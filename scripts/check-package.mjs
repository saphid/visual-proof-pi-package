#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateProof, loadProofFromFile } from '../src/visual-proof-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const requiredSkills = new Map([
  ['visual-proof', 'skills/visual-proof/SKILL.md'],
  ['visual-primitives', 'skills/visual-primitives/SKILL.md']
]);

function fail(message) {
  console.error(`check-package: ${message}`);
  process.exit(1);
}

function readText(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function requireFile(relativePath) {
  if (!existsSync(path.join(repoRoot, relativePath))) fail(`missing required file ${relativePath}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertIncludes(text, needle, message) {
  assert(text.includes(needle), message);
}

function validateManifest() {
  const manifest = readJson('package.json');
  assert(manifest.type === 'module', 'package.json must use type=module');
  assert(Array.isArray(manifest.keywords) && manifest.keywords.includes('pi-package'), 'package.json keywords must include pi-package');
  assert(manifest.dependencies && Object.keys(manifest.dependencies).length === 0, 'dependencies must be empty for dependency-free local validation');
  assert(manifest.devDependencies && Object.keys(manifest.devDependencies).length === 0, 'devDependencies must be empty for dependency-free local validation');
  assert(manifest.scripts?.check === 'node scripts/check-package.mjs', 'npm run check must use the pure Node package checker');
  assert(Array.isArray(manifest.pi?.extensions) && manifest.pi.extensions.length === 1, 'pi manifest must expose exactly one extension');
  assert(Array.isArray(manifest.pi?.skills) && manifest.pi.skills.length >= requiredSkills.size, 'pi manifest must expose visual-proof and visual-primitives skills');

  const skillIds = new Set();
  for (const skill of manifest.pi.skills) {
    assert(typeof skill.id === 'string' && skill.id.length > 0, 'each skill must have an id');
    assert(!skillIds.has(skill.id), `duplicate skill id ${skill.id}`);
    skillIds.add(skill.id);
    assert(typeof skill.path === 'string' && skill.path.length > 0, `skill ${skill.id} must have a path`);
    requireFile(skill.path);
  }

  for (const [skillId, expectedPath] of requiredSkills) {
    const skill = manifest.pi.skills.find((entry) => entry.id === skillId);
    assert(skill, `pi manifest must expose ${skillId} skill`);
    assert(skill.path === expectedPath, `${skillId} skill path must be ${expectedPath}`);
    assert(typeof skill.description === 'string' && skill.description.length > 20, `${skillId} skill must have a useful description`);
  }

  requireFile(manifest.pi.extensions[0].path);
  requireFile('bin/visual-proof.mjs');
  requireFile('src/visual-proof-core.mjs');
  requireFile('src/visual-proof-tools.mjs');
  requireFile('docs/visual-proof-object.md');
  requireFile('docs/visual-proof-process.md');
  requireFile('examples/button-overlap-proof.json');
}

function validateVisualProofSkill() {
  const skill = readText('skills/visual-proof/SKILL.md');
  assert(skill.startsWith('---\n'), 'visual-proof skill must have YAML frontmatter');
  assert(/name:\s*visual-proof/.test(skill), 'visual-proof frontmatter must name visual-proof');
  assert(/description:\s*.+Visual Proof Objects/.test(skill), 'visual-proof frontmatter must describe Visual Proof Objects');
  assertIncludes(skill, 'This is the proof layer only.', 'visual-proof must be explicitly proof-only');
  assertIncludes(skill, 'This skill does not capture screenshots, drive a browser, inspect DOM, run OCR, call VLMs, generate visual primitives from pixels, or fix application code.', 'visual-proof must exclude capture/DOM/OCR/VLM/primitive/code-fix ownership');
  assertIncludes(skill, 'When a screenshot needs manual visual grounding, use the `visual-primitives` skill', 'visual-proof must delegate drawing/pointing to visual-primitives');
  assertIncludes(skill, 'at least one of `route` or `url`', 'visual-proof draft instructions must match required screenshot route/url metadata');
  assert(!skill.includes('`route` or `url` when known'), 'visual-proof must not imply route/url is optional for validated draft screenshots');
  assertIncludes(skill, 'It never gives a final `fixed` verdict without a complete before/after VP1 proof.', 'visual-proof must not claim a final verdict without complete proof data');
  assertIncludes(skill, 'Do not infer these from the screenshot path alone.', 'visual-proof must be honest about evidence-backed predicates');
}

function validateVisualPrimitivesSkill() {
  const skill = readText('skills/visual-primitives/SKILL.md');
  assert(skill.startsWith('---\n'), 'visual-primitives skill must have YAML frontmatter');
  assert(/name:\s*visual-primitives/.test(skill), 'visual-primitives frontmatter must name visual-primitives');
  assert(/description:\s*.+boxes, points, and paths/.test(skill), 'visual-primitives frontmatter must describe boxes, points, and paths');
  assertIncludes(skill, 'This is the drawing/pointing layer only.', 'visual-primitives must be explicitly drawing/pointing-only');
  assertIncludes(skill, 'This skill does not capture screenshots, drive a browser, inspect DOM, map selectors, run OCR, call VLMs, fix application code, evaluate complete proofs, or declare a final fixed verdict.', 'visual-primitives must exclude browser/DOM/OCR/VLM/fixing/evaluation/final-verdict ownership');
  assertIncludes(skill, '`box`, `point`, and `path` primitives', 'visual-primitives must output VP1 primitive types');
  assertIncludes(skill, '"id": "footer"', 'visual-primitives example must define footer before suggesting predicates against it');
  assertIncludes(skill, '"id": "main_content"', 'visual-primitives example must define main_content before suggesting predicates against it');
  assertIncludes(skill, '"predicateSuggestions"', 'visual-primitives may provide predicate suggestions for handoff');
  assertIncludes(skill, '"primitives": ["submit_button", "footer"]', 'visual-primitives predicate suggestions must use VP1-compatible primitive arrays');
  assertIncludes(skill, '"to": "visual-proof"', 'visual-primitives must document draft handoff to visual-proof');
  assertIncludes(skill, 'Evidence-backed claims such as visible text or clickability are left for explicit evidence adapters or for the `visual-proof` skill to require.', 'visual-primitives must not replace evidence-backed proof');
}

function validateProcessDocs() {
  const processDoc = readText('docs/visual-proof-process.md');
  for (const phrase of [
    'Observe or capture state',
    'Ground visual primitives',
    'Define predicates and evidence needs',
    'Save before proof',
    'Fix the app',
    'Capture after state',
    'Verify and report'
  ]) {
    assertIncludes(processDoc, phrase, `process doc must include phase: ${phrase}`);
  }
  for (const skillId of requiredSkills.keys()) {
    assertIncludes(processDoc, `\`${skillId}\``, `process doc must mention ${skillId}`);
  }
  for (const futureSkill of ['browser-capture', 'dom-bridge', 'visual-fix-loop']) {
    assertIncludes(processDoc, `\`${futureSkill}\``, `process doc must document future ${futureSkill} boundary`);
  }
  assertIncludes(processDoc, 'They are intentionally not implemented here.', 'process doc must state future adapters are not implemented');

  const readme = readText('README.md');
  assertIncludes(readme, '## Composable skill split', 'README must explain the composable skill split');
  assertIncludes(readme, 'skills/visual-proof/SKILL.md', 'README must list visual-proof skill');
  assertIncludes(readme, 'skills/visual-primitives/SKILL.md', 'README must list visual-primitives skill');
  assertIncludes(readme, 'docs/visual-proof-process.md', 'README must link to the process doc');
}

function validateSkills() {
  validateVisualProofSkill();
  validateVisualPrimitivesSkill();
  validateProcessDocs();
}

function validateExtension() {
  const extension = readText('extensions/visual-proof/index.ts');
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
validateSkills();
validateExtension();
validateExample();
runNode('test/core.test.mjs');
runNode('test/extension-smoke.test.mjs');
const checkOut = path.join(repoRoot, '.visual-proof-test-output', 'check-package');
rmSync(checkOut, { recursive: true, force: true });
runNode('bin/visual-proof.mjs', ['evaluate', 'examples/button-overlap-proof.json', '--out', checkOut]);
console.log('check-package: ok');
