/**
 * Store module: read/write lifecycle objects through pluginFiles accessor.
 * (software-dev-blueprint.md §2.7, core §12.5)
 */

import {
  parseMarkdown,
  serializeMarkdown,
  canTransition,
  type Idea,
  type ChangeRequest,
  type Task,
} from "./objects.js";

/** Structural type for pluginFiles accessor */
interface PluginFilesAccessor {
  list(subpath?: string): Promise<Array<{ name: string; kind: string }>>;
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export class Store {
  constructor(private pf: PluginFilesAccessor) {}

  /**
   * List all idea objects.
   * The real accessor returns recursive entries with relative paths.
   * We filter to depth 1 files (e.g., `IDEA-001.md`, not nested paths).
   */
  async listIdeas(): Promise<Idea[]> {
    try {
      const entries = await this.pf.list("ideas");
      const ideas: Idea[] = [];
      for (const entry of entries) {
        // Filter to depth 1: only `IDEA-001.md`, not nested paths
        const segments = entry.name.split("/");
        if (segments.length !== 1) continue;
        if (entry.kind !== "file" || !entry.name.endsWith(".md")) continue;
        try {
          const content = await this.pf.read(`ideas/${entry.name}`);
          if (!content) continue;
          const idea = parseMarkdown(content, "idea") as Idea;
          ideas.push(idea);
        } catch {
          // Skip malformed files
        }
      }
      return ideas;
    } catch {
      return [];
    }
  }

  /**
   * Read a single idea by id.
   */
  async readIdea(id: string): Promise<Idea> {
    const content = await this.pf.read(`ideas/${id}.md`);
    if (!content) throw new Error(`Idea not found: ${id}`);
    return parseMarkdown(content, "idea") as Idea;
  }

  /**
   * Write an idea object.
   */
  async writeIdea(idea: Idea, body: string): Promise<void> {
    const md = serializeMarkdown(idea, body);
    await this.pf.write(`ideas/${idea.id}.md`, md);
  }

  /**
   * List all CRs, optionally filtered by idea_id.
   * The real accessor returns recursive entries with relative paths (e.g., `CR-001`, `CR-001/cr.md`, `CR-001/tasks/TASK-001.md`).
   * We filter to depth 1 to get only the CR directory names, then read their cr.md files.
   */
  async listChanges(ideaId?: string): Promise<ChangeRequest[]> {
    try {
      const entries = await this.pf.list("changes");
      const crs: ChangeRequest[] = [];
      const seenCRs = new Set<string>();

      for (const entry of entries) {
        // Filter to entries at depth 1: just `CR-001`, not `CR-001/cr.md` or deeper
        const segments = entry.name.split("/");
        if (segments.length !== 1) continue;
        if (entry.kind !== "dir") continue;

        const crId = segments[0]!;
        if (seenCRs.has(crId)) continue;
        seenCRs.add(crId);

        try {
          const content = await this.pf.read(`changes/${crId}/cr.md`);
          if (!content) continue;
          const cr = parseMarkdown(content, "cr") as ChangeRequest;
          if (ideaId && cr.idea_id !== ideaId) continue;
          crs.push(cr);
        } catch {
          // Skip malformed
        }
      }
      return crs;
    } catch {
      return [];
    }
  }

  /**
   * Read a single CR by id. Throws with a list of known ids if not found.
   */
  async readCR(id: string): Promise<ChangeRequest> {
    try {
      const content = await this.pf.read(`changes/${id}/cr.md`);
      if (!content) throw new Error("Not found");
      return parseMarkdown(content, "cr") as ChangeRequest;
    } catch {
      const allIds = await this.listChanges();
      const knownIds = allIds.map((c) => c.id).join(", ");
      throw new Error(
        `CR not found: ${id}. Known CRs: ${knownIds || "(none)"}. `
      );
    }
  }

  /**
   * Write a CR object.
   */
  async writeCR(cr: ChangeRequest, body: string): Promise<void> {
    const md = serializeMarkdown(cr, body);
    await this.pf.write(`changes/${cr.id}/cr.md`, md);
  }

  /**
   * List tasks for a given CR.
   * The real accessor returns recursive entries. We filter to depth 1 under tasks/
   * (e.g., `TASK-001.md`, not nested paths like `TASK-001/subtask.md`).
   */
  async listTasks(crId: string): Promise<Task[]> {
    try {
      const entries = await this.pf.list(`changes/${crId}/tasks`);
      const tasks: Task[] = [];
      for (const entry of entries) {
        // Filter to depth 1 files under tasks: `TASK-001.md`, not nested
        const segments = entry.name.split("/");
        if (segments.length !== 1) continue;
        if (entry.kind !== "file" || !entry.name.endsWith(".md")) continue;
        try {
          const content = await this.pf.read(`changes/${crId}/tasks/${entry.name}`);
          if (!content) continue;
          const task = parseMarkdown(content, "task") as Task;
          tasks.push(task);
        } catch {
          // Skip malformed
        }
      }
      return tasks;
    } catch {
      return [];
    }
  }

  /**
   * Read a single task by id. Throws with known ids if not found.
   */
  async readTask(id: string): Promise<Task> {
    try {
      // Search for task in all CRs
      const crs = await this.listChanges();
      for (const cr of crs) {
        try {
          const content = await this.pf.read(
            `changes/${cr.id}/tasks/${id}.md`
          );
          if (!content) continue;
          return parseMarkdown(content, "task") as Task;
        } catch {
          // Continue searching
        }
      }
      throw new Error("Not found");
    } catch {
      throw new Error(`Task not found: ${id}`);
    }
  }

  /**
   * Transition a task's status. Idempotent for pending->done->done.
   * Preserves the task body from the original file.
   */
  async transitionTask(id: string, newStatus: "done" | "blocked"): Promise<void> {
    const task = await this.readTask(id);
    if (task.status === newStatus) {
      // Idempotent
      return;
    }
    if (!canTransition("task", task.status, newStatus)) {
      throw new Error(
        `Invalid transition for task ${id}: ${task.status} → ${newStatus}`
      );
    }
    task.status = newStatus;
    // serializeMarkdown will use the preserved _body from parseMarkdown
    const crId = (task as Record<string, unknown>).cr_id as string | undefined;
    if (!crId) throw new Error("Task has no cr_id");
    await this.pf.write(
      `changes/${crId}/tasks/${id}.md`,
      serializeMarkdown(task)
    );
  }

  /**
   * Import: validate path is within workspace (containment, core §8.2).
   * This is a placeholder; actual workspace checking comes later.
   */
  async importProject(path: string): Promise<void> {
    // Check path is not absolute or outside workspace
    if (path.startsWith("/") && path !== "/") {
      throw new Error(`Path outside workspace: ${path}`);
    }
  }
}
