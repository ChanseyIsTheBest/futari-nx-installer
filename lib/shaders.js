// Builds futari_shaders.mesp + futari_shaders.mesp.idx, the shader library of the Switch build, from the player's own
// game files, entirely in the browser (or Node). The same steps as futari-nx's tools: the containers come out of the
// game's executables (tools/extract_shaders.py, tools/sweep_raw_shaders.py, tools/wrap_discovered.py), then every one
// is translated to HLSL (XenosRecomp), compiled to SPIR-V (DXC) and packed (tools/build_shader_library.sh). The result
// must match, byte for byte, the library the NRO was tested with (its SHA-256 is in release/manifest.json).
//
// Mushihimesama Futari keeps all its shaders inside its executables, default.xex and the eight game cores of
// media/Module (no shader files):
//  - Direct3D shader containers in their data (default.xex 22 + 22, every core 2 + 2);
//  - a block of raw microcode near the start of .rdata, loaded with IM_LOAD_IMMEDIATE: Direct3D's own shaders (clear,
//    gamma...) and some of the game's. The ones no container holds are wrapped in a register-linked container made from
//    a template container of the same stage (which template is part of the build's entry in the manifest).

import { t } from './i18n.js';

function be32(data, offset) {
  return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

function setBe32(data, offset, value) {
  data[offset] = value >>> 24;
  data[offset + 1] = (value >>> 16) & 0xff;
  data[offset + 2] = (value >>> 8) & 0xff;
  data[offset + 3] = value & 0xff;
}

export async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isContainer(bytes) {
  return bytes.length >= 36 && (be32(bytes, 0) & 0xffffff00) >>> 0 === 0x102a1100;
}

function sameBytes(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

// Whether `needle` occurs in `haystack`.
function contains(haystack, needle) {
  if (!needle.length || needle.length > haystack.length) {
    return false;
  }
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

// tools/extract_shaders.py: the XDK 2.0.9328 containers in an image (+0 magic 0x102A1101 vertex / 0x102A1100 pixel,
// +4 header size, +8 microcode size), word aligned.
export function imageContainers(image) {
  const found = [];
  for (let off = 0; off < image.length - 12; off += 4) {
    const magic = be32(image, off);
    if (magic !== 0x102a1101 && magic !== 0x102a1100) {
      continue;
    }
    const header = be32(image, off + 4);
    const ucode = be32(image, off + 8);
    if (header < 12 || header > 1 << 16 || ucode === 0 || ucode > 1 << 20 || ucode % 4) {
      continue;
    }
    if (off + header + ucode > image.length) {
      continue;
    }
    found.push({ stage: magic === 0x102a1101 ? 'vs' : 'ps', bytes: image.slice(off, off + header + ucode) });
  }
  return found;
}

// tools/sweep_raw_shaders.py: the raw programs packed back to back near the start of .rdata, each followed by one zero
// instruction (the immediate load takes it too: (instructions + 1) * 3 words). A program is recognised by its control
// flow alone: the first exec starts right after the control-flow triples, the execs cover the instructions back to
// back, the last one ends the program, only exec / alloc / nop opcodes and at least one alloc. A vertex shader
// allocates the position (alloc type 1), a pixel shader never does.
const EXEC_OPS = new Set([1, 2, 3, 4, 5, 6, 13, 14]);
const END_OPS = new Set([2, 4, 6, 14]);
const ALLOC = 12;
const NOP = 0;
const MAX_CF_TRIPLES = 16;
const MAX_INSTRUCTIONS = 256;

function cfPair(w0, w1, w2) {
  const a = BigInt(w0) | (BigInt(w1 & 0xffff) << 32n);
  const b = BigInt(w1 >>> 16) | (BigInt(w2) << 16n);
  return [a, b];
}

function field(cf, shift, mask) {
  return Number((cf >> BigInt(shift)) & BigInt(mask));
}

function parseRaw(words, start) {
  const cfs = [];
  let triples = 0;
  let ended = false;
  while (triples < MAX_CF_TRIPLES && !ended) {
    const i = start + triples * 3;
    if (i + 3 > words.length) {
      return null;
    }
    for (const cf of cfPair(words[i], words[i + 1], words[i + 2])) {
      cfs.push(cf);
      if (END_OPS.has(field(cf, 44, 0xf))) {
        ended = true;
        break;
      }
    }
    triples++;
  }
  if (!ended) {
    return null;
  }
  let expected = triples;
  const allocs = [];
  for (const cf of cfs) {
    const op = field(cf, 44, 0xf);
    if (EXEC_OPS.has(op)) {
      const address = field(cf, 0, 0xfff);
      const count = field(cf, 12, 0x7);
      if (address !== expected || count === 0) {
        return null;
      }
      expected += count;
    } else if (op === ALLOC) {
      allocs.push(field(cf, 41, 0x3));
    } else if (op !== NOP || cf !== 0n) {
      return null;
    }
  }
  if (!allocs.length || expected > MAX_INSTRUCTIONS || expected === triples) {
    return null;
  }
  return { instructions: expected, stage: allocs.includes(1) ? 'vs' : 'ps' };
}

export function rawShaders(image, limit = 0x10000) {
  const data = image.subarray(0, Math.min(limit, image.length));
  const words = new Array(data.length >>> 2);
  for (let i = 0; i < words.length; i++) {
    words[i] = be32(data, i * 4);
  }
  const found = [];
  let i = 0;
  while (i < words.length) {
    // a program starts after zeros (padding of the previous one) or at an exec / alloc triple
    if (words[i] === 0 && (i + 1 >= words.length || words[i + 1] >>> 16 === 0)) {
      i++;
      continue;
    }
    const r = parseRaw(words, i);
    if (!r) {
      i++;
      continue;
    }
    const n = (r.instructions + 1) * 3;
    const body = words.slice(i, i + n);
    if (body.length !== n || body.slice(r.instructions * 3).some((w) => w !== 0)) {
      i++; // the padding instruction must be zero, otherwise this is not a packed raw program
      continue;
    }
    found.push({ stage: r.stage, bytes: data.slice(i * 4, (i + n) * 4) });
    i += r.instructions * 3;
  }
  return found;
}

// tools/wrap_discovered.py (banjo-nx): the bit mask of a pixel shader's exports (bits 0..3 colour targets, bit 4 depth
// = export register 61), found by walking the exec clauses.
export function pixelExports(raw) {
  const w = [];
  for (let i = 0; i + 4 <= raw.length; i += 4) {
    w.push(be32(raw, i));
  }
  let mask = 0;
  let end = Math.floor(w.length / 3);
  let pair = 0;
  while (pair < end && pair * 3 + 2 < w.length) {
    for (const c of cfPair(w[pair * 3], w[pair * 3 + 1], w[pair * 3 + 2])) {
      const opcode = field(c, 44, 0xf);
      if (!((opcode >= 1 && opcode <= 6) || opcode === 13 || opcode === 14)) {
        continue;
      }
      const address = field(c, 0, 0xfff);
      const count = field(c, 12, 0x7);
      const sequence = field(c, 16, 0xfff);
      if (address) {
        end = Math.min(end, address);
      }
      for (let i = 0; i < count; i++) {
        const index = address + i;
        if ((sequence >> (i * 2)) & 1 || index * 3 + 2 >= w.length) {
          continue; // a fetch, or outside the program
        }
        const w0 = w[index * 3];
        if (!((w0 >>> 15) & 1)) {
          continue; // not an export
        }
        for (const [dest, write] of [[w0 & 0x3f, (w0 >>> 16) & 0xf], [(w0 >>> 8) & 0x3f, (w0 >>> 20) & 0xf]]) {
          if (!write) {
            continue;
          }
          if (dest <= 3) {
            mask |= 1 << dest;
          } else if (dest === 61) {
            mask |= 0x10;
          }
        }
      }
    }
    pair++;
  }
  return mask || 1;
}

// shaders/tools/wrap_raw_shader.py: raw microcode in a register-linked 2008 container. The template's virtual part is
// kept (its empty definitions), the shader header is rewritten to expose fetches, exports and interpolators by
// register, and the constant and definition tables are dropped. A pixel shader then declares the exports its code
// writes (tools/wrap_discovered.py).
export function wrapRawShader(raw, template, stage) {
  if (!raw.length || raw.length % 4) {
    throw new Error('raw microcode must contain whole words');
  }
  if (!isContainer(template)) {
    throw new Error('the template is not a 2008 Xenos shader container');
  }
  const shader = be32(template, 24);
  const templateVirtual = be32(template, 4);
  if (shader + (stage === 'vs' ? 36 : 32) > templateVirtual) {
    throw new Error('the template shader header is truncated');
  }
  const exports = stage === 'ps' ? pixelExports(raw) : 0;
  const virtualSize = stage === 'ps' ? Math.max(templateVirtual, shader + 32 + 16 * 4) : templateVirtual;
  const container = new Uint8Array(virtualSize + raw.length);
  container.set(template.subarray(0, Math.min(templateVirtual, template.length)), 0);
  setBe32(container, 4, virtualSize);
  setBe32(container, 8, raw.length);
  setBe32(container, shader, 0);
  setBe32(container, shader + 4, raw.length);
  setBe32(container, shader + 20, stage === 'ps' ? 16 << 5 : 0);
  setBe32(container, shader + 24, 0);
  if (stage === 'vs') {
    setBe32(container, shader + 28, 0);
    setBe32(container, shader + 32, 0);
  } else {
    setBe32(container, shader + 28, exports);
    for (let register = 0; register < 16; register++) {
      setBe32(container, shader + 32 + register * 4, register << 8);
    }
  }
  container.set(raw, virtualSize);
  setBe32(container, 16, 0); // constant table
  setBe32(container, 20, 0); // definition table
  return container;
}

function physicalPart(container) {
  if (container.length < 12) {
    return new Uint8Array(0);
  }
  const virtual = be32(container, 4);
  return container.subarray(virtual, virtual + be32(container, 8));
}

// The containers of the library: [{ name, stage, bytes }], from the decompressed images (default.xex first, then the
// game cores). recipe: the build's "shaders" entry (the SHA-256 of the template container of each stage).
export async function shaderContainers(recipe, images) {
  const containers = [];
  for (const image of images) {
    for (const c of imageContainers(image)) {
      if (!containers.some((o) => sameBytes(o.bytes, c.bytes))) {
        containers.push(c);
      }
    }
  }
  const templates = {};
  for (const c of containers) {
    const hash = await sha256(c.bytes);
    for (const stage of ['vs', 'ps']) {
      if (recipe.templates[stage] === hash) {
        templates[stage] = c.bytes;
      }
    }
  }
  const raws = [];
  for (const image of images) {
    for (const r of rawShaders(image, recipe.raw_limit || 0x10000)) {
      if (!raws.some((o) => sameBytes(o.bytes, r.bytes))) {
        raws.push(r);
      }
    }
  }
  const wrapped = [];
  for (const raw of raws) {
    // a raw program a real container also holds is that container's (Direct3D rewrote it, or the game loads it both
    // ways): only Direct3D's own shaders, which have no container anywhere, are wrapped
    if (containers.some((c) => contains(physicalPart(c.bytes), raw.bytes))) {
      continue;
    }
    if (!templates[raw.stage]) {
      throw new Error(t('shaderMissing', { name: `${raw.stage} template` }));
    }
    wrapped.push({ stage: raw.stage, bytes: wrapRawShader(raw.bytes, templates[raw.stage], raw.stage) });
  }
  const all = [...containers, ...wrapped];
  return all.map((c, i) => ({ name: `${c.stage}_${String(i).padStart(3, '0')}.bin`, stage: c.stage, bytes: c.bytes }));
}

// One fingerprint for a set of containers: the SHA-256 of their sorted SHA-256s, one per line. It tells early, before
// the long compilation, whether the containers are the tested ones.
export async function containersFingerprint(containers) {
  const hashes = [];
  for (const c of containers) {
    hashes.push(await sha256(c.bytes));
  }
  return sha256(new TextEncoder().encode(hashes.sort().join('\n')));
}

// containers: shaderContainers(); modules: { hlsl, dxc, pack } instantiated Emscripten modules (one object each);
// shaderCommon: shader_common.h of the translator. Returns { library, index } (the .mesp and its .idx).
export async function buildShaderLibrary(containers, modules, shaderCommon, log = () => {}) {
  const { hlsl, dxc, pack } = modules;

  hlsl.FS.mkdirTree('/in');
  for (const c of containers) {
    hlsl.FS.writeFile(`/in/${c.name}`, c.bytes);
  }
  hlsl.FS.writeFile('/shader_common.h', shaderCommon);
  const translated = hlsl.callMain(['/in', '/out', '/shader_common.h']);
  if (translated !== 0 && translated !== undefined) {
    throw new Error(`shader translation failed (${translated})`);
  }
  log(t('translatedShaders', { count: containers.length }));

  dxc.FS.mkdirTree('/work');
  pack.FS.mkdirTree('/in');
  pack.FS.mkdirTree('/spirv');
  let done = 0;
  for (const c of containers) {
    const stem = c.name.slice(0, -4);
    const input = `/work/${stem}.hlsl`;
    const output = `/work/${stem}.spv`;
    dxc.FS.writeFile(input, hlsl.FS.readFile(`/out/${stem}.hlsl`));
    const rc = dxc.ccall('compile', 'number', ['string', 'string', 'number'], [input, output, c.stage === 'vs' ? 1 : 0]);
    if (rc !== 0) {
      throw new Error(`DXC rejected ${stem} (${rc})`);
    }
    pack.FS.writeFile(`/spirv/${stem}.spv`, dxc.FS.readFile(output));
    pack.FS.writeFile(`/in/${c.name}`, c.bytes);
    dxc.FS.unlink(input);
    dxc.FS.unlink(output);
    if (++done % 10 === 0 || done === containers.length) {
      log(t('compiled', { done, total: containers.length }));
    }
  }
  const packed = pack.callMain(['/in', '/spirv', '/futari_shaders.mesp']);
  if (packed !== 0 && packed !== undefined) {
    throw new Error(`packing failed (${packed})`);
  }
  return { library: pack.FS.readFile('/futari_shaders.mesp'), index: pack.FS.readFile('/futari_shaders.mesp.idx') };
}
