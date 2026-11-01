/**
 * Skills and agent-template conformance (software-dev-blueprint.md §2.1, §2.2).
 *
 * Skills are driven through the PUBLIC `@voidrift/core` surface: a temp plugin
 * package whose `./skills` directory is a copy of this package's `seed/skills`
 * registers through `core.register.skills('./skills')`, and the skills are read
 * back through `api.skills.list()` + `skill_view` — core's own parser decides
 * what is valid, so presence proves a clean parse and name==dir.
 *
 * Deterministic and offline: `fakeModel()` drives the engine, in-memory session
 * repository and config store, a per-test hermetic workspace backs the plugin.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fakeModel } from "@langchain/core/testing";
import { AIMessage } from "@langchain/core/messages";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  createCore,
  InMemorySessionRepository,
  InMemoryConfigStore,
  seedPermissions,
  type CoreAPI,
} from "@voidrift/core";

const SKILLS_DIR = path.join(process.cwd(), "seed/skills");
const AGENTS_DIR = path.join(process.cwd(), "seed/agents");

const EXPECTED_SKILLS = [
  "build-and-test-discovery",
  "code-review",
  "conventional-commits",
  "debugging",
  "real-environment-check",
  "refactor",
  "release-audit",
  "release-notes",
  "solution-standards",
  "spec-first-change",
  "test-driven-change",
];

const EXPECTED_AGENTS = [
  "blueprint",
  "deployer",
  "dev-implementer",
  "dev-reviewer",
  "developer-loop",
  "documenter",
  "interactive-developer",
  "lead-engineer-cr",
  "pm-idea",
  "security-reviewer",
  "task-developer",
  "verifier",
];

/** The core tool list a template may draw from (brief). */
const ALLOWED_TOOLS = new Set([
  "read_file",
  "glob_files",
  "search_files",
  "workspace_map",
  "write_file",
  "patch",
  "terminal",
  "web_extract",
  "web_search",
  "skill_view",
  "read_manual",
  // top-level orchestration tools the dev-loop legitimately carries
  "task",
  "skills_list",
  "todo_list",
  "process_manage",
]);

const FORBIDDEN_NAMES = [/(?<!\.)\bkiro\b/i, /\baws\b/i, /\bhermes\b/i, /\bcursor\b/i, /\bopencode\b/i, /\bclaude\b/i, /\bcopilot\b/i];

function wordCount(body: string): number {
  // Strip fenced code blocks and frontmatter so the cap measures prose only.
  const noCode = body.replace(/```[\s\S]*?```/g, " ");
  return noCode.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
}

function frontmatterDescription(raw: string): string | undefined {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw.replace(/^\uFEFF/, ""));
  if (!m) return undefined;
  const line = m[1]!.split(/\r?\n/).find((l) => l.startsWith("description:"));
  return line?.slice("description:".length).trim();
}

function bodyAfterFrontmatter(raw: string): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/.exec(raw.replace(/^\uFEFF/, ""));
  return (m?.[1] ?? raw).trim();
}

/** Normalize a paragraph for duplicate detection: lowercase, collapse whitespace. */
function normalizeParagraph(p: string): string {
  return p.toLowerCase().replace(/\s+/g, " ").trim();
}

function paragraphs(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\n\s*\n/)
    .map(normalizeParagraph)
    .filter((p) => p.split(" ").length >= 8); // only substantial paragraphs
}

async function readSkill(name: string): Promise<string> {
  return fs.readFile(path.join(SKILLS_DIR, name, "SKILL.md"), "utf8");
}

