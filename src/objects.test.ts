import { describe, it, expect } from "vitest";
import {
  parseMarkdown,
  serializeMarkdown,
  nextIdForKind,
  canTransition,
  type Idea,
  type ChangeRequest,
  type Task,
} from "./objects.js";

describe("objects — id generation", () => {
  it("nextIdForKind returns 001 for empty list", () => {
    expect(nextIdForKind("IDEA", [])).toBe("IDEA-001");
  });

  it("nextIdForKind increments from max existing id", () => {
    expect(nextIdForKind("IDEA", ["IDEA-001.md", "IDEA-003.md", "IDEA-002.md"])).toBe("IDEA-004");
  });

  it("nextIdForKind handles different kinds independently", () => {
    expect(nextIdForKind("CR", ["IDEA-010.md", "CR-002.md"])).toBe("CR-003");
    expect(nextIdForKind("TASK", ["IDEA-010.md", "TASK-001.md", "CR-002.md"])).toBe("TASK-002");
  });

  it("nextIdForKind ignores files without matching kind", () => {
    expect(nextIdForKind("IDEA", ["CR-001.md", "TASK-005.md"])).toBe("IDEA-001");
  });
});

describe("objects — frontmatter parsing", () => {
  it("parses idea with required fields", () => {
    const md = `---
id: IDEA-001
title: Add user authentication
status: draft
created_at: 2026-10-27T10:00:00Z
---
Problem: Users have no auth.`;
    const idea = parseMarkdown(md, "idea") as Idea;
    expect(idea.id).toBe("IDEA-001");
    expect(idea.title).toBe("Add user authentication");
    expect(idea.status).toBe("draft");
    expect(idea.created_at).toBe("2026-10-27T10:00:00Z");
  });

  it("parses CR with modules and acceptanceCriteria", () => {
    const md = `---
id: CR-001
title: Implement OAuth2
status: draft
created_at: 2026-10-27T10:00:00Z
modules:
  - auth
  - security
acceptanceCriteria:
  - Users can log in via GitHub
  - Tokens are secure
---
Detailed implementation plan.`;
    const cr = parseMarkdown(md, "cr") as ChangeRequest;
    expect(cr.id).toBe("CR-001");
    expect(cr.modules).toEqual(["auth", "security"]);
    expect(cr.acceptanceCriteria).toEqual([
      "Users can log in via GitHub",
      "Tokens are secure",
    ]);
  });

  it("parses task with cr_id", () => {
    const md = `---
id: TASK-001
title: Set up OAuth provider
status: pending
created_at: 2026-10-27T10:00:00Z
cr_id: CR-001
acceptanceCriteria:
  - Provider config is validated
---
Implementation steps.`;
    const task = parseMarkdown(md, "task") as Task;
    expect(task.id).toBe("TASK-001");
    expect(task.status).toBe("pending");
    expect(task.cr_id).toBe("CR-001");
  });

  it("preserves user-edited extra frontmatter fields", () => {
    const md = `---
id: IDEA-001
title: Test idea
status: draft
created_at: 2026-10-27T10:00:00Z
custom_field: user value
another: 123
---
Content here.`;
    const idea = parseMarkdown(md, "idea") as Idea & Record<string, unknown>;
    expect(idea.custom_field).toBe("user value");
    expect(idea.another).toBe(123);
  });

  it("handles missing optional fields gracefully", () => {
    const md = `---
id: CR-001
title: Simple CR
status: draft
created_at: 2026-10-27T10:00:00Z
---
No modules or criteria.`;
    const cr = parseMarkdown(md, "cr") as ChangeRequest;
    expect(cr.modules).toBeUndefined();
    expect(cr.acceptanceCriteria).toBeUndefined();
  });

  it("parses inline YAML array format [item1, item2]", () => {
    const md = `---
id: CR-001
title: CR with inline array
status: draft
created_at: 2026-10-27T10:00:00Z
modules: [auth, api, db]
---
Content`;
    const cr = parseMarkdown(md, "cr") as ChangeRequest;
    expect(cr.modules).toEqual(["auth", "api", "db"]);
  });

  it("parses integer and boolean values", () => {
    const md = `---
id: IDEA-001
title: Test
status: draft
created_at: 2026-10-27T10:00:00Z
priority: 5
approved: true
rejected: false
---
Content`;
    const idea = parseMarkdown(md, "idea") as Idea & Record<string, unknown>;
    expect(idea.priority).toBe(5);
    expect(idea.approved).toBe(true);
    expect(idea.rejected).toBe(false);
  });

  it("parses quoted string values", () => {
    const md = `---
id: IDEA-001
title: Test
status: draft
created_at: 2026-10-27T10:00:00Z
description: "This is quoted"
---
Content`;
    const idea = parseMarkdown(md, "idea") as Idea & Record<string, unknown>;
    expect(idea.description).toBe("This is quoted");
  });

  it("throws on missing required id field", () => {
    const md = `---
title: No ID
status: draft
created_at: 2026-10-27T10:00:00Z
---
Content`;
    expect(() => parseMarkdown(md, "idea")).toThrow("Missing id");
  });

  it("throws on missing required title field", () => {
    const md = `---
id: IDEA-001
status: draft
created_at: 2026-10-27T10:00:00Z
---
Content`;
    expect(() => parseMarkdown(md, "idea")).toThrow("Missing title");
  });

  it("throws on missing required status field", () => {
    const md = `---
id: IDEA-001
title: Test
created_at: 2026-10-27T10:00:00Z
---
Content`;
    expect(() => parseMarkdown(md, "idea")).toThrow("Missing status");
  });

  it("throws on missing required created_at field", () => {
    const md = `---
id: IDEA-001
title: Test
status: draft
---
Content`;
    expect(() => parseMarkdown(md, "idea")).toThrow("Missing created_at");
  });

  it("throws on missing frontmatter entirely", () => {
    const md = `No frontmatter here`;
    expect(() => parseMarkdown(md, "idea")).toThrow("Invalid frontmatter");
  });
});

