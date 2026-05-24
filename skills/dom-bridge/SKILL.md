---
name: dom-bridge
description: DOM and evidence adapter workflow for turning selectors, DOM boxes, hit tests, computed styles, accessibility snapshots, and text sources into candidate VP1 primitives and explicit evidence.
---

# DOM Bridge Skill

Use this skill when a Visual Proof workflow has explicit DOM-related data and needs to adapt it into VP1-compatible candidates or evidence. It is useful for selector bounding boxes, computed visibility, hit-test results, accessibility snapshots, and text sources that should support deterministic predicates.

This is the DOM/evidence adapter layer only. It does not replace screenshot review or deterministic proof evaluation.

## Owns

- Mapping supplied selectors or DOM bounding boxes into candidate primitives with stable ids.
- Mapping supplied hit-test results into `evidence.clickTargets`.
- Mapping supplied computed-style, layout, intersection, or accessibility visibility facts into `evidence.visibility`.
- Mapping supplied text, accessible names, labels, or test-harness text snapshots into `evidence.detectedText`.
- Recording evidence provenance so `visual-proof` can distinguish explicit evidence from guesses.
- Handing candidate primitives to `visual-primitives` for screenshot review or directly to `visual-proof` when they are already accepted.

## Does not own

This skill does not capture screenshots or video, draw final manual primitives from pixels, run OCR/VLMs, fix application code, evaluate complete VP1 proofs, or declare a final fixed verdict. It adapts explicit DOM/evidence data only.

Evidence is not a proof verdict. The `visual-proof` skill decides whether supplied evidence satisfies VP1 predicates in a complete before/after proof.

## Inputs to request

Ask for explicit data from the active browser, test harness, or user-provided snapshot:

- The screenshot metadata and coordinate space that DOM boxes should align with.
- Selector list, element labels, roles, or ids to map.
- Bounding client rects or equivalent layout boxes in viewport coordinates.
- Scroll offset, device pixel ratio, and viewport size when needed to align boxes to screenshots.
- Hit-test results for action points, including the tested coordinate and actual target.
- Computed style, intersection, disabled/aria-disabled, accessibility, or visibility facts.
- Text sources such as element text, accessible name, label text, or test harness text snapshot.

Do not infer unavailable DOM facts from screenshot appearance. If a live page is not available, report which evidence fields cannot be produced.

## Coordinate alignment rules

DOM geometry is usually reported in CSS viewport pixels; VP1 `pixel` primitives are screenshot pixels. Convert only when the screenshot capture mode and scale are explicit.

Definitions to record with every conversion:

- `rect.left`, `rect.top`, `rect.width`, and `rect.height` from `getBoundingClientRect()` are CSS viewport pixels with the origin at the visible viewport top-left.
- `scrollX` and `scrollY` are CSS pixel offsets from the document origin to the current viewport origin.
- `deviceScaleFactor` or `window.devicePixelRatio` is the expected CSS-to-device-pixel scale; treat it as a check, not the only source of truth.
- `documentWidthCss` and `documentHeightCss` are the full-page CSS pixel extents required for `fullPage` screenshot conversion.
- `scaleX` and `scaleY` are screenshot pixels per CSS pixel. Prefer measured screenshot dimensions over assumptions from `deviceScaleFactor`.

For a viewport screenshot (`fullPage: false`), the screenshot origin is the current viewport:

```text
scaleX = screenshot.width / screenshot.viewport.width
scaleY = screenshot.height / screenshot.viewport.height
x = rect.left * scaleX
y = rect.top * scaleY
width = rect.width * scaleX
height = rect.height * scaleY
```

Do not add scroll offsets for a viewport screenshot. If the capture is a clipped sub-rectangle, subtract the clip origin in CSS viewport pixels before scaling. If an element extends outside the viewport, clip/intersect it or mark the candidate uncertain.

For a full-page screenshot (`fullPage: true`), the screenshot origin is the document origin only when the capture tool documents that behavior and the full-page CSS extent is known:

```text
documentXCss = rect.left + scrollX
documentYCss = rect.top + scrollY
scaleX = screenshot.width / documentWidthCss
scaleY = screenshot.height / documentHeightCss
x = documentXCss * scaleX
y = documentYCss * scaleY
width = rect.width * scaleX
height = rect.height * scaleY
```

Require `documentWidthCss` and `documentHeightCss` for full-page conversion. The only safe shortcut for `documentWidthCss` is an explicit capture guarantee that the full-page screenshot width equals the viewport width and there is no horizontal scroll/overflow; then `documentWidthCss = screenshot.viewport.width`. If either full-page CSS extent is missing, block instead of converting.

Screenshot-vs-viewport scaling can differ by tool: CSS-pixel screenshots often have `scaleX = 1`, while device-pixel screenshots often have `scaleX = deviceScaleFactor`. If measured `scaleX`/`scaleY` do not match `deviceScaleFactor` within an explicit tolerance, use the measured values and report the mismatch; if dimensions are missing, block.

### Zoom/transforms/ambiguity stop conditions

Return a blocked output instead of candidate primitives when any of these are unresolved:

