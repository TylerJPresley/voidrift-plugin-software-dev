---
name: refactor
description: Use when restructuring code without changing behaviour, to keep it safe and reversible.
---

Refactor is a behaviour-preserving change: the code reads better or is better structured, and does
exactly what it did before. Keep it strictly separate from feature work and bug fixes — mixing them
hides which edit changed behaviour and which only moved it, and makes a regression impossible to
bisect.

Work in small, individually verifiable increments. Rename one thing, extract one function, move one
module — then run the tests. Do not stack five transformations and verify once at the end; a failure
then tells you nothing about which step broke.

```
npm test
```

Keep the tests green at every step. If the suite is thin where you are working, add characterisation
tests that capture the current behaviour first, so you have a safety net before you move anything.

Change the shape, never the contract. Public signatures, return values, side effects, and error
behaviour stay the same unless a separate, labelled change alters them on purpose. If a refactor
tempts you to "fix a small bug while I'm here", stop and make that a separate commit.

Each increment leaves the tree in a working, committable state, so any step can be the last one and the
work can stop safely at any point.
