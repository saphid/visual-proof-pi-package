# Visual Proof Object (VP1)

VP1 is a dependency-free JSON contract for proving UI visual bugs with grounded primitives instead of vague screenshot descriptions.

A proof contains:

- `observations.before` and `observations.after` with screenshot metadata.
- Optional `observations.after.video` metadata for acceptance evidence.
- Visual primitives: `box`, `point`, and `path` in either `pixel` or `normalized` coordinates.
- Predicates evaluated deterministically against both observations.
- Explicit evidence for predicates that cannot be inferred safely from geometry alone.

## Minimal shape

```json
{
  "schemaVersion": "vp1",
  "id": "button-overlap-proof",
  "coordinateSpace": "pixel",
  "observations": {
    "before": {
      "screenshot": { "path": "before.png", "width": 1024, "height": 640, "viewport": { "width": 1024, "height": 640 }, "route": "/checkout" },
      "primitives": [{ "id": "submit_button", "type": "box", "x": 800, "y": 535, "width": 160, "height": 56 }],
      "evidence": {}
    },
    "after": {
      "screenshot": { "path": "after.png", "width": 1024, "height": 640, "viewport": { "width": 1024, "height": 640 }, "route": "/checkout" },
      "video": { "path": "after.webm", "durationMs": 4200, "frameCount": 126 },
      "primitives": [{ "id": "submit_button", "type": "box", "x": 432, "y": 432, "width": 160, "height": 56 }],
      "evidence": {}
    }
  },
  "predicates": [{ "id": "submit_visible", "type": "visible", "subject": "submit_button" }]
}
```

## Primitives

- `box`: `{ id, type: "box", x, y, width, height, label?, role? }`
- `point`: `{ id, type: "point", x, y, label?, role? }`
- `path`: `{ id, type: "path", points: [{ x, y }, ...], label?, role? }`

Coordinates default to pixels. Set `coordinateSpace: "normalized"` at the proof, observation, or primitive level to use `0..1` values scaled by screenshot width/height.

## Predicates

Geometry-backed predicates:

- `not_overlapping`: two box primitives must have overlap ratio <= `maxOverlapRatio` (default `0`).
- `inside`: a `box` or `point` subject must be inside a container `box`.
- `aligned`: two or more boxes/points align on `center_x`, `center_y`, `left`, `right`, `top`, or `bottom` within `tolerancePx`.
- `count_equals`: counts primitives matching a selector (`type`, `label`, `role`, `id`, `ids`, `idPrefix`, `labelIncludes`).
- `path_continuous`: adjacent points in a path must be no farther than `maxGapPx`.

Evidence-backed predicates:

- `visible`: requires `observation.evidence.visibility[subject].visible === true`.
- `text_present`: requires `observation.evidence.detectedText` and matches `text`/`expectedText`.
- `clickable`: requires `observation.evidence.clickTargets[subject].clickable === true`.

Evidence-backed predicates never infer from screenshots, OCR, pixels, or the DOM. Missing evidence fails the predicate rather than silently passing.

## Verdicts

`evaluateProof(proof)` evaluates every predicate against `before` and `after`:

- `fixed`: before has failures and after passes all predicates.
- `passing`: both before and after pass.
- `regressed`: before passes but after fails.
- `still_failing`: both before and after have failures.

The CLI writes:

- `evaluation.json`: compact machine-readable verdict.
- `report.md`: human-readable summary.
- `before-overlay.svg` and `after-overlay.svg`: primitive overlays referencing screenshot paths without embedding image data.
