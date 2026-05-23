import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VisualProofError,
  boxCenter,
  boxToPixels,
  containsBox,
  containsPoint,
  distance,
  evaluatePredicate,
  evaluateProof,
  generateMarkdownReport,
  intersectionArea,
  loadProofFromFile,
  overlapRatio,
  writeEvaluationArtifacts
} from '../src/visual-proof-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(repoRoot, 'examples/button-overlap-proof.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const fixture = loadProofFromFile(fixturePath);
const testOutputRoot = path.join(repoRoot, '.visual-proof-test-output');

test('geometry helpers compute area, overlap, containment, centers, and distance', () => {
  const a = { type: 'box', id: 'a', x: 0, y: 0, width: 100, height: 100 };
  const b = { type: 'box', id: 'b', x: 50, y: 50, width: 100, height: 100 };
  assert.equal(intersectionArea(a, b), 2500);
  assert.equal(overlapRatio(a, b), 0.25);
  assert.deepEqual(boxCenter(a), { x: 50, y: 50 });
  assert.equal(containsBox({ x: 0, y: 0, width: 100, height: 100 }, { x: 10, y: 10, width: 20, height: 20 }), true);
  assert.equal(containsPoint({ x: 0, y: 0, width: 100, height: 100 }, { x: 101, y: 50 }), false);
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('normalized primitives convert deterministically to pixels', () => {
  const observation = {
    coordinateSpace: 'normalized',
    screenshot: { path: 'screen.png', width: 200, height: 100 },
    primitives: []
  };
  const box = boxToPixels({ id: 'hero', type: 'box', x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, observation);
  assert.equal(box.x, 50);
  assert.equal(box.y, 50);
  assert.equal(box.width, 100);
  assert.equal(box.height, 25);
});

test('example proof distinguishes before overlap bug from after fix', () => {
  const evaluation = evaluateProof(fixture);
  assert.equal(evaluation.verdict, 'fixed');
  assert.equal(evaluation.before.passed, false);
  assert.equal(evaluation.after.passed, true);
  assert.deepEqual(evaluation.after.failingPredicateIds, []);
  assert.ok(evaluation.before.failingPredicateIds.includes('button_not_over_footer'));
  assert.ok(evaluation.before.failingPredicateIds.includes('button_inside_main_content'));
  assert.ok(evaluation.before.failingPredicateIds.includes('submit_button_clickable'));
  const overlapBefore = evaluation.before.results.find((entry) => entry.id === 'button_not_over_footer');
  const overlapAfter = evaluation.after.results.find((entry) => entry.id === 'button_not_over_footer');
  assert.equal(overlapBefore.passed, false);
  assert.equal(overlapAfter.passed, true);
});

test('full proof validation requires after video metadata', () => {
  const proof = clone(fixture);
  delete proof.observations.after.video;
  assert.throws(() => evaluateProof(proof), /observations\.after\.video is required/);
});

test('full proof validation requires after video frame metadata', () => {
  const proof = clone(fixture);
  delete proof.observations.after.video.frameCount;
  delete proof.observations.after.video.sampledFrames;
  assert.throws(() => evaluateProof(proof), /observations\.after\.video must include frameCount or sampledFrames/);

  const emptyFrames = clone(fixture);
  delete emptyFrames.observations.after.video.frameCount;
  emptyFrames.observations.after.video.sampledFrames = [];
  assert.throws(() => evaluateProof(emptyFrames), /sampledFrames must include at least one frame/);
});

test('visible predicate fails when explicit visibility evidence is missing', () => {
  const proof = clone(fixture);
  delete proof.observations.after.evidence.visibility.submit_button;
  const evaluation = evaluateProof(proof);
  const result = evaluation.after.results.find((entry) => entry.id === 'submit_button_visible');
  assert.equal(result.passed, false);
  assert.match(result.reason, /missing explicit visibility evidence/);
});

test('text_present predicate fails when explicit detectedText evidence is missing', () => {
  const proof = clone(fixture);
  delete proof.observations.after.evidence.detectedText;
  const evaluation = evaluateProof(proof);
  const result = evaluation.after.results.find((entry) => entry.id === 'submit_text_present');
  assert.equal(result.passed, false);
  assert.match(result.reason, /missing explicit detectedText evidence/);
});

test('clickable predicate fails when explicit click target evidence is missing', () => {
  const proof = clone(fixture);
  delete proof.observations.after.evidence.clickTargets.submit_button;
  const evaluation = evaluateProof(proof);
  const result = evaluation.after.results.find((entry) => entry.id === 'submit_button_clickable');
  assert.equal(result.passed, false);
  assert.match(result.reason, /missing explicit click target evidence/);
});

test('visible and clickable predicates require referenced subject primitives even when evidence exists', () => {
  const observation = {
    primitives: [],
    evidence: {
      visibility: { ghost_button: { visible: true } },
      clickTargets: { ghost_button: { clickable: true } }
    }
  };
  assert.throws(
    () => evaluatePredicate({ id: 'ghost_visible', type: 'visible', subject: 'ghost_button' }, observation, 'after'),
    /Primitive "ghost_button" was not found/
  );
  assert.throws(
    () => evaluatePredicate({ id: 'ghost_clickable', type: 'clickable', subject: 'ghost_button' }, observation, 'after'),
    /Primitive "ghost_button" was not found/
  );
});

test('aligned, count_equals, and path_continuous predicates are deterministic', () => {
  const observation = {
    screenshot: { path: 'screen.png', width: 400, height: 300 },
    primitives: [
      { id: 'left_button', type: 'box', label: 'Button', x: 20, y: 100, width: 80, height: 30 },
      { id: 'right_button', type: 'box', label: 'Button', x: 140, y: 101, width: 80, height: 30 },
      { id: 'good_path', type: 'path', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 }] },
      { id: 'bad_path', type: 'path', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] }
    ],
    evidence: {}
  };
  assert.equal(evaluatePredicate({ id: 'aligned', type: 'aligned', primitives: ['left_button', 'right_button'], axis: 'center_y', tolerancePx: 2 }, observation, 'after').passed, true);
  assert.equal(evaluatePredicate({ id: 'count', type: 'count_equals', selector: { label: 'Button' }, expected: 2 }, observation, 'after').passed, true);
  assert.equal(evaluatePredicate({ id: 'good_path', type: 'path_continuous', subject: 'good_path', maxGapPx: 25 }, observation, 'after').passed, true);
  assert.equal(evaluatePredicate({ id: 'bad_path', type: 'path_continuous', subject: 'bad_path', maxGapPx: 25 }, observation, 'after').passed, false);
});

