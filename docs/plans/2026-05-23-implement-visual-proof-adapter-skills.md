# Visual Proof adapter skills implementation plan

## Review in 2 minutes

**Goal:** Implement the three previously documented-but-missing Visual Proof process skills — `browser-capture`, `dom-bridge`, and `visual-fix-loop` — as standalone Pi skills in this package. The goal is a clean skill package boundary, not a heavyweight browser automation library: each new skill should define what it owns, what it refuses to infer, what data shape it hands to VP1/`visual-proof`, and when to delegate to the other skills.

**Non-goals:**
- Do not add runtime dependencies; keep package validation dependency-free.
- Do not add browser-driver code to the verifier core.
- Do not make `visual-proof` capture screenshots, inspect DOM, fix code, or infer OCR/VLM results.
- Do not implement OCR, VLM grounding, pixel diffing, or site-specific browser behavior.
- Do not create private/live capture artifacts in the repo.

**Risky assumptions:**
- “Implemented” means Pi skills with usable workflows/contracts, not new extension tools for every phase.
- `browser-capture` can describe tool-backed capture using existing Pi tools such as `browser_worker_interact`, Pi Autobrowse, Playwright, or user/test harness output without owning those tools.
- `dom-bridge` can provide explicit evidence contracts and safe DOM snippets without becoming a hidden proof engine.
- `visual-fix-loop` can orchestrate the loop while preserving final verdict ownership in `visual-proof`.

**Slice order:** S1 contracts/docs → S2 add adapter skills → S3 manifest/checker/tests → S4 validation/review gardening.

**Expected high-risk files:**
- `package.json` — skill manifest must expose five unique skills.
- `scripts/check-package.mjs` — package checker must validate new skill boundaries without brittle prose-only checks.
- `skills/*/SKILL.md` — boundaries must not contradict one another; existing `visual-proof`/`visual-primitives` docs must delegate to implemented companion skills instead of calling them future/not implemented.
- `README.md`, `docs/visual-proof-process.md` — remove “not implemented” drift and explain current ownership.