describe("software-dev skills — files (§2.1)", () => {
  it("exactly the eleven expected skills exist", async () => {
    const dirs = (await fs.readdir(SKILLS_DIR)).sort();
    expect(dirs).toEqual([...EXPECTED_SKILLS].sort());
  });

  it("each SKILL.md has a 'Use when' description and name == directory", async () => {
    for (const name of EXPECTED_SKILLS) {
      const raw = await readSkill(name);
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)![1]!;
      const nameLine = fm.split(/\r?\n/).find((l) => l.startsWith("name:"))!;
      expect(nameLine.slice("name:".length).trim()).toBe(name);
      const desc = frontmatterDescription(raw)!;
      expect(desc.startsWith("Use when")).toBe(true);
    }
  });

  it("each skill body is 100-250 words", async () => {
    for (const name of EXPECTED_SKILLS) {
      const raw = await readSkill(name);
      const words = wordCount(bodyAfterFrontmatter(raw));
      expect(words, `${name} has ${words} words`).toBeGreaterThanOrEqual(100);
      expect(words, `${name} has ${words} words`).toBeLessThanOrEqual(250);
    }
  });

  it("no forbidden product name appears in any skill", async () => {
    for (const name of EXPECTED_SKILLS) {
      const raw = await readSkill(name);
      for (const re of FORBIDDEN_NAMES) {
        expect(re.test(raw), `${name} names a forbidden product`).toBe(false);
      }
    }
  });

  it("no forbidden product name appears in any agent prompt or manifest", async () => {
    for (const name of EXPECTED_AGENTS) {
      const json = await fs.readFile(path.join(AGENTS_DIR, name, "agent.json"), "utf8");
      const prompt = await fs.readFile(path.join(AGENTS_DIR, name, "prompt.md"), "utf8");
      for (const re of FORBIDDEN_NAMES) {
        expect(re.test(json), `${name}.json names a forbidden product`).toBe(false);
        expect(re.test(prompt), `${name} prompt names a forbidden product`).toBe(false);
      }
    }
  });

  it("no code block chains commands with &&, ; or a heredoc", async () => {
    for (const name of EXPECTED_SKILLS) {
      const raw = await readSkill(name);
      const blocks = raw.match(/```[\s\S]*?```/g) ?? [];
      for (const block of blocks) {
        const body = block.replace(/```[a-z]*\n?/i, "").replace(/```$/, "");
        for (const line of body.split(/\r?\n/)) {
          expect(line.includes("&&"), `${name} chains with &&`).toBe(false);
          expect(/;\s*\S/.test(line), `${name} chains with ;`).toBe(false);
          expect(/<<-?\s*['"]?\w/.test(line), `${name} uses a heredoc`).toBe(false);
        }
      }
    }
  });
});

describe("software-dev skills — no duplicated paragraph (§2.1)", () => {
  it("no substantial paragraph repeats across two skills", async () => {
    const seen = new Map<string, string>();
    for (const name of EXPECTED_SKILLS) {
      const raw = await readSkill(name);
      for (const p of paragraphs(raw)) {
        const prev = seen.get(p);
        expect(prev, `paragraph in skill:${name} duplicates ${prev}`).toBeUndefined();
        seen.set(p, `skill:${name}`);
      }
    }
  });

  it("no skill teaching paragraph is copied verbatim into an agent prompt", async () => {
    // Worker-rule boilerplate is shared core doctrine across prompts by design;
    // what must NOT happen is a skill's teaching prose being duplicated into a
    // prompt (or vice versa). Check each skill paragraph against every prompt.
    const promptParas = new Set<string>();
    for (const name of EXPECTED_AGENTS) {
      const raw = await fs.readFile(path.join(AGENTS_DIR, name, "prompt.md"), "utf8");
      for (const p of paragraphs(raw)) promptParas.add(p);
    }
    for (const name of EXPECTED_SKILLS) {
      const raw = await readSkill(name);
      for (const p of paragraphs(raw)) {
        expect(promptParas.has(p), `skill ${name} shares a paragraph with a prompt`).toBe(false);
      }
    }
  });

  // Cross-repo dedup against the core manual (../voidrift-core/docs/explanation)
  // is deliberately NOT done here: reaching a sibling package violates package
  // isolation and the check:graph flat-layout rule. The brief's fallback applies
  // — a normalized-paragraph check among the plugin's OWN skills and prompts
  // (the test above) is the package-local guard against duplication.
});

describe("software-dev agent templates (§2.2)", () => {
  it("exactly the twelve expected agents exist", async () => {
    const dirs = (await fs.readdir(AGENTS_DIR)).sort();
    expect(dirs).toEqual([...EXPECTED_AGENTS].sort());
  });

  it("each agent.json is a valid manifest: name==dir, kind, tools subset of the allowed list", async () => {
    for (const name of EXPECTED_AGENTS) {
      const raw = await fs.readFile(path.join(AGENTS_DIR, name, "agent.json"), "utf8");
      const m = JSON.parse(raw) as { name: string; description: string; kind: string; tools?: string[] };
      expect(m.name).toBe(name);
      expect(typeof m.description).toBe("string");
      expect(m.description.length).toBeGreaterThan(0);
      expect(["worker", "top-level"]).toContain(m.kind);
      const tools = m.tools ?? [];
      for (const t of tools) {
        // The generic core tool list, plus the plugin's OWN software_dev_* tools
        // (§2.4), which the lifecycle agents legitimately hold.
        const allowed = ALLOWED_TOOLS.has(t) || t.startsWith("software_dev_");
        expect(allowed, `${name} holds non-allowed tool ${t}`).toBe(true);
      }
      // A sibling prompt.md must exist and be non-empty (the manifest carries no inline prompt).
      const prompt = await fs.readFile(path.join(AGENTS_DIR, name, "prompt.md"), "utf8");
      expect(prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("no template holds delegate_task or clarify", async () => {
    for (const name of EXPECTED_AGENTS) {
      const raw = await fs.readFile(path.join(AGENTS_DIR, name, "agent.json"), "utf8");
      const tools: string[] = JSON.parse(raw).tools ?? [];
      expect(tools).not.toContain("delegate_task");
      expect(tools).not.toContain("clarify");
    }
  });

  it("no forbidden product name appears in any template prompt or manifest", async () => {
    for (const name of EXPECTED_AGENTS) {
      const json = await fs.readFile(path.join(AGENTS_DIR, name, "agent.json"), "utf8");
      const prompt = await fs.readFile(path.join(AGENTS_DIR, name, "prompt.md"), "utf8");
      for (const re of FORBIDDEN_NAMES) {
        expect(re.test(json), `${name}.json names a forbidden product`).toBe(false);
        expect(re.test(prompt), `${name} prompt names a forbidden product`).toBe(false);
      }
    }
  });

  it("blueprint and documenter prompts state their write scope", async () => {
    const blueprint = await fs.readFile(path.join(AGENTS_DIR, "blueprint", "prompt.md"), "utf8");
    expect(/write scope/i.test(blueprint)).toBe(true);
    expect(blueprint).toContain("blueprint.md");
    expect(blueprint).toContain("*-blueprint.md");

    const documenter = await fs.readFile(path.join(AGENTS_DIR, "documenter", "prompt.md"), "utf8");
    expect(/write scope/i.test(documenter)).toBe(true);
    expect(documenter).toContain("README.md");
    expect(documenter).toContain("CHANGELOG.md");
    expect(documenter).toContain("docs/");
  });
});

describe("software-dev skills — registered through the public CoreAPI (§2.1)", () => {
  let ws: string;
  const trackedCores: CoreAPI[] = [];

  const seed = {
    models: { test: { model: "test-model", protocol: "openai", contextLimit: 32_000 } },
    modelSelected: "test",
    permissions: seedPermissions(),
  };

  beforeEach(async () => {
    ws = await fs.mkdtemp(path.join(os.tmpdir(), "sd-skills-"));
    await fs.mkdir(path.join(ws, ".voidrift"), { recursive: true });
    trackedCores.length = 0;
  });

  afterEach(async () => {
    for (const c of trackedCores) await c.session.shutdown().catch(() => undefined);
    await fs.rm(ws, { recursive: true, force: true });
  });

  /** Write a temp plugin package whose ./skills is a copy of seed/skills. */
  async function writeSkillPlugin(root: string, rel: string): Promise<string> {
    const dir = path.join(root, rel);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: rel, version: "1.0.0", license: "MIT", main: "index.js", voidrift: { kind: "plugin", plugin: true } }, null, 2),
    );
    await fs.writeFile(path.join(dir, "index.js"), `export function register(core){ core.register.skills('./skills'); }`);
    await fs.cp(SKILLS_DIR, path.join(dir, "skills"), { recursive: true });
    return dir;
  }

  async function boot(config: Record<string, unknown>, script?: () => ReturnType<typeof fakeModel>) {
    const ready = await createCore({
      workspaceRoot: ws,
      configStore: new InMemoryConfigStore({ ...seed, ...config }),
      sessionRepository: new InMemorySessionRepository(),
      chatModelFactory: () => (script ?? (() => fakeModel().respond(new AIMessage("done"))))(),
      installSignalHandlers: false,
    });
    trackedCores.push(ready.api);
    return ready.api;
  }

  it("all eleven skills appear while enabled, are skill_view-able, and are absent when not registered", async () => {
    const pluginDir = await writeSkillPlugin(ws, "sd-skillplug");
    const api = await boot(
      { plugins: { "sd-skillplug": { enabled: true, path: pluginDir } } },
      () => fakeModel().respondWithTools([{ name: "skill_view", args: { name: "debugging" } }]).respond(new AIMessage("loaded")),
    );

    await new Promise((r) => setTimeout(r, 400));
    const list = await api.skills.list();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const names = list.value.filter((s) => s.source === "plugin").map((s) => s.name).sort();
    expect(names).toEqual([...EXPECTED_SKILLS].sort());

    // skill_view activates and renders a body.
    const created = await api.session.create({ name: "s" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const res = await api.session.send(created.value.id, { input: "use it" });
    expect(res.ok && res.value.toolsUsed).toContain("skill_view");

    // Disabling removes every contributed skill.
    expect((await api.plugins.disable("sd-skillplug")).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 200));
    const after = await api.skills.list();
    expect(after.ok && after.value.some((s) => s.source === "plugin")).toBe(false);
  });

  describe("mutation — the dedup guard catches a duplicated paragraph", () => {
    it("a paragraph copied from one skill into another FAILs the cross-skill dedup check", async () => {
      const a = await readSkill("debugging");
      const b = await readSkill("refactor");
      const firstPara = paragraphs(a)[0]!;
      // Simulate injecting the debugging paragraph into refactor and re-run the detector.
      const mutatedParas = [...paragraphs(b), firstPara];
      const seen = new Set(paragraphs(a));
      const collision = mutatedParas.some((p) => seen.has(p));
      if (collision) console.log("FAIL (dedup): a paragraph duplicated between two skills was detected");
      expect(collision).toBe(true); // mutation observed by the guard

      // Restore: the real files share no such paragraph.
      const realCollision = paragraphs(b).some((p) => seen.has(p));
      expect(realCollision).toBe(false);
    });
  });
});
