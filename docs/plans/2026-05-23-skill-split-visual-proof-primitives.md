# Visual proof skill split implementation plan

## Review in 2 minutes

**Goal:** Convert the current single visual-proof package into a clearer set of composable Pi skills. Keep `visual-proof` as the simple proof-only skill: it consumes screenshots/video metadata, visual primitives, and explicit evidence, then creates/evaluates before/after Visual Proof Objects. Add a second standalone `visual-primitives` skill for the drawing/pointing layer: given a screenshot or screenshot metadata, produce boxes/points/paths and optional overlays/draft proofs, but do not inspect DOM or fix code. Document the later extension points (`browser-capture`, `dom-bridge`, `visual-fix-loop`) without implementing them.

**Non-goals:**
- Do not add browser automation, DOM extraction, OCR, VLM calls, or app-fixing orchestration in this pass.
- Do not rewrite the verifier or change VP1 semantics unless a docs/checker bug is found.
- Do not rename existing `visual-proof` tools or break the current CLI/example validation.
- Do not create a full future `dom-bridge` implementation; only document the intended next skill boundary.

**Risky assumptions:**
- Adding one additional skill plus boundary docs is enough to make the package modular for the next iteration.
- Pi package manifests can expose multiple skill paths in `pi.skills`.
- A static package checker can prevent the two skills from drifting into each other’s responsibilities.
- The existing extension tools remain useful as proof-verifier tools shared by both skills.

**Slice order:** S1 phase/boundary documentation → S2 proof-only skill tightening → S3 standalone visual-primitives skill → S4 manifest/checker/tests/gardening

**Expected high-risk files:**
- `skills/visual-proof/SKILL.md` — must become proof-only and not imply browser/DOM capture.
- `skills/visual-primitives/SKILL.md` — must be useful but honest: drawing/pointing only, no DOM.
- `package.json` and `scripts/check-package.mjs` — must support and validate multiple skills.
- `README.md` and `docs/visual-proof-process.md` — must explain phases and how to compose skills.

