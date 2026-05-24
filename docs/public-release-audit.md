# Public release audit

Date: 2026-05-24

## Scope

This audit covers the Visual Proof Pi package repository contents intended for a public GitHub repository. It does not audit external browser-worker tools, Pi runtime credentials, private browser profiles, hosted demos, or generated local artifacts outside the tracked tree.

## Summary

Status: **ready for public repository review** after the cleanup in this document.

The repository contains dependency-free source, tests, docs, plans, skill contracts, and one intentionally generated public README banner image. No tracked binary capture assets, database files, `.env` files, browser profiles, or private screenshots/videos were found.

## Commands run

```bash
git status --short --branch --untracked-files=all
git ls-files
git grep -n -I -E '/home/|/Users/|C:\\Users\\|\.pi-autobrowse|facebook|cookie|token|bearer|password|secret|api[_-]?key|PRIVATE KEY|OPENAI|ANTHROPIC|GITHUB_TOKEN|npm_' || true
git grep -n -I -E '/home/|/Users/|C:\\Users\\|\.pi-autobrowse|facebook|cookie|token|bearer|password|secret|api[_-]?key|PRIVATE KEY|OPENAI|ANTHROPIC|GITHUB_TOKEN|npm_' $(git rev-list --all) -- . || true
git ls-files | grep -E '\.(png|jpg|jpeg|gif|webp|mp4|webm|mov|sqlite|db)$' || true
find . -name '.env*' -print
npm run check
node test/core.test.mjs
node test/extension-smoke.test.mjs
node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-public-demo
git diff --check
git diff --cached --check
npm pack --dry-run --json
```

## Findings

### Secrets and private data

- No tracked `.env` files were found.
- No tracked binary screenshots, videos, SQLite databases, or browser profile files were found.
- `docs/assets/readme-banner.png` is an intentionally generated public illustration for the README, not a browser capture or private artifact.
- Sensitive-word hits in tracked files are documentation examples and guardrails such as `authNotesNoSecrets`, `cookies`, `tokens`, and `API keys`; they do not contain real secret values.
- Git history scan found the same documentation-only hits and no committed private Facebook artifacts or local home-directory paths in tracked project content.

### Generated artifacts

- A local synthetic SPA demo existed under `artifacts/skill-testing-spa/` as untracked files. It was removed from the worktree before public-readiness changes were prepared.
- A local `.pi-autobrowse/captures/facebook/` directory existed as empty local state. `.pi-autobrowse/` is now ignored so future capture files are not accidentally committed.
- `.gitignore` and `.npmignore` now ignore top-level generated artifact, browser-capture, and local-output directories so future demos are not accidentally committed or packed.

### Dependencies

- `dependencies` and `devDependencies` are empty.
- The validation suite uses Node built-ins only.
- The package remains a workflow/verifier package and does not add browser automation, DOM runtime, OCR, VLM, hashing, or pixel-diff dependencies.

### Licensing and contribution docs

- Added `LICENSE` with the MIT license matching `package.json`.
- Added `SECURITY.md` with reporting guidance and private-artifact cautions.
- Added `CONTRIBUTING.md` with validation commands, boundary rules, and artifact hygiene.
- README now opens with attribution/context links to the `Thinking with Visual Primitives` technical report and the Two Minute Papers video discussing it, plus a non-affiliation note.

## Final validation results

- `npm run check` — pass.
- `node test/core.test.mjs` — pass.
- `node test/extension-smoke.test.mjs` — pass.
- `node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-public-demo` — pass, verdict `fixed`.
- `git diff --check` — pass.
- `git diff --cached --check` — pass.
- `npm pack --dry-run --json` — reviewed; ignored local output directories and generated artifacts are not included, with explicit `.npmignore` coverage; the intentional README banner is included.

## Remaining publication notes

- `package.json` keeps `private: true` intentionally. That is safe for a public GitHub repository and prevents accidental npm publication while the package name/release process is not finalized.
- Before publishing to npm, choose a final package name, add repository/homepage/bugs metadata, decide whether to remove `private: true`, and add an npm `files` allowlist.
- Public issue reports should not include private screenshots, DOM dumps, session data, cookies, tokens, or captured authenticated states.
