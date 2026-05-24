#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateProof, loadProofFromFile } from '../src/visual-proof-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const requiredSkills = new Map([
  ['visual-proof', {
    path: 'skills/visual-proof/SKILL.md',
    descriptionPattern: /Visual Proof Objects/i,
    manifestDescriptionPattern: /Proof-only workflow.*Visual Proof Objects/i
  }],
  ['visual-primitives', {
    path: 'skills/visual-primitives/SKILL.md',
    descriptionPattern: /boxes, points, and paths/i,
    manifestDescriptionPattern: /Drawing and pointing workflow.*boxes, points, and paths/i
  }],
  ['browser-capture', {
    path: 'skills/browser-capture/SKILL.md',
    descriptionPattern: /screenshot.*after-video metadata|capture.*metadata/i,
    manifestDescriptionPattern: /Capture.*metadata.*screenshot.*after-video/i
  }],
  ['dom-bridge', {
    path: 'skills/dom-bridge/SKILL.md',
    descriptionPattern: /DOM.*evidence.*candidate VP1 primitives/i,
    manifestDescriptionPattern: /DOM.*evidence.*candidate VP1 primitives/i
  }],
  ['visual-fix-loop', {
    path: 'skills/visual-fix-loop/SKILL.md',
    descriptionPattern: /Orchestration workflow.*Visual Proof fix loops/i,
    manifestDescriptionPattern: /Orchestration workflow.*recapture.*final proof/i
  }]
]);

const implementedAdapterSkillIds = ['browser-capture', 'dom-bridge', 'visual-fix-loop'];

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

function assertAllIncludes(text, needles, label) {
  for (const needle of needles) {
    assertIncludes(text, needle, `${label} must include ${needle}`);
  }
}

function assertNoStaleImplementedSkillWording(text, label) {
  for (const skillId of implementedAdapterSkillIds) {
    const escapedId = skillId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const skillPattern = '(?:`' + escapedId + '`|' + escapedId + ')';
    const staleTerm = '(?:future|later\\s+work|not\\s+implemented|intentionally\\s+not\\s+implemented|planned-but-missing)';
    const staleBefore = new RegExp(`${staleTerm}[^\\n.]{0,120}${skillPattern}`, 'i');
    const staleAfter = new RegExp(`${skillPattern}[^\\n.]{0,120}${staleTerm}`, 'i');
    assert(!staleBefore.test(text) && !staleAfter.test(text), `${label} must not describe ${skillId} as future/not implemented`);
  }
}

function validateManifest() {
  const manifest = readJson('package.json');
  assert(manifest.type === 'module', 'package.json must use type=module');
  assert(Array.isArray(manifest.keywords) && manifest.keywords.includes('pi-package'), 'package.json keywords must include pi-package');
  for (const keyword of implementedAdapterSkillIds) {
    assert(manifest.keywords.includes(keyword), `package.json keywords must include ${keyword}`);
  }
  assert(manifest.dependencies && Object.keys(manifest.dependencies).length === 0, 'dependencies must be empty for dependency-free local validation');
  assert(manifest.devDependencies && Object.keys(manifest.devDependencies).length === 0, 'devDependencies must be empty for dependency-free local validation');
  assert(manifest.scripts?.check === 'node scripts/check-package.mjs', 'npm run check must use the pure Node package checker');
  assert(Array.isArray(manifest.pi?.extensions) && manifest.pi.extensions.length === 1, 'pi manifest must expose exactly one extension');
  assert(Array.isArray(manifest.pi?.skills) && manifest.pi.skills.length >= requiredSkills.size, 'pi manifest must expose all five required skills');

  const skillIds = new Set();
  const skillDescriptions = new Set();
  for (const skill of manifest.pi.skills) {
    assert(typeof skill.id === 'string' && skill.id.length > 0, 'each skill must have an id');
    assert(!skillIds.has(skill.id), `duplicate skill id ${skill.id}`);
    skillIds.add(skill.id);
    assert(typeof skill.name === 'string' && skill.name.length > 0, `skill ${skill.id} must have a name`);
    assert(typeof skill.path === 'string' && skill.path.length > 0, `skill ${skill.id} must have a path`);
    requireFile(skill.path);
    assert(typeof skill.description === 'string' && skill.description.length > 40, `skill ${skill.id} must have a useful description`);
    const normalizedDescription = skill.description.trim().toLowerCase();
    assert(!skillDescriptions.has(normalizedDescription), `duplicate skill description for ${skill.id}`);
    skillDescriptions.add(normalizedDescription);
  }

  for (const [skillId, expected] of requiredSkills) {
    const skill = manifest.pi.skills.find((entry) => entry.id === skillId);
    assert(skill, `pi manifest must expose ${skillId} skill`);
    assert(skill.path === expected.path, `${skillId} skill path must be ${expected.path}`);
    assert(expected.manifestDescriptionPattern.test(skill.description), `${skillId} skill must have a useful scope-specific description`);
  }

  requireFile(manifest.pi.extensions[0].path);
  requireFile('bin/visual-proof.mjs');
  requireFile('src/visual-proof-core.mjs');
  requireFile('src/visual-proof-tools.mjs');
  requireFile('docs/visual-proof-object.md');
  requireFile('docs/visual-proof-process.md');
  requireFile('examples/button-overlap-proof.json');
}

