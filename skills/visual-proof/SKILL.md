---
name: visual-proof
description: Use Visual Proof Objects to prove UI visual bugs or feature acceptance with screenshots, video metadata, grounded primitives, and deterministic predicates.
---

# Visual Proof Workflow

Use this skill when a task asks you to fix or accept a UI visual issue: overlap, containment, alignment, missing visible text, clickability, focus path, layout regression, or similar screenshot-grounded behavior.

## Core rule

Do not claim the UI is visually fixed from code inspection alone. Build a before/after proof with grounded visual primitives and deterministic predicates.

## Workflow

1. **Capture the failing state**
   - Reproduce the bug.
   - Obtain failing screenshot metadata: path, dimensions, viewport, route/URL.
   - Ground the important primitives as boxes, points, or paths. Examples: button box, footer box, modal bounds, click point, focus path.
   - Add predicates that encode the desired truth: `not_overlapping`, `inside`, `aligned`, `count_equals`, `path_continuous`, `visible`, `text_present`, `clickable`.

2. **Require explicit evidence where geometry is insufficient**
   - `visible` requires explicit visibility evidence.
   - `text_present` requires explicit detected text evidence.
   - `clickable` requires explicit click-target/hit-test evidence.
   - Do not infer these from the screenshot path alone.

3. **Save the before proof**
   - Use `visual_proof_create` if you are in Pi with this extension loaded, or write a VP1 JSON file directly.
   - The before observation should show at least one objective failing predicate for a bug fix.

4. **Fix the UI**
   - Make the application change separately. This package does not mutate the app under test.

5. **Capture the after state**
   - Obtain after screenshot metadata with the same route/viewport when possible.
   - Include after video metadata for acceptance evidence: path plus duration and frame count or sampled frames.
   - Ground after primitives using the same ids when the same visual objects still exist.
   - Add updated explicit evidence for visibility/text/clickability predicates.

6. **Verify and report**
   - Run `visual_proof_evaluate` or `node bin/visual-proof.mjs evaluate <proof.json> --out <dir>`.
   - The strongest bug-fix verdict is `fixed`: before predicates fail and after predicates pass.
   - Attach or reference `evaluation.json`, `report.md`, and overlay SVGs in the final handoff.

## Adapter boundary

Browser capture, Playwright automation, DOM box extraction, OCR, and VLM grounding are adapters. They can produce screenshot/video metadata, primitives, and evidence for the proof, but they are not implemented by this package.

## When to ask for more data

Ask for additional screenshot/video/evidence data if the proof would otherwise rely on guessing. Missing evidence should fail predicates instead of being treated as success.
