---
name: release-audit
description: Use when preparing a release, to audit dependencies and common security issues from gathered facts.
---

Run this once before a release, not on every change and not inside the normal gate. It is a
focused, read-only check of the things that go wrong between releases: risky dependencies and a short
list of common code-security mistakes.

Let a script gather the facts first. A deterministic program enumerates the dependency tree, their
licenses, known advisories, install scripts, and version pinning far more reliably than reading by
hand. Run the project's audit script if it has one; otherwise gather the raw facts mechanically:

```
npm audit --json
```

Judge only the items the facts flag. Open each flagged dependency or file and confirm the issue at its
exact location — do not re-scan the whole tree or re-derive what the script already decided. Check
licenses against the project's stated policy: shipped dependencies must meet it, while dev-only tooling
is informational. Check for committed secrets, unvalidated input, and injection-unsafe shell or file
paths on the flagged paths.

State the date and the source for every advisory and license fact, since those change over time and
your own memory is not evidence.

Return a ranked verdict: pass, or a list of findings ordered by severity with the file, the line, and
the fix. Hold any unresolved license or dependency question open for a decision rather than passing it.
