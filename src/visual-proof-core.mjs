import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const VISUAL_PROOF_SCHEMA_VERSION = 'vp1';

const EPSILON = 1e-9;
const KNOWN_PREDICATE_TYPES = new Set([
  'not_overlapping',
  'inside',
  'aligned',
  'count_equals',
  'path_continuous',
  'visible',
  'text_present',
  'clickable'
]);

/**
 * Visual Proof Object (VP1)
 *
 * A proof has two observations, `before` and `after`, each with screenshot
 * metadata, visual primitives, and optional explicit evidence supplied by an
 * adapter (browser automation, VLM grounding, OCR, accessibility probe, etc.).
 * This core does not read pixels or run browsers; it deterministically checks
 * the supplied primitives/evidence.
 *
 * Minimal shape:
 * {
 *   schemaVersion: 'vp1',
 *   id: 'button-overlap-proof',
 *   title: 'Submit button no longer overlaps footer',
 *   observations: {
 *     before: {
 *       screenshot: { path, width, height, viewport, url?, route? },
 *       primitives: [{ id, type: 'box', x, y, width, height }, ...],
 *       evidence: { visibility, detectedText, clickTargets }
 *     },
 *     after: { screenshot, video?, primitives, evidence }
 *   },
 *   predicates: [
 *     { id, type: 'not_overlapping', primitives: ['submit_button', 'footer'] }
 *   ]
 * }
 */

export class VisualProofError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'VisualProofError';
    this.details = details;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, at) {
  if (!isObject(value)) {
    throw new VisualProofError(`${at} must be an object`, { at, value });
  }
  return value;
}

function assertArray(value, at) {
  if (!Array.isArray(value)) {
    throw new VisualProofError(`${at} must be an array`, { at, value });
  }
  return value;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function assertNonEmptyString(value, at) {
  if (!isNonEmptyString(value)) {
    throw new VisualProofError(`${at} must be a non-empty string`, { at, value });
  }
  return value;
}

function assertFiniteNumber(value, at) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new VisualProofError(`${at} must be a finite number`, { at, value });
  }
  return value;
}

function assertPositiveNumber(value, at) {
  const number = assertFiniteNumber(value, at);
  if (number <= 0) {
    throw new VisualProofError(`${at} must be greater than 0`, { at, value });
  }
  return number;
}

function optionalPositiveNumber(value, at) {
  if (value === undefined || value === null) return undefined;
  return assertPositiveNumber(value, at);
}

function numberOrDefault(value, fallback, at) {
  if (value === undefined || value === null) return fallback;
  return assertFiniteNumber(value, at);
}

function coordinateSpaceFor(primitiveOrPoint, observation = {}, proof = {}, override) {
  return (
    override ||
    primitiveOrPoint?.coordinateSpace ||
    observation?.coordinateSpace ||
    proof?.coordinateSpace ||
    'pixel'
  );
}

function normalizeCoordinateSpace(space, at) {
  if (space === 'pixel' || space === 'pixels') return 'pixel';
  if (space === 'normalized' || space === 'normalised') return 'normalized';
  throw new VisualProofError(`${at} has unsupported coordinateSpace ${JSON.stringify(space)}`, {
    at,
    supported: ['pixel', 'normalized']
  });
}

function screenshotDimensions(observation, at) {
  const screenshot = assertObject(observation?.screenshot, `${at}.screenshot`);
  return {
    width: assertPositiveNumber(screenshot.width, `${at}.screenshot.width`),
    height: assertPositiveNumber(screenshot.height, `${at}.screenshot.height`)
  };
}

function scaleCoordinate(value, axis, observation, proof, coordinateSpace, at) {
  const number = assertFiniteNumber(value, at);
  if (coordinateSpace === 'pixel') return number;
  const dimensions = screenshotDimensions(observation, at.replace(/\.[^.]+$/, ''));
  return axis === 'x' ? number * dimensions.width : number * dimensions.height;
}

function validateScreenshot(screenshot, at) {
  assertObject(screenshot, at);
  assertNonEmptyString(screenshot.path, `${at}.path`);
  assertPositiveNumber(screenshot.width, `${at}.width`);
  assertPositiveNumber(screenshot.height, `${at}.height`);
  assertObject(screenshot.viewport, `${at}.viewport`);
  assertPositiveNumber(screenshot.viewport.width, `${at}.viewport.width`);
  assertPositiveNumber(screenshot.viewport.height, `${at}.viewport.height`);

  if (screenshot.url !== undefined) assertNonEmptyString(screenshot.url, `${at}.url`);
  if (screenshot.route !== undefined) assertNonEmptyString(screenshot.route, `${at}.route`);
  if (!isNonEmptyString(screenshot.url) && !isNonEmptyString(screenshot.route)) {
    throw new VisualProofError(`${at} must include route or url`, {
      at,
      required: ['route', 'url']
    });
  }
}

