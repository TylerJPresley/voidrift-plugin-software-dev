/**
 * VoidRift Software Development — a first-party plugin (software-dev-blueprint.md §2).
 */

import type { ScopedCoreApi } from "@voidrift/core";
import { Store } from "./store.js";
import { registerCommands } from "./commands.js";

/**
 * Plugin configuration options (software-dev-blueprint.md §5)
 */
interface PluginOptions {
  safeShell?: boolean;
  gate?: Record<string, string>;
  lsp?: { enabled?: boolean; servers?: Record<string, unknown> } | undefined;
  formatter?: {
    enabled?: boolean;
    onEdit?: boolean;
    formatters?: Record<string, unknown>;
  } | undefined;
  git?: { commitMessages?: boolean; prDescriptions?: boolean } | undefined;
  worktreeIncludeDefaults?: string[];
  toolchains?: string[];
}

/** Default options */
const DEFAULT_OPTIONS: PluginOptions = {
  safeShell: true,
  gate: {},
  lsp: { enabled: false, servers: {} },
  formatter: { enabled: false, onEdit: false, formatters: {} },
  git: { commitMessages: true, prDescriptions: true },
  worktreeIncludeDefaults: ["node_modules"],
  toolchains: [],
};

/**
 * Validate and normalize plugin options. Unknown keys are reported, not fatal (§5).
 */
function validateOptions(opts: unknown): PluginOptions {
  if (opts === undefined) return { ...DEFAULT_OPTIONS };
  if (typeof opts !== "object" || opts === null) {
    console.warn("plugin-software-dev: options must be an object");
    return { ...DEFAULT_OPTIONS };
  }

  const options = { ...DEFAULT_OPTIONS };
  const obj = opts as Record<string, unknown>;

  // Validate known keys
  for (const [key, value] of Object.entries(obj)) {
    if (!DEFAULT_OPTIONS.hasOwnProperty(key)) {
      console.warn(`plugin-software-dev: unknown option key: ${key}`);
      continue;
    }

    if (key === "safeShell" && typeof value === "boolean") options.safeShell = value;
    else if (key === "gate" && typeof value === "object") options.gate = value as Record<string, string>;
    else if (key === "lsp" && typeof value === "object") options.lsp = value as PluginOptions["lsp"];
    else if (key === "formatter" && typeof value === "object") options.formatter = value as PluginOptions["formatter"];
    else if (key === "git" && typeof value === "object") options.git = value as PluginOptions["git"];
    else if (key === "worktreeIncludeDefaults" && Array.isArray(value)) options.worktreeIncludeDefaults = value as string[];
    else if (key === "toolchains" && Array.isArray(value)) options.toolchains = value as string[];
  }

  return options;
}

/**
 * The plugin entry point. The scoped CoreAPI tags every registration with this
 * plugin's id and namespaces its registry access to the plugin (core §12.4, §12.5).
 */
export function register(core: ScopedCoreApi, opts?: unknown): void {
  validateOptions(opts);

  // Create store and register commands
  if (!core.workspace.pluginFiles) {
    throw new Error("plugin-software-dev: core.workspace.pluginFiles is not available");
  }
  const store = new Store(core.workspace.pluginFiles);
  registerCommands(core, store);
}

export default { register };
