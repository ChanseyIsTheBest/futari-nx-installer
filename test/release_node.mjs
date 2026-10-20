// Updates the build's entry of release/manifest.json for a new release of futari-nx: the NRO's SHA-256 and size, and
// the fingerprints of the game and of the shaders made from your copy with the page's own code.
//   - the shader library of 1.0.0's renderer (futari_shaders.mesp): its recipe ("shaders": the number of game cores
//     and the template container of each stage) is kept as it is; --no-library: a build without it
//     ("shader_library": false: 1.0.1 on, whose NRO links no Vulkan driver and so no renderer that reads it);
//   - --deko3d: the deko3d renderer's deko3d_glsl.bin (1.0.1 on: the NRO carries no game shader and reads it beside
//     itself): the "deko3d" entry (the shaders, their containers' SHA-256, the package's), made by lib/deko3d.js;
//     --deko3d-tested <deko3d_glsl.bin> also checks that the page makes that tested file byte for byte.
// Check first that the NRO was tested with those shaders (a run with them next to the NRO).
// Usage: node test/release_node.mjs <disc image or game folder> <futari.nro> [--version <x.y.z>] [--no-library]
//        [--deko3d] [--deko3d-tested <deko3d_glsl.bin>] [--write]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chosenOnDisk, loadModules, root } from './node_files.mjs';
import { findGame, identifyGame, lzxStep } from '../lib/installer.js';
import { readXexImage } from '../lib/xex.js';
import { buildShaderLibrary, containersFingerprint, imageContainers, shaderContainers } from '../lib/shaders.js';
import { buildDeko3dPackage } from '../lib/deko3d.js';

const args = process.argv.slice(2);
const take = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args.splice(at, 2)[1] : null;
};
const has = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? (args.splice(at, 1), true) : false;
};
const version = take('--version');
const testedPath = take('--deko3d-tested');
const write = has('--write');
const noLibrary = has('--no-library');
const withDeko3d = has('--deko3d') || Boolean(testedPath);
const [input, nroPath] = args;
if (!input || !nroPath) {
  console.error('usage: node test/release_node.mjs <disc image or game folder> <futari.nro> [--version <x.y.z>] ' +
    '[--no-library] [--deko3d] [--deko3d-tested <deko3d_glsl.bin>] [--write]');
  process.exit(1);
}
const sha = (b) => createHash('sha256').update(b).digest('hex');
const manifestPath = path.join(root, 'release/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const build = manifest.builds[0];
const before = JSON.stringify(build);

const { game } = await findGame(chosenOnDisk([input]));
if (!game) {
  throw new Error(`no game in ${input}`);
}
const modules = await loadModules();
const lzx = lzxStep(modules.lzx);
const { xex, xexHash } = await identifyGame(game.files, { builds: [] });
build.xex_sha256 = xexHash;
const images = [(await readXexImage(xex, lzx)).image];
const cores = game.files.filter((f) => /^media\/module\/[^/]+\.xex$/i.test(f.path))
  .sort((a, b) => (a.path.toLowerCase() < b.path.toLowerCase() ? -1 : 1));
for (const core of cores) {
  images.push((await readXexImage(await core.read(0, core.size), lzx)).image);
}

let library = null;
let index = null;
if (noLibrary) {
  build.shader_library = false;
  for (const key of ['library_sha256', 'library_size', 'index_sha256', 'index_size', 'shaders']) {
    delete build[key];
  }
} else {
  delete build.shader_library;
  build.shaders.cores = cores.length;
  const containers = await shaderContainers(build.shaders, images);
  build.shaders.containers_sha256 = await containersFingerprint(containers);
  const shaderCommon = new Uint8Array(fs.readFileSync(path.join(root, 'shader_common.h')));
  ({ library, index } = await buildShaderLibrary(containers, modules, shaderCommon));
  build.library_sha256 = sha(library);
  build.library_size = library.length;
  build.index_sha256 = sha(index);
  build.index_size = index.length;
}

let deko3d = null;
if (withDeko3d) {
  const unique = [];
  const seen = new Set();
  for (const image of images) {
    for (const c of imageContainers(image)) {
      const h = sha(c.bytes);
      if (!seen.has(h)) {
        seen.add(h);
        unique.push(c);
      }
    }
  }
  const common = fs.readFileSync(path.join(root, 'renut_shader_common.h'));
  const { package: pkg, shaders } = await buildDeko3dPackage(unique, null, modules, common);
  if (testedPath && sha(fs.readFileSync(testedPath)) !== sha(pkg)) {
    throw new Error(`the page's deko3d_glsl.bin (${sha(pkg)}) is not the tested one (${testedPath})`);
  }
  deko3d = pkg;
  build.deko3d = {
    cores: cores.length,
    shaders: shaders.map((s) => s.name),
    containers_sha256: [...new Set(shaders.map((s) => sha(unique[s.container].bytes)))].sort(),
    package_sha256: sha(pkg),
    package_size: pkg.length,
  };
} else {
  delete build.deko3d;
}

build.game_files = game.files.length;
build.game_bytes = game.files.reduce((sum, f) => sum + f.size, 0);

const nro = fs.readFileSync(nroPath);
build.nro_sha256 = sha(nro);
build.nro_size = nro.length;
if (version) {
  build.version = version;
}

const old = JSON.parse(before);
for (const key of new Set([...Object.keys(old), ...Object.keys(build)])) {
  const a = JSON.stringify(old[key]);
  const b = JSON.stringify(build[key]);
  if (a !== b) {
    console.log(`${key}: ${a && a.length > 120 ? a.slice(0, 117) + '...' : a} -> ` +
      `${b && b.length > 120 ? b.slice(0, 117) + '...' : b}`);
  }
}
if (write) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.copyFileSync(nroPath, path.join(root, 'release', build.nro));
  const written = [`${nroPath} copied to release/${build.nro}`];
  if (library) {
    fs.writeFileSync(path.join(root, 'release', 'futari_shaders.mesp'), library);
    fs.writeFileSync(path.join(root, 'release', 'futari_shaders.mesp.idx'), index);
    written.push('the library to release/futari_shaders.mesp(.idx)');
  }
  if (deko3d) {
    fs.writeFileSync(path.join(root, 'release', 'deko3d_glsl.bin'), deko3d);
    written.push('the deko3d shaders to release/deko3d_glsl.bin');
  }
  console.log(`written: release/manifest.json; ${written.join(', ')} for local tests (none of them is committed)`);
} else {
  console.log('(dry run: add --write to save)');
}
