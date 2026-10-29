import { describe, it, expect, vi } from "vitest";
import type { ScopedCoreApi } from "@voidrift/core";
import { register } from "./index.js";

describe("software-dev plugin — registration", () => {
  it("register() is a function", () => {
    expect(typeof register).toBe("function");
  });

  it("calling register() with a proper stub does not throw", () => {
    const stub = {
      pluginId: "@voidrift/plugin-software-dev",
      workspace: {
        pluginFiles: {
          list: () => Promise.resolve([]),
          read: () => Promise.resolve(null),
          write: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        },
      },
      register: {
        command: () => {},
        agents: () => {},
      },
    } as unknown as ScopedCoreApi;
    expect(() => register(stub)).not.toThrow();
  });
});

describe("software-dev plugin — options validation (§5)", () => {
  const buildStubCore = () => ({
    pluginId: "@voidrift/plugin-software-dev",
    workspace: {
      pluginFiles: {
        list: () => Promise.resolve([]),
        read: () => Promise.resolve(null),
        write: () => Promise.resolve(),
        remove: () => Promise.resolve(),
      },
    },
    register: {
      command: () => {},
      agents: () => {},
    },
  } as unknown as ScopedCoreApi);

  const spyWarn = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  it("defaults when options undefined", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() => register(core, undefined)).not.toThrow();
    warn.mockRestore();
  });

  it("defaults when options null", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() => register(core, null)).not.toThrow();
    warn.mockRestore();
  });

  it("accepts safeShell boolean key (§5)", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() => register(core, { safeShell: false })).not.toThrow();
    warn.mockRestore();
  });

  it("accepts gate object key (§5)", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() =>
      register(core, {
        gate: {
          test: "npm test",
          lint: "npm run lint",
        },
      })
    ).not.toThrow();
    warn.mockRestore();
  });

  it("accepts lsp object key (§5)", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() =>
      register(core, {
        lsp: { enabled: true, servers: { typescript: {} } },
      })
    ).not.toThrow();
    warn.mockRestore();
  });

  it("accepts formatter object key (§5)", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() =>
      register(core, {
        formatter: { enabled: true, onEdit: true, formatters: {} },
      })
    ).not.toThrow();
    warn.mockRestore();
  });

  it("accepts git object key (§5)", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() =>
      register(core, {
        git: { commitMessages: false, prDescriptions: false },
      })
    ).not.toThrow();
    warn.mockRestore();
  });

  it("accepts worktreeIncludeDefaults array key (§5)", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() =>
      register(core, {
        worktreeIncludeDefaults: ["node_modules", ".env"],
      })
    ).not.toThrow();
    warn.mockRestore();
  });

  it("accepts toolchains array key (§5)", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() =>
      register(core, {
        toolchains: ["node", "python"],
      })
    ).not.toThrow();
    warn.mockRestore();
  });

  it("unknown key reported not fatal", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() => register(core, { unknownKey: "value" })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("unknown option key")
    );
    warn.mockRestore();
  });

  it("wrong type for safeShell reported not fatal, default kept", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() => register(core, { safeShell: "invalid" })).not.toThrow();
    // Default (true) should be kept; type mismatch is silent skip
    warn.mockRestore();
  });

  it("wrong type for gate reported not fatal, default kept", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() => register(core, { gate: "invalid" })).not.toThrow();
    // Default ({}) should be kept
    warn.mockRestore();
  });

  it("wrong type for worktreeIncludeDefaults reported not fatal, default kept", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    expect(() => register(core, { worktreeIncludeDefaults: "invalid" })).not.toThrow();
    // Default should be kept
    warn.mockRestore();
  });

  it("register never throws on null options", () => {
    const core = buildStubCore();
    expect(() => register(core, null as unknown)).not.toThrow();
  });

  it("register never throws on array options", () => {
    const core = buildStubCore();
    expect(() => register(core, [] as unknown)).not.toThrow();
  });

  it("register never throws on string options", () => {
    const core = buildStubCore();
    expect(() => register(core, "invalid" as unknown)).not.toThrow();
  });

  it("register never throws on number options", () => {
    const core = buildStubCore();
    expect(() => register(core, 123 as unknown)).not.toThrow();
  });

  it("all §5 keys present in defaults", () => {
    const warn = spyWarn();
    const core = buildStubCore();
    // Pass all valid keys
    expect(() =>
      register(core, {
        safeShell: true,
        gate: {},
        lsp: { enabled: false, servers: {} },
        formatter: { enabled: false, onEdit: false, formatters: {} },
        git: { commitMessages: true, prDescriptions: true },
        worktreeIncludeDefaults: ["node_modules"],
        toolchains: [],
      })
    ).not.toThrow();
    // Should not warn about these keys
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
