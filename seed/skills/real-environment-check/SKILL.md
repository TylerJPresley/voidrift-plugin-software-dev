---
name: real-environment-check
description: Use when verifying a built product at a milestone, in a scratch environment without touching user config.
---

Verify the built product the way it actually runs, once per milestone, on what changed. Unit tests
prove the parts; this proves the assembled whole behaves against a real environment.

Build the shippable artifact and run it, rather than testing source through a harness. Exercise the
paths the milestone changed — the command a user would type, the request a client would send — and
confirm the real effect happened, not just that a function returned.

Work in a scratch environment that is thrown away afterwards. Point the product at a temporary working
directory and temporary configuration so the run cannot read or write the user's own settings, data,
or credentials. Never verify against the user's live configuration.

```
timeout 120 node dist/cli.js --help
```

Cap any step that spends a real external resource — a paid model call, a network round-trip — to a
small fixed number of runs, enough to prove the path works and no more. Fake the external boundary for
everything that does not need the real thing.

Scope the check to what changed since the last milestone, not the entire product, and record what you
ran, what you observed, and what you could not verify. Clean up the scratch environment and leave no
stray processes behind.