**Validation strategy:**
- `npm run check` — validates package manifest, both skills, boundary language, examples, core tests, extension smoke, and CLI demo.
- `node test/core.test.mjs` — confirms VP1 verifier still works.
- `node test/extension-smoke.test.mjs` — confirms extension tools still work.
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-skill-split-demo` — confirms value demo still returns `fixed`.

**Reasons this plan might be wrong:**
- If the user wants only one skill file and no package/extension changes, adding `visual-primitives` may be too much; stop if review says scope should be docs-only.
- If multiple skills in the manifest require a different Pi package shape, package validation may need adjustment.
- If the line between visual-proof and visual-primitives is too subtle, docs/checker should enforce examples and non-goals explicitly.

## Slice table

| Slice | Status | Depends on | Parallel? | Expected files | Validation |
|---|---|---|---|---|---|
| S1 Phase and skill-boundary docs | pending | none | no | `docs/visual-proof-process.md`, `README.md` | `npm run check` after S4 |
| S2 Tighten `visual-proof` proof-only skill | pending | S1 | no | `skills/visual-proof/SKILL.md`, `README.md` | checker boundary assertions after S4 |
| S3 Add `visual-primitives` drawing/pointing skill | pending | S1 | no | `skills/visual-primitives/SKILL.md`, `README.md`, `docs/visual-proof-process.md` | checker validates second skill after S4 |
| S4 Manifest/checker/tests/gardening | pending | S1-S3 | no | `package.json`, `scripts/check-package.mjs`, `implementation-notes.md` | full validation commands |

## Global acceptance criteria

- Package exposes at least two skills: `visual-proof` and `visual-primitives`.
- `visual-proof` is clearly proof-only: it creates/evaluates VP1 artifacts from supplied metadata/primitives/evidence and does not claim to capture screenshots, inspect DOM, OCR, VLM, or fix code.
- `visual-primitives` is clearly drawing/pointing-only: it helps an agent produce boxes/points/paths from screenshots and optional draft proof primitives, but does not inspect DOM or evaluate complete fixes by itself.
- README and docs explain the end-to-end phases and which phase each skill owns.
- Later skill boundaries (`browser-capture`, `dom-bridge`, `visual-fix-loop`) are documented as future adapters/orchestrators, not implemented.
- Existing verifier/CLI/extension behavior and demo remain passing.
- Local validation remains dependency-free.

## Assumptions to verify

- `package.json` `pi.skills` can be an array with two skill entries; verify with checker structure and existing Pi docs if needed.
- Skill descriptions should be specific enough for automatic skill loading but not too broad.
- Static tests can check for key boundary language without becoming too brittle.

## Rejected / not doing

- No Playwright or browser-worker implementation in this pass; that belongs in a later `browser-capture` or `visual-fix-loop` skill.
- No DOM selector mapping in this pass; that belongs in a later `dom-bridge` skill.
- No VLM prompt automation beyond human/agent instructions for drawing primitives.
- No changes to the VP1 coordinate/predicate schema unless required by the skill split.

## Slice S1: Phase and skill-boundary docs

**Status:** pending
**Purpose:** Make the Visual Proof Process durable and reviewable before modifying skills.
**Depends on:** none
**Can run in parallel with:** none
**Expected files:**
- `docs/visual-proof-process.md` — new phase map: observe, ground primitives, define predicates, save before proof, fix app, capture after, verify, report; also maps phases to current/future skills.
- `README.md` — add short “Composable skills” and “Phase map” sections linking to the process doc.

**Context needed:**
- Current `README.md`, `skills/visual-proof/SKILL.md`, `docs/visual-proof-object.md`.
- User direction: first simple visual-proof skill, then iterate with drawing/pointing and DOM skills.

**Steps:**
- [ ] Write a concise process doc with phase ownership.
- [ ] Identify current implemented skills vs future skills.
- [ ] Keep future skills framed as adapters/orchestrators.

**Acceptance:**
- A reader can tell exactly which phases are covered now and which are future work.
- The process doc does not imply DOM/browser automation exists.

**Validation:**
- Manual review now; `npm run check` after S4 should assert doc exists and has core phase terms.

**Critical findings for next slice:**
- 

**Blockers / escape-hatch notes:**
- If the phase map reveals that `visual-proof` and `visual-primitives` overlap too much, stop and choose a single-skill docs-only plan; `no split` is valid if separation is confusing.

## Slice S2: Tighten `visual-proof` proof-only skill

**Status:** pending
**Purpose:** Ensure the existing skill is the simple proof layer, not an accidental end-to-end UI automation workflow.
**Depends on:** S1
**Can run in parallel with:** none
**Expected files:**
- `skills/visual-proof/SKILL.md` — restructure around inputs/outputs/steps/non-goals; explicitly delegates primitive generation to `visual-primitives` when a screenshot needs manual grounding.
- `README.md` — update skill list and workflow summary.

**Context needed:**
- S1 process doc.
- Existing visual-proof extension tool names and VP1 schema docs.

**Steps:**
- [ ] Add “Owns / Does not own” boundary.
- [ ] Keep before-only draft and complete before/after evaluation instructions.
- [ ] Make missing evidence behavior explicit.
- [ ] Reference `visual-primitives` as the drawing/pointing helper, not as a dependency required for every proof.

**Acceptance:**
- The skill can be used standalone when primitives/evidence are already supplied.
- The skill points to `visual-primitives` only when primitive grounding is needed.
- No language suggests it can open browsers, map DOM nodes, or run OCR/VLM itself.

**Validation:**
- Checker assertions in S4 for forbidden/required boundary phrases.

**Critical findings for next slice:**
- 

**Blockers / escape-hatch notes:**
- If adding references to `visual-primitives` before the skill exists makes the package temporarily inconsistent, implement S2 and S3 in the same commit/slice during build.

## Slice S3: Add `visual-primitives` drawing/pointing skill

**Status:** pending
**Purpose:** Provide the standalone paper-inspired drawing/pointing workflow without DOM or browser coupling.
**Depends on:** S1
**Can run in parallel with:** none
**Expected files:**
- `skills/visual-primitives/SKILL.md` — new skill for producing VP1-compatible `box`, `point`, and `path` primitives from screenshots.
- `docs/visual-proof-process.md` — link or mention the new skill in phase 2.
- `README.md` — list the skill.

**Context needed:**
- Thinking with Visual Primitives idea: use points/boxes/paths to close reference gap.
- VP1 primitive schema from `docs/visual-proof-object.md`.

**Steps:**
- [ ] Write skill frontmatter with specific description for screenshot grounding/drawing/pointing.
- [ ] Define input expectations: screenshot path or image, dimensions/viewport if known, bug/feature target.
- [ ] Define output contract: JSON primitive list, optional predicates suggestions, optional draft proof handoff to `visual-proof`.
- [ ] Include coordinate rules: pixel or normalized, stable ids, same ids before/after when possible.
- [ ] Include quality checklist: boxes tight enough, points center/actionable, paths ordered, uncertainty surfaced.
- [ ] Include non-goals: no DOM, no code fixing, no final fixed verdict.

**Acceptance:**
- The skill is independently useful for “draw/point at the screenshot” tasks.
- It produces artifacts that `visual-proof` can consume.
- It does not require browser/DOM/OCR/VLM tools to be present.

**Validation:**
- Checker validates frontmatter and boundary language.

**Critical findings for next slice:**
- 

**Blockers / escape-hatch notes:**
- If the skill becomes too procedural or too broad, cut it back to just primitive-output contract plus checklist.

## Slice S4: Manifest/checker/tests/gardening

**Status:** pending
**Purpose:** Wire the skill split into the package and prove nothing regressed.
**Depends on:** S1-S3
**Can run in parallel with:** none
**Expected files:**
- `package.json` — expose both skills.
- `scripts/check-package.mjs` — validate multiple skills, process doc, and key boundary language.
- `implementation-notes.md` — record decisions, validation, and next skill plan.

**Context needed:**
- Existing checker and validation output.
- Pi skills/package docs already read for this package.

**Steps:**
- [ ] Update manifest `pi.skills` to include `visual-primitives`.
- [ ] Update checker from “exactly one skill” to required skill IDs/paths.
- [ ] Add static assertions that `visual-proof` says proof-only/no DOM/browser capture and `visual-primitives` says boxes/points/paths/no DOM/no final verdict.
- [ ] Add process doc assertions.
- [ ] Run all validation.
- [ ] Update implementation notes.

**Acceptance:**
- `npm run check` fails if either skill is missing or boundary docs regress.
- Existing core tests, extension smoke, and CLI demo still pass.
- Implementation notes summarize the split and future next skill candidates.

**Validation:**
- `npm run check`
- `node test/core.test.mjs`
- `node test/extension-smoke.test.mjs`
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-skill-split-demo`
- `codex review --base master` or x-high fallback during Bead review.

**Critical findings for next slice:**
- 

**Blockers / escape-hatch notes:**
- If package checker becomes brittle on prose, prefer checking section headings and unique boundary sentences rather than long paragraphs.
