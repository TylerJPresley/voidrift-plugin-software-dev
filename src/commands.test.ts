import { describe, it, expect, beforeEach } from "vitest";
import type { ScopedCoreApi } from "@voidrift/core";
import { registerCommands } from "./commands.js";
import { Store } from "./store.js";

/** In-memory fake pluginFiles for testing */
class FakePluginFilesAccessor {
  private files: Map<string, string> = new Map();
  _writeCount = 0;

  async list(subpath?: string): Promise<Array<{ name: string; kind: string }>> {
    const prefix = subpath ? (subpath.endsWith("/") ? subpath : subpath + "/") : "";
    const keys = Array.from(this.files.keys()).filter((k) => k.startsWith(prefix));
    const immediateChildren = new Set<string>();
    for (const key of keys) {
      const rest = key.slice(prefix.length);
      const idx = rest.indexOf("/");
      if (idx === -1) {
        immediateChildren.add(rest);
      } else {
        immediateChildren.add(rest.slice(0, idx));
      }
    }
    return Array.from(immediateChildren).map((name) => {
      const isDir = keys.some((k) => k.startsWith(prefix + name + "/"));
      return { name, kind: isDir ? "dir" : "file" };
    });
  }

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  async write(path: string, content: string): Promise<void> {
    this._writeCount++;
    this.files.set(path, content);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  _setFile(path: string, content: string): void {
    this.files.set(path, content);
  }
}

/** In-memory fake command registry */
class FakeCommandRegistry {
  private handlers: Map<string, (args?: unknown) => Promise<unknown>> = new Map();

  command(name: string, handler: (args?: unknown) => Promise<unknown>): void {
    this.handlers.set(name, handler);
  }

