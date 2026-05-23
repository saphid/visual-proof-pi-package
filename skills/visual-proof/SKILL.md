---
name: visual-proof
description: Proof-only workflow for creating and evaluating Visual Proof Objects (VP1) from supplied screenshot/video metadata, grounded primitives, and explicit evidence.
---

# Visual Proof Skill

Use this skill when you need a deterministic proof artifact for a UI visual bug or feature acceptance claim. It consumes supplied screenshot/video metadata, VP1-compatible primitives, and explicit evidence, then creates or evaluates Visual Proof Objects.

This is the proof layer only. If a broader task also involves capturing a browser state, drawing primitives, inspecting the DOM, or fixing app code, perform those steps with another skill, adapter, or ordinary implementation workflow before returning to this proof skill.

## Owns

- Building VP1 JSON from supplied before/after observations.
- Selecting deterministic predicates such as `not_overlapping`, `inside`, `aligned`, `count_equals`, `path_continuous`, `visible`, `text_present`, and `clickable`.
- Saving a before-only draft when only the failing observation is available.
- Evaluating a complete before/after proof and reporting `fixed`, `passing`, `regressed`, or `still_failing`.
- Explaining missing metadata or evidence without guessing.

## Does not own

This skill does not capture screenshots, drive a browser, inspect DOM, run OCR, call VLMs, generate visual primitives from pixels, or fix application code. It never gives a final `fixed` verdict without a complete before/after VP1 proof.

When a screenshot needs manual visual grounding, use the `visual-primitives` skill to draw boxes, points, and paths first. Future adapters such as `browser-capture`, `dom-bridge`, or `visual-fix-loop` may produce inputs for this skill, but they are not implemented here.

## Required inputs

For a before-only draft:

- Failing screenshot metadata: `path`, `width`, `height`, `viewport`, and at least one of `route` or `url`.
- Grounded primitives with stable ids: `box`, `point`, or `path`.
- Predicates that express the visual requirement.
- Explicit evidence for evidence-backed predicates when available.

For full evaluation, also require:

- After screenshot metadata with the same route/viewport when possible.
- After video metadata: `path` plus duration and `frameCount` or `sampledFrames`.
- After primitives using the same ids when the same visual objects still exist.
- Updated explicit evidence for visibility, text, and clickability predicates.

## Evidence rule

Geometry predicates can be checked from primitives. Evidence-backed predicates cannot:

- `visible` requires `observation.evidence.visibility[subject].visible === true`.
- `text_present` requires explicit `observation.evidence.detectedText` evidence.
- `clickable` requires explicit `observation.evidence.clickTargets[subject].clickable === true`.

Do not infer these from the screenshot path alone. Missing evidence should fail predicates instead of being treated as success.

## Workflow

1. **Receive the observation package**
   - Confirm that screenshots/video metadata came from the user, another skill, or an adapter.
   - Confirm that primitives are already grounded. If not, pause proof work and hand the screenshot to `visual-primitives`.

2. **Create the VP1 object**
   - Use `schemaVersion: "vp1"`.
   - Set the proof-level `coordinateSpace` to `pixel` or `normalized`.
   - Add `observations.before` and, when available, `observations.after`.
   - Add predicates with clear ids and subjects/containers that match primitive ids.

3. **Save a before-only draft when useful**
   - Use `visual_proof_create` if this extension is loaded, or write a VP1 JSON file directly.
   - A before-only draft returns `status`/`verdict` `draft` and is not a final proof.
   - The before observation should show at least one objective failing predicate for a bug fix.

4. **Complete after external change/capture**
   - The UI fix, browser recapture, DOM mapping, OCR, or hit-test work happens outside this skill.
   - Add after screenshot metadata, after video metadata, after primitives, and explicit after evidence when those outputs are supplied.

5. **Evaluate and report**
   - Run `visual_proof_evaluate` or `node bin/visual-proof.mjs evaluate <proof.json> --out <dir>` only after the proof has complete before and after observations.
   - The strongest bug-fix verdict is `fixed`: before predicates fail and after predicates pass.
   - Attach or reference `evaluation.json`, `report.md`, and overlay SVGs in the final handoff.

## When to ask for more data

Ask for additional screenshots, video metadata, primitives, or evidence if the proof would otherwise rely on guessing. A draft or explicit missing-data report is better than a false proof.
