---
name: test-driven-change
description: Use when adding a feature or fixing a bug in code, to drive the change from tests.
---

Write the test before the code. Start from the acceptance criteria and turn each one into a failing
test that names the behaviour it proves; run it and watch it fail for the right reason. Only then
write the smallest code that makes it pass, and refactor once it is green.

Every bug fix carries a regression test written first: reproduce the bug as a failing assertion, then
fix the cause so that assertion turns green and stays green.

Shape each test Given/When/Then so it mirrors one acceptance criterion. Keep a broad base of fast unit
tests, fewer integration tests, and only the minimal end-to-end checks the behaviour demands.

Mock only at the true external boundary — the network, the clock, a third-party service. Inside that
boundary use real objects, deterministic fixtures, and in-memory fakes rather than elaborate mock
setups, so a passing test exercises the real path it claims to cover and cannot pass by accident.

Run the suite through the project's own command:

```
npm test
```

A change is complete when every new test passes, the existing suite stays green, and each criterion
has a test that would fail if the behaviour regressed.
