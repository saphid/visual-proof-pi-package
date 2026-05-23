# Implementation notes — Visual Proof VP1

Date: 2026-05-23

## Decisions

- Implemented VP1 as a dependency-free ESM core (`src/visual-proof-core.mjs`) so local validation does not require `npm install` or Pi runtime imports.
- Kept the Pi extension (`extensions/visual-proof/index.ts`) as a thin adapter around dependency-free tool registration. The smoke test exercises the registered tool handler path with a mock `pi.registerTool` object.
- Evidence-backed predicates (`visible`, `text_present`, `clickable`) require explicit evidence fields and fail on missing evidence. They never infer from screenshot paths or primitive geometry.
- Reports include machine-readable `evaluation.json`, human-readable `report.md`, and SVG overlays that reference screenshots without embedding raster data.
- The example fixture is synthetic by design: it proves the before/after predicate workflow deterministically without committing screenshots, videos, browser output, or generated artifacts.

## Limitations

- VP1 verifies supplied primitives/evidence only. It does not capture screenshots, inspect pixels, verify file existence, run OCR, drive browsers, or call a VLM.
- The extension assumes Pi can load a TypeScript extension that imports local `.mjs` helpers. Dependency-free tests validate the helper path but not an authenticated Pi runtime load.
- `clickable`, `visible`, and `text_present` are only as trustworthy as the adapter evidence that populates them.
- SVG overlays are simple primitive drawings, not screenshot annotations with raster backgrounds.

## Validation evidence

All required validation was run locally without installing dependencies:

- `npm run check` — exit 0. Validated manifest/resources, fixture metadata, core tests, extension smoke, and CLI demo under `/tmp/visual-proof-package-check`.
- `node test/core.test.mjs` — exit 0. Covered geometry, normalized conversion, before/after verdict, evidence-backed failures, alignment/count/path predicates, malformed errors, and report artifacts.
- `node test/extension-smoke.test.mjs` — exit 0. Registered `visual_proof_create`, `visual_proof_evaluate`, and `visual_proof_report` on a mock Pi object and evaluated the fixture through the registered handler.
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo` — exit 0. Verdict `fixed`; generated `evaluation.json`, `report.md`, `before-overlay.svg`, and `after-overlay.svg`.

Demo verdict details:

- Before failed predicates: `button_not_over_footer`, `button_inside_main_content`, `button_center_inside_main_content`, `submit_button_clickable`.
- After failed predicates: none.

## Next adapter ideas

- Playwright adapter to capture screenshots/videos and populate screenshot/video metadata.
- DOM bounding-box adapter to ground initial `box` and `point` primitives from selectors.
- Browser hit-test adapter to populate `evidence.clickTargets`.
- Accessibility/text/OCR adapter to populate `evidence.detectedText`.
- Optional VLM grounding adapter for ambiguous visual primitives, with human-reviewable coordinates before deterministic VP1 evaluation.
