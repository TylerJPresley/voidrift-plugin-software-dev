import { describe, it, expect } from "vitest";
import type { ScopedCoreApi } from "@voidrift/core";
import { register } from "./index.js";

describe("software-dev plugin", () => {
  it("register() is a function", () => {
    expect(typeof register).toBe("function");
  });

  it("calling register() with a minimal stub does not throw", () => {
    const stub = {
      pluginId: "@voidrift/plugin-software-dev",
    } as unknown as ScopedCoreApi;
    expect(() => register(stub)).not.toThrow();
  });
});
