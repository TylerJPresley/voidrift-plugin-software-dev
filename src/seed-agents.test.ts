/**
 * Unit test: validate seed agent directory structure.
 * Tests: every seed dir has both agent.json and prompt.md; dir name matches agent name;
 * agent.json parses as valid JSON with correct structure.
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";

describe("software-dev seed agents — structure (§2.2)", () => {
  const seedDir = path.join(process.cwd(), "seed/agents");

  it("seed/agents directory exists", async () => {
    const stat = await fs.stat(seedDir).catch(() => null);
    expect(stat?.isDirectory()).toBe(true);
  });

  it("every seed dir has both agent.json and prompt.md", async () => {
    const agents = await fs.readdir(seedDir);
    expect(agents.length).toBeGreaterThan(0);

    for (const dir of agents) {
      const agentDir = path.join(seedDir, dir);
      const stat = await fs.stat(agentDir).catch(() => null);
      expect(stat?.isDirectory()).toBe(true);

      const jsonPath = path.join(agentDir, "agent.json");
      const promptPath = path.join(agentDir, "prompt.md");

      const jsonStat = await fs.stat(jsonPath).catch(() => null);
      expect(jsonStat?.isFile()).toBe(true);

      const promptStat = await fs.stat(promptPath).catch(() => null);
      expect(promptStat?.isFile()).toBe(true);
    }
  });

  it("dir name matches agent.name inside agent.json", async () => {
    const agents = await fs.readdir(seedDir);

    for (const dir of agents) {
      const jsonPath = path.join(seedDir, dir, "agent.json");
      const json = await fs.readFile(jsonPath, "utf8");
      const manifest = JSON.parse(json);
      expect(manifest.name).toBe(dir);
    }
  });

  it("every agent.json has required fields", async () => {
    const agents = await fs.readdir(seedDir);

    for (const dir of agents) {
      const jsonPath = path.join(seedDir, dir, "agent.json");
      const json = await fs.readFile(jsonPath, "utf8");
      const manifest = JSON.parse(json);

      expect(manifest.name).toBeDefined();
      expect(typeof manifest.name).toBe("string");
      expect(manifest.description).toBeDefined();
      expect(typeof manifest.description).toBe("string");
      expect(manifest.kind).toBeDefined();
      expect(["worker", "top-level"]).toContain(manifest.kind);
    }
  });

  it("seed contains exactly 9 agents", async () => {
    const agents = await fs.readdir(seedDir);
    expect(agents).toHaveLength(9);
  });

  it("seed agents have expected names", async () => {
    const agents = (await fs.readdir(seedDir)).sort();
    const expected = [
      "deployer",
      "dev-implementer",
      "dev-reviewer",
      "developer-loop",
      "interactive-developer",
      "lead-engineer-cr",
      "pm-idea",
      "task-developer",
      "verifier",
    ];
    expect(agents).toEqual(expected);
  });
});
