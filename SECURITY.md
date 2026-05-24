# Security Policy

## Supported versions

This repository is pre-1.0. Security fixes are expected to land on `master` until a versioned release policy exists.

## Reporting a vulnerability

Do **not** publish exploit details, private screenshots, captured browser sessions, cookies, tokens, or other secrets in public issues.

Preferred reporting path:

1. Use GitHub private vulnerability reporting if it is enabled for the public repository.
2. If private reporting is not available, open a minimal public issue that says a security report is available and ask the maintainers for a private contact path. Do not include the sensitive payload in that issue.

## Scope notes

This package is intentionally dependency-free and verifies supplied Visual Proof Objects only. It does not drive browsers, inspect live DOM, read image pixels, run OCR/VLMs, or make network calls as part of core verification.

Security-sensitive inputs to treat carefully:

- screenshots or videos from authenticated/private sessions;
- DOM snapshots, accessibility dumps, and text evidence that may contain user data;
- optional capture provenance such as auth-state notes, commands, or artifact hashes;
- generated reports and overlays that may reveal private routes, filenames, or UI state.

Do not commit private captures or generated local proof artifacts to this repository.
