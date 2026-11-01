---
name: release-notes
description: Use when preparing a release, to draft a changelog entry and summary from the commit range.
---

Draft the release notes from the actual commit range, not from memory of what you intended to ship.
Start by listing the commits since the last release so the notes describe what the code really does.

```
git log --oneline LAST_TAG..HEAD
```

Group the entries by conventional-commit type: features, fixes, refactors, documentation, and chores.
Put breaking changes first and label them clearly — a reader scanning the notes must see what will
break their usage before anything else. Fold pure-internal chores into a short line or omit them; the
notes are for the people who consume the release.

Write each line in terms of user-visible effect, not implementation. "Requests now retry on timeout"
tells a reader more than "added retry loop to runner". Link the spec section each change implements
when one applies, so a curious reader can trace the decision.

Produce two artifacts: a changelog entry under the new version heading, following the format the
project's changelog already uses, and a short release summary — a few sentences naming the headline
changes and any migration a user must perform.

These are drafts for review. Do not tag, commit, or publish the release; hand the notes back for the
release step to use.
