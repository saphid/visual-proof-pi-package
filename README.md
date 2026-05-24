# Visual Proof Pi Package

Inspired by the 2026 technical report [**Thinking with Visual Primitives**](https://huggingface.co/datasets/NodeLinker/deepseek-ai-Thinking-with-Visual-Primitives-deleted-repo/resolve/main/Thinking_with_Visual_Primitives.pdf) ([archived project mirror](https://github.com/ailuntx/Thinking-with-Visual-Primitives)) and the [Two Minute Papers video discussing it](https://www.youtube.com/watch?v=LpXhy2iiaQE), this package turns the idea of “point while you reason” into deterministic proof artifacts for UI fixes. It is not affiliated with DeepSeek, the paper authors, or Two Minute Papers.

![Visual Proof README banner showing before/after UI boxes, points, paths, and proof panels](docs/assets/readme-banner.png)

Visual Proof is a small Pi package for proving that a visual UI bug was actually fixed. The point is not to run another vague screenshot comparison and hope the agent guessed correctly. The point is to turn the claim into inspectable evidence: screenshots, video metadata, boxes, points, paths, predicates, explicit DOM/text/clickability evidence, and a final deterministic verdict.

It is intentionally boring in the same way good infrastructure is boring. It takes supplied observations, checks them, writes artifacts, and stays out of everything else.

## What this is

Visual Proof gives agents a way to say:

> “Here is the broken before state. Here is the fixed after state. Here are the exact visual primitives and predicates. Here is the report. The verifier says `fixed`.”

A Visual Proof Object (VP1) is just structured data:

- screenshot/video metadata
- grounded `box`, `point`, and `path` primitives
- deterministic predicates like `not_overlapping`, `inside`, `visible`, `text_present`, and `clickable`
- explicit evidence for things the geometry alone cannot prove
- generated `evaluation.json`, `report.md`, and overlay SVGs

That separation matters because visual bugs are easy to hand-wave. This package makes the mechanism visible.

## What it is not

This is not a browser automation framework. It is not an OCR engine. It is not a VLM wrapper. It is not a pixel-diff tool. It is not a site-specific fixer.

The package is split into composable Pi skills. It still does **not** ship browser automation dependencies, DOM runtime libraries, OCR, VLM calls, pixel diffing, or project-specific code fixing. The adapter skills are workflow contracts over supplied data and already-available tools; the deterministic VP1 verifier remains the final proof boundary.

## Quick start

No `npm install` is required.

```bash
node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo
```

Expected verdict: `fixed`.

The demo fixture is a synthetic checkout UI bug:

- Before: the submit button overlaps a sticky footer and the explicit click-target evidence says it is not clickable.
- After: the submit button is inside the main content region, does not overlap the footer, has after screenshot metadata, and includes after video metadata.

It writes:

- `/tmp/visual-proof-demo/evaluation.json`
- `/tmp/visual-proof-demo/report.md`
- `/tmp/visual-proof-demo/before-overlay.svg`
- `/tmp/visual-proof-demo/after-overlay.svg`

## What it exposes

- One Pi extension: `extensions/visual-proof/index.ts`
  - `visual_proof_create` — create complete proofs or before-only drafts
  - `visual_proof_evaluate` — evaluate a VP1 proof and write artifacts
  - `visual_proof_report` — regenerate report artifacts from a proof
- Five Pi skills:
  - `skills/visual-proof/SKILL.md` — proof-only VP1 creation/evaluation from supplied metadata, primitives, predicates, and evidence.
  - `skills/visual-primitives/SKILL.md` — drawing/pointing-only production of VP1-compatible boxes, points, and paths from supplied screenshots.
  - `skills/browser-capture/SKILL.md` — capture/metadata workflow for screenshot, route/URL, viewport, and after-video metadata from supplied or existing browser-tool outputs.
  - `skills/dom-bridge/SKILL.md` — DOM/evidence adapter workflow for candidate primitives and explicit VP1 evidence from selectors, DOM boxes, hit tests, computed styles, accessibility snapshots, or text sources.
  - `skills/visual-fix-loop/SKILL.md` — orchestration workflow for reproduce/capture/primitives/proof/fix/recapture/proof loops while delegating the final verdict to `visual-proof`.
- Dependency-free core: `src/visual-proof-core.mjs`
- CLI: `bin/visual-proof.mjs`

## Composable skill split

Use the skills together when a task needs the full loop, but keep the ownership clean. This is the part that prevents the proof from becoming vibes again.

1. `browser-capture` gets or normalizes screenshot/video metadata from a user, browser worker, Pi Autobrowse, Playwright, or test harness. It does not draw primitives, inspect DOM evidence, fix app code, or decide a VP1 verdict.
2. `dom-bridge` converts supplied DOM, selector, hit-test, computed-style, accessibility, or text data into candidate VP1 primitives and explicit evidence fields. It does not hide visual proof decisions or claim the UI is fixed.
3. `visual-primitives` grounds what is visible in a supplied screenshot as VP1 primitives. It can suggest predicates or a draft handoff, but it has no DOM authority and no final fixed verdict.
4. `visual-proof` turns supplied observations into a before-only draft or complete before/after proof. It requires explicit evidence for visibility, text, and clickability, then evaluates the deterministic verdict.
5. `visual-fix-loop` coordinates the overall fix workflow and calls the companion skills in sequence. It reports fixed only by citing the `visual-proof` output.

Hardening added by the skills:

- `browser-capture` recommends optional provenance such as `sha256`/checksum when available, capture command/tool, timestamp, browser/device/version, viewport, `deviceScaleFactor`, `fullPage`, auth notes without secrets, and whether dimensions were measured or supplied.
- `dom-bridge` documents CSS viewport pixels to screenshot pixels conversion, including screenshot-vs-viewport scaling, `deviceScaleFactor`, `fullPage` vs viewport captures, required full-page document extents, scroll offsets, zoom/transforms, and ambiguity stop conditions.
- `visual-primitives` must inspect the supplied image or return blocked/missing-data; paths, filenames, routes, and surrounding context alone are not enough to draw primitives.
- Each workflow skill has a concrete blocked output shape so missing dimensions, missing video, unavailable images, ambiguous DOM alignment, or incomplete proof inputs stay explicit.

These are documentation and handoff contracts only; they do not add browser, DOM, OCR, VLM, hashing, or pixel-diff runtime capabilities.

See `docs/visual-proof-process.md` for the phase map, handoff contracts, and non-goals.

## Phase map

| Phase | Current package support |
| --- | --- |
| Observe/capture screenshot or video metadata | `browser-capture`, using supplied or existing browser/test-harness outputs |
| Ground boxes, points, and paths | `visual-primitives`; `dom-bridge` may provide selector-derived candidates |
| Collect DOM/evidence fields | `dom-bridge`, for candidate primitives and `evidence.visibility`, `evidence.detectedText`, or `evidence.clickTargets` |
| Define predicates and evidence needs | `visual-proof`; `visual-primitives` may suggest drafts |
| Save before-only proof | `visual-proof` |
| Fix app code | Outside the proof package; `visual-fix-loop` may orchestrate the implementation workflow |
| Capture after state and video metadata | `browser-capture` |
| Evaluate and report VP1 verdict | `visual-proof` |

## Typical agent workflow

1. Capture or supply the before screenshot metadata with `browser-capture`.
2. Pull selector, hit-test, computed-style, accessibility, or text evidence through `dom-bridge` if it exists.
3. Draw or correct boxes, points, and paths with `visual-primitives`.
4. Create the before-only VP1 draft with `visual-proof`.
5. Fix the app outside this package. Use `visual-fix-loop` if you want the whole reproduce/fix/recapture/proof sequence coordinated.
6. Capture the after screenshot and required after video metadata.
7. Refresh DOM evidence and primitives if the fix changed layout or interaction state.
8. Evaluate the complete before/after proof with `visual-proof` and keep the report next to the bug-fix evidence.

See the five `skills/*/SKILL.md` files for full Pi skill instructions.

## Validate locally

```bash
npm run check
node test/core.test.mjs
node test/extension-smoke.test.mjs
node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo
```

All validation is pure Node.js and dependency-free.

## Schema

See `docs/visual-proof-object.md`.

## Public repository hygiene

This repository is intended to be safe to make public as source code and documentation. It should not contain private screenshots, videos, browser profiles, DOM dumps from authenticated sessions, generated proof outputs, or secrets.

- License: MIT; see `LICENSE`.
- Security reporting and private-artifact cautions: `SECURITY.md`.
- Contribution and validation guidance: `CONTRIBUTING.md`.
- Public-readiness audit: `docs/public-release-audit.md`.

Generated local outputs are ignored for both git and npm packing under `.visual-proof/`, `.visual-proof-test-output/`, `artifacts/`, and `.pi-autobrowse/`.

## Remaining non-goals

These are deliberate boundaries, not missing features:

- The verifier only checks supplied primitives and evidence.
- It does not inspect image pixels, inspect live DOM, or verify that screenshot/video files exist.
- The adapter skills do not add runtime dependencies, browser drivers, Playwright installs, DOM libraries, OCR engines, VLM calls, pixel-diff engines, hashing libraries, or site-specific browser behavior.
- Evidence-backed predicates fail on missing evidence instead of guessing.
- Final `fixed`, `passing`, `regressed`, or `still_failing` verdicts belong to `visual-proof` output only.
- The included fixture is synthetic so local validation remains deterministic and dependency-free.

## External tool adapters

Existing browser workers, Pi Autobrowse sessions, Playwright suites, user/test harnesses, DOM snippets, OCR systems, or VLM tools can feed data into these skills. Keep those tools optional and reviewable; they should populate VP1 metadata, primitives, and evidence rather than replacing deterministic `visual-proof` evaluation.