- Missing screenshot width/height, viewport width/height, or `fullPage` flag.
- Missing capture clip origin when the capture is a clipped sub-rectangle.
- For a full-page screenshot, missing `documentHeightCss`, or missing `documentWidthCss` without the explicit no-horizontal-overflow/full-page-width-equals-viewport guarantee that permits deriving it from `screenshot.viewport.width`.
- Missing `scrollX`/`scrollY` for a full-page screenshot or any conversion from viewport coordinates to document coordinates.
- Raw layout offsets (`offsetLeft`, `clientTop`, untransformed layout boxes) are supplied but CSS `transform`, CSS `zoom`, browser zoom, `deviceScaleFactor`, or `visualViewport.scale` may affect the rendered box.
- `getBoundingClientRect()` was measured before layout settled, after a different scroll position, or against a stale DOM snapshot.
- Mobile pinch zoom or `visualViewport.offsetLeft`/`offsetTop` is relevant but not supplied.
- Fixed or sticky elements in a full-page screenshot have tool-specific behavior and the capture source does not state how they are rendered.
- Non-uniform `scaleX`/`scaleY`, rotation, transforms, or clipping make the mapped box visibly uncertain.

When blocked, preserve any explicit evidence that does not depend on coordinate conversion, but do not emit precise `candidatePrimitives`.

## Output/handoff contract

Return candidate primitives and explicit evidence in a JSON-friendly shape:

```json
{
  "coordinateSpace": "pixel",
  "source": "dom-snapshot",
  "candidatePrimitives": [
    {
      "id": "submit_button",
      "type": "box",
      "x": 800,
      "y": 535,
      "width": 160,
      "height": 56,
      "label": "Submit button",
      "source": { "selector": "button[type=submit]", "rect": "boundingClientRect" }
    },
    {
      "id": "submit_button_center",
      "type": "point",
      "x": 880,
      "y": 563,
      "label": "Submit button hit-test point"
    }
  ],
  "evidence": {
    "visibility": {
      "submit_button": {
        "visible": true,
        "source": "computed-style+intersection"
      }
    },
    "detectedText": [
      {
        "text": "Submit",
        "primitive": "submit_button",
        "source": "accessible-name"
      }
    ],
    "clickTargets": {
      "submit_button": {
        "clickable": false,
        "point": { "x": 880, "y": 563 },
        "hitTarget": "footer.sticky",
        "source": "document.elementFromPoint"
      }
    }
  },
  "handoff": [
    { "to": "visual-primitives", "reason": "review candidate primitives against the screenshot" },
    { "to": "visual-proof", "reason": "evaluate predicates once primitives and observations are complete" }
  ]
}
```

Use `candidatePrimitives` until the boxes/points have been accepted for VP1. Copy only accepted entries into `observations.before.primitives` or `observations.after.primitives`.

## Blocked output shape

If DOM coordinates cannot be safely aligned to the screenshot, return a concrete blocked handoff:

```json
{
  "status": "blocked",
  "skill": "dom-bridge",
  "blockedReason": "cannot align CSS viewport pixels to screenshot pixels",
  "missing": ["screenshot.viewport.width", "screenshot.viewport.height", "deviceScaleFactor", "fullPage", "documentWidthCss", "documentHeightCss", "scrollX", "scrollY"],
  "ambiguous": ["CSS transform on #submit", "unknown full-page fixed-element behavior"],
  "safeOutput": {
    "evidence": {
      "detectedText": [
        { "text": "Submit", "primitive": "submit_button", "source": "accessible-name" }
      ]
    }
  },
  "nextRequest": "Provide capture mode, scroll offsets, measured screenshot dimensions, and transformed boundingClientRect values."
}
```

## Workflow

1. **Confirm alignment context**
   - Confirm screenshot dimensions, viewport dimensions, coordinate space, `fullPage`, scroll position, `deviceScaleFactor`, and any screenshot-vs-viewport scaling.
   - If DOM coordinates cannot be aligned with the screenshot, return a blocked shape or evidence notes without pretending to have precise primitives.

2. **Collect explicit DOM data**
   - Use the active browser, test harness, or supplied snapshot to obtain selectors, boxes, styles, hit tests, accessibility, or text facts.
   - Keep raw source details in notes or provenance fields for review.

3. **Create candidate primitives**
   - Convert DOM boxes to VP1 `box` candidates and action centers to VP1 `point` candidates.
   - Use stable ids that can match predicates and evidence keys.
   - Mark uncertainty rather than hiding selector ambiguity.

4. **Create explicit evidence**
   - Populate `evidence.visibility`, `evidence.detectedText`, and `evidence.clickTargets` only from supplied facts.
   - Distinguish `visible: false`, `clickable: false`, and missing evidence.
   - Do not turn evidence fields into pass/fail proof conclusions.

5. **Hand off**
   - Send candidate primitives to `visual-primitives` when screenshot review is needed.
   - Send accepted primitives and evidence to `visual-proof` for draft or final VP1 evaluation.
   - If the overall task is a fix loop, report the handoff status to `visual-fix-loop` without claiming the final verdict.

## Quality checklist

Before handing off DOM/evidence data:

- Every candidate primitive has a stable id and source/provenance note.
- Candidate boxes are in the same coordinate space as the screenshot, with CSS viewport pixels converted to screenshot pixels by the documented formulas, or are clearly marked as blocked/needs conversion.
- Evidence keys match primitive ids expected by predicates.
- Hit-test evidence includes the tested point and target result when available.
- Text evidence states its source; DOM/accessibility text is not represented as OCR or pixel truth.
- Missing, stale, or ambiguous DOM data is surfaced explicitly.
- The handoff makes clear that `visual-proof` owns the complete VP1 verdict.
