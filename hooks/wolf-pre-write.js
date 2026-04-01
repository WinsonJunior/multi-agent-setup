/**
 * PreToolUse hook on Write/Edit — do-not-repeat enforcement.
 * - Reads .wolf/cerebrum.md for learned "never do this" patterns
 * - Regex-matches incoming code against Do-Not-Repeat list
 * - Searches .wolf/buglog.json for past bugs in the same file
 * - Warns via stderr if violations found (never blocks)
 */

import { join } from "path";
import {
  ensureWolfDir, readJSON, readMd,
  readStdin, warn
} from "./wolf-shared.js";

function extractDoNotRepeatPatterns(cerebrum) {
  if (!cerebrum) return [];
  const patterns = [];

  // Extract from ## Do-Not-Repeat section
  const dnrMatch = cerebrum.match(/##\s*Do-Not-Repeat([\s\S]*?)(?=\n##|\n$|$)/i);
  if (!dnrMatch) return patterns;

  const section = dnrMatch[1];
  const lines = section.split("\n").filter((l) => l.trim().startsWith("-") || l.trim().startsWith("*"));

  for (const line of lines) {
    // Extract quoted patterns: "pattern" or 'pattern' or `pattern`
    const quoted = line.match(/[`'"](.*?)[`'"]/g);
    if (quoted) {
      for (const q of quoted) {
        const clean = q.slice(1, -1).trim();
        if (clean.length >= 3) {
          try {
            patterns.push({ regex: new RegExp(clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), rule: line.trim() });
          } catch { /* skip invalid regex */ }
        }
      }
    }

    // Extract "never use X" / "avoid X" / "don't use X" directives
    const neverMatch = line.match(/(?:never|avoid|don'?t)\s+(?:use|import|add|include|call)\s+[`'"]?(\w[\w.-]*)[`'"]?/i);
    if (neverMatch) {
      const term = neverMatch[1];
      if (term.length >= 3) {
        try {
          patterns.push({ regex: new RegExp(`\\b${term}\\b`, "i"), rule: line.trim() });
        } catch { /* skip */ }
      }
    }
  }

  return patterns;
}

function findRelevantBugs(buglog, filePath) {
  if (!buglog || !buglog.length) return [];
  return buglog
    .filter((b) => b.file === filePath)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 2);
}

try {
  const wolfDir = ensureWolfDir();
  if (!wolfDir) process.exit(0);

  const input = readStdin();
  const filePath = input?.tool_input?.file_path;
  const newContent = input?.tool_input?.new_string || input?.tool_input?.content || "";
  if (!filePath || !newContent) process.exit(0);

  // Skip .wolf internal files
  if (filePath.includes(".wolf")) process.exit(0);

  const cerebrumFile = join(wolfDir, "cerebrum.md");
  const buglogFile = join(wolfDir, "buglog.json");

  // Check Do-Not-Repeat patterns
  const cerebrum = readMd(cerebrumFile);
  const patterns = extractDoNotRepeatPatterns(cerebrum);

  const violations = [];
  for (const { regex, rule } of patterns) {
    if (regex.test(newContent)) {
      violations.push(rule);
    }
  }

  if (violations.length > 0) {
    warn(`🚫 Do-Not-Repeat violation in ${filePath}:`);
    for (const v of violations.slice(0, 3)) {
      warn(`   → ${v}`);
    }
    if (violations.length > 3) {
      warn(`   ... and ${violations.length - 3} more`);
    }
  }

  // Check buglog for past bugs in this file
  const buglog = readJSON(buglogFile, []);
  const relevantBugs = findRelevantBugs(buglog, filePath);

  if (relevantBugs.length > 0) {
    warn(`📋 Past bugs in ${filePath}:`);
    for (const bug of relevantBugs) {
      warn(`   → [${bug.tags.join(", ")}] ${bug.summary} (${bug.timestamp.slice(0, 10)})`);
    }
    warn(`   FYI only — do NOT apply blindly.`);
  }
} catch {
  // Silent fail
}

process.exit(0);