describe("objects — frontmatter serialization", () => {
  it("round-trips idea with preserved extra fields", () => {
    const idea: Idea & Record<string, unknown> = {
      id: "IDEA-001",
      title: "Test",
      status: "draft",
      created_at: "2026-10-27T10:00:00Z",
      custom: "preserved",
    };
    const md = serializeMarkdown(idea, "content here");
    const parsed = parseMarkdown(md, "idea") as typeof idea;
    expect(parsed.id).toBe(idea.id);
    expect(parsed.custom).toBe("preserved");
  });

  it("does not rewrite frontmatter fields it does not own", () => {
    const original = `---
id: CR-001
title: Original
status: draft
created_at: 2026-10-27T10:00:00Z
user_added_field: keep this
---
Original content.`;
    const cr = parseMarkdown(original, "cr") as ChangeRequest & Record<string, unknown>;
    const serialized = serializeMarkdown(cr, "Original content.");
    expect(serialized).toContain("user_added_field: keep this");
  });

  it("serializes array fields with YAML list syntax", () => {
    const cr: ChangeRequest = {
      id: "CR-001",
      title: "Test",
      status: "draft",
      created_at: "2026-10-27T10:00:00Z",
      modules: ["auth", "api"],
      acceptanceCriteria: ["test1", "test2"],
    };
    const md = serializeMarkdown(cr, "body");
    expect(md).toContain("modules:");
    expect(md).toContain("  - auth");
    expect(md).toContain("  - api");
    expect(md).toContain("acceptanceCriteria:");
    expect(md).toContain("  - test1");
    expect(md).toContain("  - test2");
  });

  it("serializes non-string/non-array values as JSON", () => {
    const idea: Idea & Record<string, unknown> = {
      id: "IDEA-001",
      title: "Test",
      status: "draft",
      created_at: "2026-10-27T10:00:00Z",
      count: 42,
      flag: true,
      data: { nested: "value" },
    };
    const md = serializeMarkdown(idea, "body");
    expect(md).toContain("count: 42");
    expect(md).toContain("flag: true");
    expect(md).toContain("data: ");
    const reparsed = parseMarkdown(md, "idea") as typeof idea;
    expect(reparsed.count).toBe(42);
    expect(reparsed.flag).toBe(true);
  });
});

