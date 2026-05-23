import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerVisualProofTools } from '../src/visual-proof-tools.mjs';
import { loadProofFromFile } from '../src/visual-proof-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(repoRoot, 'examples/button-overlap-proof.json');

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
  const outDir = path.join('/tmp', `visual-proof-extension-smoke-${process.pid}`);
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
  const outDir = path.join('/tmp', `visual-proof-extension-create-${process.pid}`);
  rmSync(outDir, { recursive: true, force: true });
  const proof = loadProofFromFile(fixturePath);
  const result = await tool('visual_proof_create').handler({ proof, outputDir: outDir }, { cwd: repoRoot });
  assert.equal(result.details.verdict, 'fixed');
  assert.ok(existsSync(result.details.proofPath));
});
