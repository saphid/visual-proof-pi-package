# Visual Proof Process

The Visual Proof Process is a composable workflow for proving UI visual bugs and feature acceptance without bundling browser automation, DOM inspection, drawing, code fixing, and final verification into one skill.

The package currently implements two skills:

- `visual-primitives`: drawing/pointing only; produces VP1-compatible boxes, points, and paths from supplied screenshots.
- `visual-proof`: proof-only; creates and evaluates VP1 objects from supplied metadata, primitives, predicates, and explicit evidence.

Future skills or adapters may supply more inputs, but they are not implemented in this package.

## Phase map

| Phase | Purpose | Current owner | Output | Boundary |
| --- | --- | --- | --- | --- |
| 1. Observe or capture state | Obtain screenshot/video files and metadata for the UI state under review. | User, test harness, or future `browser-capture` adapter | Screenshot path, dimensions, viewport, route/URL; after video metadata for full acceptance | Not owned by `visual-proof` or `visual-primitives` |
| 2. Ground visual primitives | Draw or point at the relevant screenshot regions. | `visual-primitives` | VP1 `box`, `point`, and `path` primitives with stable ids | No DOM lookup, OCR, VLM calls, browser driving, or final verdict |
| 3. Define predicates and evidence needs | Convert the visual requirement into deterministic checks. | `visual-proof`; `visual-primitives` may suggest draft predicates | Predicate list plus notes about required explicit evidence | Evidence-backed predicates require supplied evidence rather than inference |
| 4. Save before proof | Preserve the failing observation as a VP1 draft. | `visual-proof` | Before-only VP1 draft with `status`/`verdict` `draft` | Not a final proof |
| 5. Fix the app | Change application code or configuration outside the proof package. | Human/agent implementation workflow; future `visual-fix-loop` orchestrator | App change plus a need to recapture | Not owned by either current skill |
| 6. Capture after state | Obtain after screenshot metadata and required after video metadata. | User, test harness, or future `browser-capture` adapter | After observation inputs for VP1 | Not owned by `visual-proof` |
| 7. Verify and report | Evaluate before/after predicates and write artifacts. | `visual-proof` | `evaluation.json`, `report.md`, overlay SVGs, verdict | Requires complete VP1 inputs; no guessing |
| 8. Handoff/closeout | Explain verdict, artifacts, missing evidence, and any remaining risk. | Agent using the proof output | Reviewable final evidence summary | Missing evidence remains explicit |

## Current skill boundaries

### `visual-primitives`

Use this skill when the screenshot exists and the immediate task is to identify visual objects. It owns drawing and pointing:

- boxes for bounded regions such as buttons, cards, modals, footers, and containers;
- points for click centers, focus targets, or reference anchors;
- paths for focus travel, gestures, or continuity checks.

It may suggest predicates or prepare a draft handoff for `visual-proof`, but it does not inspect DOM, capture browsers, run OCR/VLM tooling, fix code, or declare the UI fixed.

### `visual-proof`

Use this skill when metadata, primitives, predicates, and evidence are ready to become a VP1 artifact. It owns deterministic proof work:

- assembling before-only drafts or complete before/after proofs;
- requiring explicit evidence for `visible`, `text_present`, and `clickable`;
- evaluating predicates and reporting the final VP1 verdict.

It does not draw primitives from screenshots, inspect DOM, capture screenshots/videos, run OCR/VLM tooling, or fix application code.

## Future extension points

These names describe likely boundaries for later work. They are intentionally not implemented here.

- `browser-capture`: drive a browser or test harness to produce screenshot paths, viewport metadata, route/URL metadata, and after video metadata.
- `dom-bridge`: map selectors, accessibility snapshots, or DOM boxes into candidate VP1 primitives and explicit evidence such as hit-test results.
- `visual-fix-loop`: orchestrate application code changes, recapture after states, and call `visual-proof`; it should not replace deterministic VP1 evaluation.

Any future adapter should feed explicit data into VP1 rather than making hidden proof decisions.

## Minimal composable flow

1. Get before screenshot metadata from a user or capture harness.
2. Use `visual-primitives` to create boxes, points, and paths for the failing state.
3. Use `visual-proof` to define predicates and save a before-only draft.
4. Fix the app outside these skills.
5. Get after screenshot metadata and after video metadata.
6. Reuse `visual-primitives` when after primitives need drawing.
7. Use `visual-proof` to evaluate and report the complete proof.

This flow keeps the drawing layer, proof layer, capture adapters, DOM adapters, and code-fixing loop separable and reviewable.
