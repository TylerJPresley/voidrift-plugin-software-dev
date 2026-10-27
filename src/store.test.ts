import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "./store.js";
import type { ChangeRequest } from "./objects.js";

/** Type definitions for test fakes */
interface PluginFilesAccessor {
  list(subpath?: string): Promise<Array<{ name: string; kind: string }>>;
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/** In-memory fake of pluginFiles and command registry for testing. */
class FakePluginFilesAccessor implements PluginFilesAccessor {
  private files: Map<string, string> = new Map();

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
      // Check if it's a file or dir by seeing if any files are under it
      const isDir = keys.some((k) => k.startsWith(prefix + name + "/"));
      return { name, kind: isDir ? "dir" : "file" };
    });
  }

  async read(path: string): Promise<string | null> {
    const content = this.files.get(path);
    return content ?? null;
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  _setFile(path: string, content: string): void {
    this.files.set(path, content);
  }
}

describe("store — reading and writing objects", () => {
  let pf: FakePluginFilesAccessor;
  let store: Store;

  beforeEach(() => {
    pf = new FakePluginFilesAccessor();
    store = new Store(pf);
  });

  it("lists ideas from ideas/ directory", async () => {
    pf._setFile("ideas/IDEA-001.md", "---\nid: IDEA-001\ntitle: Test\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent");
    const ideas = await store.listIdeas();
    expect(ideas.length).toBe(1);
    expect(ideas[0]!.id).toBe("IDEA-001");
  });

  it("reads a single idea by id", async () => {
    pf._setFile("ideas/IDEA-001.md", "---\nid: IDEA-001\ntitle: Test Idea\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nProblem statement");
    const idea = await store.readIdea("IDEA-001");
    expect(idea.title).toBe("Test Idea");
  });

  it("writes an idea object", async () => {
    const idea = {
      id: "IDEA-001",
      title: "New Idea",
      status: "draft" as const,
      created_at: "2026-10-27T10:00:00Z",
    };
    await store.writeIdea(idea, "Problem and solution");
    const content = await pf.read("ideas/IDEA-001.md");
    expect(content).toBeTruthy();
    expect(content!).toContain("IDEA-001");
    expect(content!).toContain("New Idea");
  });

  it("lists CRs filtered by idea id (optional)", async () => {
    pf._setFile(
      "changes/CR-001/cr.md",
      "---\nid: CR-001\ntitle: CR1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\nidea_id: IDEA-001\n---\nContent"
    );
    pf._setFile(
      "changes/CR-002/cr.md",
      "---\nid: CR-002\ntitle: CR2\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\nidea_id: IDEA-002\n---\nContent"
    );
    const allCrs = await store.listChanges();
    expect(allCrs.length).toBe(2);
    const cr1Only = await store.listChanges("IDEA-001");
    expect(cr1Only.length).toBe(1);
    expect(cr1Only[0]!.id).toBe("CR-001");
  });

  it("reads a CR object", async () => {
    pf._setFile(
      "changes/CR-001/cr.md",
      "---\nid: CR-001\ntitle: Auth\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\nmodules:\n  - auth\n---\nDetails"
    );
    const cr = await store.readCR("CR-001");
    expect(cr.title).toBe("Auth");
    expect(cr.modules).toStrictEqual(["auth"]);
  });

  it("reads tasks from a CR", async () => {
    pf._setFile(
      "changes/CR-001/tasks/TASK-001.md",
      "---\nid: TASK-001\ntitle: Task 1\nstatus: pending\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\n---\nWork item"
    );
    const tasks = await store.listTasks("CR-001");
    expect(tasks.length).toBe(1);
    expect(tasks[0]!.id).toBe("TASK-001");
  });

  it("writes a CR object", async () => {
    const cr: ChangeRequest = {
      id: "CR-001",
      title: "New CR",
      status: "draft",
      created_at: "2026-10-27T10:00:00Z",
      modules: ["auth"],
      acceptanceCriteria: ["test"],
    };
    await store.writeCR(cr, "CR content");
    const content = await pf.read("changes/CR-001/cr.md");
    expect(content).toBeTruthy();
    expect(content!).toContain("CR-001");
    expect(content!).toContain("New CR");
  });

  it("readIdea throws on missing idea", async () => {
    try {
      await store.readIdea("IDEA-999");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as Error;
      expect(err.message).toContain("not found");
    }
  });

  it("listTasks returns empty on missing CR", async () => {
    const tasks = await store.listTasks("CR-999");
    expect(tasks).toEqual([]);
  });

  it("readTask searches across CRs", async () => {
    pf._setFile(
      "changes/CR-001/cr.md",
      "---\nid: CR-001\ntitle: CR1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
    );
    pf._setFile(
      "changes/CR-001/tasks/TASK-001.md",
      "---\nid: TASK-001\ntitle: Task\nstatus: pending\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\n---\nWork"
    );
    const task = await store.readTask("TASK-001");
    expect(task.id).toBe("TASK-001");
  });

  it("readTask throws if not found in any CR", async () => {
    try {
      await store.readTask("TASK-999");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as Error;
      expect(err.message).toContain("Task not found");
    }
  });

  it("transitionTask throws on invalid transition", async () => {
    pf._setFile(
      "changes/CR-001/cr.md",
      "---\nid: CR-001\ntitle: CR1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent"
    );
    pf._setFile(
      "changes/CR-001/tasks/TASK-001.md",
      "---\nid: TASK-001\ntitle: Task\nstatus: done\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\n---\nWork"
    );
    try {
      await store.transitionTask("TASK-001", "blocked");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as Error;
      expect(err.message).toContain("Invalid transition");
    }
  });

  it("skips non-file entries in listIdeas", async () => {
    pf._setFile("ideas/subdir/ignored.txt", "content");
    pf._setFile("ideas/IDEA-001.md", "---\nid: IDEA-001\ntitle: Good\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent");
    const ideas = await store.listIdeas();
    expect(ideas).toHaveLength(1);
    expect(ideas[0]!.id).toBe("IDEA-001");
  });

  it("skips non-.md files in listIdeas", async () => {
    pf._setFile("ideas/IDEA-001.md", "---\nid: IDEA-001\ntitle: Good\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent");
    pf._setFile("ideas/README.txt", "Some text");
    const ideas = await store.listIdeas();
    expect(ideas).toHaveLength(1);
  });

  it("skips non-directory entries in listChanges", async () => {
    pf._setFile("changes/file.txt", "content");
    pf._setFile("changes/CR-001/cr.md", "---\nid: CR-001\ntitle: Good\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent");
    const crs = await store.listChanges();
    expect(crs).toHaveLength(1);
  });

  it("skips non-file or non-.md entries in listTasks", async () => {
    pf._setFile("changes/CR-001/cr.md", "---\nid: CR-001\ntitle: CR1\nstatus: draft\ncreated_at: 2026-10-27T10:00:00Z\n---\nContent");
    pf._setFile("changes/CR-001/tasks/TASK-001.md", "---\nid: TASK-001\ntitle: Task\nstatus: pending\ncreated_at: 2026-10-27T10:00:00Z\ncr_id: CR-001\n---\nWork");
    pf._setFile("changes/CR-001/tasks/README.txt", "ignore");
    const tasks = await store.listTasks("CR-001");
    expect(tasks).toHaveLength(1);
  });
});

