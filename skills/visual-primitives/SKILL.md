---
name: visual-primitives
description: Drawing and pointing workflow for producing VP1-compatible boxes, points, and paths from supplied screenshots, with optional predicate suggestions and draft handoff.
---

# Visual Primitives Skill

Use this skill when a screenshot or screenshot metadata is available and an agent needs to ground what matters visually. The output is a small, reviewable set of VP1-compatible `box`, `point`, and `path` primitives that another workflow can consume.

This is the drawing/pointing layer only. It helps close the reference gap between "the thing in the screenshot" and deterministic proof data, but it does not evaluate whether a complete UI fix is final.

## Owns

- Marking visible objects in supplied screenshots as VP1 `box`, `point`, or `path` primitives.
- Assigning stable, meaningful primitive ids such as `submit_button`, `footer`, or `focus_path`.
- Recording coordinate space and screenshot dimensions clearly enough for deterministic evaluation.
- Optionally suggesting predicates for `visual-proof` to review and use.
- Optionally preparing a draft handoff payload for the `visual-proof` skill.

## Does not own

This skill does not capture screenshots, drive a browser, inspect DOM, map selectors, run OCR, call VLMs, fix application code, evaluate complete proofs, or declare a final fixed verdict. It produces drawing/pointing data only.

If DOM boxes, browser hit tests, OCR text, or videos are needed, treat them as outputs from separate future adapters such as `browser-capture` or `dom-bridge`. If code changes are needed, they belong outside this skill or in a future `visual-fix-loop` orchestrator.

## Inputs to request

Ask for the smallest set of data needed to ground the screenshot:

- Screenshot image or path.
- Screenshot `width` and `height`; viewport dimensions when known.
- Route, URL, state description, or test case name when known.
- The visual target: bug description, desired relationship, or feature acceptance claim.
- Whether coordinates should be `pixel` or `normalized`.
- Any known before/after pairing so ids can remain stable across observations.

Do not pretend to have browser, DOM, OCR, or VLM evidence when it was not supplied.

## Output contract

Return primitives in a JSON-friendly shape that can be pasted into a VP1 proof:

```json
{
  "coordinateSpace": "pixel",
  "screenshot": {
    "path": "before.png",
    "width": 1024,
    "height": 640,
    "viewport": { "width": 1024, "height": 640 },
    "route": "/checkout"
  },
  "primitives": [
    { "id": "main_content", "type": "box", "x": 80, "y": 96, "width": 720, "height": 440, "label": "Main content" },
    { "id": "footer", "type": "box", "x": 0, "y": 520, "width": 1024, "height": 120, "label": "Sticky footer" },
    { "id": "submit_button", "type": "box", "x": 800, "y": 535, "width": 160, "height": 56, "label": "Submit" },
    { "id": "button_center", "type": "point", "x": 880, "y": 563, "label": "Submit center" },
    { "id": "tab_path", "type": "path", "points": [{ "x": 120, "y": 80 }, { "x": 880, "y": 563 }] }
  ],
  "predicateSuggestions": [
    { "type": "not_overlapping", "primitives": ["submit_button", "footer"] },
    { "type": "inside", "subject": "button_center", "container": "main_content" }
  ],
  "handoff": {
    "to": "visual-proof",
    "status": "draft-primitives",
    "notes": "Review predicate suggestions and add explicit clickability evidence before evaluation."
  }
}
```

Only include fields you can support from the supplied screenshot and task context. Predicate suggestions are not final proof results.

## Coordinate rules

- Prefer `pixel` coordinates when screenshot dimensions are known.
- Use `normalized` coordinates only when requested or when it makes the handoff more portable; normalized values must be in `0..1`.
- Boxes use top-left `x`, `y`, plus positive `width` and `height`.
- Points should target the meaningful center or action location, not a vague nearby area.
- Paths should list ordered points in the observed direction of travel.
- Keep ids stable between before and after when the same visual object still exists.
- Use labels/roles as helpful annotations, not as proof that text, accessibility, or DOM state exists.

## Quality checklist

Before handing off primitives:

- Boxes are tight enough to represent the object but not so tight that borders or shadows make the relationship ambiguous.
- Points land inside the intended target and are actionable for later hit-test evidence.
- Paths have enough ordered points to make continuity meaningful.
- Every predicate suggestion references existing primitive ids.
- Uncertainty is surfaced in notes rather than hidden in overconfident coordinates.
- Evidence-backed claims such as visible text or clickability are left for explicit evidence adapters or for the `visual-proof` skill to require.

## Handoff to visual-proof

When the primitive set is ready, hand it to `visual-proof` with screenshot metadata and any predicate suggestions. `visual-proof` decides whether the proof is a before-only draft, complete before/after evaluation, or blocked on missing evidence.
