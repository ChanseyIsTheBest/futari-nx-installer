// Builds the futari-nx.zip package from the player's own copy of the game.
//
// The game comes as a disc image (read in place, nothing is extracted to disk) or as a folder it was extracted into.
// The zip holds the Switch build (futari.nro) and its licenses, the shaders made from the game's own executables
// (deko3d_glsl.bin for the deko3d renderer of 1.0.1 on, the shader library futari_shaders.mesp for 1.0.0's renderer),
// the game files (game_root/, as on the disc) and, when chosen, the Black Label and Ver 1.01 DLC (as package files or
// as unpacked folders; the game installs them from dlc/ at its first start). The settings file, futari.toml, is
// written by the game at its first start, so an update never replaces the player's settings.

import { readXexImage } from './xex.js';
import { CONTENT_DLC, readStfsHeader } from './stfs.js';
import { buildShaderLibrary, containersFingerprint, imageContainers, sha256, shaderContainers } from './shaders.js';
import { buildDeko3dPackage } from './deko3d.js';
import { listFiles } from './xdvdfs.js';
import { ZipWriter, zipSize } from './zip.js';
import { t } from './i18n.js';

const CHUNK = 16 * 1024 * 1024;
const ROOT = 'futari-nx';
const TITLE_ID = 0x435a07d7;
// files whose header is read to find the DLC packages in a chosen folder (packages have no extension)
const MAX_CANDIDATES = 256;
// the disc's console system update: not part of the game
const NOT_GAME = /^\$systemupdate\//i;

async function* chunksOf(file) {
  for (let offset = 0; offset < file.size; offset += CHUNK) {
    yield await file.read(offset, Math.min(CHUNK, file.size - offset));
  }
}