test('malformed primitives and predicates raise actionable errors', () => {
  const badPrimitive = clone(fixture);
  badPrimitive.observations.after.primitives.find((entry) => entry.id === 'submit_button').width = 0;
  assert.throws(() => evaluateProof(badPrimitive), VisualProofError);

  const badPredicate = clone(fixture);
  badPredicate.predicates.push({ id: 'mystery', type: 'pixel_magic' });
  assert.throws(() => evaluateProof(badPredicate), /not supported/);
});

test('report generation writes machine and human readable artifacts', () => {
  const outDir = path.join(testOutputRoot, `core-${process.pid}`);
  rmSync(outDir, { recursive: true, force: true });
  const { evaluation, paths } = writeEvaluationArtifacts(fixture, outDir);
  assert.equal(evaluation.verdict, 'fixed');
  assert.ok(existsSync(paths.evaluation));
  assert.ok(existsSync(paths.report));
  assert.ok(existsSync(paths.overlays.before));
  assert.ok(existsSync(paths.overlays.after));
  const report = readFileSync(paths.report, 'utf8');
  const beforeOverlay = readFileSync(paths.overlays.before, 'utf8');
  assert.match(report, /Verdict:\*\* `fixed`/);
  assert.match(report, /Submit button must not overlap/);
  assert.match(beforeOverlay, /<image href="\.\.\/\.\.\/examples\/artifacts\/before\/button-overlap-before\.png"/);
  assert.match(generateMarkdownReport(fixture), /Boundary/);
});
