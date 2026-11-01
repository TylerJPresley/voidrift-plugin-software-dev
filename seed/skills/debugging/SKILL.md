---
name: debugging
description: Use when code fails, throws, or behaves wrong, to find the cause before changing anything.
---

Build a tight reproduction loop first. Find one command that triggers the failure fast and runs in
seconds, before you form any hypothesis. The same inputs give the same failure, so pin the inputs
until the failure is reliable.

```
npx vitest run path/to/failing.test.ts
```

Observe before you theorise. Read the actual error, stack trace, and surrounding state; add a
targeted log or breakpoint at the boundary where behaviour diverges from expectation. Describe what
you see, not what you assume.

Name the failing assumption. State in one sentence the belief the evidence contradicts — a value you
expected, an order you assumed, a boundary you thought was handled. This is the defect's location.

Form one hypothesis that explains the evidence, then change one thing to test it. If the failure
persists unchanged, the hypothesis was wrong; return to the evidence rather than trying another patch.

Fix the cause, not the symptom. Once the cause is clear, write a regression test that fails on the old
code, then apply the smallest fix that turns it green. Re-run the reproduction command to confirm the
failure is gone and the suite stays green.
