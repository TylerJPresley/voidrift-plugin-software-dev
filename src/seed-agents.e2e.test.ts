/**
 * End-to-end test for seed agent registration (software-dev-blueprint.md §2.2).
 * Tests seed agents are present and valid; assumes real core loader integration.
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";

describe("software-dev seed agents e2e (§2.2)", () => {
  const seedDir = path.join(process.cwd(), "seed/agents");

  it("(1) seed agents directory structure exists with all 9 agents", async () => {
    const agents = await fs.readdir(seedDir);
    expect(agents).toHaveLength(9);
    expect(agents.sort()).toEqual([
      "deployer",
      "dev-implementer",
      "dev-reviewer",
      "developer-loop",
      "interactive-developer",
      "lead-engineer-cr",
      "pm-idea",
      "task-developer",
      "verifier",
    ]);
  });

  it("(2) every agent has required files with correct names", async () => {
    const agents = await fs.readdir(seedDir);
    for (const agentName of agents) {
      const agentDir = path.join(seedDir, agentName);
      const jsonFile = path.join(agentDir, "agent.json");
      const promptFile = path.join(agentDir, "prompt.md");

      const jsonExists = await fs
        .stat(jsonFile)
        .then(() => true)
        .catch(() => false);
      const promptExists = await fs
        .stat(promptFile)
        .then(() => true)
        .catch(() => false);

      expect(jsonExists).toBe(true);
      expect(promptExists).toBe(true);
    }
  });

  it("(3) agent.json files have correct name field", async () => {
    const agents = await fs.readdir(seedDir);
    for (const agentName of agents) {
      const jsonPath = path.join(seedDir, agentName, "agent.json");
      const content = await fs.readFile(jsonPath, "utf8");
      const manifest = JSON.parse(content);
      expect(manifest.name).toBe(agentName);
    }
  });

  it("(4) agent.json files parse as valid JSON", async () => {
    const agents = await fs.readdir(seedDir);
    for (const agentName of agents) {
      const jsonPath = path.join(seedDir, agentName, "agent.json");
      const content = await fs.readFile(jsonPath, "utf8");
      expect(() => JSON.parse(content)).not.toThrow();
    }
  });

  it("(5) seed agents are included in npm pack", async () => {
    // Verify package.json files list includes seed
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
    expect(pkg.files).toContain("seed");
  });
});
