/**
 * PostToolUse hook on Write/Edit — bug auto-detection + anatomy update.
 * - Pattern-matches edits to detect 12 bug-fix categories
 * - Auto-logs detected bugs to .wolf/buglog.json
 * - Updates .wolf/anatomy.md with file entry
 * - Appends action to .wolf/memory.md
 * - Warns if a file has been edited 3+ times this session
 */

import { join } from "path";
import { existsSync, readFileSync } from "fs";
import {
  ensureWolfDir, readJSON, writeJSON, readMd, appendMd,
  readStdin, warn, estimateTokens, timestamp
} from "./wolf-shared.js";

// Bug-fix detection patterns
const BUG_PATTERNS = [
  { tag: "error-handling", patterns: [/try\s*\{/, /\.catch\(/, /catch\s*\(/, /on[A-Z]\w*Error/] },
  { tag: "null-safety", patterns: [/\?\.\w/, /\?\?/, /!= ?null/, /!== ?null/, /!== ?undefined/] },
  { tag: "guard-clause", patterns: [/if\s*\(!?\w+\)\s*(return|throw|continue|break)/] },
  { tag: "wrong-value", patterns: [/(['"`])(?:(?!\1).)+\1\s*(?:=>|→|was|changed|replaced)/i] },
  { tag: "missing-import", patterns: [/^[+].*(?:import|require|use)\s/m] },
  { tag: "async-fix", patterns: [/^[+].*await\s/m, /^[+].*async\s/m] },
  { tag: "type-fix", patterns: [/:\s*(?:string|number|boolean|any|void|never|unknown)/, /as\s+\w+/] },
  { tag: "logic-fix", patterns: [/===\s*(?:true|false)/, /&&\s*!/, /\|\|\s*!/] },
  { tag: "operator-fix", patterns: [/===/, /!==/, />=/, /<=/] },
  { tag: "return-value", patterns: [/^[+].*return\s/m] },
  { tag: "style-fix", patterns: [/(?:color|margin|padding|display|flex|grid|font|border|width|height)\s*:/] },
  { tag: "refactor", patterns: [/^[-].*function\s/m, /^[+].*function\s/m] }
];

function detectBugPatterns(content) {
  if (!content) return [];
  const tags = [];
  for (const { tag, patterns } of BUG_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        tags.push(tag);
        break;
      }
    }
  }
  return tags;
}

function summarizeEdit(toolName, input) {
  if (toolName === "Write") return "wrote file";
  if (input?.old_string && input?.new_string) {
    const removed = input.old_string.split("\n").length;
    const added = input.new_string.split("\n").length;
    if (added > removed) return `added ${added - removed} lines`;
    if (removed > added) return `removed ${removed - added} lines`;
    return `modified ${added} lines`;
  }
  return "edited file";
}

try {
  const wolfDir = ensureWolfDir();
  if (!wolfDir) process.exit(0);

  const input = readStdin();
  const toolName = input?.tool_name || "Edit";
  const filePath = input?.tool_input?.file_path;
  if (!filePath) process.exit(0);

  // Skip .wolf internal files and .env files
  if (filePath.includes(".wolf") || filePath.includes(".env")) process.exit(0);

  const sessionFile = join(wolfDir, "session.json");
  const buglogFile = join(wolfDir, "buglog.json");
  const anatomyFile = join(wolfDir, "anatomy.md");
  const memoryFile = join(wolfDir, "memory.md");

  const session = readJSON(sessionFile, { reads: {}, writes: {}, started: new Date().toISOString() });
  const buglog = readJSON(buglogFile, []);

  // Track edit count
  if (!session.writes) session.writes = {};
  const editCount = (session.writes[filePath]?.count || 0) + 1;
  session.writes[filePath] = { count: editCount, last: new Date().toISOString() };

  if (editCount >= 3) {
    warn(`⚠️ ${filePath} edited ${editCount} times this session. Possible churn — consider logging to buglog.`);
  }

  // Bug auto-detection on edits
  if (toolName === "Edit" && input?.tool_input?.new_string) {
    const newContent = input.tool_input.new_string;
    const oldContent = input.tool_input.old_string || "";
    const diff = newContent.replace(oldContent, "");
    const tags = detectBugPatterns(diff);

    if (tags.length > 0) {
      // Deduplicate: skip if same file + same tags within last 5 minutes
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const isDupe = buglog.some(
        (b) =>
          b.file === filePath &&
          new Date(b.timestamp).getTime() > fiveMinAgo &&
          JSON.stringify(b.tags.sort()) === JSON.stringify(tags.sort())
      );

      if (!isDupe) {
        const entry = {
          id: `bug-${Date.now()}`,
          file: filePath,
          tags,
          summary: summarizeEdit(toolName, input.tool_input),
          snippet: diff.slice(0, 200),
          timestamp: new Date().toISOString()
        };
        buglog.push(entry);
        writeJSON(buglogFile, buglog);
        warn(`🐛 Bug-fix detected [${tags.join(", ")}] in ${filePath} — logged to buglog.json`);
      }
    }
  }

  // Update anatomy
  let anatomy = readMd(anatomyFile);
  const fileName = filePath.split(/[/\\]/).pop();
  let fileContent = "";
  try {
    if (existsSync(filePath)) fileContent = readFileSync(filePath, "utf8");
  } catch { /* skip */ }
  const tokens = estimateTokens(fileContent);
  const lineCount = fileContent ? fileContent.split("\n").length : 0;

  const anatomyEntry = `| ${filePath} | ${lineCount}L | ~${tokens} tokens |`;
  const escaped = filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (anatomy.includes(filePath)) {
    anatomy = anatomy.replace(new RegExp(`\\|\\s*${escaped}\\s*\\|[^\\n]+`), anatomyEntry);
  } else {
    anatomy += `\n${anatomyEntry}`;
  }
  try {
    const { writeFileSync: wf } = await import("fs");
    wf(anatomyFile, anatomy, "utf8");
  } catch { /* skip */ }

  // Append to memory
  const summary = summarizeEdit(toolName, input?.tool_input);
  appendMd(memoryFile, `| ${timestamp()} | ${toolName} | ${filePath} | ${summary} | ~${tokens}t |\n`);

  writeJSON(sessionFile, session);
} catch {
  // Silent fail
}

process.exit(0);