function baseName(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function isPackageName(name) {
  return /^[0-9A-Fa-f]{40,42}$/.test(name);
}

// The LZX step of readXexImage, done by libmspack compiled to WebAssembly.
export function lzxStep(lzx) {
  return async (compressed, bits, size) => {
    lzx.FS.writeFile('/image.lzx', compressed);
    const rc = lzx.callMain(['/image.lzx', '/image.bin', String(bits), String(size)]);
    if (rc) {
      throw new Error(`LZX decompression failed (${rc})`);
    }
    const out = lzx.FS.readFile('/image.bin');
    lzx.FS.unlink('/image.lzx');
    lzx.FS.unlink('/image.bin');
    return out;
  };
}

// Where the program is downloaded from. Its SHA-256 is part of the address, so every version is a different address
// and a copy kept by the browser is never mistaken for a newer one.
export function programPath(build) {
  return `./release/${build.nro}?sha256=${build.nro_sha256}`;
}

// The game's files without what is not part of the game, sorted by path.
function gameFiles(files) {
  return files.filter((f) => !NOT_GAME.test(f.path)).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

// An unpacked DLC package: a folder named like a package that holds Black Label's Rom/cg_black.bin or the Ver 1.01
// key, wherever it is among the chosen files.
function unpackedDlc(files) {
  const packages = new Map();
  for (const f of files) {
    const parts = f.path.split('/');
    const lower = f.path.toLowerCase();
    const marker = lower.endsWith('/rom/cg_black.bin') ? 3 : lower.endsWith('/ver101_key.bin') ? 2 : 0;
    if (!marker || parts.length < marker) {
      continue;
    }
    const name = parts[parts.length - marker];
    if (!isPackageName(name)) {
      continue;
    }
    const prefix = parts.slice(0, parts.length - marker + 1).join('/') + '/';
    if (!packages.has(name)) {
      const originals = files.filter((g) => g.path.startsWith(prefix));
      const inside = originals.map((g) => ({ ...g, path: g.path.slice(prefix.length) }));
      packages.set(name, {
        kind: 'folder', name, size: inside.reduce((sum, g) => sum + g.size, 0), files: inside, originals,
      });
    }
  }
  return [...packages.values()];
}

// Sorts out what the player chose: files ([{ path, size, read }]) from the "Disc image" button (the chosen files) or
// from the "Folder" button (every file under the folder, path relative to it).
// Returns { game, dlc, others }: game = { kind: 'image' | 'folder', name, size, files } or null; dlc = the DLC packages
// ([{ kind: 'package', name, size, read } or { kind: 'folder', name, size, files }]); others = the names of content
// packages of other games.
export async function findGame(chosen) {
  // The DLC first, wherever it is in what was chosen (also inside the game folder): unpacked packages by their files,
  // package files by their header (content type 2 of this game; the disc's own packages, AvatarAssetPack and nxeart,
  // have other content types and stay game files).
  const dlc = unpackedDlc(chosen);
  const taken = new Set(dlc.flatMap((d) => d.originals));
  const others = [];
  const candidates = chosen
    .filter((f) => !taken.has(f) && f.size >= 0xa000 && !baseName(f.path).includes('.'))
    .slice(0, MAX_CANDIDATES);
  for (const file of candidates) {
    const header = readStfsHeader(await file.read(0, 0x600));
    if (!header) {
      continue;
    }
    const name = baseName(file.path);
    if (header.titleId !== TITLE_ID) {
      if (baseName(file.path) !== 'AvatarAssetPack') {
        others.push(header.displayName || name);
      }
    } else if (header.contentType === CONTENT_DLC && !dlc.some((d) => d.name === name)) {
      dlc.push({ kind: 'package', name, size: file.size, read: file.read, path: file.path });
      taken.add(file);
    }
  }
  const rest = chosen.filter((f) => !taken.has(f));
  let game = null;
  // A disc image: the first large file that holds an XDVDFS game partition with a default.xex.
  for (const file of rest.filter((f) => f.size >= 64 * 1024 * 1024).sort((a, b) => b.size - a.size)) {
    let files = null;
    try {
      files = await listFiles(file);
    } catch {
      files = null;
    }
    if (files && files.some((f) => f.path.toLowerCase() === 'default.xex')) {
      const kept = gameFiles(files);
      game = { kind: 'image', name: baseName(file.path), size: kept.reduce((sum, f) => sum + f.size, 0), files: kept };
      break;
    }
  }
  // An extracted game: the shallowest default.xex names its folder, and every file in that folder is a game file.
  if (!game) {
    const executables = rest
      .filter((f) => baseName(f.path).toLowerCase() === 'default.xex')
      .sort((a, b) => a.path.split('/').length - b.path.split('/').length);
    if (executables.length) {
      const prefix = executables[0].path.slice(0, -'default.xex'.length);
      const files = gameFiles(rest
        .filter((f) => f.path.startsWith(prefix))
        .map((f) => ({ ...f, path: f.path.slice(prefix.length) })));
      game = {
        kind: 'folder',
        name: prefix ? baseName(prefix.slice(0, -1)) : '',
        size: files.reduce((sum, f) => sum + f.size, 0),
        files,
      };
    }
  }
  return { game, dlc: dlc.map(({ originals, ...d }) => d), others };
}

// Identifies the build of this game by the SHA-256 of default.xex. Returns { xex, xexHash, build (null when none) }.
export async function identifyGame(files, manifest) {
  const xexFile = files.find((f) => f.path.toLowerCase() === 'default.xex');
  if (!xexFile) {
    const error = new Error(t('noGame'));
    error.code = 'noGame';
    throw error;
  }
  const xex = await xexFile.read(0, xexFile.size);
  const xexHash = await sha256(xex);
  const build = manifest.builds.find((b) => b.xex_sha256 === xexHash) || null;
  return { xex, xexHash, build };
}

// The decompressed images of default.xex and of the game cores (media/Module/*.xex, sorted by name).
async function gameImages(files, xex, lzx) {
  const images = [(await readXexImage(xex, lzx)).image];
  const cores = files
    .filter((f) => /^media\/module\/[^/]+\.xex$/i.test(f.path))
    .sort((a, b) => (a.path.toLowerCase() < b.path.toLowerCase() ? -1 : 1));
  for (const core of cores) {
    images.push((await readXexImage(await core.read(0, core.size), lzx)).image);
  }
  return images;
}

// The shader library of a build, made from the game's executables and checked against the tested one.
// Returns { library, index }.
export async function makeShaderLibrary(files, xex, build, modules, shaderCommon, log = () => {}) {
  const images = await gameImages(files, xex, lzxStep(modules.lzx));
  if (images.length - 1 !== build.shaders.cores) {
    throw new Error(t('incompleteError', { count: images.length - 1, expected: build.shaders.cores }));
  }
  const containers = await shaderContainers(build.shaders, images);
  log(t('foundShaders', { count: containers.length }));
  if ((await containersFingerprint(containers)) !== build.shaders.containers_sha256) {
    throw new Error(t('containersMismatch'));
  }
  const { library, index } = await buildShaderLibrary(containers, modules, shaderCommon, log);
  const libraryHash = await sha256(library);
  if (libraryHash !== build.library_sha256 || (await sha256(index)) !== build.index_sha256) {
    throw new Error(t('libraryMismatch', { hash: libraryHash }));
  }
  log(t('libraryReady'));
  return { library, index };
}

// The shaders of the Switch build's renderer (Renut on deko3d, futari-nx 1.0.1): deko3d_glsl.bin, which the NRO
// reads beside itself, made from the containers stored in the game's executables (lib/deko3d.js) and checked against
// the build's manifest entry ("deko3d": { cores, shaders: [names], containers_sha256: [...], package_sha256 }). null
// for a build without that entry. modules: { lzx, renutHlsl, dxc, spirvCross }; renutCommon: Renut's shader_common.h.
export async function makeDeko3dPackage(files, xex, build, modules, renutCommon, log = () => {}) {
  if (!build.deko3d) {
    return null;
  }
  const images = await gameImages(files, xex, lzxStep(modules.lzx));
  if (images.length - 1 !== build.deko3d.cores) {
    throw new Error(t('incompleteError', { count: images.length - 1, expected: build.deko3d.cores }));
  }
  const wanted = build.deko3d.containers_sha256;
  const containers = [];
  const seen = new Set();
  for (const image of images) {
    for (const c of imageContainers(image)) {
      const hash = await sha256(c.bytes);
      if (wanted.includes(hash) && !seen.has(hash)) {
        seen.add(hash);
        containers.push(c);
      }
    }
  }
  if (seen.size !== wanted.length) {
    throw new Error(t('deko3dContainers', { found: seen.size, wanted: wanted.length }));
  }
  log(t('deko3dShaders', { count: build.deko3d.shaders.length }));
  const { package: pkg } = await buildDeko3dPackage(containers, build.deko3d.shaders, modules, renutCommon, log);
  const hash = await sha256(pkg);
  if (hash !== build.deko3d.package_sha256) {
    throw new Error(t('deko3dMismatch', { hash }));
  }
  log(t('deko3dReady'));
  return pkg;
}

// The zip entries of a DLC package: a package file goes to dlc/<name>, an unpacked package to dlc/00000002/<name>/.
function dlcEntries(d) {
  if (d.kind === 'package') {
    return [{ path: `${ROOT}/dlc/${d.name}`, file: d }];
  }
  return d.files.map((f) => ({ path: `${ROOT}/dlc/00000002/${d.name}/${f.path}`, file: f }));
}

// chosen: findGame(); release: { manifest, nro: Uint8Array, licenses: Uint8Array (release/LICENSES.txt),
// shaderCommon: Uint8Array (the native library's translator header, for a build with a library), renutShaderCommon:
// Uint8Array (Renut's, for a build with a "deko3d" entry) }
// modules: { hlsl, dxc, pack, lzx, renutHlsl, spirvCross } instantiated Emscripten modules (one object each; hlsl and
// pack only for a build with a library, renutHlsl and spirvCross only for one with a "deko3d" entry)
// sink: { write(Uint8Array), close() } receiving the zip file
// onSize(bytes) is called with the exact size of the zip before the first byte is written.
// update: only the program, its licenses and the shaders (and the DLC when chosen), for a folder already on the SD
// card. A build whose entry says "shader_library": false (1.0.1 on: the NRO has no renderer that reads it) gets none.
export async function createPackage(chosen, release, modules, sink, log = () => {}, progress = () => {},
  onSize = () => {}, { update = false } = {}) {
  const { game, dlc } = chosen;
  if (!game) {
    throw new Error(t('noGame'));
  }
  const { xex, xexHash, build } = await identifyGame(game.files, release.manifest);
  if (!build) {
    throw new Error(t('notSupportedYet', { hash: xexHash }));
  }
  log(t('logBuild', { version: build.version }));
  if (update) {
    log(t('logUpdate'));
  }
  for (const d of dlc) {
    log(t('logDlc', { name: d.name }));
  }

  // a folder the game was only partly extracted into would make a package that does not start
  if (!update && game.files.length < build.game_files) {
    throw new Error(t('incompleteError', { count: game.files.length, expected: build.game_files }));
  }

  // The shaders first: they are the step most likely to stop the package, and nothing is written before them.
  const withLibrary = build.shader_library !== false;
  const { library, index } = withLibrary
    ? await makeShaderLibrary(game.files, xex, build, modules, release.shaderCommon, log)
    : {};
  const deko3d = await makeDeko3dPackage(game.files, xex, build, modules, release.renutShaderCommon, log);

  const gameEntries = update ? [] : game.files.map((f) => ({ path: `${ROOT}/game_root/${f.path}`, file: f }));
  const dlcFiles = dlc.flatMap(dlcEntries);
  const total = [...gameEntries, ...dlcFiles].reduce((sum, e) => sum + e.file.size, 0) || 1;
  let done = 0;
  const onChunk = (chunk) => {
    done += chunk.length;
    progress(done / total);
  };
  if (!update) {
    const bytes = game.files.reduce((sum, f) => sum + f.size, 0);
    log(t(game.files.length === build.game_files && bytes === build.game_bytes ? 'gameIdentical' : 'gameDifferent'));
  }

  const entries = [
    { path: `${ROOT}/futari.nro`, size: release.nro.length },
    { path: `${ROOT}/LICENSES.txt`, size: release.licenses.length },
    ...(withLibrary ? [{ path: `${ROOT}/futari_shaders.mesp`, size: library.length },
      { path: `${ROOT}/futari_shaders.mesp.idx`, size: index.length }] : []),
    ...(deko3d ? [{ path: `${ROOT}/deko3d_glsl.bin`, size: deko3d.length }] : []),
    ...gameEntries.map((e) => ({ path: e.path, size: e.file.size })),
    ...dlcFiles.map((e) => ({ path: e.path, size: e.file.size })),
  ];
  onSize(zipSize(entries));
  log(t('packing'));
  const zip = new ZipWriter(sink);
  await zip.addBytes(`${ROOT}/futari.nro`, release.nro);
  await zip.addBytes(`${ROOT}/LICENSES.txt`, release.licenses);
  if (withLibrary) {
    await zip.addBytes(`${ROOT}/futari_shaders.mesp`, library);
    await zip.addBytes(`${ROOT}/futari_shaders.mesp.idx`, index);
  }
  if (deko3d) {
    await zip.addBytes(`${ROOT}/deko3d_glsl.bin`, deko3d);
  }
  for (const e of [...gameEntries, ...dlcFiles]) {
    await zip.addFile(e.path, e.file.size, chunksOf(e.file), onChunk);
  }
  await zip.finish();
  progress(1);
  log(t('done'));
  return { version: build.version, dlc: dlc.length, update };
}
