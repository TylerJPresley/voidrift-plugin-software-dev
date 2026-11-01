---
name: solution-standards
description: Use when designing or writing code, to choose the simplest correct solution that fits the target.
---

Write the smallest correct solution. No boilerplate, no speculative abstraction, no defensive code for
a case that cannot occur yet. A five-line inline change beats a fifty-line module that anticipates
needs nobody has.

Fix the root cause, not the symptom. If an edit only suppresses a visible failure while the underlying
fault remains, say so and propose the real fix; a workaround is acceptable only when it is explicitly
requested and labelled temporary.

Understand a thing before you remove or change it. If the purpose of some code is unclear, find out why
it exists; if the reason still holds, keep it. Delete only once you have confirmed the reason is gone.

Fit the real target. Verify the approach works across every environment, platform, and provider the
code must run on — something that works on one and breaks on another is not a correct implementation.
Test the assumption against the actual constraints.

Reach for a maintained library before writing more than a few lines of utility code, but do not
cargo-cult: a library feature must solve the real problem in the real runtime, and a simpler approach
that works everywhere is better than a dependency that works in theory.

Keep one source of truth. If logic already exists, extend or replace it rather than growing a parallel
version that will drift. Give each module a single responsibility and let it depend on abstractions,
not concrete implementations.
