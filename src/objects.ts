/**
 * Objects module: parse, serialize, and validate idea/CR/task objects.
 * Markdown+YAML frontmatter, with user-edits honored.
 * (software-dev-blueprint.md §2.7)
 */
import { parseDocument } from "yaml";
import type { Document } from "yaml";

/** Base object type with common fields. */
export interface BaseObject {
  id: string;
  title: string;
  status: string;
  created_at: string;
  [key: string]: unknown; // Preserve user-added fields
}

export interface Idea extends BaseObject {
  status: "draft" | "accepted" | "analyzed";
}

export interface ChangeRequest extends BaseObject {
  status: "draft" | "developed" | "verified" | "deployed" | "failed";
  modules?: string[];
  acceptanceCriteria?: string[];
  idea_id?: string;
}

export interface Task extends BaseObject {
  status: "pending" | "done" | "blocked";
  cr_id: string;
  acceptanceCriteria?: string[];
}

export type ObjectKind = "idea" | "cr" | "task";
export type AnyObject = Idea | ChangeRequest | Task;

/** Extract the max id number from a list of filenames for a given kind. */
export function nextIdForKind(kind: string, filenames: string[]): string {
  const prefix = kind.toUpperCase() + "-";
  const nums = filenames
    .map((fn) => {
      if (!fn.startsWith(prefix)) return 0;
      const match = fn.match(new RegExp(`^${prefix}(\\d+)\\.md$`));
      return match && match[1] ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const max = Math.max(0, ...nums);
  return `${kind.toUpperCase()}-${String(max + 1).padStart(3, "0")}`;
}

/**
 * Parse Markdown with YAML frontmatter into an object.
 * User-edited frontmatter fields are preserved.
 * The body (content after frontmatter) is stored separately for serialization.
 */
export function parseMarkdown(content: string, kind: ObjectKind): AnyObject {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match || !match[1]) {
    throw new Error(`Invalid frontmatter in ${kind} object`);
  }

  const yamlStr = match[1];
  let doc: Document;
  try {
    doc = parseDocument(yamlStr);
  } catch (err) {
    throw new Error(`Invalid YAML frontmatter in ${kind} object: ${err instanceof Error ? err.message : String(err)}`);
  }

  const fm = doc.toJSON() as Record<string, unknown>;

  // Validate required fields
  const id = fm.id as string | undefined;
  const title = fm.title as string | undefined;
  const status = fm.status as string | undefined;
  const created_at = fm.created_at as string | undefined;

  if (typeof id !== "string") throw new Error(`Missing id in ${kind} object`);
  if (typeof title !== "string") throw new Error(`Missing title in ${kind} object`);
  if (typeof status !== "string") throw new Error(`Missing status in ${kind} object`);
  if (typeof created_at !== "string") throw new Error(`Missing created_at in ${kind} object`);

  // Store the YAML document and body for serialization
  (fm as Record<string, unknown>).__yamlDoc = doc;
  (fm as Record<string, unknown>).__body = match[2];

  return fm as AnyObject;
}

/**
 * Serialize an object back to Markdown with YAML frontmatter.
 * If parsed from markdown, preserves all existing frontmatter/body, editing only the fields the plugin owns.
 * If programmatically constructed, creates new YAML frontmatter.
 */
export function serializeMarkdown(obj: AnyObject, body?: string): string {
  const fm = obj as Record<string, unknown>;
  let doc = fm.__yamlDoc as Document | undefined;
  const originalBody = fm.__body as string | undefined;

  // Use provided body or fall back to stored original
  const bodyToWrite = body ?? originalBody ?? "";

  // If we have a parsed document, use its API to preserve structure
  if (doc) {
    // Update ONLY the fields that are not internal markers
    // This preserves comments, key order, quoting of other values
    for (const [key, value] of Object.entries(fm)) {
      if (!key.startsWith("__")) {
        doc.set(key, value);
      }
    }
    // Re-stringify the document (preserves comments, key order, quoting)
    // doc.toString() already ends with a newline, so strip it to avoid double newlines
    const frontmatterStr = doc.toString({ directives: false }).trimEnd();
    return `---\n${frontmatterStr}\n---\n${bodyToWrite}`;
  }

  // Otherwise, construct from scratch for programmatically created objects
  const fmCopy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fm)) {
    if (!key.startsWith("__")) {
      fmCopy[key] = value;
    }
  }

  let frontmatter = "---\n";
  for (const [key, value] of Object.entries(fmCopy)) {
    if (Array.isArray(value)) {
      frontmatter += `${key}:\n`;
      for (const item of value) {
        frontmatter += `  - ${item}\n`;
      }
    } else if (typeof value === "string") {
      // Quote if the value contains special characters
      if (value.includes(":") || value.includes("#") || value.includes("[")) {
        frontmatter += `${key}: "${value}"\n`;
      } else {
        frontmatter += `${key}: ${value}\n`;
      }
    } else {
      frontmatter += `${key}: ${JSON.stringify(value)}\n`;
    }
  }
  frontmatter += "---\n";

  return frontmatter + bodyToWrite;
}

/**
 * Check if a status transition is allowed for an object kind.
 * (software-dev-blueprint.md §2.7)
 */
export function canTransition(
  kind: ObjectKind,
  from: string,
  to: string
): boolean {
  if (from === to && kind === "task" && to === "done") return true;
  if (from === to) return false;

  if (kind === "idea") {
    if (from === "draft") return to === "accepted";
    if (from === "accepted") return to === "analyzed";
    return false;
  }

  if (kind === "cr") {
    if (from === "draft") return to === "developed";
    if (from === "developed") return to === "verified";
    if (from === "verified") return to === "deployed" || to === "failed";
    return false;
  }

  if (kind === "task") {
    if (from === "pending") return to === "done" || to === "blocked";
    return false;
  }

  return false;
}