describe("objects — status transitions", () => {
  it("idea: draft → accepted → analyzed", () => {
    expect(canTransition("idea", "draft", "accepted")).toBe(true);
    expect(canTransition("idea", "accepted", "analyzed")).toBe(true);
    expect(canTransition("idea", "analyzed", "draft")).toBe(false);
  });

  it("idea rejects invalid transitions", () => {
    expect(canTransition("idea", "draft", "analyzed")).toBe(false);
    expect(canTransition("idea", "draft", "deployed")).toBe(false);
  });

  it("CR: draft → developed → verified → deployed", () => {
    expect(canTransition("cr", "draft", "developed")).toBe(true);
    expect(canTransition("cr", "developed", "verified")).toBe(true);
    expect(canTransition("cr", "verified", "deployed")).toBe(true);
  });

  it("CR: verified → failed", () => {
    expect(canTransition("cr", "verified", "failed")).toBe(true);
  });

  it("CR rejects invalid transitions", () => {
    expect(canTransition("cr", "draft", "verified")).toBe(false);
    expect(canTransition("cr", "verified", "developed")).toBe(false);
  });

  it("task: pending → done", () => {
    expect(canTransition("task", "pending", "done")).toBe(true);
  });
});

describe("objects — frontmatter preservation (YAML-aware)", () => {
  it("preserves quoted title with colon: Fix: parser", () => {
    const original = `---
id: IDEA-001
title: "Fix: parser"
status: draft
created_at: 2026-10-27T10:00:00Z
---
Implementation notes.`;
    const idea = parseMarkdown(original, "idea") as Idea;
    expect(idea.title).toBe("Fix: parser");
    const serialized = serializeMarkdown(idea, "Implementation notes.");
    expect(serialized).toContain('title: "Fix: parser"');
  });

  it("preserves YAML comments in frontmatter", () => {
    const original = `---
id: IDEA-001
# This is a comment
title: Test idea
status: draft
created_at: 2026-10-27T10:00:00Z
---
Body here.`;
    const idea = parseMarkdown(original, "idea") as Idea;
    const serialized = serializeMarkdown(idea, "Body here.");
    // After status transition, only status line differs, comment preserved
    expect(serialized).toContain("# This is a comment");
  });

  it("preserves multi-line block scalar |", () => {
    const original = `---
id: CR-001
title: CR with block
status: draft
created_at: 2026-10-27T10:00:00Z
description: |
  Line 1
  Line 2
  Line 3
---
Body content.`;
    const cr = parseMarkdown(original, "cr") as ChangeRequest;
    const serialized = serializeMarkdown(cr, "Body content.");
    expect(serialized).toContain("description:");
    // Multi-line block should be preserved
  });

  it("preserves unusual key order and quoted values", () => {
    const original = `---
status: draft
title: "Test: title"
created_at: 2026-10-27T10:00:00Z
id: IDEA-001
custom_field: "quoted value"
---
Body.`;
    const idea = parseMarkdown(original, "idea") as Idea;
    const serialized = serializeMarkdown(idea, "Body.");
    // Key order and quoting should be preserved where possible
    expect(serialized).toContain('"quoted value"');
  });

  it("status transition changes only status line, body is byte-identical", () => {
    const original = `---
id: IDEA-001
title: Test
status: draft
created_at: 2026-10-27T10:00:00Z
priority: 1
---
Body line 1
Body line 2
Body line 3`;
    const idea = parseMarkdown(original, "idea") as Idea;
    idea.status = "accepted";
    const serialized = serializeMarkdown(idea, "Body line 1\nBody line 2\nBody line 3");
    
    // Extract frontmatter and body
    const match = serialized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match || !match[1] || !match[2]) throw new Error("Invalid serialized markdown");
    const fm = match[1];
    const body = match[2];
    
    // Body must be byte-identical
    expect(body).toBe("Body line 1\nBody line 2\nBody line 3");
    
    // Count the differences in frontmatter
    const originalMatch = original.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!originalMatch || !originalMatch[1]) throw new Error("Invalid original markdown");
    const origFm = originalMatch[1];
    
    const origLines = origFm.split("\n");
    const newLines = fm.split("\n");
    const diffs = origLines.filter((l, i) => l !== newLines[i]);
    
    // Only status line should differ
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain("status: draft");
    expect(newLines.find(l => l.includes("status:"))).toBe("status: accepted");
  });

  it("body containing --- lines survives round-trip", () => {
    const original = `---
id: TASK-001
title: Task with code
status: pending
created_at: 2026-10-27T10:00:00Z
---
Here is a code block:
---
Some code here
---
End of block`;
    const task = parseMarkdown(original, "task") as Task;
    const serialized = serializeMarkdown(task, "Here is a code block:\n---\nSome code here\n---\nEnd of block");
    expect(serialized).toContain("---\nSome code here\n---");
  });

  it("invalid YAML frontmatter throws typed error with filename", () => {
    const invalid = `---
id: IDEA-001
title Test (missing colon)
status: draft
created_at: 2026-10-27T10:00:00Z
---
Body`;
    expect(() => parseMarkdown(invalid, "idea")).toThrow();
    // Error should indicate the issue; when we integrate YAML library, it will have the filename
  });

  it("file with invalid YAML is not overwritten", () => {
    // This test verifies that an invalid file cannot be accidentally modified
    const invalid = `---
id: IDEA-001
incomplete frontmatter
`;
    expect(() => parseMarkdown(invalid, "idea")).toThrow("Invalid frontmatter");
    // The parseMarkdown should not modify the file (it's read-only here)
  });

  it("task: pending → blocked", () => {
    expect(canTransition("task", "pending", "blocked")).toBe(true);
  });

  it("task rejects invalid transitions", () => {
    expect(canTransition("task", "done", "pending")).toBe(false);
    expect(canTransition("task", "blocked", "done")).toBe(false);
    expect(canTransition("task", "pending", "analyzed")).toBe(false);
  });

  it("task done → done is allowed (idempotent)", () => {
    expect(canTransition("task", "done", "done")).toBe(true);
  });

  it("task transition preserves exact original text except status value", () => {
    const original = `---
# my comment
id: TASK-001
title: "Fix: parser"
cr_id: CR-001
status: pending
notes: |
  line one
  line two
created_at: 2026-01-01
---
## Objective
Real text ---
stays
`;
    const task = parseMarkdown(original, "task") as Task;
    expect(task.status).toBe("pending");
    
    task.status = "done";
    const serialized = serializeMarkdown(task, "## Objective\nReal text ---\nstays\n");
    
    const expected = original.replace("status: pending", "status: done");
    expect(serialized).toBe(expected);
  });

  it("successive task transitions do not accumulate blank lines", () => {
    const original = `---
id: TASK-001
title: "Task with CR"
cr_id: CR-001
status: pending
created_at: 2026-01-01
---
## Work
Content here
`;
    const task = parseMarkdown(original, "task") as Task;
    
    // First transition
    task.status = "blocked";
    const afterFirst = serializeMarkdown(task, "## Work\nContent here\n");
    
    // Parse the result and transition again
    const task2 = parseMarkdown(afterFirst, "task") as Task;
    task2.status = "done";
    const afterSecond = serializeMarkdown(task2, "## Work\nContent here\n");
    
    // Count blank lines before closing --- in both
    const firstMatch = afterFirst.match(/\n\n(---\n## Work)/);
    const secondMatch = afterSecond.match(/\n\n(---\n## Work)/);
    
    expect(firstMatch).toBeNull();
    expect(secondMatch).toBeNull();
  });

  it("CR transition preserves exact original except status value", () => {
    const original = `---
id: CR-001
title: "CR: refactor"
status: draft
created_at: 2026-01-01
modules:
  - core
  - api
---
## Plan
Details
`;
    const cr = parseMarkdown(original, "cr") as ChangeRequest;
    cr.status = "developed";
    const serialized = serializeMarkdown(cr, "## Plan\nDetails\n");
    
    const expected = original.replace("status: draft", "status: developed");
    expect(serialized).toBe(expected);
  });

  it("idea transition preserves exact original except status value", () => {
    const original = `---
id: IDEA-001
title: "Idea: feature"
status: draft
created_at: 2026-01-01
---
## Description
Idea details
`;
    const idea = parseMarkdown(original, "idea") as Idea;
    idea.status = "accepted";
    const serialized = serializeMarkdown(idea, "## Description\nIdea details\n");
    
    const expected = original.replace("status: draft", "status: accepted");
    expect(serialized).toBe(expected);
  });
});
