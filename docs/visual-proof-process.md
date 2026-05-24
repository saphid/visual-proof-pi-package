# Visual Proof Process

The Visual Proof Process is a composable workflow for proving UI visual bugs and feature acceptance without bundling browser automation, DOM inspection, drawing, code fixing, and final verification into one hidden step.

The package currently implements five skills:

- `browser-capture`: capture/metadata workflow for screenshot paths, dimensions, viewport, route/URL, and after-video metadata from supplied or existing browser-tool outputs.
- `dom-bridge`: DOM/evidence adapter workflow for candidate primitives and explicit evidence from selectors, DOM boxes, hit tests, computed styles, accessibility snapshots, or text sources.
- `visual-primitives`: drawing/pointing only; produces VP1-compatible boxes, points, and paths from supplied screenshots.
- `visual-proof`: proof-only; creates and evaluates VP1 objects from supplied metadata, primitives, predicates, and explicit evidence.
- `visual-fix-loop`: orchestration only; sequences reproduce, capture, primitive grounding, proof drafting, app fixing, recapture, and final proof while delegating the verdict to `visual-proof`.

These skills are dependency-free instructions and contracts. They may call or consume outputs from existing Pi tools, browser workers, Pi Autobrowse, Playwright, user artifacts, or test harnesses, but this package does not add browser automation, DOM runtime, OCR, VLM, pixel-diff, or code-fixing libraries.

## Phase map

| Phase | Purpose | Current owner | Output | Boundary |
| --- | --- | --- | --- | --- |
| 1. Observe or capture state | Obtain screenshot/video files and metadata for the UI state under review. | `browser-capture`, using supplied or existing browser/test-harness outputs | Screenshot path, dimensions, viewport, route/URL; source/tool notes; after video metadata when applicable | Does not draw primitives, inspect DOM evidence, fix code, or declare a VP1 verdict |
| 2. Bridge DOM evidence when available | Convert explicit DOM, selector, hit-test, computed-style, accessibility, or text data into reviewable VP1 inputs. | `dom-bridge` | Candidate `box`/`point` primitives and explicit `evidence.visibility`, `evidence.detectedText`, or `evidence.clickTargets` | Evidence is not proof; no hidden visual truth or fixed verdict |
| 3. Ground visual primitives | Draw or point at the relevant screenshot regions. | `visual-primitives`; `dom-bridge` candidates may be reviewed or corrected here | VP1 `box`, `point`, and `path` primitives with stable ids | No browser driving, DOM lookup, OCR/VLM calls, proof evaluation, or final verdict |
| 4. Define predicates and evidence needs | Convert the visual requirement into deterministic checks. | `visual-proof`; `visual-primitives` may suggest draft predicates | Predicate list plus notes about required explicit evidence | Evidence-backed predicates require supplied evidence rather than inference |
| 5. Save before proof | Preserve the failing observation as a VP1 draft. | `visual-proof`; `visual-fix-loop` may coordinate the handoff | Before-only VP1 draft with `status`/`verdict` `draft` | Not a final proof |
| 6. Fix the app | Change application code or configuration outside the verifier core. | Human/agent implementation workflow, coordinated by `visual-fix-loop` when useful | App change plus a need to recapture | Project-specific code changes are not owned by the VP1 verifier |
| 7. Capture after state | Obtain after screenshot metadata and required after video metadata. | `browser-capture` | After observation inputs for VP1 | Does not prove the fix by itself |
| 8. Verify and report | Evaluate before/after predicates and write artifacts. | `visual-proof` | `evaluation.json`, `report.md`, overlay SVGs, verdict | Requires complete VP1 inputs; no guessing |
| 9. Handoff/closeout | Explain verdict, artifacts, missing evidence, and any remaining risk. | Agent or `visual-fix-loop` citing `visual-proof` output | Reviewable final evidence summary | Missing evidence remains explicit |

## Hardened handoff rules

- Optional capture provenance: `browser-capture` should record available `sha256`/checksum, capture command/tool, timestamp, browser/device/version, viewport, `deviceScaleFactor`, `fullPage`, auth notes without secrets, and measured/supplied dimension source. These fields are recommended metadata, not new VP1 core requirements.
- Coordinate alignment: `dom-bridge` must convert CSS viewport pixels to screenshot pixels with measured screenshot-vs-viewport scale, `deviceScaleFactor` as a cross-check, `fullPage` vs viewport capture mode, full-page document extents (`documentWidthCss`/`documentHeightCss`), and scroll offsets. If zoom, transforms, clip origins, sticky/fixed full-page behavior, missing full-page extents, or scale ambiguity make the mapping uncertain, it blocks instead of emitting precise primitives.
- Inspect images or block: `visual-primitives` must inspect the supplied image before drawing boxes, points, or paths. It should return blocked/missing-data when only a filename, path, route, or text context is available.
- Blocked handoffs: every workflow skill that can block has a JSON-friendly blocked output shape with `status: "blocked"`, missing fields, and a next request. Missing metadata/evidence remains explicit rather than being guessed.
- Implementation ownership: `visual-fix-loop` coordinates ordinary app changes but does not choose framework-specific code changes, and no skill except `visual-proof` owns the final VP1 verdict.

