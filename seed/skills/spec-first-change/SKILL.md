---
name: spec-first-change
description: Use when a change touches behaviour a spec describes, to keep code and spec in lockstep.
---

Read the governing spec before you design or write anything. The spec is the source of truth; code
follows it, and code that contradicts it is a defect to fix, not a decision to defend. Find the section
that owns the behaviour you are about to change and read it first.

Two altitudes carry the spec. A system-level document fixes identity, components, and how they relate;
component-level documents hold the buildable internal detail. The system level governs — a component
spec never contradicts it, and when both must move they move together.

Treat a spec change as deliberate and approved, never incidental. Propose the exact wording for the
section, confirm it with whoever owns the decision, and only then write it. Approving the idea is not
approving the words; write the words that were approved, nothing more.

Write a spec as the finished system in present tense and affirmative voice. Describe what the system
does, not what it will do or what is missing; build progress, phasing, and open tasks live in working
notes, not in the spec. Keep section numbers stable, because code and other documents cite them.

When code and spec disagree, bring them back into lockstep in the same change: fix whichever one the
governing rule says is wrong, and leave them consistent. If the conflict touches a decision that is
not yours to make, stop and surface it rather than picking a side.
