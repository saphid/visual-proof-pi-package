# Visual proof Pi package implementation plan

## Review in 2 minutes

**Goal:** Build a Pi-native package that turns the “Thinking with Visual Primitives” idea into a reusable UI bug/feature proof workflow. The package should provide a project-loadable Pi extension plus a skill. The extension gives agents deterministic tools to create, store, evaluate, compare, and report visual proof objects made of screenshots/videos metadata, boxes, points, paths, and visual predicates. The skill teaches agents when to use those tools during UI bug fixing and feature acceptance: capture failing proof, fix code, capture after proof, verify visually and with deterministic predicates.

**Non-goals:**
- Do not implement a full browser runner or VLM screenshot grounding model in this first package; Playwright/browser-worker/VLM capture remains an adapter layer using the proof schema.
- Do not claim pixel-perfect visual diff or OCR capability without inputs from another tool.
- Do not depend on paid APIs, external services, native image libraries, or npm install to pass local checks.
- Do not mutate the user’s app under test; the package only creates/evaluates proof artifacts.

**Risky assumptions:**
- A core artifact library plus Pi tool wrappers is enough to demonstrate the cheap/fast/accurate value before adding browser/VLM automation.
- Bounding boxes, points, paths, and deterministic predicates cover the first useful UI bug classes: overlap, containment, evidence-backed visibility/clickability, alignment, text-presence evidence, count, and path continuity.
- Pi extension runtime can import local `.mjs` helpers from a TypeScript extension loaded by jiti.
- Tests can validate the value using synthetic before/after proof JSON fixtures that include realistic screenshot/video metadata, even without raster image files.

**Slice order:** S1 proof contracts/geometry/verifier → S2 report/CLI/demo fixtures → S3 Pi extension tools → S4 visual-proof skill/docs/package validation → S5 acceptance proof/gardening

**Expected high-risk files:**
- `src/visual-proof-core.mjs` — schema validation, geometry, predicate semantics, before/after verdict logic.
- `extensions/visual-proof/index.ts` — Pi tool schemas and artifact writing safety.
- `skills/visual-proof/SKILL.md` — must guide agents without overclaiming automation.
- `examples/*.json` and `test/*.mjs` — must prove before fails and after passes.