function validateSkillHeader(skillId) {
  const expected = requiredSkills.get(skillId);
  const skill = readText(expected.path);
  assert(skill.startsWith('---\n'), `${skillId} skill must have YAML frontmatter`);
  assert(new RegExp(`name:\\s*${skillId}`).test(skill), `${skillId} frontmatter must name ${skillId}`);
  assert(expected.descriptionPattern.test(skill), `${skillId} frontmatter must describe its scope`);
  return skill;
}

function validateVisualProofSkill() {
  const skill = validateSkillHeader('visual-proof');
  assertNoStaleImplementedSkillWording(skill, 'visual-proof skill');
  assertIncludes(skill, 'This is the proof layer only.', 'visual-proof must be explicitly proof-only');
  assertIncludes(skill, 'This skill does not capture screenshots, drive a browser, inspect DOM, run OCR, call VLMs, generate visual primitives from pixels, or fix application code.', 'visual-proof must exclude capture/DOM/OCR/VLM/primitive/code-fix ownership');
  assertIncludes(skill, 'When a screenshot needs manual visual grounding, use the `visual-primitives` skill', 'visual-proof must delegate drawing/pointing to visual-primitives');
  assertIncludes(skill, 'Use the `browser-capture` skill for screenshot/video capture and metadata collection.', 'visual-proof must delegate capture to browser-capture');
  assertIncludes(skill, 'Use the `dom-bridge` skill for selector, hit-test, computed-style, accessibility, or text evidence.', 'visual-proof must delegate DOM/evidence adaptation to dom-bridge');
  assertIncludes(skill, 'Use the `visual-fix-loop` skill when the task needs an end-to-end reproduce/fix/recapture/proof loop.', 'visual-proof must delegate end-to-end loop orchestration to visual-fix-loop');
  assertIncludes(skill, 'at least one of `route` or `url`', 'visual-proof draft instructions must match required screenshot route/url metadata');
  assert(!skill.includes('`route` or `url` when known'), 'visual-proof must not imply route/url is optional for validated draft screenshots');
  assertIncludes(skill, 'It never gives a final `fixed` verdict without a complete before/after VP1 proof.', 'visual-proof must not claim a final verdict without complete proof data');
  assertIncludes(skill, 'Do not infer these from the screenshot path alone.', 'visual-proof must be honest about evidence-backed predicates');
  assertIncludes(skill, '## Predicate/evidence summary', 'visual-proof must include a compact predicate/evidence table');
  assertIncludes(skill, '| Predicate type | Data needed | Blocks if |', 'visual-proof predicate table must document blocking conditions');
  assertIncludes(skill, '"blockedReason": "complete proof cannot be evaluated"', 'visual-proof must include a concrete blocked output example');
  assertIncludes(skill, '"verdictSource": "visual-proof"', 'visual-proof blocked/evaluation handoff must name itself as verdict source');
}

