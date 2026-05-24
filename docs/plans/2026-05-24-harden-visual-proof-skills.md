# Harden Visual Proof skills implementation plan

## Review in 2 minutes

**Goal:** Harden the five Visual Proof Pi skills so they stay small but become more operational in real use: precise DOM-to-screenshot coordinate guidance, stronger capture provenance, concrete blocked-output contracts, less boundary ambiguity, and validation/checker coverage that prevents the useful details from drifting out of the skill docs.

**Non-goals:**
- Do not add browser automation, DOM runtime, OCR, VLM, pixel-diff, or hashing dependencies.
- Do not make optional provenance fields mandatory in VP1 core validation unless the existing schema already requires them.
- Do not broaden `visual-proof` into capture, DOM, primitive drawing, or orchestration ownership.
- Do not turn `visual-fix-loop` into a framework-specific app-fixing skill.
- Do not commit generated browser captures, private artifacts, or local proof outputs.

**Risky assumptions:**
- Optional capture provenance can live as documented recommended metadata without changing `validateProof`.
- DOM coordinate conversion guidance can be deterministic enough as workflow instructions without adding a DOM adapter implementation.
- Checker assertions should cover the important new guardrails without becoming brittle prose snapshots.
- Trimming repetition should not remove the explicit boundaries that stop skills from absorbing each other.

**Slice order:** S1 skill-contract hardening → S2 package docs/checker guardrails.

**Expected high-risk files:**
- `skills/dom-bridge/SKILL.md` — coordinate conversion must not lie about CSS pixels, screenshot pixels, full-page captures, scroll, or device pixel ratio.
- `skills/browser-capture/SKILL.md` — provenance recommendations must be concrete but optional/dependency-free.
- `skills/visual-fix-loop/SKILL.md` — wording must keep orchestration separate from project-specific implementation.
- `scripts/check-package.mjs` — guardrails should catch missing essentials without overfitting to long exact prose.