function validateVideo(video, at, options = {}) {
  assertObject(video, at);
  assertNonEmptyString(video.path, `${at}.path`);
  const hasDuration = video.durationMs != null || video.durationSeconds != null;
  if (!hasDuration) {
    throw new VisualProofError(`${at} must include durationMs or durationSeconds`, { at });
  }
  optionalPositiveNumber(video.durationMs, `${at}.durationMs`);
  optionalPositiveNumber(video.durationSeconds, `${at}.durationSeconds`);

  const hasFrameMetadata = video.frameCount !== undefined || video.sampledFrames !== undefined;
  if (options.requireFrameMetadata && !hasFrameMetadata) {
    throw new VisualProofError(`${at} must include frameCount or sampledFrames`, { at });
  }
  if (video.frameCount !== undefined) {
    assertPositiveNumber(video.frameCount, `${at}.frameCount`);
  }
  if (video.sampledFrames !== undefined) {
    const frames = assertArray(video.sampledFrames, `${at}.sampledFrames`);
    frames.forEach((frame, index) => {
      assertObject(frame, `${at}.sampledFrames[${index}]`);
      if (frame.timeMs !== undefined) assertFiniteNumber(frame.timeMs, `${at}.sampledFrames[${index}].timeMs`);
      if (frame.path !== undefined) assertNonEmptyString(frame.path, `${at}.sampledFrames[${index}].path`);
    });
  }
}

function validatePrimitive(primitive, at) {
  assertObject(primitive, at);
  assertNonEmptyString(primitive.id, `${at}.id`);
  assertNonEmptyString(primitive.type, `${at}.type`);

  if (primitive.coordinateSpace !== undefined) {
    normalizeCoordinateSpace(primitive.coordinateSpace, at);
  }

  if (primitive.type === 'box') {
    assertFiniteNumber(primitive.x, `${at}.x`);
    assertFiniteNumber(primitive.y, `${at}.y`);
    assertPositiveNumber(primitive.width, `${at}.width`);
    assertPositiveNumber(primitive.height, `${at}.height`);
    return;
  }

  if (primitive.type === 'point') {
    assertFiniteNumber(primitive.x, `${at}.x`);
    assertFiniteNumber(primitive.y, `${at}.y`);
    return;
  }

  if (primitive.type === 'path') {
    const points = assertArray(primitive.points, `${at}.points`);
    if (points.length < 2) {
      throw new VisualProofError(`${at}.points must include at least two points`, { at: `${at}.points` });
    }
    points.forEach((point, index) => {
      assertObject(point, `${at}.points[${index}]`);
      assertFiniteNumber(point.x, `${at}.points[${index}].x`);
      assertFiniteNumber(point.y, `${at}.points[${index}].y`);
    });
    return;
  }

  throw new VisualProofError(`${at}.type must be one of box, point, path`, {
    at: `${at}.type`,
    value: primitive.type
  });
}

function validateObservation(observation, phase, options = {}) {
  assertObject(observation, `observations.${phase}`);
  if (observation.coordinateSpace !== undefined) {
    normalizeCoordinateSpace(observation.coordinateSpace, `observations.${phase}`);
  }
  validateScreenshot(observation.screenshot, `observations.${phase}.screenshot`);
  if (options.requireVideo && observation.video === undefined) {
    throw new VisualProofError(`observations.${phase}.video is required`, {
      at: `observations.${phase}.video`
    });
  }
  if (observation.video !== undefined) {
    validateVideo(observation.video, `observations.${phase}.video`, {
      requireFrameMetadata: options.requireVideoFrameMetadata === true
    });
  }

  const primitives = assertArray(observation.primitives, `observations.${phase}.primitives`);
  const seen = new Set();
  primitives.forEach((primitive, index) => {
    validatePrimitive(primitive, `observations.${phase}.primitives[${index}]`);
    if (seen.has(primitive.id)) {
      throw new VisualProofError(`Duplicate primitive id ${JSON.stringify(primitive.id)} in ${phase}`, {
        phase,
        primitiveId: primitive.id
      });
    }
    seen.add(primitive.id);
  });

  if (observation.evidence !== undefined) {
    assertObject(observation.evidence, `observations.${phase}.evidence`);
  }
}

function validatePredicate(predicate, index) {
  assertObject(predicate, `predicates[${index}]`);
  assertNonEmptyString(predicate.id, `predicates[${index}].id`);
  assertNonEmptyString(predicate.type, `predicates[${index}].type`);
  if (!KNOWN_PREDICATE_TYPES.has(predicate.type)) {
    throw new VisualProofError(`predicates[${index}].type ${JSON.stringify(predicate.type)} is not supported`, {
      at: `predicates[${index}].type`,
      supported: [...KNOWN_PREDICATE_TYPES]
    });
  }
}

function validateProofPreamble(proof) {
  assertObject(proof, 'proof');
  if (proof.schemaVersion !== undefined && proof.schemaVersion !== VISUAL_PROOF_SCHEMA_VERSION) {
    throw new VisualProofError(`schemaVersion must be ${VISUAL_PROOF_SCHEMA_VERSION}`, {
      at: 'schemaVersion',
      value: proof.schemaVersion
    });
  }
  if (proof.coordinateSpace !== undefined) {
    normalizeCoordinateSpace(proof.coordinateSpace, 'coordinateSpace');
  }
  if (proof.id !== undefined) assertNonEmptyString(proof.id, 'id');
  return assertObject(proof.observations, 'observations');
}