function validateVisualPrimitivesSkill() {
  const skill = validateSkillHeader('visual-primitives');
  assertNoStaleImplementedSkillWording(skill, 'visual-primitives skill');
  assertIncludes(skill, 'This is the drawing/pointing layer only.', 'visual-primitives must be explicitly drawing/pointing-only');
  assertIncludes(skill, 'This skill does not capture screenshots, drive a browser, inspect DOM, map selectors, run OCR, call VLMs, fix application code, evaluate complete proofs, or declare a final fixed verdict.', 'visual-primitives must exclude browser/DOM/OCR/VLM/fixing/evaluation/final-verdict ownership');
  assertIncludes(skill, 'Use `browser-capture` for capture/metadata.', 'visual-primitives must delegate capture to browser-capture');
  assertIncludes(skill, 'Use `dom-bridge` for selector-derived boxes, hit-test evidence, computed-style evidence, accessibility evidence, or text evidence.', 'visual-primitives must delegate DOM/evidence work to dom-bridge');
  assertIncludes(skill, 'Use `visual-fix-loop` only to coordinate the larger bug-fix loop.', 'visual-primitives must delegate loop orchestration to visual-fix-loop');
  assertIncludes(skill, '`box`, `point`, and `path` primitives', 'visual-primitives must output VP1 primitive types');
  assertIncludes(skill, '"id": "footer"', 'visual-primitives example must define footer before suggesting predicates against it');
  assertIncludes(skill, '"id": "main_content"', 'visual-primitives example must define main_content before suggesting predicates against it');
  assertIncludes(skill, '"predicateSuggestions"', 'visual-primitives may provide predicate suggestions for handoff');
  assertIncludes(skill, '"primitives": ["submit_button", "footer"]', 'visual-primitives predicate suggestions must use VP1-compatible primitive arrays');
  assertIncludes(skill, '"to": "visual-proof"', 'visual-primitives must document draft handoff to visual-proof');
  assertIncludes(skill, 'Evidence-backed claims such as visible text or clickability are left for `dom-bridge`, other explicit evidence adapters, or for the `visual-proof` skill to require.', 'visual-primitives must not replace evidence-backed proof');
  assertIncludes(skill, '## Inspect supplied image or block', 'visual-primitives must require image inspection or block');
  assertIncludes(skill, 'Do not draw primitives from filename, path, alt text, route, DOM hints, or surrounding context alone.', 'visual-primitives must reject filename/path/context-only drawing');
  assertIncludes(skill, '"blockedReason": "supplied screenshot image is unavailable"', 'visual-primitives must include unavailable-image blocked example');
  assertIncludes(skill, '"blockedReason": "visual target ambiguous after inspection"', 'visual-primitives must include ambiguous-target blocked example');
}

function validateBrowserCaptureSkill() {
  const skill = validateSkillHeader('browser-capture');
  assertIncludes(skill, 'This is the capture/metadata layer only.', 'browser-capture must be explicitly capture/metadata-only');
  assertIncludes(skill, 'This skill does not draw visual primitives, inspect DOM for evidence, map selectors, fix application code, evaluate complete VP1 proofs, or declare a final VP1 verdict.', 'browser-capture must reject primitive, DOM, fixing, proof, and verdict ownership');
  assertIncludes(skill, '`browser_worker_interact`', 'browser-capture must mention browser_worker_interact as an available capture source');
  assertIncludes(skill, '`Pi Autobrowse`', 'browser-capture must mention Pi Autobrowse as an available capture source');
  assertIncludes(skill, '`Playwright`', 'browser-capture must mention Playwright as an available capture source');
  assertIncludes(skill, 'user/test harness', 'browser-capture must mention user/test harness capture sources');
  assertIncludes(skill, '"screenshot"', 'browser-capture must output screenshot metadata');
  assertIncludes(skill, '"video"', 'browser-capture must output after video metadata');
  assertIncludes(skill, 'After capture for a complete proof must include video metadata.', 'browser-capture must require after video metadata for complete proof');
  assertIncludes(skill, '"to": "visual-primitives"', 'browser-capture must hand off to visual-primitives');
  assertIncludes(skill, '"to": "dom-bridge"', 'browser-capture must hand off to dom-bridge when DOM/evidence is available');
  assertIncludes(skill, '"to": "visual-proof"', 'browser-capture must hand off to visual-proof');
  assertIncludes(skill, '## Recommended optional provenance', 'browser-capture must document optional provenance');
  assertIncludes(skill, 'recommended when already available; they are not required by VP1 core validation', 'browser-capture provenance must stay optional');
  assertAllIncludes(skill, [
    '`sha256`',
    '`checksum`',
    '`captureCommand`',
    '`timestamp`',
    '`browser`',
    '`device`',
    '`version`',
    '`viewport`',
    '`deviceScaleFactor`',
    '`fullPage`',
    '`authNotesNoSecrets`',
    '`dimensionsSource`'
  ], 'browser-capture provenance');
  assertIncludes(skill, '"blockedReason": "missing screenshot dimensions"', 'browser-capture must include missing-dimensions blocked example');
  assertIncludes(skill, '"blockedReason": "after video metadata required for complete VP1 proof"', 'browser-capture must include missing-video blocked example');
  assertIncludes(skill, '"blockedReason": "requested capture provenance is unavailable"', 'browser-capture must include requested-provenance blocked example');
}