**Validation strategy:**
- `npm run check` — package manifest/resource validation, dependency-free core tests, extension tool-registration smoke, and fixture evaluation.
- `node test/core.test.mjs` — geometry, evidence-backed predicate semantics, before/after verdict, report generation.
- `node test/extension-smoke.test.mjs` — no-Pi-runtime mock registration test proving the extension tool definitions register expected tools and evaluate the example proof through the tool handler path.
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo` — value demo: before screenshot metadata fails, after screenshot/video metadata passes, reports created.
- Optional Pi-load smoke if available: `pi --no-session --no-extensions -e ./extensions/visual-proof/index.ts -p "What visual proof tools are available?"`.

**Reasons this plan might be wrong:**
- If Pi custom tool schema support cannot express nested proof objects cleanly, the extension may need path-only inputs first.
- If TypeScript extension imports of local `.mjs` are brittle, the extension may need inline helpers or a package-level entrypoint.
- If “value” requires actual app screenshot capture in this iteration, this package will need a Playwright adapter slice before it is useful.

## Slice table

| Slice | Status | Depends on | Parallel? | Expected files | Validation |
|---|---|---|---|---|---|
| S1 Proof contracts and deterministic verifier | pending | none | no | `src/visual-proof-core.mjs`, `test/core.test.mjs` | `node test/core.test.mjs` |
| S2 Reports, CLI, and proof fixtures | pending | S1 | no | `bin/visual-proof.mjs`, `examples/*.json`, `docs/visual-proof-object.md`, `test/core.test.mjs` | `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo` |
| S3 Pi extension tools | pending | S1, S2 | no | `src/visual-proof-tools.mjs`, `extensions/visual-proof/index.ts`, `test/extension-smoke.test.mjs` | `node test/extension-smoke.test.mjs`; `npm run check` |
| S4 Skill, package manifest, and user docs | pending | S1-S3 | no | `skills/visual-proof/SKILL.md`, `README.md`, `package.json`, `scripts/check-package.mjs` | `npm run check` |
| S5 Acceptance proof and gardening | pending | S1-S4 | no | `implementation-notes.md`, generated demo artifacts under `/tmp` only | full validation commands and reviewer proof |

## Global acceptance criteria

- The repository is a valid Pi package with a `package.json` `pi` manifest exposing one extension and one skill.
- The package defines a Visual Proof Object with normalized visual primitives and predicates suitable for UI bug evidence.
- A deterministic verifier can evaluate before/after observations and prove a synthetic UI overlap bug is fixed.
- Reports include human-readable Markdown plus a compact machine-readable verdict.
- The extension registers Pi tools for creating/evaluating/reporting proofs without requiring an external API.
- The skill explains the bug-fix workflow: capture failing screenshot/proof, fix, capture after proof, verify predicates, save evidence.
- Local validation passes without installing dependencies; any Pi-runtime-only imports are kept out of dependency-free tests.
- Documentation is honest about the boundary: this iteration is the proof artifact/verifier layer, not a full VLM/browser capture agent.

## Assumptions to verify

- Local Node.js is available and can run ESM tests and CLI scripts.
- Pi package discovery accepts `pi.extensions` and `pi.skills` manifest entries pointing to project paths.
- Pi extension schema helpers may be available at runtime, but `npm run check` must not require external npm dependencies. Prefer dependency-free tool definition helpers that can be smoke-tested with a mock Pi object.
- Extension tools should write only under an explicit output directory or `.visual-proof/` in `ctx.cwd` to avoid unsafe arbitrary writes.

## Rejected / not doing

- Full Playwright route capture in this first build: useful but expands scope and requires app-specific setup.
- Raster screenshot annotation with native image libraries: SVG/Markdown overlays are enough for proof without dependencies.
- Fine-tuning or training a VLM: the paper’s immediate value is the artifact and reasoning protocol, not reproducing DeepSeek’s model.
- Pixel-diff as primary proof: visual primitives plus predicates are less noisy and more auditable for UI agents.

## Slice S1: Proof contracts and deterministic verifier

**Status:** pending
**Purpose:** Establish the schema and correctness-sensitive core that makes the package valuable independent of Pi runtime.
**Depends on:** none
**Can run in parallel with:** none
**Expected files:**
- `src/visual-proof-core.mjs` — exports geometry helpers, proof validation, predicate evaluation, before/after comparison.
- `test/core.test.mjs` — red/green tests for overlap, containment, visibility, alignment, path continuity, and before/after verdict.

**Context needed:**
- This plan and the paper summary: visual primitives solve the reference gap by anchoring language to coordinates.
- No existing project code; create minimal dependency-free ESM.

**Steps:**
- [ ] Define Visual Proof Object shape in comments/JSDoc.
- [ ] Implement primitive lookup and validation errors for malformed boxes/points/paths.
- [ ] Implement geometry helpers: area, intersection, overlap ratio, containment, center, distance, normalized-to-pixel conversion.
- [ ] Implement predicate evaluators for `not_overlapping`, `inside`, `aligned`, `count_equals`, and `path_continuous` from primitives/geometry.
- [ ] Implement `visible`, `text_present`, and `clickable` as evidence-backed predicates: they must read explicit observation evidence fields such as `visibility`, `detectedText`, or `clickTargets`; missing evidence fails or errors and never silently passes.
- [ ] Implement `evaluateProof(proof)` returning before/after predicate results and final verdict.
- [ ] Write tests that fail if the verifier cannot distinguish a before-overlap from an after-fix, and tests that fail on missing evidence for `visible`, `text_present`, and `clickable`.

**Acceptance:**
- Core functions are deterministic, dependency-free, and tested.
- A proof with failing before predicates and passing after predicates returns `fixed`.
- Evidence-backed predicates require explicit evidence and do not infer from screenshots/OCR.
- Malformed primitives/predicates produce actionable errors rather than silent pass.

**Validation:**
- `node test/core.test.mjs` — proves geometry and verdict behavior.

**Critical findings for next slice:**
- 

**Blockers / escape-hatch notes:**
- If a predicate cannot be implemented reliably without pixel/OCR data, keep it as evidence-backed input validation only and document the limitation; `no fix` is valid for that predicate in S1.

## Slice S2: Reports, CLI, and proof fixtures

**Status:** pending
**Purpose:** Make the value visible outside Pi tools: a user can run a fixture and see before failure, after pass, and a durable proof report.
**Depends on:** S1
**Can run in parallel with:** none
**Expected files:**
- `bin/visual-proof.mjs` — CLI with `evaluate <proof.json> --out <dir>`.
- `examples/button-overlap-proof.json` — synthetic before/after UI bug proof with required realistic `before.screenshot` and `after.screenshot` metadata (path, dimensions, viewport, URL/route) plus required `after.video` metadata (path, duration, frame count or sampled frame info).
- `docs/visual-proof-object.md` — concise schema/reference docs.
- `test/core.test.mjs` — report/CLI coverage as needed.

**Context needed:**
- S1 exported functions and error shapes.
- Pi package should not commit generated `/tmp` demo output.

**Steps:**
- [ ] Add Markdown report generation summarizing bug, primitives, predicates, before/after status, and verdict.
- [ ] Add SVG overlay generation for boxes/points/path primitives if screenshot dimensions are known; reference screenshot path without embedding.
- [ ] Add CLI evaluation command that writes `evaluation.json`, `report.md`, and optional overlay SVGs.
- [ ] Add a fixture where `submit_button` overlaps `footer` before and is inside `main_content` after, with required `before.screenshot.path`, `after.screenshot.path`, dimensions, URL/route, viewport, and required `after.video.path`, duration, and frame-count or sampled-frame metadata.

**Acceptance:**
- Running the CLI on the fixture writes a readable report and machine-readable evaluation.
- The fixture demonstrates the exact workflow value: a before screenshot/description proof has objective failing visual predicates, then an after screenshot/video proof has objective passing predicates after fix.

**Validation:**
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo` — output verdict should be `fixed`.
- `node test/core.test.mjs` — still passes.

**Critical findings for next slice:**
- 

**Blockers / escape-hatch notes:**
- If SVG overlay adds fragility, fall back to Markdown/JSON report only and note overlay as future work.

## Slice S3: Pi extension tools

**Status:** pending
**Purpose:** Expose the proof system to Pi agents as tools they can call during UI debugging/fixing sessions.
**Depends on:** S1, S2
**Can run in parallel with:** none
**Expected files:**
- `src/visual-proof-tools.mjs` — dependency-free tool definition/registration helper with executable handlers that can be tested using a mock Pi object.
- `extensions/visual-proof/index.ts` — thin Pi adapter that imports the helper and registers `visual_proof_create`, `visual_proof_evaluate`, and `visual_proof_report` or equivalent minimal tool set.
- `test/extension-smoke.test.mjs` — no-Pi-runtime smoke test using a mock Pi registration object.

**Context needed:**
- Pi extension docs: custom tools use `pi.registerTool`; the local test path should avoid runtime-only dependencies while the Pi adapter can use documented Pi runtime imports if necessary.
- S1/S2 APIs.

**Steps:**
- [ ] Build dependency-free tool definitions and handlers in `src/visual-proof-tools.mjs`.
- [ ] Register a create tool that writes a proof JSON artifact from supplied description, observations, primitives, and predicates.
- [ ] Register an evaluate/report tool that reads a proof path or inline proof object, runs the core verifier, and writes report artifacts.
- [ ] Keep tool inputs explicit and safe: output directory optional, default `.visual-proof/<proof-id>`; no arbitrary shelling.
- [ ] Return concise content plus details with verdict, artifact paths, failing predicates, and passing predicates.
- [ ] Add a mock-Pi smoke test that registers the tools and invokes the evaluate handler against `examples/button-overlap-proof.json`.

**Acceptance:**
- Extension imports the core/tool modules and registers tools without side effects at import time.
- Dependency-free smoke test proves the tool handler path can evaluate the example proof and report artifact paths.
- Tool descriptions/prompt snippets guide agents toward using visual primitives for UI bug proof.

**Validation:**
- `node test/extension-smoke.test.mjs` — registers expected tools with a mock Pi object and invokes evaluation.
- `npm run check` — static/package validation includes extension file presence, core tests, fixture evaluation, and extension smoke.
- Optional: `pi --no-session --no-extensions -e ./extensions/visual-proof/index.ts -p "List the visual proof workflow this extension enables"`.

**Critical findings for next slice:**
- 

**Blockers / escape-hatch notes:**
- If Pi runtime cannot import the extension in a non-interactive smoke test, keep core/skill/package complete and document the failure plus next exact fix.

## Slice S4: Skill, package manifest, and user docs

**Status:** pending
**Purpose:** Make the package installable/discoverable and teach agents the intended visual-proof workflow.
**Depends on:** S1-S3
**Can run in parallel with:** none
**Expected files:**
- `skills/visual-proof/SKILL.md` — on-demand workflow instructions for UI bugs/features.
- `README.md` — install, usage, example, value claims, limitations.
- `package.json` — Pi package manifest and npm scripts.
- `scripts/check-package.mjs` — validates expected package layout/frontmatter, verifies local checks need no npm install, and runs tests/smokes.

**Context needed:**
- Pi skills docs and package docs.
- This plan’s non-goals and value framing.

**Steps:**
- [ ] Add package metadata with `keywords: ["pi-package"]`, `pi.extensions`, `pi.skills`, and scripts.
- [ ] Write the skill with exact steps: reproduce, screenshot, ground primitives, save before proof, fix, save after proof/video metadata, deterministic verify, VLM only for ambiguity.
- [ ] Write README explaining how the paper’s ideas map to UI proof and how to run the demo.
- [ ] Add package checker that fails on missing resources, missing frontmatter, invalid examples, examples missing required screenshot/video metadata, failing tests, or missing extension-smoke coverage.

**Acceptance:**
- Skill is specific enough to auto-load for UI visual proof/bug-fixing requests.
- README is honest that this is the proof/verifier layer and shows where browser/VLM capture plugs in.
- `npm run check` passes from a clean checkout without npm install.

**Validation:**
- `npm run check` — manifest, skill, examples, tests.

**Critical findings for next slice:**
- 

**Blockers / escape-hatch notes:**
- If package validation cannot avoid dependency installation, replace it with a pure Node script and document optional Pi-load smoke separately.

## Slice S5: Acceptance proof and gardening

**Status:** pending
**Purpose:** Prove the built package actually provides the intended value and clean up rough edges before final handoff.
**Depends on:** S1-S4
**Can run in parallel with:** none
**Expected files:**
- `implementation-notes.md` — decisions, deviations, validation evidence.
- Generated demo artifacts under `/tmp/visual-proof-demo` only, not committed.

**Context needed:**
- Final diff and validation output.
- Simple-build review expectations: acceptance-aware blocker review plus Codex/x-hi closeout when possible.

**Steps:**
- [ ] Run all focused validation.
- [ ] Run the fixture demo and inspect report content for human usefulness.
- [ ] Update `implementation-notes.md` with how value was proven, limitations, and next slices.
- [ ] Perform blocker-only review for correctness, tests/proof, and scope honesty.
- [ ] Fix accepted blockers only.

**Acceptance:**
- Evidence shows the package makes a visual UI bug proof cheaper/faster/more accurate at the artifact/verifier layer.
- No generated temp artifacts or local state are committed.
- Any limitations are documented clearly.

**Validation:**
- `npm run check`
- `node test/extension-smoke.test.mjs`
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo`
- Optional Pi-load smoke if runtime/auth permits.

**Critical findings for next slice:**
- 

**Blockers / escape-hatch notes:**
- If the demo does not convincingly show before fail/after pass, stop and improve the fixture/report before claiming value; `no fix` is not valid for missing proof value.
