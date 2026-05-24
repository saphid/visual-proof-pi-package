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
- Recording recommended optional provenance when supplied: `sha256` or other checksum, capture command/tool, timestamp, browser/device/version, viewport, `deviceScaleFactor`, `fullPage`, auth-state notes without secrets, reproduction steps, and whether dimensions were measured or supplied.
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
- Optional provenance when already available: `sha256`/checksum, `captureCommand` or tool name, `timestamp`, `browser`/`device`/`version`, `viewport`, `deviceScaleFactor`, `fullPage`, `dimensionsSource`, and `authNotesNoSecrets`.
- For after states, video file metadata: `path`, duration, and `frameCount` or `sampledFrames`.
- Any constraints such as authentication state, feature flags, timezone, locale, or seed data.

If a tool produced the screenshot but omitted dimensions, ask the tool/harness/user for dimensions instead of guessing from the path.

## Recommended optional provenance

These fields are recommended when already available; they are not required by VP1 core validation and must not introduce hashing, browser, or filesystem dependencies in this package:

- `sha256` or another `checksum` for the artifact when the capture tool already supplies one.
- `captureTool` and `captureCommand` showing the source tool or command that produced the artifact.
- `timestamp` for when the capture was taken.
- `browser`, `device`, and `version` notes such as browser name/version, emulated device, OS, or test harness version.
- `viewport`, `deviceScaleFactor`, and `fullPage` so `dom-bridge` can align CSS viewport pixels to screenshot pixels.
- `authNotesNoSecrets` describing auth state without cookies, bearer tokens, passwords, API keys, or private session values.
- `dimensionsSource` such as `measured`, `supplied`, or `tool-reported` so downstream skills know whether dimensions were measured or copied from a harness.

If optional provenance is unavailable, say so explicitly. Do not invent hashes, browser versions, or auth details.

## Output/handoff contract

Return JSON-friendly metadata that can be pasted under `observations.before.screenshot` or `observations.after.screenshot` in a VP1 proof:

```json
{
  "phase": "before",
  "source": "browser_worker_interact",
  "provenance": {
    "captureTool": "browser_worker_interact",
    "captureCommand": "browser_worker_interact screenshot --route /checkout",
    "timestamp": "2026-05-24T12:00:00Z",
    "browser": { "name": "Chromium", "version": "125" },
    "device": "Desktop Chrome",
    "viewport": { "width": 1024, "height": 640 },
    "deviceScaleFactor": 1,
    "fullPage": false,
    "dimensionsSource": "measured",
    "sha256": "optional-when-available",
    "authNotesNoSecrets": "Authenticated as test checkout user; no tokens captured."
  },
  "screenshot": {
    "path": "artifacts/checkout-before.png",
    "width": 1024,
    "height": 640,
    "viewport": { "width": 1024, "height": 640 },
    "route": "/checkout",
    "deviceScaleFactor": 1,
    "fullPage": false,
    "dimensionsSource": "measured"
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

## Blocked output shapes

If required capture metadata is unavailable, return an explicit blocked shape instead of guessing:

```json
{
  "status": "blocked",
  "skill": "browser-capture",
  "blockedReason": "missing screenshot dimensions",
  "missing": ["screenshot.width", "screenshot.height", "screenshot.viewport.width", "screenshot.viewport.height"],
  "available": { "path": "artifacts/checkout-before.png", "route": "/checkout" },
  "nextRequest": "Ask the capture tool or user for measured image and viewport dimensions."
}
```

For a complete after proof, missing video metadata is also blocking:

```json
{
  "status": "blocked",
  "skill": "browser-capture",
  "blockedReason": "after video metadata required for complete VP1 proof",
  "missing": ["after.video.path", "after.video.durationMs|durationSeconds", "after.video.frameCount|sampledFrames"],
  "coreProofImpact": "visual-proof can create a draft or missing-data report, but not a complete fixed verdict"
}
```

Optional provenance should not block VP1 core validation by itself. If the caller made provenance a task requirement and it is unavailable, block that task-specific handoff explicitly:

```json
{
  "status": "blocked",
  "skill": "browser-capture",
  "blockedReason": "requested capture provenance is unavailable",
  "missing": ["provenance.sha256", "provenance.captureCommand", "provenance.timestamp"],
  "coreProofImpact": "VP1 core can still proceed if required screenshot/video metadata is complete"
}
```

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
   - Keep source/tool notes and optional provenance separate from proof predicates.

4. **Hand off**
   - Send screenshot metadata to `visual-primitives` when objects need drawing.
   - Send browser/page context to `dom-bridge` only when explicit DOM, selector, hit-test, style, accessibility, or text data is available.
   - Send metadata to `visual-proof` after primitives and evidence are ready for a draft or complete evaluation.

## Quality checklist

Before handing off capture metadata:

- Screenshot and video paths are stable references for the task handoff.
- Width, height, and viewport dimensions are explicit numbers.
- At least one of `route` or `url` is present for every screenshot.
- Optional provenance records available checksums, capture tool/command, timestamp, browser/device/version, viewport, deviceScaleFactor, fullPage, auth notes without secrets, and measured/supplied dimensions without making them up.
- The phase is clear: `before` or `after`.
- After proof attempts include after video metadata or clearly state why it is missing.
- No primitive coordinates, DOM evidence, code-fix claims, or VP1 verdicts are invented by this skill.