describe("store — error handling", () => {
  let pf: FakePluginFilesAccessor;

  beforeEach(() => {
    pf = new FakePluginFilesAccessor();
  });

  it("listIdeas returns empty array when list() throws", async () => {
    const throwingPf = Object.create(pf) as FakePluginFilesAccessor & { list: () => Promise<never> };
    throwingPf.list = () => Promise.reject(new Error("IO error"));
    const storeWithError = new Store(throwingPf as any);
    const ideas = await storeWithError.listIdeas();
    expect(ideas).toEqual([]);
  });

  it("listChanges returns empty array when list() throws", async () => {
    const throwingPf = Object.create(pf) as FakePluginFilesAccessor & { list: () => Promise<never> };
    throwingPf.list = () => Promise.reject(new Error("IO error"));
    const storeWithError = new Store(throwingPf as any);
    const crs = await storeWithError.listChanges();
    expect(crs).toEqual([]);
  });

  it("listTasks returns empty array when list() throws", async () => {
    const throwingPf = Object.create(pf) as FakePluginFilesAccessor & { list: () => Promise<never> };
    throwingPf.list = () => Promise.reject(new Error("IO error"));
    const storeWithError = new Store(throwingPf as any);
    const tasks = await storeWithError.listTasks("CR-001");
    expect(tasks).toEqual([]);
  });
});
