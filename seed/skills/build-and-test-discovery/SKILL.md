---
name: build-and-test-discovery
description: Use when starting work in an unfamiliar repository, to find its real build and test commands.
---

Discover the project's commands from its own configuration before you assume any. Guessing `npm test`
in a repository that builds with another toolchain wastes a cycle and reports a false failure.

Read the manifest and config files that declare the commands. In a Node project, open `package.json`
and read its `scripts` block — the build, test, lint, and typecheck entries are named there. Other
ecosystems declare them in their own manifest or task file; read whichever the repository actually has
before running anything.

```
cat package.json
```

Identify four commands: how the project builds, how it runs tests, how it lints, and how it
typechecks. If a contributor guide or a gate script names a single command that chains them, prefer
that — it is the project's own definition of a passing state.

Name the gate explicitly in your plan: the one command, or the ordered set, that must pass for the
change to be complete. Use those exact commands for every later verification so the result matches what
the project's own checks would produce.

When a command is genuinely absent — no test script, no linter — say so rather than inventing one, and
treat setting one up as its own decision, not a silent assumption.
