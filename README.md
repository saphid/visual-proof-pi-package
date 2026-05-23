# Visual Proof Pi Package

A dependency-free Pi package for proving UI visual fixes with Visual Proof Objects (VP1): screenshot/video metadata, grounded boxes/points/paths, deterministic predicates, and concise reports.

This package implements the proof artifact/verifier layer. It does **not** capture screenshots, drive a browser, run OCR, call a VLM, or perform pixel diffs. Browser workers, Playwright, and VLM grounding can be adapters that populate the VP1 JSON schema.

## What it exposes

- One Pi extension: `extensions/visual-proof/index.ts`
  - `visual_proof_create` (complete proofs or before-only drafts)
  - `visual_proof_evaluate`
  - `visual_proof_report`
- One skill: `skills/visual-proof/SKILL.md`
- Dependency-free core: `src/visual-proof-core.mjs`
- CLI: `bin/visual-proof.mjs`

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

1. Reproduce the visual UI issue.
2. Capture or receive failing screenshot metadata.
3. Ground relevant visual primitives (`box`, `point`, `path`) in the screenshot.
4. Add predicates that express the desired visual truth.
5. Add explicit evidence for visibility, text, and clickability when those predicates are needed.
6. Optionally save a before-only draft with `visual_proof_create`; it returns `status`/`verdict` `draft` and is not evaluable until after evidence is added.
7. Fix the UI.
8. Capture after screenshot metadata and after video metadata.
9. Evaluate the complete proof and save the report next to the bug fix evidence.

See `skills/visual-proof/SKILL.md` for the full Pi skill instructions.

## Schema

See `docs/visual-proof-object.md`.

## Limitations

- The verifier only checks supplied primitives and evidence.
- It does not inspect image pixels or verify that screenshot/video files exist.
- Evidence-backed predicates fail on missing evidence instead of guessing.
- The included fixture is synthetic so local validation remains deterministic and dependency-free.

## Adapter ideas

Future adapters can populate VP1 from Playwright screenshots/videos, DOM bounding boxes, browser hit tests, accessibility snapshots, OCR, or VLM grounding. Those adapters should remain optional and feed this deterministic verifier rather than replacing it.
