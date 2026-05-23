import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerVisualProofTools } from '../src/visual-proof-tools.mjs';
import { loadProofFromFile } from '../src/visual-proof-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(repoRoot, 'examples/button-overlap-proof.json');
const testOutputRoot = path.join(repoRoot, '.visual-proof-test-output');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDefaultOutputUnderVisualProof(cwd, outDir) {
  const relative = path.relative(cwd, outDir);
  assert.ok(relative.startsWith(`.visual-proof${path.sep}`), `expected ${outDir} to be under ${cwd}/.visual-proof/`);
  const leaf = path.basename(outDir);
  assert.ok(!/^\.+$/.test(leaf), `expected default output leaf not to be dot-only: ${leaf}`);
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const registered = [];
const mockPi = {
  registerTool(tool) {
    registered.push(tool);
  }
};

registerVisualProofTools(mockPi);

function tool(name) {
  const found = registered.find((entry) => entry.name === name);
  assert.ok(found, `expected tool ${name} to be registered`);
  assert.equal(typeof found.handler, 'function');
  return found;
}

await test('extension helper registers expected dependency-free tools', () => {
  assert.deepEqual(registered.map((entry) => entry.name).sort(), [
    'visual_proof_create',
    'visual_proof_evaluate',
    'visual_proof_report'
  ]);
  for (const entry of registered) {
    assert.equal(typeof entry.description, 'string');
    assert.equal(entry.inputSchema.type, 'object');
  }
});

await test('registered evaluate tool handler evaluates fixture and writes reports', async () => {
  const outDir = path.join(testOutputRoot, `extension-smoke-${process.pid}`);
  rmSync(outDir, { recursive: true, force: true });
  const result = await tool('visual_proof_evaluate').handler({ proofPath: fixturePath, outputDir: outDir }, { cwd: repoRoot });
  assert.equal(result.details.verdict, 'fixed');
  assert.equal(result.details.before.passed, false);
  assert.equal(result.details.after.passed, true);
  assert.ok(existsSync(result.details.artifacts.evaluation));
  assert.ok(existsSync(result.details.artifacts.report));
  assert.ok(existsSync(result.details.artifacts.overlays.before));
  assert.match(result.content[0].text, /verdict: fixed/);
});

await test('registered create tool writes a validated proof artifact', async () => {
  const outDir = path.join(testOutputRoot, `extension-create-${process.pid}`);
  rmSync(outDir, { recursive: true, force: true });
  const proof = loadProofFromFile(fixturePath);
  const result = await tool('visual_proof_create').handler({ proof, outputDir: outDir }, { cwd: repoRoot });
  assert.equal(result.details.verdict, 'fixed');
  assert.ok(existsSync(result.details.proofPath));
});

await test('registered create tool writes a before-only draft proof artifact', async () => {
  const outDir = path.join(testOutputRoot, `extension-draft-${process.pid}`);
  rmSync(outDir, { recursive: true, force: true });
  const proof = clone(loadProofFromFile(fixturePath));
  delete proof.observations.after;
  const result = await tool('visual_proof_create').handler({ proof, outputDir: outDir }, { cwd: repoRoot });
  assert.equal(result.details.status, 'draft');
  assert.equal(result.details.verdict, 'draft');
  assert.ok(existsSync(result.details.proofPath));
  assert.match(result.content[0].text, /draft/);
});

await test('tool default output dirs stay under .visual-proof for dot-like ids', async () => {
  const cwd = path.join(testOutputRoot, `extension-safe-slug-${process.pid}`);
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(cwd, { recursive: true });
  for (const id of ['.', '..', '...']) {
    const proof = clone(loadProofFromFile(fixturePath));
    proof.id = id;
    const result = await tool('visual_proof_create').handler({ proof, fileName: `${id.length}.json` }, { cwd });
    const outDir = path.dirname(result.details.proofPath);
    assertDefaultOutputUnderVisualProof(cwd, outDir);
    assert.ok(existsSync(result.details.proofPath));
  }
});

await test('CLI default output dir stays under .visual-proof for path-normalizing ids', async () => {
  const cwd = path.join(testOutputRoot, `cli-safe-slug-${process.pid}`);
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(cwd, { recursive: true });
  const proof = clone(loadProofFromFile(fixturePath));
  proof.id = '..';
  const proofPath = path.join(cwd, 'proof.json');
  writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  const result = spawnSync(process.execPath, [path.join(repoRoot, 'bin/visual-proof.mjs'), 'evaluate', 'proof.json'], {
    cwd,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assertDefaultOutputUnderVisualProof(cwd, output.artifacts.outDir);
  assert.ok(existsSync(output.artifacts.evaluation));
  assert.equal(existsSync(path.join(cwd, 'evaluation.json')), false);
});