function validatePredicateList(proof) {
  const predicates = assertArray(proof.predicates, 'predicates');
  if (predicates.length === 0) {
    throw new VisualProofError('predicates must include at least one predicate', { at: 'predicates' });
  }
  const seen = new Set();
  predicates.forEach((predicate, index) => {
    validatePredicate(predicate, index);
    if (seen.has(predicate.id)) {
      throw new VisualProofError(`Duplicate predicate id ${JSON.stringify(predicate.id)}`, {
        predicateId: predicate.id
      });
    }
    seen.add(predicate.id);
  });
  return predicates;
}

export function validateDraftProof(proof) {
  const observations = validateProofPreamble(proof);
  validateObservation(observations.before, 'before');
  if (observations.after !== undefined) {
    throw new VisualProofError('draft proofs must omit observations.after; use validateProof for complete before/after proofs', {
      at: 'observations.after'
    });
  }
  validatePredicateList(proof);
  return proof;
}

export function validateProof(proof) {
  const observations = validateProofPreamble(proof);
  validateObservation(observations.before, 'before');
  validateObservation(observations.after, 'after', { requireVideo: true, requireVideoFrameMetadata: true });
  validatePredicateList(proof);
  return proof;
}

export function buildPrimitiveMap(observation) {
  const primitives = assertArray(observation?.primitives, 'observation.primitives');
  const map = new Map();
  primitives.forEach((primitive) => {
    map.set(primitive.id, primitive);
  });
  return map;
}

export function getPrimitive(observation, id, phase = 'observation') {
  assertNonEmptyString(id, 'primitive id');
  const map = buildPrimitiveMap(observation);
  const primitive = map.get(id);
  if (!primitive) {
    throw new VisualProofError(`Primitive ${JSON.stringify(id)} was not found in ${phase}`, {
      phase,
      primitiveId: id
    });
  }
  return primitive;
}

export function boxToPixels(box, observation = {}, proof = {}) {
  if (!box || box.type !== 'box') {
    throw new VisualProofError(`Primitive ${JSON.stringify(box?.id)} must be a box`, {
      primitiveId: box?.id,
      type: box?.type
    });
  }
  const coordinateSpace = normalizeCoordinateSpace(coordinateSpaceFor(box, observation, proof), `primitive ${box.id}`);
  return {
    ...box,
    type: 'box',
    x: scaleCoordinate(box.x, 'x', observation, proof, coordinateSpace, `primitive ${box.id}.x`),
    y: scaleCoordinate(box.y, 'y', observation, proof, coordinateSpace, `primitive ${box.id}.y`),
    width: scaleCoordinate(box.width, 'x', observation, proof, coordinateSpace, `primitive ${box.id}.width`),
    height: scaleCoordinate(box.height, 'y', observation, proof, coordinateSpace, `primitive ${box.id}.height`),
    coordinateSpace: 'pixel'
  };
}

export function pointToPixels(point, observation = {}, proof = {}, coordinateSpaceOverride) {
  const coordinateSpace = normalizeCoordinateSpace(
    coordinateSpaceFor(point, observation, proof, coordinateSpaceOverride),
    `point ${point?.id || ''}`.trim()
  );
  return {
    ...point,
    type: point.type || 'point',
    x: scaleCoordinate(point.x, 'x', observation, proof, coordinateSpace, `point ${point?.id || ''}.x`.trim()),
    y: scaleCoordinate(point.y, 'y', observation, proof, coordinateSpace, `point ${point?.id || ''}.y`.trim()),
    coordinateSpace: 'pixel'
  };
}

export function pathToPixels(pathPrimitive, observation = {}, proof = {}) {
  if (!pathPrimitive || pathPrimitive.type !== 'path') {
    throw new VisualProofError(`Primitive ${JSON.stringify(pathPrimitive?.id)} must be a path`, {
      primitiveId: pathPrimitive?.id,
      type: pathPrimitive?.type
    });
  }
  const coordinateSpace = normalizeCoordinateSpace(
    coordinateSpaceFor(pathPrimitive, observation, proof),
    `primitive ${pathPrimitive.id}`
  );
  return {
    ...pathPrimitive,
    type: 'path',
    points: pathPrimitive.points.map((point) => pointToPixels(point, observation, proof, coordinateSpace)),
    coordinateSpace: 'pixel'
  };
}

export function boxArea(box) {
  return assertPositiveNumber(box.width, 'box.width') * assertPositiveNumber(box.height, 'box.height');
}

