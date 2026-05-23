# Implementation notes — Visual Proof VP1

Date: 2026-05-23

## Decisions

- Implemented VP1 as a dependency-free ESM core (`src/visual-proof-core.mjs`) so local validation does not require `npm install` or Pi runtime imports.
- Kept the Pi extension (`extensions/visual-proof/index.ts`) as a thin adapter around dependency-free tool registration. The smoke test exercises the registered tool handler path with a mock `pi.registerTool` object.
- Evidence-backed predicates (`visible`, `text_present`, `clickable`) require explicit evidence fields and fail on missing evidence. They never infer from screenshot paths or primitive geometry.
- Reports include machine-readable `evaluation.json`, human-readable `report.md`, and SVG overlays that reference screenshots without embedding raster data.
- The example fixture is synthetic by design: it proves the before/after predicate workflow deterministically without committing screenshots, videos, browser output, or generated artifacts.

## Review fix decisions — 2026-05-23

- Full proof validation now enforces required before/after screenshot metadata (`path`, dimensions, viewport dimensions, and route or URL) plus required after video metadata (`path`, duration, and frame count or sampled frames) in the core paths used by CLI/tools/reports.
- `visual_proof_create` uses a separate before-only draft validator when `observations.after` is omitted; it writes the draft and returns `status`/`verdict` `draft`, while evaluate/report/CLI still require a complete proof.
- Default output slugs in both CLI and tool helpers now fall back for dot-only/path-normalizing ids so generated artifacts remain under `.visual-proof/` instead of collapsing to the cwd/project root.
- `visible` and `clickable` predicates now require the referenced subject primitive to exist before explicit evidence can pass them.

## Limitations

- VP1 verifies supplied primitives/evidence only. It does not capture screenshots, inspect pixels, verify file existence, run OCR, drive browsers, or call a VLM.
- The extension assumes Pi can load a TypeScript extension that imports local `.mjs` helpers. Dependency-free tests validate the helper path but not an authenticated Pi runtime load.
- `clickable`, `visible`, and `text_present` are only as trustworthy as the adapter evidence that populates them.
- SVG overlays are simple primitive drawings, not screenshot annotations with raster backgrounds.

## Validation evidence

All required validation was run locally without installing dependencies:

- `npm run check` — exit 0. Validated manifest/resources, fixture metadata, core tests, extension smoke, and CLI demo under `/tmp/visual-proof-package-check`.
- `node test/core.test.mjs` — exit 0. Covered geometry, normalized conversion, before/after verdict, required after video/frame metadata failures, evidence-backed failures, nonexistent visible/clickable subjects, alignment/count/path predicates, malformed errors, and report artifacts.
- `node test/extension-smoke.test.mjs` — exit 0. Registered `visual_proof_create`, `visual_proof_evaluate`, and `visual_proof_report` on a mock Pi object; covered fixture evaluation, before-only draft create, tool default slug safety, and CLI default slug safety.
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo-fix` — exit 0. Verdict `fixed`; generated `evaluation.json`, `report.md`, `before-overlay.svg`, and `after-overlay.svg`.
- CLI default output sanity with proof id `..` — exit 0. Wrote artifacts under `/tmp/visual-proof-cli-default-sanity-*/.visual-proof/visual-proof` and did not create `evaluation.json` in the temp cwd.

Demo verdict details:

- Before failed predicates: `button_not_over_footer`, `button_inside_main_content`, `button_center_inside_main_content`, `submit_button_clickable`.
- After failed predicates: none.

## Next adapter ideas

- Playwright adapter to capture screenshots/videos and populate screenshot/video metadata.
- DOM bounding-box adapter to ground initial `box` and `point` primitives from selectors.
- Browser hit-test adapter to populate `evidence.clickTargets`.
- Accessibility/text/OCR adapter to populate `evidence.detectedText`.
- Optional VLM grounding adapter for ambiguous visual primitives, with human-reviewable coordinates before deterministic VP1 evaluation.

## Review closeout follow-up 2

Codex Review accepted two additional P2 findings after the first blocker fix:
- Complete after-video metadata now rejects `sampledFrames: []`; sampled-frame evidence must include at least one actual frame when used instead of `frameCount`.
- Overlay SVGs now include an `<image href="...">` for the screenshot before drawing primitives, so the artifact is an actual overlay reference rather than boxes on a blank canvas.

I also moved local test/check generated artifacts from `/tmp` into ignored `.visual-proof-test-output/` because Codex's sandbox could not create `/tmp/*` directories even though the normal parent environment could. The user-facing CLI demo still supports any explicit `--out` path, including `/tmp/...`.
