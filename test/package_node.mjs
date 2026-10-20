// Builds futari-nx.zip (or futari-nx-update.zip) in Node from the game's disc image or folder, with the same code the
// page runs. The NRO is taken from release/ (put it there first: the deployment downloads it from the futari-nx
// release).
// Usage: node test/package_node.mjs <output zip> <disc image or game folder> [<DLC package or folder> ...] [--update]
import fs from 'node:fs';
import path from 'node:path';
import { chosenOnDisk, loadModules, root } from './node_files.mjs';
import { createPackage, findGame } from '../lib/installer.js';

const args = process.argv.slice(2);
const update = args.includes('--update');
const [output, ...inputs] = args.filter((a) => a !== '--update');
if (!output || !inputs.length) {
  console.error('usage: node test/package_node.mjs <output zip> <disc image or game folder> [<DLC> ...] [--update]');
  process.exit(1);
}

const chosen = await findGame(chosenOnDisk(inputs));
if (!chosen.game) {
  throw new Error('the game was not found in ' + inputs.join(', '));
}
console.log(`game: ${chosen.game.kind} ${chosen.game.name} (${chosen.game.files.length} files); DLC: ` +
  `${chosen.dlc.map((d) => d.name).join(', ') || 'none'}`);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release/manifest.json'), 'utf8'));
const release = {
  manifest,
  nro: new Uint8Array(fs.readFileSync(path.join(root, 'release', manifest.builds[0].nro))),
  licenses: new Uint8Array(fs.readFileSync(path.join(root, 'release/LICENSES.txt'))),
  shaderCommon: new Uint8Array(fs.readFileSync(path.join(root, 'shader_common.h'))),
  // the deko3d renderer's translator header (a build with a "deko3d" entry)
  renutShaderCommon: new Uint8Array(fs.readFileSync(path.join(root, 'renut_shader_common.h'))),
};
const out = fs.openSync(output, 'w');
const sink = { write: async (b) => { fs.writeSync(out, b); }, close: async () => fs.closeSync(out) };
const started = Date.now();
let last = -1;
let size = 0;
const result = await createPackage(chosen, release, await loadModules(), sink,
  (t) => console.log(`${((Date.now() - started) / 1000).toFixed(1).padStart(6)} s  ${t}`),
  (f) => {
    const p = Math.floor(f * 10);
    if (p !== last) {
      last = p;
      console.log(`${((Date.now() - started) / 1000).toFixed(1).padStart(6)} s  ${p * 10} %`);
    }
  },
  (bytes) => { size = bytes; }, { update });
const written = fs.statSync(output).size;
console.log(JSON.stringify(result), `zip ${written} bytes (announced ${size})`, `${((Date.now() - started) / 1000).toFixed(1)} s`);
if (written !== size) {
  throw new Error('the zip does not have the announced size');
}
