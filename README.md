# Visual Proof Pi Package

A dependency-free Pi package for proving UI visual fixes with Visual Proof Objects (VP1): screenshot/video metadata, grounded boxes/points/paths, deterministic predicates, and concise reports.

This package is split into composable skills. It does **not** capture screenshots, drive a browser, inspect DOM, run OCR, call a VLM, perform pixel diffs, or fix app code. Browser workers, Playwright, DOM bridges, OCR/VLM tooling, and fix loops can be separate adapters that populate the VP1 JSON schema.

## What it exposes

- One Pi extension: `extensions/visual-proof/index.ts`
  - `visual_proof_create` (complete proofs or before-only drafts)
  - `visual_proof_evaluate`
  - `visual_proof_report`
- Two Pi skills:
  - `skills/visual-proof/SKILL.md` — proof-only VP1 creation/evaluation from supplied metadata, primitives, predicates, and evidence.
  - `skills/visual-primitives/SKILL.md` — drawing/pointing-only production of VP1-compatible boxes, points, and paths from supplied screenshots.
- Dependency-free core: `src/visual-proof-core.mjs`
- CLI: `bin/visual-proof.mjs`

## Composable skill split

Use the skills together when needed, but keep their responsibilities separate:

1. `visual-primitives` grounds what is visible in a supplied screenshot as VP1 primitives. It can suggest predicates or a draft handoff, but it has no DOM authority and no final fixed verdict.
2. `visual-proof` turns supplied observations into a before-only draft or complete before/after proof. It requires explicit evidence for visibility, text, and clickability, then evaluates the deterministic verdict.

Future adapters may add browser capture, DOM mapping, OCR/text evidence, hit-test evidence, or a visual fix loop. Those adapters should feed data into the skills instead of replacing the VP1 proof boundary.

See `docs/visual-proof-process.md` for the phase map and current/future skill ownership.

## Phase map

| Phase | Current package support |
| --- | --- |
| Observe/capture screenshot or video metadata | External user/test harness; future `browser-capture` adapter |
| Ground boxes, points, and paths | `visual-primitives` |
| Define predicates and evidence needs | `visual-proof`; `visual-primitives` may suggest drafts |
| Save before-only proof | `visual-proof` |
| Fix app code | Outside this package; future `visual-fix-loop` orchestrator |
| Capture after state and video metadata | External user/test harness; future `browser-capture` adapter |
| Evaluate and report VP1 verdict | `visual-proof` |

## Run the demo

No `npm install` is required.

```bash
node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo
```

Expected verdict: `fixed`.

The demo fixture proves a synthetic checkout UI bug:

- Before: the submit button overlaps a sticky footer and the explicit click-target evidence says it is not clickable.
- After: the submit button is inside the main content region, does not overlap the footer, has after screenshot metadata, and includes after video metadata.

Generated artifacts:

- `/tmp/visual-proof-demo/evaluation.json`
- `/tmp/visual-proof-demo/report.md`
- `/tmp/visual-proof-demo/before-overlay.svg`
- `/tmp/visual-proof-demo/after-overlay.svg`

## Validate locally

```bash
npm run check
node test/core.test.mjs
node test/extension-smoke.test.mjs
node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo
```

All validation is pure Node.js and dependency-free.

## Workflow for agents

1. Receive or capture screenshot metadata outside this proof package.
2. Use `visual-primitives` when boxes, points, or paths need to be drawn from a screenshot.
3. Use `visual-proof` to create a VP1 before-only draft with predicates and explicit evidence requirements.
4. Fix the UI outside these skills if a broader task requires implementation work.
5. Receive or capture after screenshot metadata and after video metadata.
6. Reuse `visual-primitives` if after primitives need drawing.
7. Use `visual-proof` to evaluate the complete proof and save the report next to the bug fix evidence.

See `skills/visual-proof/SKILL.md` and `skills/visual-primitives/SKILL.md` for full Pi skill instructions.

## Schema

See `docs/visual-proof-object.md`.

## Limitations

- The verifier only checks supplied primitives and evidence.
- It does not inspect image pixels, inspect DOM, or verify that screenshot/video files exist.
- Evidence-backed predicates fail on missing evidence instead of guessing.
- The included fixture is synthetic so local validation remains deterministic and dependency-free.

## Adapter ideas

Future adapters can populate VP1 from Playwright screenshots/videos, DOM bounding boxes, browser hit tests, accessibility snapshots, OCR, or VLM grounding. Those adapters should remain optional and feed this deterministic verifier rather than replacing it.
