# Contributing

Thanks for helping improve Visual Proof.

## Local validation

No dependency install is required for the current test suite.

```bash
npm run check
node test/core.test.mjs
node test/extension-smoke.test.mjs
node bin/visual-proof.mjs evaluate examples/button-overlap-proof.json --out /tmp/visual-proof-demo
```

Run `git diff --check` before submitting patches.

## Design boundaries

Keep the package dependency-free unless a separate design discussion accepts the tradeoff.

- `visual-proof` owns VP1 proof creation/evaluation and final VP1 verdicts.
- `visual-primitives` owns drawing/pointing from supplied screenshots only.
- `browser-capture` owns capture metadata contracts only.
- `dom-bridge` owns explicit DOM/evidence adaptation only.
- `visual-fix-loop` owns orchestration only and cites `visual-proof` for final verdicts.

Do not add browser drivers, DOM runtimes, OCR/VLM calls, pixel-diff engines, or project-specific app-fixing logic to the verifier core.

## Artifact hygiene

Do not commit:

- screenshots/videos from private or authenticated sessions;
- generated proof outputs under `.visual-proof/`, `.visual-proof-test-output/`, or `artifacts/`;
- `.env` files, logs, cookies, tokens, local browser profiles, or temporary server outputs.

Synthetic examples are okay when they are explicitly reviewed and intentionally tracked.

## Documentation changes

When changing skill boundaries or public behavior, update the relevant files together:

- `skills/*/SKILL.md`
- `README.md`
- `docs/visual-proof-process.md`
- `docs/visual-proof-object.md` when schema behavior changes
- `scripts/check-package.mjs` for durable guardrails