**Validation strategy:**
- `npm run check`
- `node test/core.test.mjs`
- `node test/extension-smoke.test.mjs`
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-adapter-skills-demo`
- `git diff --check`
- blocker-only review plus Codex Review/x-high closeout.

**Reasons this plan might be wrong:**
- The user may expect executable capture/DOM tools rather than skills that orchestrate existing tools.
- Pi package manifest conventions may require only skill docs, not helper scripts; adding scripts would be unnecessary scope.
- If checker assertions become too exact, harmless wording edits could fail validation.

## Slice table

| Slice | Status | Depends on | Parallel? | Expected files | Validation |
|---|---|---|---|---|---|
| S1 Contract docs update | pending | none | no | `docs/visual-proof-process.md`, `README.md`, `skills/visual-proof/SKILL.md`, `skills/visual-primitives/SKILL.md`, maybe `implementation-notes.md` | `npm run check` after S3 |
| S2 Add three skill docs | pending | S1 | no | `skills/browser-capture/SKILL.md`, `skills/dom-bridge/SKILL.md`, `skills/visual-fix-loop/SKILL.md` | skill frontmatter/readability checks via S3 |
| S3 Manifest and checker | pending | S2 | no | `package.json`, `scripts/check-package.mjs` | `npm run check` |
| S4 Final validation and review gardening | pending | S3 | no | small doc/checker fixes only | full validation list + review closeout |

## Global acceptance criteria

- `package.json` exposes `visual-proof`, `visual-primitives`, `browser-capture`, `dom-bridge`, and `visual-fix-loop` as Pi skills with useful descriptions and unique ids.
- `browser-capture` is implemented as a capture/metadata skill: it can use supplied/browser-tool outputs to produce screenshot/video metadata, but it does not draw primitives, inspect DOM for evidence, fix app code, or declare a VP1 verdict.
- `dom-bridge` is implemented as an explicit DOM/evidence adapter skill: it can map selectors/DOM boxes/hit-tests/computed styles/accessibility snapshots into candidate VP1 primitives or evidence fields, but it does not silently infer final visual truth or declare fixed.
- `visual-fix-loop` is implemented as an orchestrator skill: it sequences reproduce → capture → primitives → proof draft → fix → recapture → proof, but delegates final verdict to `visual-proof`.
- `visual-proof` and `visual-primitives` remain narrow and do not absorb the new responsibilities.
- README and process docs describe the five implemented skills and make any remaining non-goals explicit.
- The checker validates all five skills and key boundary language.
- Existing core/extension behavior remains unchanged and validation passes.

## Assumptions to verify

- Manifest shape supports adding more entries under `pi.skills` without extension changes.
- No tests currently assume exactly two skills.
- The checker can be extended with a small skill definition table instead of duplicating ad-hoc checks.
- `implementation-notes.md` should be updated because this changes architecture expectations from future boundaries to implemented skills.

## Rejected / not doing

- **New browser automation implementation:** rejected for this package because it would require dependencies and platform-specific setup; the skill should call existing browser tools/harnesses.
- **New DOM runtime library:** rejected for this package because DOM access depends on the active browser/test harness; the skill can provide contracts/snippets and expected evidence shape.
- **End-to-end code fixer:** rejected as direct implementation because fixing is project-specific; `visual-fix-loop` should orchestrate ordinary implementation workflows.
- **Changing VP1 core schema:** rejected unless checker/tests reveal a mismatch; current VP1 already has primitives and evidence fields needed by the new skills.

## Slice S1: Contract docs update

**Status:** pending

**Purpose:** Update the package-level architecture docs from “future adapter ideas” to “implemented skill boundaries” without implying new verifier powers.

**Depends on:** none

**Can run in parallel with:** none

**Expected files:**
- `README.md` — list all five skills, explain the current package exposes proof, primitive, capture, DOM bridge, and orchestrator skill docs.
- `docs/visual-proof-process.md` — phase map owners should mention `browser-capture`, `dom-bridge`, and `visual-fix-loop` as implemented skills, while keeping OCR/VLM/pixel-diff as non-goals.
- `skills/visual-proof/SKILL.md` — replace stale “future/not implemented” wording with delegation to implemented companion skills while preserving proof-only ownership.
- `skills/visual-primitives/SKILL.md` — replace stale “future adapters/orchestrator” wording with delegation to implemented companion skills while preserving drawing/pointing-only ownership.
- `implementation-notes.md` — note the decision that adapter skills are workflow contracts over existing tools, not new browser/DOM dependencies.

**Context needed:**
- Existing `README.md` skill split section.
- Existing `docs/visual-proof-process.md` phase map and future extension points.
- Existing `skills/visual-proof/SKILL.md` and `skills/visual-primitives/SKILL.md` boundaries.

**Steps:**
- [ ] Replace “future adapters may add” wording with “additional implemented skills provide workflows/contracts” where appropriate.
- [ ] Update `visual-proof` and `visual-primitives` skill docs so they delegate capture, DOM evidence, and fix orchestration to the implemented companion skills instead of saying those skills are future/not implemented.
- [ ] Keep explicit non-goals: no OCR/VLM/pixel diff; no browser driver in core; no hidden proof decisions.
- [ ] Add a compact “which skill for which task” summary.

**Acceptance:**
- Docs make it clear that five skills are exposed, but only `visual-proof` evaluates final VP1 verdicts.
- Package docs and existing skill docs no longer say `browser-capture`, `dom-bridge`, or `visual-fix-loop` are future or intentionally not implemented.
- `visual-proof` and `visual-primitives` still explicitly reject owning capture/DOM/fix/final-verdict responsibilities outside their current boundaries.

**Validation:**
- `npm run check` after S3 — checker should enforce updated wording.

**Critical findings for next slice:**
- None yet.

**Blockers / escape-hatch notes:**
- If docs imply a new dependency or hidden runtime capability, stop and rewrite the boundary before adding skills.

## Slice S2: Add browser-capture, dom-bridge, and visual-fix-loop skills

**Status:** pending

**Purpose:** Create the three new Pi skills as standalone workflow contracts with concrete inputs, outputs, handoffs, and refusal boundaries.

**Depends on:** S1

**Can run in parallel with:** none

**Expected files:**
- `skills/browser-capture/SKILL.md` — capture/metadata skill.
- `skills/dom-bridge/SKILL.md` — DOM/evidence bridge skill.
- `skills/visual-fix-loop/SKILL.md` — orchestration skill.

**Context needed:**
- Pi skill frontmatter rules from Pi docs.
- Existing skill style in `skills/visual-proof/SKILL.md` and `skills/visual-primitives/SKILL.md`.
- VP1 evidence fields from `docs/visual-proof-object.md`.

**Steps:**
- [ ] Add valid YAML frontmatter with `name` matching skill id and specific `description`.
- [ ] For each skill, include: use cases, owns, does-not-own, inputs to request, output/handoff contract, workflow, quality checklist, and next-skill handoff.
- [ ] `browser-capture` should output screenshot metadata and after video metadata; it can mention browser_worker_interact/Pi Autobrowse/Playwright/user harness as capture sources.
- [ ] `dom-bridge` should output candidate primitives and explicit evidence such as `evidence.visibility`, `evidence.detectedText`, `evidence.clickTargets`; it must distinguish evidence from proof verdicts.
- [ ] `visual-fix-loop` should sequence skills and require before/after proof completion before claiming fixed.

**Acceptance:**
- Each skill has a clear, different reason to exist.
- Each skill names the next handoff target(s) and the condition for using them.
- No new skill declares a final fixed verdict except by calling/using `visual-proof` output.

**Validation:**
- S3 checker assertions over frontmatter and boundary text.

**Critical findings for next slice:**
- None yet.

**Blockers / escape-hatch notes:**
- If a skill’s scope overlaps too much with `visual-proof` or `visual-primitives`, prefer shrinking the new skill over broadening existing proof/drawing responsibilities.

## Slice S3: Manifest and checker

**Status:** pending

**Purpose:** Make the package discover and validate all five skills.

**Depends on:** S2

**Can run in parallel with:** none

**Expected files:**
- `package.json` — add `browser-capture`, `dom-bridge`, and `visual-fix-loop` entries under `pi.skills`; consider keywords.
- `scripts/check-package.mjs` — generalize required skill validation and add targeted boundary checks for all five skills, including stale-wording checks for existing `visual-proof` and `visual-primitives` docs.

**Context needed:**
- Existing checker functions and current validation output.
- Package manifest conventions.

**Steps:**
- [ ] Extend required skill map to five entries.
- [ ] Add specific checker functions for the three new skills.
- [ ] Update `validateVisualProofSkill` and `validateVisualPrimitivesSkill` so they require delegation to implemented companion skills and fail on stale “future/not implemented” wording for `browser-capture`, `dom-bridge`, or `visual-fix-loop`.
- [ ] Update process-doc checks from future-skill wording to implemented-skill wording.
- [ ] Ensure existing checks for `visual-proof` and `visual-primitives` still pass.

**Acceptance:**
- `npm run check` fails if any new skill is missing from package manifest or lacks key boundary language.
- `npm run check` fails if existing skill docs still call the newly implemented skills future/not implemented instead of delegating to them.
- Package remains dependency-free.
- Existing tests still pass.

**Validation:**
- `npm run check`
- `node test/core.test.mjs`
- `node test/extension-smoke.test.mjs`

**Critical findings for next slice:**
- None yet.

**Blockers / escape-hatch notes:**
- If checker becomes too brittle, consolidate on semantic boundary phrases rather than long exact paragraphs.

## Slice S4: Final validation and review gardening

**Status:** pending

**Purpose:** Run final validation, fix drift, and close review on the completed skill package.

**Depends on:** S3

**Can run in parallel with:** none

**Expected files:**
- Any of the files from S1-S3, but only for review/validation fixes.

**Context needed:**
- Full diff.
- Plan acceptance criteria.
- Validation outputs.

**Steps:**
- [ ] Run full validation commands.
- [ ] Run `git diff --check`.
- [ ] Run acceptance-aware blocker review and Codex Review/x-high closeout.
- [ ] Fix accepted blockers only.
- [ ] Update implementation notes with any final decision/risk.

**Acceptance:**
- Full validation passes.
- Blocker review passes.
- Final diff only includes intended package/docs/skill changes.

**Validation:**
- `npm run check`
- `node test/core.test.mjs`
- `node test/extension-smoke.test.mjs`
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-adapter-skills-demo`
- `git diff --check`
- `codex review --commit HEAD` after merge, or x-high fallback.

**Critical findings for next slice:**
- Final slice; summarize in handoff.

**Blockers / escape-hatch notes:**
- If reviewers find that “implemented” must mean new executable browser/DOM tools, stop and ask the user before expanding scope beyond standalone skills.
