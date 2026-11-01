---
name: code-review
description: Use when reviewing a code change you did not write, to judge it against the plan and spec.
---

Review the change in fresh context, against the plan and the spec it claims to satisfy — never against
your memory of writing it, and never trusting the author's own report of what it does.

Read the diff and ask four questions. Correctness: does it do what the step asked, including the edge
cases? Tests: is every changed path covered, and would a test fail if the behaviour regressed? Safety:
is input validated, are secrets kept out of logs and output, are shell and file paths injection-safe?
Scope and fit: is it the minimal change, in the project's style, with nothing unrelated smuggled in?

Run the project's full gate read-only and confirm it passes on your own machine, not on the author's
word:

```
npm test
```

Try to break the work rather than to improve it: feed it the empty input, the boundary value, the
concurrent call, the malformed file. A review that only confirms the happy path has proved nothing.

Return a ranked verdict. PASS, or FAIL with specific, actionable findings ordered by severity, each
naming the file and line and the behaviour it breaks. Write nothing and change nothing — the verdict
goes back to whoever dispatched the review.