## Current skill boundaries

### `browser-capture`

Use this skill when the task needs screenshot or video metadata. It owns capture requests and metadata normalization:

- screenshot `path`, `width`, `height`, `viewport`, and `route` or `url`;
- recommended optional provenance such as `sha256`/checksum when available, capture source/command, timestamp, browser/device/version, viewport, `deviceScaleFactor`, `fullPage`, auth-state notes without secrets, and measured/supplied dimension source;
- after video metadata with `path` plus duration and `frameCount` or `sampledFrames` for complete proof acceptance.

It can use supplied files, browser worker outputs, Pi Autobrowse, Playwright, or a user/test harness. It does not draw primitives, inspect DOM evidence, fix application code, evaluate a VP1 proof, or declare the visual result fixed.

### `dom-bridge`

Use this skill when explicit DOM-related data is available and should become VP1 inputs. It owns evidence adaptation:

- selector or DOM bounding boxes as candidate `box`/`point` primitives;
- visibility/computed-style/accessibility facts as explicit evidence;
- hit-test results as `evidence.clickTargets`;
- text or accessible-name sources as `evidence.detectedText`.

It may reduce manual drawing, but all outputs remain reviewable. It must align CSS viewport pixels to screenshot pixels using explicit capture scale, `fullPage` mode, full-page document extents, scroll offsets, and transform/zoom context; when that mapping is ambiguous, it blocks or emits evidence-only notes. It does not silently infer final visual truth, replace screenshot grounding, evaluate the proof, or declare fixed.

### `visual-primitives`

Use this skill when the screenshot exists and the immediate task is to identify visual objects. It owns drawing and pointing:

- boxes for bounded regions such as buttons, cards, modals, footers, and containers;
- points for click centers, focus targets, or reference anchors;
- paths for focus travel, gestures, or continuity checks.

It may review `dom-bridge` candidates, suggest predicates, or prepare a draft handoff for `visual-proof`, but it must inspect the supplied image before drawing and block when only a filename/path/context is available. It does not inspect DOM, capture browsers, run OCR/VLM tooling, fix code, evaluate complete proofs, or declare the UI fixed.

### `visual-proof`

Use this skill when metadata, primitives, predicates, and evidence are ready to become a VP1 artifact. It owns deterministic proof work:

- assembling before-only drafts or complete before/after proofs;
- requiring explicit evidence for `visible`, `text_present`, and `clickable`;
- evaluating predicates and reporting the final VP1 verdict.

It does not draw primitives from screenshots, inspect DOM, capture screenshots/videos, run OCR/VLM tooling, or fix application code.

### `visual-fix-loop`

Use this skill when a bug-fix task needs end-to-end coordination. It owns sequencing and handoffs:

1. reproduce the issue and define the claim;
2. call `browser-capture` for before metadata;
3. call `dom-bridge` and/or `visual-primitives` for evidence and primitives;
4. call `visual-proof` for a before-only draft;
5. coordinate the ordinary project-specific fix;
6. recapture and refresh evidence/primitives;
7. call `visual-proof` for the complete before/after proof.

It does not perform the delegated steps internally, does not choose framework-specific code changes, and does not replace the `visual-proof` verdict.

## Minimal composable flow

1. Get before screenshot metadata with `browser-capture` or from a supplied harness artifact.
2. Use `dom-bridge` when selector, DOM, accessibility, text, or hit-test evidence is available.
3. Use `visual-primitives` to create or review boxes, points, and paths for the failing state.
4. Use `visual-proof` to define predicates and save a before-only draft.
5. Fix the app outside the verifier core, optionally coordinated by `visual-fix-loop`.
6. Get after screenshot metadata and after video metadata with `browser-capture`.
7. Refresh DOM evidence and primitives when needed.
8. Use `visual-proof` to evaluate and report the complete proof.

This flow keeps the capture layer, DOM/evidence adapter, drawing layer, proof layer, and code-fixing loop separable and reviewable.

## Remaining non-goals

- No browser-driver implementation or Playwright dependency is added to the verifier core.
- No DOM runtime library or live-page access is added to the verifier core.
- No OCR, VLM grounding, or pixel diffing is performed by these skills.
- No site-specific browser behavior or project-specific code-fixing strategy is encoded here.
- No skill except `visual-proof` owns final VP1 verdict evaluation.
- Any external adapter should feed explicit data into VP1 rather than making hidden proof decisions.
