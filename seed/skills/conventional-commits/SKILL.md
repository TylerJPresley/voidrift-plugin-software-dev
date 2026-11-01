---
name: conventional-commits
description: Use when composing a commit from a diff, to produce a small, tested, conventional commit.
---

Compose one logical change per commit, small enough that a reader understands what happened from the
message and the diff alone. Never mix a refactor, a removal, a new option, and a bug fix in one commit;
split them.

Write a conventional-commit message. The subject is a type, an optional scope, and an imperative
summary; the body explains why when the diff does not. Use the type that matches the change:

```
feat: add retry budget to the request runner
```

The types are `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, and the rest of the standard set.
Cite the spec section the change implements when one applies, so the history traces back to the
decision. A breaking change is marked, not buried.

Every commit is tested. Build and the affected tests pass before you make it, and a bug fix carries its
regression test in the same commit — never a separate "add test" commit landing after the fix. Commit
after each verified chunk of work, not once in a single pile at the end.

Push only when asked, and only after the full suite passes. Never force-push and never amend a commit
that is already pushed; both rewrite history others may hold. Follow the project's stated branching
model; without one, commit to the default branch.
