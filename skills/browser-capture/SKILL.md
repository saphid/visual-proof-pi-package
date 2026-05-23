---
name: browser-capture
description: Capture and metadata workflow for producing VP1-ready screenshot, route/URL, viewport, and after-video metadata from supplied or existing browser-tool outputs.
---

# Browser Capture Skill

Use this skill when a Visual Proof workflow needs reproducible screenshot or video metadata. It turns supplied files or outputs from existing browser tooling into the observation metadata that `visual-proof`, `visual-primitives`, and `dom-bridge` can consume.

This is the capture/metadata layer only. It describes how to request, collect, and normalize capture artifacts without adding a browser automation dependency to this package.

## Owns

- Requesting or accepting before/after screenshot artifacts from a user, `browser_worker_interact`, `Pi Autobrowse`, `Playwright`, a test harness, or another available capture source.
- Recording screenshot metadata: `path`, `width`, `height`, `viewport`, and at least one of `route` or `url`.
- Recording capture context such as source tool, timestamp, browser/device/viewport notes, authenticated state notes, and reproduction steps when supplied.
- Recording required after video metadata for complete VP1 evaluation: `path` plus duration and `frameCount` or `sampledFrames`.
- Handing capture metadata to `visual-primitives`, `dom-bridge`, or `visual-proof` without claiming proof results.

## Does not own

This skill does not draw visual primitives, inspect DOM for evidence, map selectors, fix application code, evaluate complete VP1 proofs, or declare a final VP1 verdict. It also does not install or implement browser drivers; use the tools already available in the active task environment.

## Inputs to request

Ask for the smallest capture package that can support the proof phase:

- Route, URL, test case, user story, or reproduction steps.
- Target viewport size and device/browser context.
- Whether the capture is `before` or `after`.
- Screenshot file or browser-tool screenshot output.
- Screenshot dimensions and viewport dimensions.
- For after states, video file metadata: `path`, duration, and `frameCount` or `sampledFrames`.
- Any constraints such as authentication state, feature flags, timezone, locale, or seed data.

If a tool produced the screenshot but omitted dimensions, ask the tool/harness/user for dimensions instead of guessing from the path.

## Output/handoff contract

Return JSON-friendly metadata that can be pasted under `observations.before.screenshot` or `observations.after.screenshot` in a VP1 proof:

```json
{
  "phase": "before",
  "source": "browser_worker_interact",
  "screenshot": {
    "path": "artifacts/checkout-before.png",
    "width": 1024,
    "height": 640,
    "viewport": { "width": 1024, "height": 640 },
    "route": "/checkout"
  },
  "captureNotes": [
    "Viewport set to 1024x640 before capture.",
    "Authenticated as test checkout user."
  ],
  "handoff": [
    { "to": "visual-primitives", "reason": "draw boxes, points, or paths from the screenshot" },
    { "to": "dom-bridge", "reason": "adapt selectors, hit tests, styles, accessibility, or text evidence if available" },
    { "to": "visual-proof", "reason": "assemble or evaluate VP1 after primitives/evidence are ready" }
  ]
}
```

For an after capture intended for complete proof evaluation, include video metadata:

```json
{
  "phase": "after",
  "screenshot": {
    "path": "artifacts/checkout-after.png",
    "width": 1024,
    "height": 640,
    "viewport": { "width": 1024, "height": 640 },
    "route": "/checkout"
  },
  "video": {
    "path": "artifacts/checkout-after.webm",
    "durationMs": 4200,
    "frameCount": 126
  },
  "handoff": [
    { "to": "visual-proof", "reason": "complete before/after proof once primitives and evidence are supplied" }
  ]
}
```

After capture for a complete proof must include video metadata. If the after video is unavailable, report that `visual-proof` can only produce a draft or missing-data result.

## Workflow

1. **Clarify the state to capture**
   - Identify the route, URL, viewport, user state, and whether the target is before or after a fix.
   - Record reproduction steps rather than encoding site-specific browser behavior in this package.

2. **Collect artifacts with available tools**
   - Use supplied screenshots/videos directly when they include enough metadata.
   - Otherwise, call an existing task-appropriate tool such as `browser_worker_interact`, `Pi Autobrowse`, `Playwright`, or a user/test harness.
   - Do not add runtime dependencies or commit generated capture artifacts to this package.

3. **Normalize metadata**
   - Ensure screenshot metadata has `path`, `width`, `height`, `viewport.width`, `viewport.height`, and `route` or `url`.
   - Ensure after video metadata has `path`, duration, and `frameCount` or non-empty `sampledFrames`.
   - Keep source/tool notes separate from proof predicates.

4. **Hand off**
   - Send screenshot metadata to `visual-primitives` when objects need drawing.
   - Send browser/page context to `dom-bridge` only when explicit DOM, selector, hit-test, style, accessibility, or text data is available.
   - Send metadata to `visual-proof` after primitives and evidence are ready for a draft or complete evaluation.

## Quality checklist

Before handing off capture metadata:

- Screenshot and video paths are stable references for the task handoff.
- Width, height, and viewport dimensions are explicit numbers.
- At least one of `route` or `url` is present for every screenshot.
- The phase is clear: `before` or `after`.
- After proof attempts include after video metadata or clearly state why it is missing.
- No primitive coordinates, DOM evidence, code-fix claims, or VP1 verdicts are invented by this skill.