function validateDomBridgeSkill() {
  const skill = validateSkillHeader('dom-bridge');
  assertIncludes(skill, 'This is the DOM/evidence adapter layer only.', 'dom-bridge must be explicitly DOM/evidence-only');
  assertIncludes(skill, 'This skill does not capture screenshots or video, draw final manual primitives from pixels, run OCR/VLMs, fix application code, evaluate complete VP1 proofs, or declare a final fixed verdict.', 'dom-bridge must reject capture, final drawing, OCR/VLM, fixing, proof, and verdict ownership');
  assertIncludes(skill, 'candidate primitives', 'dom-bridge must output candidate primitives');
  assertIncludes(skill, 'evidence.visibility', 'dom-bridge must document visibility evidence');
  assertIncludes(skill, 'evidence.detectedText', 'dom-bridge must document text evidence');
  assertIncludes(skill, 'evidence.clickTargets', 'dom-bridge must document click-target evidence');
  assertIncludes(skill, 'Evidence is not a proof verdict.', 'dom-bridge must distinguish evidence from proof verdicts');
  assertIncludes(skill, '"to": "visual-primitives"', 'dom-bridge must hand candidates to visual-primitives when review is needed');
  assertIncludes(skill, '"to": "visual-proof"', 'dom-bridge must hand accepted evidence to visual-proof');
  assertIncludes(skill, '## Coordinate alignment rules', 'dom-bridge must document coordinate alignment rules');
  assertAllIncludes(skill, [
    'CSS viewport pixels',
    'screenshot pixels',
    '`deviceScaleFactor`',
    'scaleX = screenshot.width / screenshot.viewport.width',
    'scaleY = screenshot.height / screenshot.viewport.height',
    'fullPage: false',
    'fullPage: true',
    '`documentWidthCss` and `documentHeightCss`',
    'documentXCss = rect.left + scrollX',
    'documentYCss = rect.top + scrollY',
    'scaleX = screenshot.width / documentWidthCss',
    'scaleY = screenshot.height / documentHeightCss',
    'no horizontal scroll/overflow',
    'Missing capture clip origin when the capture is a clipped sub-rectangle.',
    'missing `documentHeightCss`, or missing `documentWidthCss` without the explicit no-horizontal-overflow/full-page-width-equals-viewport guarantee',
    'Do not add scroll offsets for a viewport screenshot.',
    'Screenshot-vs-viewport scaling',
    'Zoom/transforms/ambiguity stop conditions',
    'block instead of converting'
  ], 'dom-bridge coordinate alignment');
  assertIncludes(skill, '"blockedReason": "cannot align CSS viewport pixels to screenshot pixels"', 'dom-bridge must include coordinate-alignment blocked example');
}

