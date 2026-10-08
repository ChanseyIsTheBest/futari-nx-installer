// Builds the shader library from a disc image (or an extracted game folder) in Node, with the same code as the page,
// and prints the fingerprints the build's entry in release/manifest.json needs. With a reference library
// (futari_shaders.mesp, e.g. the one tools/build_shader_library.sh of futari-nx made) it also says whether the page's
// is byte for byte the same.
// Usage: node test/library_node.mjs <disc image or game folder> [reference futari_shaders.mesp] [--out <folder>]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chosenOnDisk, loadModules, root } from './node_files.mjs';
import { findGame, lzxStep } from '../lib/installer.js';
import { readXexImage } from '../lib/xex.js';
import { buildShaderLibrary, containersFingerprint, shaderContainers } from '../lib/shaders.js';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
const [input, reference] = args;
const sha = (b) => createHash('sha256').update(b).digest('hex');
const started = Date.now();

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release/manifest.json'), 'utf8'));
const recipe = manifest.builds[0].shaders;
const { game } = await findGame(chosenOnDisk([input]));
const modules = await loadModules();
const lzx = lzxStep(modules.lzx);
const xexFile = game.files.find((f) => f.path.toLowerCase() === 'default.xex');
const xex = await xexFile.read(0, xexFile.size);
const images = [(await readXexImage(xex, lzx)).image];
console.log(`default.xex SHA-256 ${sha(xex)}; image ${images[0].length} bytes`);
const cores = game.files.filter((f) => /^media\/module\/[^/]+\.xex$/i.test(f.path))
  .sort((a, b) => (a.path.toLowerCase() < b.path.toLowerCase() ? -1 : 1));
for (const core of cores) {
  images.push((await readXexImage(await core.read(0, core.size), lzx)).image);
}
console.log(`${cores.length} game cores; ${game.files.length} game files, ${game.files.reduce((s, f) => s + f.size, 0)} bytes`);

const containers = await shaderContainers(recipe, images);
console.log(`${containers.length} containers, fingerprint ${await containersFingerprint(containers)}`);
const shaderCommon = new Uint8Array(fs.readFileSync(path.join(root, 'shader_common.h')));
const { library, index } = await buildShaderLibrary(containers, modules, shaderCommon, (t) => console.log(t));
console.log(`library ${library.length} bytes, SHA-256 ${sha(library)}`);
console.log(`index ${index.length} bytes, SHA-256 ${sha(index)}`);
if (reference) {
  const ref = fs.readFileSync(reference);
  const refIndex = fs.existsSync(reference + '.idx') ? fs.readFileSync(reference + '.idx') : null;
  console.log(`reference ${ref.length} bytes, SHA-256 ${sha(ref)}: ${Buffer.compare(ref, Buffer.from(library)) === 0 ? 'IDENTICAL' : 'different'}` +
    (refIndex ? `; index ${Buffer.compare(refIndex, Buffer.from(index)) === 0 ? 'IDENTICAL' : 'different'}` : ''));
}
if (out) {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'futari_shaders.mesp'), library);
  fs.writeFileSync(path.join(out, 'futari_shaders.mesp.idx'), index);
  for (const sub of ['in', 'hlsl', 'spirv']) {
    fs.mkdirSync(path.join(out, sub), { recursive: true });
  }
  for (const c of containers) {
    const stem = c.name.slice(0, -4);
    fs.writeFileSync(path.join(out, 'in', c.name), c.bytes);
    fs.writeFileSync(path.join(out, 'hlsl', `${stem}.hlsl`), modules.hlsl.FS.readFile(`/out/${stem}.hlsl`));
    fs.writeFileSync(path.join(out, 'spirv', `${stem}.spv`), modules.pack.FS.readFile(`/spirv/${stem}.spv`));
  }
  console.log(`written to ${out}`);
}
console.log(`${((Date.now() - started) / 1000).toFixed(1)} s`);
