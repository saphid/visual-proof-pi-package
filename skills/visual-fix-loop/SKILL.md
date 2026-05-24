---
name: visual-fix-loop
description: Orchestration workflow for Visual Proof fix loops that sequence reproduce, capture, primitives, proof draft, fix, recapture, and final proof while delegating verdicts to visual-proof.
---

# Visual Fix Loop Skill

Use this skill when a UI bug-fix task needs an end-to-end loop: reproduce the visual issue, collect proof inputs, implement a project-specific fix, recapture, and verify with a complete VP1 proof. It coordinates the companion skills without absorbing their responsibilities.

This is the orchestration layer only. The canonical sequence is reproduce → capture → primitives → proof draft → fix → recapture → proof.

## Owns

- Planning and tracking the loop from failing state through final proof artifacts.
- Calling `browser-capture` for before/after screenshot metadata and required after video metadata.
- Calling `dom-bridge` when DOM, selector, hit-test, computed-style, accessibility, or text evidence is available.
- Calling `visual-primitives` when boxes, points, or paths need manual screenshot grounding or review.
- Calling `visual-proof` to create the before-only draft and to evaluate the complete before/after proof.
- Keeping implementation work, evidence gaps, and final proof artifacts visible in the handoff.

## Does not own

This skill does not capture browsers directly, draw primitives directly, inspect DOM directly, own project-specific code changes, evaluate VP1 predicates itself, or declare the final fixed verdict. It delegates final verdict to `visual-proof` and cites that output when reporting completion.

It may coordinate app changes performed by the ordinary implementation workflow, but it does not choose or own React, CSS, framework, or app-specific fix strategy.

## Inputs to request

Ask for enough context to coordinate the loop:

- Bug or acceptance claim to prove visually.
- Reproduction steps, route/URL, viewport, browser/device context, and state setup.
- Available before screenshots, videos, DOM snapshots, or test harness outputs.
- Project-specific instructions for editing and validating the app.
- Desired artifact location for VP1 proof JSON and report outputs.
- Any non-visual checks that must run alongside the visual proof.

If the task lacks enough capture, primitive, or evidence data for a proof, keep the loop in a blocked or draft state instead of claiming a fix.

## Output/handoff contract

Return a loop status that references delegated skill outputs:

```json
{
  "status": "draft|fixing|recapture-needed|proof-ready|verified|blocked",
  "sequence": [
    "reproduce",
    "capture",
    "primitives",
    "proof draft",
    "fix",
    "recapture",
    "proof"
  ],
  "delegatedOutputs": {
    "browser-capture": ["before screenshot metadata", "after screenshot metadata", "after video metadata"],
    "dom-bridge": ["evidence.clickTargets.submit_button"],
    "visual-primitives": ["submit_button", "footer", "main_content"],
    "visual-proof": ["before draft", "evaluation.json", "report.md"]
  },
  "verdictSource": "visual-proof",
  "verdict": "fixed"
}
```

Only include `verdict: "fixed"` when `visual-proof` has evaluated a complete before/after VP1 proof and returned `fixed`. Otherwise report the current status and missing handoff data.

## Blocked and transition output shapes

When the loop lacks required delegated inputs, keep it blocked instead of implying progress:

```json
{
  "status": "blocked",
  "skill": "visual-fix-loop",
  "blockedReason": "cannot create before proof draft",
  "missing": ["browser-capture.before.screenshot.width", "visual-primitives.primitives"],
  "nextDelegation": [
    { "to": "browser-capture", "reason": "provide measured before screenshot metadata" },
    { "to": "visual-primitives", "reason": "inspect supplied image and draw target primitives" }
  ],
  "verdictSource": "visual-proof",
  "verdict": null
}
```

When implementation work is done by the ordinary project workflow, report the transition without owning the framework-specific fix:

```json
{
  "status": "recapture-needed",
  "skill": "visual-fix-loop",
  "transition": "fixing -> recapture-needed",
  "implementationOwner": "ordinary project workflow",
  "appChangeSummary": "Implementation workflow adjusted checkout layout; this skill only coordinates recapture and proof.",
  "nextDelegation": [
    { "to": "browser-capture", "reason": "collect after screenshot and video metadata" },
    { "to": "visual-proof", "reason": "evaluate after primitives/evidence when complete" }
  ],
  "verdictSource": "visual-proof",
  "verdict": "not-evaluated"
}
```

## Workflow

1. **Reproduce and define the claim**
   - Write the visual claim as objective predicates when possible, such as no overlap, inside container, visible text, or clickable target.
   - Record route/URL, viewport, state setup, and expected acceptance evidence.

2. **Capture the failing state**
   - Use `browser-capture` to obtain or normalize before screenshot metadata.
   - Do not commit generated browser artifacts to the package repository.

3. **Ground primitives and evidence**
   - Use `dom-bridge` for selector-derived candidate primitives or explicit evidence.
   - Use `visual-primitives` to draw or review boxes, points, and paths from the screenshot.
   - Keep candidate data separate from accepted VP1 primitives.

4. **Create a before-only proof draft**
   - Use `visual-proof` to assemble the failing observation, predicates, and evidence requirements.
   - Confirm the draft shows an objective failing state or clearly lists missing data.

5. **Implement the project-specific fix**
   - Make the narrow app change in the host project using the ordinary implementation workflow.
   - Keep this skill focused on sequencing and evidence; it does not prescribe, choose, or own framework-specific code changes.

6. **Recapture and refresh proof inputs**
   - Use `browser-capture` for after screenshot metadata and required after video metadata.
   - Re-run `dom-bridge` and `visual-primitives` when layout, text, clickability, or primitive coordinates changed.

7. **Evaluate final proof**
   - Use `visual-proof` to evaluate the complete before/after VP1 object.
   - Require a complete before/after VP1 proof before reporting fixed.
   - If `visual-proof` reports `still_failing`, `regressed`, `passing`, `draft`, or missing evidence, report that status exactly.

8. **Close out**
   - Summarize changed code, delegated skill outputs, VP1 artifacts, verdict, validation commands, and remaining risks.
   - Attribute the verdict to `visual-proof` rather than to this orchestrator.

## Quality checklist

Before reporting the loop complete:

- The before state was captured and saved or referenced.
- The before proof draft exists and records failing predicates or missing evidence.
- The app change is separate from proof generation, owned by the ordinary project workflow, and validated by project-appropriate checks.
- The after state includes screenshot metadata and after video metadata.
- Primitives and explicit evidence were refreshed after the fix when needed.
- `visual-proof` evaluated the complete proof.
- The final summary cites `visual-proof` artifacts and does not invent an independent fixed verdict.