function validateVisualFixLoopSkill() {
  const skill = validateSkillHeader('visual-fix-loop');
  assertIncludes(skill, 'This is the orchestration layer only.', 'visual-fix-loop must be explicitly orchestration-only');
  assertIncludes(skill, 'reproduce → capture → primitives → proof draft → fix → recapture → proof', 'visual-fix-loop must document the required sequence');
  assertIncludes(skill, 'This skill does not capture browsers directly, draw primitives directly, inspect DOM directly, own project-specific code changes, evaluate VP1 predicates itself, or declare the final fixed verdict.', 'visual-fix-loop must reject delegated work and final verdict ownership');
  assertIncludes(skill, 'It delegates final verdict to `visual-proof`', 'visual-fix-loop must delegate final verdict to visual-proof');
  assertIncludes(skill, '`browser-capture`', 'visual-fix-loop must call browser-capture');
  assertIncludes(skill, '`dom-bridge`', 'visual-fix-loop must call dom-bridge when evidence is available');
  assertIncludes(skill, '`visual-primitives`', 'visual-fix-loop must call visual-primitives');
  assertIncludes(skill, '`visual-proof`', 'visual-fix-loop must call visual-proof');
  assertIncludes(skill, 'complete before/after VP1 proof', 'visual-fix-loop must require complete proof before fixed claims');
  assertIncludes(skill, 'does not choose or own React, CSS, framework, or app-specific fix strategy', 'visual-fix-loop must avoid framework-specific fix ownership');
  assertIncludes(skill, '## Blocked and transition output shapes', 'visual-fix-loop must document blocked and transition shapes');
  assertIncludes(skill, '"status": "blocked"', 'visual-fix-loop must include concrete blocked output');
  assertIncludes(skill, '"transition": "fixing -> recapture-needed"', 'visual-fix-loop must include recapture transition output');
  assertIncludes(skill, '"implementationOwner": "ordinary project workflow"', 'visual-fix-loop must attribute app changes outside the skill');
}

function validateProcessDocs() {
  const processDoc = readText('docs/visual-proof-process.md');
  assertNoStaleImplementedSkillWording(processDoc, 'process doc');
  assertIncludes(processDoc, 'The package currently implements five skills:', 'process doc must describe five implemented skills');
  for (const phrase of [
    'Observe or capture state',
    'Bridge DOM evidence when available',
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
  assertIncludes(processDoc, 'No skill except `visual-proof` owns final VP1 verdict evaluation.', 'process doc must keep final verdict ownership with visual-proof');
  assertIncludes(processDoc, '## Hardened handoff rules', 'process doc must summarize hardened handoff rules');
  assertAllIncludes(processDoc, [
    'Optional capture provenance',
    'Coordinate alignment',
    'CSS viewport pixels to screenshot pixels',
    '`deviceScaleFactor`',
    '`fullPage`',
    'Inspect images or block',
    'Blocked handoffs',
    'does not choose framework-specific code changes'
  ], 'process doc hardening');

  const readme = readText('README.md');
  assertNoStaleImplementedSkillWording(readme, 'README');
  assertIncludes(readme, '## Composable skill split', 'README must explain the composable skill split');
  assertIncludes(readme, 'Five Pi skills:', 'README must list five skills');
  for (const [, expected] of requiredSkills) {
    assertIncludes(readme, expected.path, `README must list ${expected.path}`);
  }
  assertIncludes(readme, 'docs/visual-proof-process.md', 'README must link to the process doc');
  assertIncludes(readme, '## Remaining non-goals', 'README must document remaining non-goals');
  assertIncludes(readme, 'Hardening added by the skills:', 'README must summarize skill hardening');
  assertAllIncludes(readme, [
    'optional provenance',
    '`sha256`/checksum',
    'CSS viewport pixels to screenshot pixels',
    'screenshot-vs-viewport scaling',
    '`deviceScaleFactor`',
    '`fullPage`',
    'inspect the supplied image or return blocked/missing-data',
    'concrete blocked output shape',
    'do not add browser, DOM, OCR, VLM, hashing, or pixel-diff runtime capabilities'
  ], 'README hardening');
}

function validateSkills() {
  validateVisualProofSkill();
  validateVisualPrimitivesSkill();
  validateBrowserCaptureSkill();
  validateDomBridgeSkill();
  validateVisualFixLoopSkill();
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
