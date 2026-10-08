// Updates the build's entry of release/manifest.json for a new release of futari-nx: the NRO's SHA-256 and size, and
// the fingerprints of the game and of the shader library made from your copy with the page's own code.
// The shader recipe ("shaders": the number of game cores and the template container of each stage) is kept as it is.
// Check first that the NRO was tested with that library (a PC run with that futari_shaders.mesp next to futari.exe).
// Usage: node test/release_node.mjs <disc image or game folder> <futari.nro> [--version <x.y.z>] [--write]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chosenOnDisk, loadModules, root } from './node_files.mjs';
import { findGame, identifyGame, lzxStep } from '../lib/installer.js';
import { readXexImage } from '../lib/xex.js';
import { buildShaderLibrary, containersFingerprint, shaderContainers } from '../lib/shaders.js';

const args = process.argv.slice(2);
const write = args.includes('--write');
const versionAt = args.indexOf('--version');
const version = versionAt >= 0 ? args.splice(versionAt, 2)[1] : null;
const [input, nroPath] = args.filter((a) => a !== '--write');
if (!input || !nroPath) {
  console.error('usage: node test/release_node.mjs <disc image or game folder> <futari.nro> [--version <x.y.z>] [--write]');
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
build.shaders.cores = cores.length;

const containers = await shaderContainers(build.shaders, images);
build.shaders.containers_sha256 = await containersFingerprint(containers);
const shaderCommon = new Uint8Array(fs.readFileSync(path.join(root, 'shader_common.h')));
const { library, index } = await buildShaderLibrary(containers, modules, shaderCommon);
build.library_sha256 = sha(library);
build.library_size = library.length;
build.index_sha256 = sha(index);
build.index_size = index.length;

build.game_files = game.files.length;
build.game_bytes = game.files.reduce((sum, f) => sum + f.size, 0);

const nro = fs.readFileSync(nroPath);
build.nro_sha256 = sha(nro);
build.nro_size = nro.length;
if (version) {
  build.version = version;
}

const old = JSON.parse(before);
for (const key of Object.keys(build)) {
  const a = JSON.stringify(old[key]);
  const b = JSON.stringify(build[key]);
  if (a !== b) {
    console.log(`${key}: ${a} -> ${b}`);
  }
}
if (write) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.copyFileSync(nroPath, path.join(root, 'release', build.nro));
  fs.writeFileSync(path.join(root, 'release', 'futari_shaders.mesp'), library);
  fs.writeFileSync(path.join(root, 'release', 'futari_shaders.mesp.idx'), index);
  console.log(`written: release/manifest.json; ${nroPath} copied to release/${build.nro} and the library to ` +
    'release/futari_shaders.mesp(.idx) for local tests (neither is committed)');
} else {
  console.log('(dry run: add --write to save)');
}
