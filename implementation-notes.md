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

## Next tool adapter ideas

- Capture backends for `browser-capture`, such as Playwright suites or browser-worker harnesses that produce screenshot/video metadata without becoming part of the verifier core.
- DOM bounding-box and hit-test helpers for `dom-bridge` that populate candidate `box`/`point` primitives and `evidence.clickTargets` from explicit browser/test-harness facts.
- Accessibility/text/OCR helpers that can populate `evidence.detectedText` while keeping OCR output reviewable evidence rather than a proof verdict.
- Optional VLM grounding helpers for ambiguous visual primitives, with human-reviewable coordinates before deterministic VP1 evaluation.

## Review closeout follow-up 2

Codex Review accepted two additional P2 findings after the first blocker fix:
- Complete after-video metadata now rejects `sampledFrames: []`; sampled-frame evidence must include at least one actual frame when used instead of `frameCount`.
- Overlay SVGs now include an `<image href="...">` for the screenshot before drawing primitives, so the artifact is an actual overlay reference rather than boxes on a blank canvas.

I also moved local test/check generated artifacts from `/tmp` into ignored `.visual-proof-test-output/` because Codex's sandbox could not create `/tmp/*` directories even though the normal parent environment could. The user-facing CLI demo still supports any explicit `--out` path, including `/tmp/...`.

## Merge closeout follow-up

Codex Review on the integrated commit found that overlay SVG screenshot `<image>` hrefs would break when the proof used relative screenshot paths and reports were written to a different output directory. `loadProofFromFile` now remembers the proof JSON directory, and `writeEvaluationArtifacts` rewrites relative screenshot hrefs relative to the overlay output directory. This keeps overlays connected to screenshots for normal `--out /tmp/...` CLI/tool usage.
- Follow-up: if a proof explicitly sets `assetBaseDir`, overlay href rewriting now uses that before the proof JSON directory, so users can keep screenshots/videos outside the proof file folder.
- Follow-up: relative `assetBaseDir` values are now resolved against the proof JSON directory when the proof was loaded from disk, not against the process cwd.

## Skill split implementation — 2026-05-23

Decisions:

- Kept `visual-proof` as the proof-only VP1 skill. It now explicitly consumes supplied screenshot/video metadata, primitives, predicates, and evidence, and states that it does not capture screenshots, drive browsers, inspect DOM, run OCR/VLM tooling, generate primitives from pixels, or fix app code.
- Added `visual-primitives` as the drawing/pointing skill. It produces VP1-compatible `box`, `point`, and `path` primitives from supplied screenshots, may suggest predicates or a draft handoff, and does not own DOM mapping, browser capture, OCR/VLM tooling, code fixing, complete proof evaluation, or a final fixed verdict.
- Added `docs/visual-proof-process.md` to describe the phase map and to keep proof, primitive drawing, capture, DOM/evidence, and fix-loop responsibilities separate.
- Updated `package.json` to expose both initial skills and updated `scripts/check-package.mjs` to validate the manifest, process doc, README references, and key boundary language for both skills while keeping validation dependency-free.

Validation evidence for this split:

- `npm run check` — exit 0. Validated the two-skill manifest, skill boundary language, process doc/README references, fixture metadata, core tests, extension smoke, and CLI demo under `.visual-proof-test-output/check-package`.
- `node test/core.test.mjs` — exit 0.
- `node test/extension-smoke.test.mjs` — exit 0.
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-skill-split-demo` — exit 0. Verdict `fixed`; generated `evaluation.json`, `report.md`, `before-overlay.svg`, and `after-overlay.svg`.
- `git diff --check` — exit 0.

## Adapter skills implementation — 2026-05-23

Decisions:

- Implemented `browser-capture`, `dom-bridge`, and `visual-fix-loop` as dependency-free Pi skill documents and manifest entries rather than browser/DOM runtime libraries. They define workflows, inputs, outputs, handoffs, and refusal boundaries over supplied artifacts or existing task tools.
- Kept `browser-capture` limited to screenshot/video capture metadata. It can reference available tools such as browser workers, Pi Autobrowse, Playwright, or user/test harnesses, but it does not draw primitives, inspect DOM evidence, fix code, or own VP1 verdicts.
- Kept `dom-bridge` limited to explicit DOM/evidence adaptation. It can produce candidate primitives plus `evidence.visibility`, `evidence.detectedText`, and `evidence.clickTargets`, but evidence remains separate from the final proof decision.
- Kept `visual-fix-loop` as an orchestrator for reproduce/capture/primitives/proof-draft/fix/recapture/proof sequencing. Project-specific code edits remain outside the verifier core, and final fixed claims must cite `visual-proof` output.
- Updated README, process docs, `visual-proof`, and `visual-primitives` to delegate to the implemented companion skills while preserving narrow proof-only and drawing/pointing-only boundaries.
- Extended the dependency-free package checker to validate all five skill manifest entries, skill boundary language, companion-skill delegation, and stale wording around the three adapter skill ids.

Validation evidence for this adapter-skill slice:

- `npm run check` — exit 0. Validated all five skill manifest entries, skill boundary wording, README/process docs, fixture metadata, core tests, extension smoke, and the CLI demo under `.visual-proof-test-output/check-package`.
- `node test/core.test.mjs` — exit 0.
- `node test/extension-smoke.test.mjs` — exit 0.
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-adapter-skills-demo` — exit 0. Verdict `fixed`; generated `evaluation.json`, `report.md`, `before-overlay.svg`, and `after-overlay.svg` in `/tmp/visual-proof-adapter-skills-demo`.