**Validation strategy:**
- `npm run check` — manifest, skill wording, process docs, core tests, extension smoke, CLI demo.
- `node test/core.test.mjs` — unchanged deterministic verifier behavior.
- `node test/extension-smoke.test.mjs` — extension/tool behavior unchanged.
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-skill-hardening-demo` — demo remains fixed.
- `git diff --check` — no whitespace damage.

**Reasons this plan might be wrong:**
- If Pi skills need to be much shorter for prompt efficiency, adding examples may make them worse despite being clearer.
- If provenance should be machine-enforced, this plan under-scopes the work by keeping it documentation-only.
- If DOM coordinate conversion requires real browser/runtime code, workflow text alone may still be too easy to misuse.

## Slice table

| Slice | Status | Depends on | Parallel? | Expected files | Validation |
|---|---|---|---|---|---|
| S1 Skill-contract hardening | pending | none | no | `skills/browser-capture/SKILL.md`, `skills/dom-bridge/SKILL.md`, `skills/visual-primitives/SKILL.md`, `skills/visual-fix-loop/SKILL.md`, `skills/visual-proof/SKILL.md` | `npm run check`, focused read-through |
| S2 Package docs and checker guardrails | pending | S1 | no | `README.md`, `docs/visual-proof-process.md`, `scripts/check-package.mjs`, `implementation-notes.md` | full validation commands |

## Global acceptance criteria

- `dom-bridge` contains explicit coordinate conversion guidance for CSS viewport pixels, screenshot pixels, device pixel ratio / scale factor, full-page vs viewport screenshots, scroll offsets, and an escape hatch when alignment is uncertain.
- `browser-capture` recommends concrete dependency-free provenance fields such as hash/checksum when available, capture source/command, timestamp, browser/device/version, viewport, device scale factor, full-page flag, auth-state notes without secrets, and whether dimensions were measured or supplied.
- Every adapter/workflow skill that can block includes at least one concrete blocked-output example or shape for missing/ambiguous data.
- `visual-primitives` explicitly says not to draw primitives from filename/path/context alone; inspect the supplied image or return blocked/missing-data.
- `visual-fix-loop` wording avoids claiming ownership of framework-specific code changes while still coordinating the ordinary project implementation workflow.
- `visual-proof` remains final VP1 verdict owner and proof-only.
- README/process docs summarize the new hardening without claiming new runtime capabilities.
- `scripts/check-package.mjs` validates key hardening phrases/sections for all five skills.
- Existing core/extension behavior and examples remain unchanged unless a checker-only update requires harmless validation support.

## Assumptions to verify

- Existing `validateProof` accepts extra metadata fields on screenshot/video objects; verify by reading validation code before deciding whether optional provenance examples are safe.
- `writeEvaluationArtifacts` already creates nested output directories; verify validation does not depend on pre-existing `.visual-proof-test-output` after running checks.
- Skill frontmatter descriptions do not need to mention every new hardening detail; package manifest descriptions can stay concise.

## Rejected / not doing

- Adding a real Playwright/browser-worker adapter implementation — out of scope and violates dependency-free package boundary.
- Adding OCR/VLM/pixel-diff fallback logic — explicit non-goal and would weaken deterministic proof discipline.
- Making hashes mandatory in VP1 core validation — useful provenance, but not necessary for current proof semantics and may break supplied-harness workflows.
- Rewriting the whole skill split — current architecture is sound; harden weak seams instead.

## Slice S1: Skill-contract hardening

**Status:** pending

**Purpose:** Make each skill more usable under real-world conditions without changing runtime behavior or ownership boundaries.

**Depends on:** none

**Can run in parallel with:** none

**Expected files:**
- `skills/dom-bridge/SKILL.md` — add coordinate alignment rules, conversion formulas, full-page/viewport/scroll/DPR guidance, transform/zoom ambiguity warnings, and blocked output example.
- `skills/browser-capture/SKILL.md` — add recommended provenance fields and blocked output examples for missing dimensions/video/provenance.
- `skills/visual-primitives/SKILL.md` — add inspect-image-or-block rule and blocked output example for unavailable image or ambiguous target.
- `skills/visual-fix-loop/SKILL.md` — refine implementation ownership wording and add blocked/transition output examples.
- `skills/visual-proof/SKILL.md` — add compact predicate/evidence table and blocked/missing-data example while keeping final verdict ownership.

**Context needed:**
- `docs/visual-proof-object.md` predicate and metadata requirements.
- `src/visual-proof-core.mjs` validation for optional extra fields and required screenshot/video metadata.
- Current five `skills/*/SKILL.md` files.

**Steps:**
- [ ] Read current skills and VP1 object docs.
- [ ] Add `dom-bridge` coordinate conversion section with formulas and stop conditions.
- [ ] Add `browser-capture` provenance section with optional fields and privacy/secrets guardrail.
- [ ] Add blocked-output examples to each skill where missing data is likely.
- [ ] Tighten `visual-fix-loop` implementation wording so it coordinates rather than owns app-specific fixes.
- [ ] Avoid unnecessary prose expansion; prefer tables and compact JSON shapes.

**Acceptance:**
- New guidance is concrete enough for an agent to avoid DOM/screenshot coordinate lies.
- Blocked examples make missing data actionable.
- No skill claims another skill's work or a runtime capability the package does not implement.

**Validation:**
- `npm run check` — should still pass or fail only because checker needs S2 updates.
- Manual grep/read-through for `deviceScaleFactor`, `fullPage`, `scroll`, `blocked`, and `verdictSource`.

**Critical findings for next slice:**
- Fill with any exact phrases/sections that S2 checker should lock down.

**Blockers / escape-hatch notes:**
- If the coordinate conversion rules become implementation-specific or misleading, stop and document `no fix`: the skill should require supplied, already-aligned boxes instead of pretending to convert them.

## Slice S2: Package docs and checker guardrails

**Status:** pending

**Purpose:** Make the repo-level docs and validation enforce the hardening from S1 without changing verifier semantics.

**Depends on:** S1

**Can run in parallel with:** none

**Expected files:**
- `README.md` — summarize hardened provenance, coordinate-alignment, and blocked-data discipline under existing non-goals.
- `docs/visual-proof-process.md` — update phase map/current boundaries with coordinate/provenance/blocked-handoff notes.
- `scripts/check-package.mjs` — assert key hardening language/sections exist without depending on huge exact blocks.
- `implementation-notes.md` — add a short entry explaining decisions, non-goals, validation, and any tradeoffs.

**Context needed:**
- Critical findings from S1.
- Existing checker style and current exact phrase assertions.
- Validation commands from the review header.

**Steps:**
- [ ] Update README/process docs with the hardened boundaries.
- [ ] Add checker assertions for important durable guardrails: DOM scaling/scroll/DPR/full-page ambiguity, capture provenance fields, blocked examples, inspect-image-or-block rule, and fix-loop verdict ownership.
- [ ] Run validation and update notes.
- [ ] Keep generated validation artifacts ignored and out of the commit.

**Acceptance:**
- `npm run check` passes and would fail if the major hardening sections were removed.
- README/process docs stay truthful: no new browser/DOM/OCR/VLM/runtime dependency capabilities.
- Implementation notes capture the tradeoff that provenance is recommended, not core-enforced.

**Validation:**
- `npm run check` — full package checker.
- `node test/core.test.mjs` — core behavior unchanged.
- `node test/extension-smoke.test.mjs` — tools unchanged.
- `rm -rf /tmp/visual-proof-skill-hardening-demo && node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-skill-hardening-demo` — CLI demo still fixed.
- `git diff --check` — whitespace.

**Critical findings for next slice:**
- None; final closeout should run blocker-only review plus Codex/x-hi review before merge.

**Blockers / escape-hatch notes:**
- If checker assertions become brittle prose snapshots, simplify them to semantic phrase checks; `no fix` is valid for enforcing stylistic trimming in code.