export function intersectionBox(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) {
    return { x: x1, y: y1, width: 0, height: 0 };
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function intersectionArea(a, b) {
  const intersection = intersectionBox(a, b);
  return intersection.width * intersection.height;
}

export function overlapRatio(a, b, basis = 'min_area') {
  const intersection = intersectionArea(a, b);
  if (intersection === 0) return 0;
  if (basis === 'first') return intersection / boxArea(a);
  if (basis === 'second') return intersection / boxArea(b);
  if (basis === 'union') {
    return intersection / (boxArea(a) + boxArea(b) - intersection);
  }
  if (basis === 'min_area') {
    return intersection / Math.min(boxArea(a), boxArea(b));
  }
  throw new VisualProofError(`Unsupported overlap ratio basis ${JSON.stringify(basis)}`, {
    basis,
    supported: ['min_area', 'first', 'second', 'union']
  });
}

export function boxCenter(box) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function containsPoint(container, point, tolerancePx = 0) {
  return (
    point.x >= container.x - tolerancePx &&
    point.x <= container.x + container.width + tolerancePx &&
    point.y >= container.y - tolerancePx &&
    point.y <= container.y + container.height + tolerancePx
  );
}

export function containsBox(container, inner, tolerancePx = 0) {
  return (
    inner.x >= container.x - tolerancePx &&
    inner.y >= container.y - tolerancePx &&
    inner.x + inner.width <= container.x + container.width + tolerancePx &&
    inner.y + inner.height <= container.y + container.height + tolerancePx
  );
}

function result(predicate, phase, passed, reason, details = {}) {
  return {
    id: predicate.id,
    type: predicate.type,
    phase,
    passed,
    status: passed ? 'passed' : 'failed',
    reason,
    details
  };
}

function predicatePrimitiveIds(predicate, count, at) {
  const ids = Array.isArray(predicate.primitives) ? predicate.primitives : [];
  if (ids.length >= count) return ids.slice(0, count);
  const fallbacks = [predicate.subject, predicate.inner, predicate.a, predicate.target, predicate.container, predicate.outer, predicate.b]
    .filter((value) => value !== undefined);
  const combined = [...ids, ...fallbacks];
  if (combined.length < count || combined.some((id) => typeof id !== 'string' || id.trim() === '')) {
    throw new VisualProofError(`${at} must reference ${count} primitive id${count === 1 ? '' : 's'}`, {
      predicateId: predicate.id,
      predicateType: predicate.type
    });
  }
  return combined.slice(0, count);
}

function subjectId(predicate, at) {
  const id = predicate.subject || predicate.primitive || predicate.target || predicate.path || predicate.primitives?.[0];
  if (typeof id !== 'string' || id.trim() === '') {
    throw new VisualProofError(`${at} must reference a subject primitive id`, {
      predicateId: predicate.id,
      predicateType: predicate.type
    });
  }
  return id;
}

function evaluateNotOverlapping(predicate, observation, phase, proof) {
  const [aId, bId] = predicatePrimitiveIds(predicate, 2, `predicate ${predicate.id}`);
  const a = boxToPixels(getPrimitive(observation, aId, phase), observation, proof);
  const b = boxToPixels(getPrimitive(observation, bId, phase), observation, proof);
  const basis = predicate.ratioBasis || 'min_area';
  const ratio = overlapRatio(a, b, basis);
  const maxOverlapRatio = numberOrDefault(predicate.maxOverlapRatio ?? predicate.tolerance, 0, `predicate ${predicate.id}.maxOverlapRatio`);
  const area = intersectionArea(a, b);
  const passed = ratio <= maxOverlapRatio + EPSILON;
  return result(
    predicate,
    phase,
    passed,
    passed
      ? `overlap ratio ${formatNumber(ratio)} <= allowed ${formatNumber(maxOverlapRatio)}`
      : `overlap ratio ${formatNumber(ratio)} > allowed ${formatNumber(maxOverlapRatio)}`,
    { primitives: [aId, bId], intersectionArea: area, overlapRatio: ratio, ratioBasis: basis, maxOverlapRatio }
  );
}

function evaluateInside(predicate, observation, phase, proof) {
  const innerId = predicate.subject || predicate.inner || predicate.primitives?.[0];
  const outerId = predicate.container || predicate.target || predicate.outer || predicate.primitives?.[1];
  if (!innerId || !outerId) {
    throw new VisualProofError(`predicate ${predicate.id} must include subject and container primitive ids`, {
      predicateId: predicate.id
    });
  }
  const innerPrimitive = getPrimitive(observation, innerId, phase);
  const outer = boxToPixels(getPrimitive(observation, outerId, phase), observation, proof);
  const tolerancePx = numberOrDefault(predicate.tolerancePx, 0, `predicate ${predicate.id}.tolerancePx`);
  let passed;
  let details;
  if (innerPrimitive.type === 'box') {
    const inner = boxToPixels(innerPrimitive, observation, proof);
    passed = containsBox(outer, inner, tolerancePx);
    details = { subject: innerId, container: outerId, tolerancePx, subjectBox: stripPrimitiveForDetails(inner), containerBox: stripPrimitiveForDetails(outer) };
  } else if (innerPrimitive.type === 'point') {
    const point = pointToPixels(innerPrimitive, observation, proof);
    passed = containsPoint(outer, point, tolerancePx);
    details = { subject: innerId, container: outerId, tolerancePx, point: { x: point.x, y: point.y }, containerBox: stripPrimitiveForDetails(outer) };
  } else {
    throw new VisualProofError(`predicate ${predicate.id} subject must be a box or point for inside`, {
      predicateId: predicate.id,
      primitiveId: innerId,
      type: innerPrimitive.type
    });
  }
  return result(
    predicate,
    phase,
    passed,
    passed
      ? `${innerId} is inside ${outerId}`
      : `${innerId} is not inside ${outerId}`,
    details
  );
}

function alignmentValue(primitive, axis, observation, proof) {
  if (primitive.type === 'point') {
    const point = pointToPixels(primitive, observation, proof);
    if (axis === 'center_x' || axis === 'left' || axis === 'right') return point.x;
    if (axis === 'center_y' || axis === 'top' || axis === 'bottom') return point.y;
  }

  if (primitive.type !== 'box') {
    throw new VisualProofError(`Primitive ${primitive.id} must be a box or point for aligned`, {
      primitiveId: primitive.id,
      type: primitive.type
    });
  }
  const box = boxToPixels(primitive, observation, proof);
  const center = boxCenter(box);
  if (axis === 'center_x') return center.x;
  if (axis === 'center_y') return center.y;
  if (axis === 'left') return box.x;
  if (axis === 'right') return box.x + box.width;
  if (axis === 'top') return box.y;
  if (axis === 'bottom') return box.y + box.height;
  throw new VisualProofError(`Unsupported alignment axis ${JSON.stringify(axis)}`, {
    supported: ['center_x', 'center_y', 'left', 'right', 'top', 'bottom']
  });
}

function normalizeAlignmentAxis(axis) {
  const raw = axis || 'center_y';
  if (raw === 'x' || raw === 'vertical' || raw === 'vertical_center' || raw === 'center_x') return 'center_x';
  if (raw === 'y' || raw === 'horizontal' || raw === 'horizontal_center' || raw === 'center_y') return 'center_y';
  if (raw === 'baseline') return 'bottom';
  return raw;
}

function evaluateAligned(predicate, observation, phase, proof) {
  const ids = Array.isArray(predicate.primitives) ? predicate.primitives : [];
  if (ids.length < 2) {
    throw new VisualProofError(`predicate ${predicate.id} must include at least two primitives for aligned`, {
      predicateId: predicate.id
    });
  }
  const axis = normalizeAlignmentAxis(predicate.axis);
  const tolerancePx = numberOrDefault(predicate.tolerancePx, 2, `predicate ${predicate.id}.tolerancePx`);
  const values = ids.map((id) => {
    const primitive = getPrimitive(observation, id, phase);
    return { id, value: alignmentValue(primitive, axis, observation, proof) };
  });
  const numericValues = values.map((entry) => entry.value);
  const maxDelta = Math.max(...numericValues) - Math.min(...numericValues);
  const passed = maxDelta <= tolerancePx + EPSILON;
  return result(
    predicate,
    phase,
    passed,
    passed
      ? `${ids.join(', ')} aligned on ${axis} within ${formatNumber(tolerancePx)}px`
      : `${ids.join(', ')} are ${formatNumber(maxDelta)}px apart on ${axis}, exceeding ${formatNumber(tolerancePx)}px`,
    { primitives: ids, axis, tolerancePx, values, maxDelta }
  );
}

function matchesSelector(primitive, selector = {}) {
  if (!selector || Object.keys(selector).length === 0) return true;
  if (selector.type !== undefined && primitive.type !== selector.type) return false;
  if (selector.label !== undefined && primitive.label !== selector.label) return false;
  if (selector.role !== undefined && primitive.role !== selector.role) return false;
  if (selector.id !== undefined && primitive.id !== selector.id) return false;
  if (selector.idPrefix !== undefined && !primitive.id.startsWith(selector.idPrefix)) return false;
  if (Array.isArray(selector.ids) && !selector.ids.includes(primitive.id)) return false;
  if (selector.labelIncludes !== undefined) {
    const label = String(primitive.label || '').toLowerCase();
    if (!label.includes(String(selector.labelIncludes).toLowerCase())) return false;
  }
  return true;
}

function evaluateCountEquals(predicate, observation, phase) {
  const expected = predicate.expected ?? predicate.count;
  if (!Number.isInteger(expected) || expected < 0) {
    throw new VisualProofError(`predicate ${predicate.id}.expected must be a non-negative integer`, {
      predicateId: predicate.id,
      value: expected
    });
  }
  const selector = predicate.selector || {};
  assertObject(selector, `predicate ${predicate.id}.selector`);
  const matched = observation.primitives.filter((primitive) => matchesSelector(primitive, selector));
  const passed = matched.length === expected;
  return result(
    predicate,
    phase,
    passed,
    passed
      ? `found ${matched.length} primitive(s), expected ${expected}`
      : `found ${matched.length} primitive(s), expected ${expected}`,
    { selector, expected, actual: matched.length, matchedPrimitiveIds: matched.map((primitive) => primitive.id) }
  );
}

function evaluatePathContinuous(predicate, observation, phase, proof) {
  const id = subjectId(predicate, `predicate ${predicate.id}`);
  const primitive = pathToPixels(getPrimitive(observation, id, phase), observation, proof);
  const maxGapPx = numberOrDefault(predicate.maxGapPx ?? predicate.maxDistancePx, 24, `predicate ${predicate.id}.maxGapPx`);
  const segmentDistances = [];
  for (let index = 1; index < primitive.points.length; index += 1) {
    segmentDistances.push(distance(primitive.points[index - 1], primitive.points[index]));
  }
  const largestGapPx = Math.max(...segmentDistances);
  const passed = largestGapPx <= maxGapPx + EPSILON;
  return result(
    predicate,
    phase,
    passed,
    passed
      ? `${id} path is continuous; largest gap ${formatNumber(largestGapPx)}px <= ${formatNumber(maxGapPx)}px`
      : `${id} path has gap ${formatNumber(largestGapPx)}px > ${formatNumber(maxGapPx)}px`,
    { path: id, maxGapPx, largestGapPx, segmentDistances }
  );
}

function bucketLookup(bucket, id) {
  if (bucket === undefined || bucket === null) return undefined;
  if (Array.isArray(bucket)) {
    return bucket.find((entry) => entry?.id === id || entry?.primitiveId === id || entry?.target === id);
  }
  if (isObject(bucket)) return bucket[id];
  return undefined;
}

function evaluateVisible(predicate, observation, phase) {
  const id = subjectId(predicate, `predicate ${predicate.id}`);
  getPrimitive(observation, id, phase);
  const evidence = observation.evidence || {};
  const record = bucketLookup(evidence.visibility, id);
  if (record === undefined) {
    return result(predicate, phase, false, `missing explicit visibility evidence for ${id}`, {
      subject: id,
      requiredEvidence: `evidence.visibility.${id}`
    });
  }
  const visible = typeof record === 'boolean' ? record : record?.visible;
  const passed = visible === true;
  return result(
    predicate,
    phase,
    passed,
    passed ? `${id} has explicit visible=true evidence` : `${id} does not have visible=true evidence`,
    { subject: id, evidence: record }
  );
}

function detectedTextEntries(evidence) {
  const detectedText = evidence.detectedText;
  if (!Array.isArray(detectedText)) return undefined;
  return detectedText
    .map((entry) => {
      if (typeof entry === 'string') return { text: entry };
      if (isObject(entry) && typeof entry.text === 'string') return entry;
      return null;
    })
    .filter(Boolean);
}

function evaluateTextPresent(predicate, observation, phase) {
  const expectedText = predicate.text ?? predicate.expectedText;
  if (typeof expectedText !== 'string' || expectedText.length === 0) {
    throw new VisualProofError(`predicate ${predicate.id} must include text or expectedText`, {
      predicateId: predicate.id
    });
  }
  const evidence = observation.evidence || {};
  const entries = detectedTextEntries(evidence);
  if (!entries) {
    return result(predicate, phase, false, 'missing explicit detectedText evidence', {
      requiredEvidence: 'evidence.detectedText',
      expectedText
    });
  }
  const matchMode = predicate.match || 'includes';
  const caseSensitive = predicate.caseSensitive === true;
  const expected = caseSensitive ? expectedText : expectedText.toLowerCase();
  const matches = entries.filter((entry) => {
    const actual = caseSensitive ? entry.text : entry.text.toLowerCase();
    if (matchMode === 'exact') return actual === expected;
    if (matchMode === 'includes') return actual.includes(expected);
    throw new VisualProofError(`predicate ${predicate.id}.match ${JSON.stringify(matchMode)} is unsupported`, {
      supported: ['includes', 'exact']
    });
  });
  const passed = matches.length > 0;
  return result(
    predicate,
    phase,
    passed,
    passed ? `detected text includes ${JSON.stringify(expectedText)}` : `did not detect text ${JSON.stringify(expectedText)}`,
    { expectedText, match: matchMode, caseSensitive, matchedEntries: matches }
  );
}

function evaluateClickable(predicate, observation, phase) {
  const id = subjectId(predicate, `predicate ${predicate.id}`);
  getPrimitive(observation, id, phase);
  const evidence = observation.evidence || {};
  const record = bucketLookup(evidence.clickTargets, id);
  if (record === undefined) {
    return result(predicate, phase, false, `missing explicit click target evidence for ${id}`, {
      subject: id,
      requiredEvidence: `evidence.clickTargets.${id}`
    });
  }
  const clickable = typeof record === 'boolean' ? record : (record?.clickable ?? record?.canClick);
  const passed = clickable === true;
  return result(
    predicate,
    phase,
    passed,
    passed ? `${id} has explicit clickable=true evidence` : `${id} does not have clickable=true evidence`,
    { subject: id, evidence: record }
  );
}

export function evaluatePredicate(predicate, observation, phase = 'observation', proof = {}) {
  switch (predicate.type) {
    case 'not_overlapping':
      return evaluateNotOverlapping(predicate, observation, phase, proof);
    case 'inside':
      return evaluateInside(predicate, observation, phase, proof);
    case 'aligned':
      return evaluateAligned(predicate, observation, phase, proof);
    case 'count_equals':
      return evaluateCountEquals(predicate, observation, phase, proof);
    case 'path_continuous':
      return evaluatePathContinuous(predicate, observation, phase, proof);
    case 'visible':
      return evaluateVisible(predicate, observation, phase, proof);
    case 'text_present':
      return evaluateTextPresent(predicate, observation, phase, proof);
    case 'clickable':
      return evaluateClickable(predicate, observation, phase, proof);
    default:
      throw new VisualProofError(`Unsupported predicate type ${JSON.stringify(predicate.type)}`, {
        predicateId: predicate.id,
        type: predicate.type
      });
  }
}

function summarizeResults(results) {
  const failedResults = results.filter((entry) => !entry.passed);
  const passedResults = results.filter((entry) => entry.passed);
  return {
    passed: failedResults.length === 0,
    total: results.length,
    passedCount: passedResults.length,
    failedCount: failedResults.length,
    passingPredicateIds: passedResults.map((entry) => entry.id),
    failingPredicateIds: failedResults.map((entry) => entry.id),
    results
  };
}

function classifyVerdict(before, after) {
  if (!before.passed && after.passed) return 'fixed';
  if (before.passed && after.passed) return 'passing';
  if (before.passed && !after.passed) return 'regressed';
  return 'still_failing';
}

export function evaluateProof(proof) {
  validateProof(proof);
  const predicates = proof.predicates;
  const beforeResults = predicates.map((predicate) => evaluatePredicate(predicate, proof.observations.before, 'before', proof));
  const afterResults = predicates.map((predicate) => evaluatePredicate(predicate, proof.observations.after, 'after', proof));
  const before = summarizeResults(beforeResults);
  const after = summarizeResults(afterResults);
  return {
    schemaVersion: VISUAL_PROOF_SCHEMA_VERSION,
    proofId: proof.id || null,
    title: proof.title || null,
    verdict: classifyVerdict(before, after),
    before,
    after,
    fixedPredicateIds: before.failingPredicateIds.filter((id) => after.passingPredicateIds.includes(id)),
    unresolvedPredicateIds: after.failingPredicateIds
  };
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(4)).toString();
}

