// Checks lib/early_alpha.js against futari-nx's tools/renut_early_alpha.py: every ps_*.hlsl of <orig dir> (Renut's
// translator's HLSL before the step: BANJO_HLSL_DUMP_ONLY=1 XenosRecomp <dump> <cpp> <shader_common.h> <orig dir>, as
// gpu.cmake runs it) through renutEarlyAlpha() must be, byte for byte, the file the Python tool left in <expected dir>
// (a copy of <orig dir> after `python tools/renut_early_alpha.py <expected dir>`), and when the tool's report
// (<expected dir>/../renut_early_alpha.txt) is there, its line for the shader too.
// Usage: node test/early_alpha_node.mjs <orig dir> <expected dir>
import fs from 'node:fs';
import path from 'node:path';
import { formatInfo, renutEarlyAlpha } from '../lib/early_alpha.js';

const [origDir, expectedDir] = process.argv.slice(2);
if (!origDir || !expectedDir) {
  console.error('usage: node test/early_alpha_node.mjs <orig dir> <expected dir>');
  process.exit(1);
}

const report = new Map();
const reportPath = path.join(expectedDir, '..', 'renut_early_alpha.txt');
if (fs.existsSync(reportPath)) {
  for (const line of fs.readFileSync(reportPath, 'utf8').split(/\r?\n/)) {  // written in text mode: CRLF on Windows
    if (line) report.set(line.slice(0, line.indexOf(' ')), line);
  }
}

function firstDifference(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) return `line ${i + 1}: ${JSON.stringify(la[i] ?? null)} vs ${JSON.stringify(lb[i] ?? null)}`;
  }
  return 'same lines, different bytes';
}

const names = fs.readdirSync(origDir).filter((f) => /^ps_.*\.hlsl$/.test(f)).sort();
const statuses = {};
let identical = 0;
let reported = 0;
let reportSame = 0;
const started = Date.now();
for (const file of names) {
  const name = file.slice(0, -5);
  const expectedPath = path.join(expectedDir, file);
  const result = renutEarlyAlpha(file, fs.readFileSync(path.join(origDir, file), 'utf8'));
  statuses[result.status] = (statuses[result.status] ?? 0) + 1;
  const problems = [];
  if (!fs.existsSync(expectedPath)) {
    problems.push('no expected file');
  } else {
    const expected = fs.readFileSync(expectedPath);
    if (Buffer.from(result.hlsl, 'utf8').equals(expected)) {
      identical++;
    } else {
      problems.push('text differs, ' + firstDifference(result.hlsl, expected.toString('utf8')));
    }
  }
  const line = `${name} ${result.status} ${formatInfo(result.info)}`;
  if (report.has(name)) {
    reported++;
    if (report.get(name) === line) {
      reportSame++;
    } else {
      problems.push(`report differs: ${report.get(name)}`);
    }
  }
  console.log(`${problems.length ? 'MISMATCH' : 'ok      '} ${line}${problems.map((p) => '\n         ' + p).join('')}`);
}
const counts = Object.entries(statuses).sort().map(([k, v]) => `${k} ${v}`).join(', ');
console.log(`\n${identical} of ${names.length} identical (${counts}); report lines: ${reportSame} of ${reported} the same` +
  `${report.size ? '' : ' (no report beside the expected folder)'}; ${((Date.now() - started) / 1000).toFixed(1)} s`);
process.exit(identical === names.length && reportSame === reported && names.length ? 0 : 1);