  async invoke(name: string, args?: unknown): Promise<unknown> {
    const handler = this.handlers.get(name);
    if (!handler) throw new Error(`Command not registered: ${name}`);
    return handler(args);
  }
}

/** Build a fake ScopedCoreApi for testing */
function buildFakeCore(pf: FakePluginFilesAccessor): ScopedCoreApi & { _registry: FakeCommandRegistry } {
  const registry = new FakeCommandRegistry();
  return {
    pluginId: "@voidrift/plugin-software-dev",
    workspace: {
      pluginFiles: pf as unknown as any,
    },
    register: {
      command: (name: string, handler: (args?: unknown) => Promise<unknown>) => {
        registry.command(name, handler);
      },
    } as unknown as any,
    _registry: registry,
  } as any;
}

describe("commands — handler registration and invocation", () => {
  let pf: FakePluginFilesAccessor;
  let core: ReturnType<typeof buildFakeCore>;
  let store: Store;

  beforeEach(() => {
    pf = new FakePluginFilesAccessor();
    core = buildFakeCore(pf);
    store = new Store(pf);
    registerCommands(core, store);
  });

  describe("ideas command", () => {
    it("lists all ideas with empty list valid", async () => {
      const result = (await core._registry.invoke("ideas")) as { ideas: unknown[] };
      expect(result.ideas).toEqual([]);
    });

    it("lists id/title/status of seeded IDEA files", async () => {
      pf._setFile(
        "ideas/IDEA-001.md",
        "---\nid: IDEA-001\ntitle: Auth System\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "ideas/IDEA-002.md",
        "---\nid: IDEA-002\ntitle: Caching\nstatus: accepted\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      const result = (await core._registry.invoke("ideas")) as { ideas: Array<{ id: string; title: string; status: string }> };
      expect(result.ideas).toHaveLength(2);
      expect(result.ideas[0]).toEqual({ id: "IDEA-001", title: "Auth System", status: "draft" });
      expect(result.ideas[1]).toEqual({ id: "IDEA-002", title: "Caching", status: "accepted" });
    });

    it("handles malformed frontmatter without crashing, reports, lists others", async () => {
      pf._setFile(
        "ideas/IDEA-001.md",
        "---\nid: IDEA-001\ntitle: Good\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      // Malformed: missing created_at
      pf._setFile(
        "ideas/IDEA-002.md",
        "---\nid: IDEA-002\ntitle: Broken\nstatus: draft\n---\nContent"
      );
      pf._setFile(
        "ideas/IDEA-003.md",
        "---\nid: IDEA-003\ntitle: Also Good\nstatus: analyzed\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      const result = (await core._registry.invoke("ideas")) as { ideas: Array<{ id: string; title: string; status: string }> };
      // Should include IDEA-001 and IDEA-003, skip IDEA-002
      expect(result.ideas).toHaveLength(2);
      expect(result.ideas.map((i) => i.id)).toContain("IDEA-001");
      expect(result.ideas.map((i) => i.id)).toContain("IDEA-003");
    });
  });

  describe("changes command", () => {
    it("lists all CRs", async () => {
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: OAuth\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-002/cr.md",
        "---\nid: CR-002\ntitle: Cache\nstatus: developed\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      const result = (await core._registry.invoke("changes")) as { changes: unknown[] };
      expect(result.changes).toHaveLength(2);
    });

    it("filters CRs by idea id", async () => {
      pf._setFile(
        "ideas/IDEA-001.md",
        "---\nid: IDEA-001\ntitle: Good\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "ideas/IDEA-002.md",
        "---\nid: IDEA-002\ntitle: Good2\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\nidea_id: IDEA-001\n---\nContent"
      );
      pf._setFile(
        "changes/CR-002/cr.md",
        "---\nid: CR-002\ntitle: C2\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\nidea_id: IDEA-002\n---\nContent"
      );
      const result = (await core._registry.invoke("changes", { ideaId: "IDEA-001" })) as { changes: unknown[] };
      expect(result.changes).toHaveLength(1);
    });

    it("unknown idea id throws not-found", async () => {
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\nidea_id: IDEA-001\n---\nContent"
      );
      // First seed the ideas list so readIdea can be found
      pf._setFile(
        "ideas/IDEA-001.md",
        "---\nid: IDEA-001\ntitle: Good\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      try {
        await core._registry.invoke("changes", { ideaId: "IDEA-999" });
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as Error;
        expect(err.message).toContain("Idea not found");
      }
    });
  });

  describe("cr command", () => {
    it("opens CR with id", async () => {
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: OAuth\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\nmodules:\n  - auth\n---\nDetails"
      );
      const result = (await core._registry.invoke("cr", { id: "CR-001" })) as {
        id: string;
        title: string;
        modules?: string[];
      };
      expect(result.id).toBe("CR-001");
      expect(result.title).toBe("OAuth");
      expect(result.modules).toEqual(["auth"]);
    });

    it("unknown CR id throws not-found with known ids", async () => {
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-002/cr.md",
        "---\nid: CR-002\ntitle: C2\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      try {
        await core._registry.invoke("cr", { id: "CR-999" });
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as Error;
        expect(err.message).toContain("CR-999");
        expect(err.message).toContain("CR-001");
        expect(err.message).toContain("CR-002");
      }
    });
  });

  describe("done command", () => {
    it("transitions task pending → done", async () => {
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-001/tasks/TASK-001.md",
        "---\nid: TASK-001\ntitle: Task\nstatus: pending\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\n---\nWork"
      );
      const result = (await core._registry.invoke("done", { id: "TASK-001" })) as {
        status: string;
        message: string;
      };
      expect(result.status).toBe("done");
      expect(result.message).toContain("TASK-001");
      // Verify it persisted
      const updated = await store.readTask("TASK-001");
      expect(updated.status).toBe("done");
    });

    it("second call to done is idempotent (no-op)", async () => {
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-001/tasks/TASK-001.md",
        "---\nid: TASK-001\ntitle: Task\nstatus: done\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\n---\nWork"
      );
      const result = (await core._registry.invoke("done", { id: "TASK-001" })) as {
        status: string;
        message: string;
      };
      expect(result.status).toBe("done");
      // Verify it is still done
      const updated = await store.readTask("TASK-001");
      expect(updated.status).toBe("done");
    });

    it("unknown task id throws not-found", async () => {
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-001/tasks/TASK-001.md",
        "---\nid: TASK-001\ntitle: Task\nstatus: pending\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\n---\nWork"
      );
      try {
        await core._registry.invoke("done", { id: "TASK-999" });
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as Error;
        expect(err.message).toContain("Task not found");
      }
    });

    it("blocked task handled per objects.ts rules", async () => {
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-001/tasks/TASK-001.md",
        "---\nid: TASK-001\ntitle: Task\nstatus: pending\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\n---\nWork"
      );
      // Transition to blocked is allowed per canTransition
      await store.transitionTask("TASK-001", "blocked");
      const task = await store.readTask("TASK-001");
      expect(task.status).toBe("blocked");
    });
  });

  describe("import command", () => {
    it("default path ok", async () => {
      const result = (await core._registry.invoke("import")) as { status: string; path: string };
      expect(result.status).toBe("ok");
      expect(result.path).toBe(".");
    });

    it("path outside workspace refused", async () => {
      try {
        await core._registry.invoke("import", { path: "/etc/passwd" });
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as Error;
        expect(err.message).toContain("outside");
      }
    });
  });

  describe("stub commands", () => {
    it("idea returns not available message", async () => {
      const result = (await core._registry.invoke("idea")) as { message: string };
      expect(result.message).toContain("Not implemented");
    });

    it("analyze returns not available message", async () => {
      const result = (await core._registry.invoke("analyze")) as { message: string };
      expect(result.message).toContain("Not implemented");
    });

    it("develop returns not available message", async () => {
      const result = (await core._registry.invoke("develop")) as { message: string };
      expect(result.message).toContain("Not implemented");
    });

    it("verify returns not available message", async () => {
      const result = (await core._registry.invoke("verify")) as { message: string };
      expect(result.message).toContain("Not implemented");
    });

    it("deploy returns not available message", async () => {
      const result = (await core._registry.invoke("deploy")) as { message: string };
      expect(result.message).toContain("Not implemented");
    });
  });

  describe("malformed files and data preservation", () => {
    it("malformed frontmatter in ideas does not crash ideas command", async () => {
      pf._setFile(
        "ideas/IDEA-001.md",
        "---\nid: IDEA-001\ntitle: Bad YAML\nstatus: draft\n---\nNo created_at"
      );
      const result = (await core._registry.invoke("ideas")) as { ideas: unknown[] };
      // Should report it was skipped but not crash
      expect(result.ideas).toEqual([]);
    });

    it("file with extra user fields survives done round trip", async () => {
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-001/tasks/TASK-001.md",
        "---\nid: TASK-001\ntitle: Task\nstatus: pending\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\nuser_field: my_value\ncustom_tag: important\n---\nWork"
      );
      await core._registry.invoke("done", { id: "TASK-001" });
      const updated = await store.readTask("TASK-001");
      // User fields should be preserved
      expect((updated as Record<string, unknown>).user_field).toBe("my_value");
      expect((updated as Record<string, unknown>).custom_tag).toBe("important");
    });

    it("task body with structured text is byte-preserved on done", async () => {
      const userBody =
        "## Objective\nReal user text\n\n- [ ] criterion A\n- [ ] criterion B\n";
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-001/tasks/TASK-001.md",
        `---\nid: TASK-001\ntitle: Task\nstatus: pending\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\n---\n${userBody}`
      );

      const writeCount = pf._writeCount;
      await core._registry.invoke("done", { id: "TASK-001" });

      // Exactly one write
      expect(pf._writeCount).toBe(writeCount + 1);

      // Read file content directly and verify body is preserved
      const content = await pf.read("changes/CR-001/tasks/TASK-001.md");
      expect(content).toContain(userBody);
      expect(content?.endsWith(userBody)).toBe(true);

      // Parse and verify frontmatter is intact
      const updated = await store.readTask("TASK-001");
      expect(updated.status).toBe("done");
    });

    it("task body with delimiters and unicode is byte-preserved on done", async () => {
      const userBody =
        "---\nLine with dashes\n---\nUnicode: ñ á é ü 中文 🎉\n\nMore content";
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-001/tasks/TASK-001.md",
        `---\nid: TASK-001\ntitle: Task\nstatus: pending\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\n---\n${userBody}`
      );

      await core._registry.invoke("done", { id: "TASK-001" });

      // Read file content directly and verify exact byte preservation
      const content = await pf.read("changes/CR-001/tasks/TASK-001.md");
      expect(content).toContain(userBody);

      // Parse and verify status changed but everything else intact
      const updated = await store.readTask("TASK-001");
      expect(updated.status).toBe("done");
    });

    it("all frontmatter keys and values are preserved on done", async () => {
      const userBody = "Task description";
      pf._setFile(
        "changes/CR-001/cr.md",
        "---\nid: CR-001\ntitle: C1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
      );
      pf._setFile(
        "changes/CR-001/tasks/TASK-001.md",
        `---\nid: TASK-001\ntitle: Task\nstatus: pending\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\nassignable_to: alice\nenviron_test: staging\npriority: 5\n---\n${userBody}`
      );

      await core._registry.invoke("done", { id: "TASK-001" });

      // Read and verify all keys preserved
      const updated = await store.readTask("TASK-001");
      expect((updated as Record<string, unknown>).id).toBe("TASK-001");
      expect((updated as Record<string, unknown>).title).toBe("Task");
      expect((updated as Record<string, unknown>).status).toBe("done");
      expect((updated as Record<string, unknown>).created_at).toBe(
        "2026-10-27T10:00:00Z"
      );
      expect((updated as Record<string, unknown>).cr_id).toBe("CR-001");
      expect((updated as Record<string, unknown>).assignable_to).toBe("alice");
      expect((updated as Record<string, unknown>).environ_test).toBe("staging");
      expect((updated as Record<string, unknown>).priority).toBe(5);
    });
  });
});