function stripPrimitiveForDetails(primitive) {
  if (primitive.type === 'box') {
    return { id: primitive.id, x: primitive.x, y: primitive.y, width: primitive.width, height: primitive.height };
  }
  if (primitive.type === 'point') {
    return { id: primitive.id, x: primitive.x, y: primitive.y };
  }
  return { id: primitive.id, type: primitive.type };
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function observationMarkdown(observation, phase) {
  const screenshot = observation.screenshot;
  const lines = [];
  lines.push(`- Screenshot: \`${screenshot.path}\` (${screenshot.width}×${screenshot.height})`);
  if (screenshot.viewport) {
    lines.push(`- Viewport: ${screenshot.viewport.width}×${screenshot.viewport.height}`);
  }
  if (screenshot.url) lines.push(`- URL: ${screenshot.url}`);
  if (screenshot.route) lines.push(`- Route: ${screenshot.route}`);
  if (phase === 'after' && observation.video) {
    const video = observation.video;
    const duration = video.durationMs !== undefined ? `${video.durationMs}ms` : `${video.durationSeconds}s`;
    const frames = video.frameCount !== undefined ? `, ${video.frameCount} frames` : '';
    const sampled = Array.isArray(video.sampledFrames) ? `, ${video.sampledFrames.length} sampled frame(s)` : '';
    lines.push(`- Video: \`${video.path}\` (${duration}${frames}${sampled})`);
  }
  return lines.join('\n');
}

export function generateMarkdownReport(proof, evaluation = evaluateProof(proof)) {
  const title = proof.title || proof.id || 'Visual proof';
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  if (proof.description) {
    lines.push(proof.description);
    lines.push('');
  }
  lines.push(`**Verdict:** \`${evaluation.verdict}\``);
  lines.push('');
  lines.push('## Evidence metadata');
  lines.push('');
  lines.push('### Before');
  lines.push(observationMarkdown(proof.observations.before, 'before'));
  lines.push('');
  lines.push('### After');
  lines.push(observationMarkdown(proof.observations.after, 'after'));
  lines.push('');
  lines.push('## Predicate results');
  lines.push('');
  lines.push('| Predicate | Type | Description | Before | After | Notes |');
  lines.push('|---|---|---|---:|---:|---|');
  for (const predicate of proof.predicates) {
    const before = evaluation.before.results.find((entry) => entry.id === predicate.id);
    const after = evaluation.after.results.find((entry) => entry.id === predicate.id);
    lines.push(
      `| ${mdCell(predicate.id)} | ${mdCell(predicate.type)} | ${mdCell(predicate.description || '')} | ${before?.passed ? 'pass' : 'fail'} | ${after?.passed ? 'pass' : 'fail'} | ${mdCell(`${before?.reason || ''} / ${after?.reason || ''}`)} |`
    );
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Before: ${evaluation.before.passedCount}/${evaluation.before.total} predicates passed.`);
  lines.push(`- After: ${evaluation.after.passedCount}/${evaluation.after.total} predicates passed.`);
  lines.push(`- Fixed predicates: ${evaluation.fixedPredicateIds.length ? evaluation.fixedPredicateIds.join(', ') : 'none'}.`);
  lines.push(`- Unresolved predicates: ${evaluation.unresolvedPredicateIds.length ? evaluation.unresolvedPredicateIds.join(', ') : 'none'}.`);
  lines.push('');
  lines.push('## Boundary');
  lines.push('');
  lines.push('This report verifies supplied visual primitives and explicit evidence only. It does not perform screenshot capture, OCR, image segmentation, browser automation, or pixel diffing.');
  lines.push('');
  return lines.join('\n');
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function primitiveColor(primitive, index) {
  const palette = ['#d97706', '#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#0891b2', '#be123c'];
  if (primitive.role === 'bug' || primitive.id.includes('footer')) return '#dc2626';
  if (primitive.id.includes('submit') || primitive.role === 'target') return '#16a34a';
  return palette[index % palette.length];
}

export function generateOverlaySvg(proof, phase) {
  validateProof(proof);
  if (phase !== 'before' && phase !== 'after') {
    throw new VisualProofError('phase must be before or after', { phase });
  }
  const observation = proof.observations[phase];
  const { width, height } = screenshotDimensions(observation, `observations.${phase}`);
  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Visual proof ${phase} overlay">`);
  lines.push(`  <title>${xmlEscape(proof.title || proof.id || 'Visual proof')} — ${phase}</title>`);
  lines.push(`  <desc>Overlay for screenshot ${xmlEscape(observation.screenshot.path)}. The screenshot is referenced, not embedded.</desc>`);
  lines.push('  <rect x="0" y="0" width="100%" height="100%" fill="#ffffff" fill-opacity="0.02" stroke="#94a3b8" stroke-dasharray="8 8"/>');

  observation.primitives.forEach((primitive, index) => {
    const color = primitiveColor(primitive, index);
    const label = primitive.label || primitive.id;
    if (primitive.type === 'box') {
      const box = boxToPixels(primitive, observation, proof);
      lines.push(`  <rect x="${formatNumber(box.x)}" y="${formatNumber(box.y)}" width="${formatNumber(box.width)}" height="${formatNumber(box.height)}" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-width="3"/>`);
      lines.push(`  <text x="${formatNumber(box.x + 4)}" y="${formatNumber(Math.max(14, box.y - 6))}" fill="${color}" font-family="monospace" font-size="14">${xmlEscape(label)}</text>`);
    } else if (primitive.type === 'point') {
      const point = pointToPixels(primitive, observation, proof);
      lines.push(`  <circle cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="6" fill="${color}"/>`);
      lines.push(`  <text x="${formatNumber(point.x + 8)}" y="${formatNumber(point.y - 8)}" fill="${color}" font-family="monospace" font-size="14">${xmlEscape(label)}</text>`);
    } else if (primitive.type === 'path') {
      const pathPrimitive = pathToPixels(primitive, observation, proof);
      const points = pathPrimitive.points.map((point) => `${formatNumber(point.x)},${formatNumber(point.y)}`).join(' ');
      lines.push(`  <polyline points="${points}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
      const first = pathPrimitive.points[0];
      lines.push(`  <text x="${formatNumber(first.x + 8)}" y="${formatNumber(first.y - 8)}" fill="${color}" font-family="monospace" font-size="14">${xmlEscape(label)}</text>`);
    }
  });
  lines.push('</svg>');
  lines.push('');
  return lines.join('\n');
}

export function loadProofFromFile(filePath) {
  const resolved = path.resolve(filePath);
  let raw;
  try {
    raw = readFileSync(resolved, 'utf8');
  } catch (error) {
    throw new VisualProofError(`Unable to read proof file ${resolved}: ${error.message}`, { filePath: resolved });
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new VisualProofError(`Unable to parse proof JSON ${resolved}: ${error.message}`, { filePath: resolved });
  }
}

export function writeEvaluationArtifacts(proof, outDir) {
  if (typeof outDir !== 'string' || outDir.trim() === '') {
    throw new VisualProofError('outDir must be a non-empty string', { outDir });
  }
  const resolvedOutDir = path.resolve(outDir);
  mkdirSync(resolvedOutDir, { recursive: true });
  const evaluation = evaluateProof(proof);
  const evaluationPath = path.join(resolvedOutDir, 'evaluation.json');
  const reportPath = path.join(resolvedOutDir, 'report.md');
  const beforeOverlayPath = path.join(resolvedOutDir, 'before-overlay.svg');
  const afterOverlayPath = path.join(resolvedOutDir, 'after-overlay.svg');
  writeFileSync(evaluationPath, `${JSON.stringify(evaluation, null, 2)}\n`, 'utf8');
  writeFileSync(reportPath, generateMarkdownReport(proof, evaluation), 'utf8');
  writeFileSync(beforeOverlayPath, generateOverlaySvg(proof, 'before'), 'utf8');
  writeFileSync(afterOverlayPath, generateOverlaySvg(proof, 'after'), 'utf8');
  return {
    evaluation,
    paths: {
      outDir: resolvedOutDir,
      evaluation: evaluationPath,
      report: reportPath,
      overlays: {
        before: beforeOverlayPath,
        after: afterOverlayPath
      }
    }
  };
}

export default {
  VISUAL_PROOF_SCHEMA_VERSION,
  VisualProofError,
  validateProof,
  validateDraftProof,
  buildPrimitiveMap,
  getPrimitive,
  boxToPixels,
  pointToPixels,
  pathToPixels,
  boxArea,
  intersectionBox,
  intersectionArea,
  overlapRatio,
  boxCenter,
  distance,
  containsPoint,
  containsBox,
  evaluatePredicate,
  evaluateProof,
  generateMarkdownReport,
  generateOverlaySvg,
  loadProofFromFile,
  writeEvaluationArtifacts
};
