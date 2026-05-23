#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateProof, loadProofFromFile } from '../src/visual-proof-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function fail(message) {
  console.error(`check-package: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function requireFile(relativePath) {
  if (!existsSync(path.join(repoRoot, relativePath))) fail(`missing required file ${relativePath}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function validateManifest() {
  const manifest = readJson('package.json');
  assert(manifest.type === 'module', 'package.json must use type=module');
  assert(Array.isArray(manifest.keywords) && manifest.keywords.includes('pi-package'), 'package.json keywords must include pi-package');
  assert(manifest.dependencies && Object.keys(manifest.dependencies).length === 0, 'dependencies must be empty for dependency-free local validation');
  assert(manifest.devDependencies && Object.keys(manifest.devDependencies).length === 0, 'devDependencies must be empty for dependency-free local validation');
  assert(manifest.scripts?.check === 'node scripts/check-package.mjs', 'npm run check must use the pure Node package checker');
  assert(Array.isArray(manifest.pi?.extensions) && manifest.pi.extensions.length === 1, 'pi manifest must expose exactly one extension');
  assert(Array.isArray(manifest.pi?.skills) && manifest.pi.skills.length === 1, 'pi manifest must expose exactly one skill');
  requireFile(manifest.pi.extensions[0].path);
  requireFile(manifest.pi.skills[0].path);
  requireFile('bin/visual-proof.mjs');
  requireFile('src/visual-proof-core.mjs');
  requireFile('src/visual-proof-tools.mjs');
  requireFile('docs/visual-proof-object.md');
  requireFile('examples/button-overlap-proof.json');
}

function validateSkill() {
  const skill = readFileSync(path.join(repoRoot, 'skills/visual-proof/SKILL.md'), 'utf8');
  assert(skill.startsWith('---\n'), 'skill must have YAML frontmatter');
  assert(/name:\s*visual-proof/.test(skill), 'skill frontmatter must name visual-proof');
  assert(/description:\s*.+Visual Proof Objects/.test(skill), 'skill frontmatter must describe Visual Proof Objects');
  assert(skill.includes('Do not infer these from the screenshot path alone.'), 'skill must be honest about evidence-backed predicates');
  assert(skill.includes('Browser capture, Playwright automation, DOM box extraction, OCR, and VLM grounding are adapters.'), 'skill must document adapter boundary');
}

function validateExtension() {
  const extension = readFileSync(path.join(repoRoot, 'extensions/visual-proof/index.ts'), 'utf8');
  assert(extension.includes("../../src/visual-proof-tools.mjs"), 'extension must import dependency-free tool registration helper');
  assert(extension.includes('registerVisualProofTools'), 'extension must register visual proof tools');
}

function validateExample() {
  const proof = loadProofFromFile(path.join(repoRoot, 'examples/button-overlap-proof.json'));
  const beforeShot = proof.observations?.before?.screenshot;
  const afterShot = proof.observations?.after?.screenshot;
  const afterVideo = proof.observations?.after?.video;
  for (const [phase, shot] of [['before', beforeShot], ['after', afterShot]]) {
    assert(typeof shot?.path === 'string' && shot.path.length > 0, `${phase}.screenshot.path is required`);
    assert(Number.isFinite(shot.width) && shot.width > 0, `${phase}.screenshot.width is required`);
    assert(Number.isFinite(shot.height) && shot.height > 0, `${phase}.screenshot.height is required`);
    assert(Number.isFinite(shot.viewport?.width) && shot.viewport.width > 0, `${phase}.screenshot.viewport.width is required`);
    assert(Number.isFinite(shot.viewport?.height) && shot.viewport.height > 0, `${phase}.screenshot.viewport.height is required`);
    assert(typeof shot.route === 'string' || typeof shot.url === 'string', `${phase}.screenshot must include route or url`);
  }
  assert(typeof afterVideo?.path === 'string' && afterVideo.path.length > 0, 'after.video.path is required');
  assert(Number.isFinite(afterVideo.durationMs) || Number.isFinite(afterVideo.durationSeconds), 'after.video duration is required');
  assert(Number.isFinite(afterVideo.frameCount) || Array.isArray(afterVideo.sampledFrames), 'after.video frameCount or sampledFrames is required');
  const evaluation = evaluateProof(proof);
  assert(evaluation.verdict === 'fixed', `example verdict must be fixed, got ${evaluation.verdict}`);
  assert(evaluation.before.failingPredicateIds.length > 0, 'example must have failing before predicates');
  assert(evaluation.after.failingPredicateIds.length === 0, 'example must have all after predicates passing');
}

function runNode(relativePath, args = []) {
  const result = spawnSync(process.execPath, [relativePath, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env }
  });
  if (result.status !== 0) fail(`${process.execPath} ${[relativePath, ...args].join(' ')} exited ${result.status}`);
}

validateManifest();
validateSkill();
validateExtension();
validateExample();
runNode('test/core.test.mjs');
runNode('test/extension-smoke.test.mjs');
const checkOut = path.join(repoRoot, '.visual-proof-test-output', 'check-package');
rmSync(checkOut, { recursive: true, force: true });
runNode('bin/visual-proof.mjs', ['evaluate', 'examples/button-overlap-proof.json', '--out', checkOut]);
console.log('check-package: ok');
