/**
 * Commands module: register deterministic handlers through core.register.command
 * (software-dev-blueprint.md §2.7, core §12.3)
 */

import { Store } from "./store.js";
import type { ScopedCoreApi } from "@voidrift/core";

interface CommandArgs {
  [key: string]: unknown;
}

export function registerCommands(core: ScopedCoreApi, store: Store): void {
  /**
   * ideas: list all idea objects with id, title, status
   */
  core.register.command("ideas", async () => {
    const ideas = await store.listIdeas();
    return {
      ideas: ideas.map((i) => ({ id: i.id, title: i.title, status: i.status })),
    };
  });

  /**
   * changes [idea-id]: list CR objects, all or filtered by idea id
   */
  core.register.command("changes", async (args: unknown) => {
    const ideaId = (args as CommandArgs)?.ideaId as string | undefined;
    if (ideaId) {
      const ideas = await store.listIdeas();
      if (!ideas.find((i) => i.id === ideaId)) {
        throw new Error(`Idea not found: ${ideaId}`);
      }
    }
    const crs = await store.listChanges(ideaId);
    return {
      changes: crs.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        idea_id: c.idea_id,
      })),
    };
  });

  /**
   * cr <id>: open/read a CR object
   */
  core.register.command("cr", async (args: unknown) => {
    const id = (args as CommandArgs)?.id as string | undefined;
    if (!id) throw new Error("cr command requires an id");
    return await store.readCR(id);
  });

  /**
   * done <task-id>: mark task as done (idempotent)
   */
  core.register.command("done", async (args: unknown) => {
    const id = (args as CommandArgs)?.id as string | undefined;
    if (!id) throw new Error("done command requires a task id");
    try {
      await store.transitionTask(id, "done");
      return { status: "done", message: `Task ${id} marked done` };
    } catch (err: unknown) {
      const error = err as { message?: string };
      if (error?.message?.includes("not found")) {
        throw new Error(`Task not found: ${id}`);
      }
      throw err;
    }
  });

  /**
   * import [path]: read project structure (workspace path validation)
   */
  core.register.command("import", async (args: unknown) => {
    const path = ((args as CommandArgs)?.path as string) || ".";
    try {
      await store.importProject(path);
      return { status: "ok", path };
    } catch (err: unknown) {
      throw err;
    }
  });

  /**
   * Stub commands for agent dispatch (not implemented in this slice)
   */
  const stubResponse = { message: "Not implemented yet in this build" };

  core.register.command("idea", async () => stubResponse);
  core.register.command("analyze", async () => stubResponse);
  core.register.command("develop", async () => stubResponse);
  core.register.command("verify", async () => stubResponse);
  core.register.command("deploy", async () => stubResponse);
}
