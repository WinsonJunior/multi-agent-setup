/**
 * SessionStart hook — initializes per-session state + cross-session memory.
 * - Creates fresh .wolf/session.json with counters
 * - Appends session header to .wolf/memory.md
 * - Checks cerebrum freshness and buglog health
 * - Ensures all .wolf/ files exist with sane defaults
 */

import { join } from "path";
import { existsSync, writeFileSync, statSync } from "fs";
import {
  ensureWolfDir, readJSON, writeJSON, readMd, appendMd,
  warn, timestamp
} from "./wolf-shared.js";

try {
  const wolfDir = ensureWolfDir();
  if (!wolfDir) process.exit(0);

  const sessionFile = join(wolfDir, "session.json");
  const memoryFile = join(wolfDir, "memory.md");
  const cerebrumFile = join(wolfDir, "cerebrum.md");
  const buglogFile = join(wolfDir, "buglog.json");
  const anatomyFile = join(wolfDir, "anatomy.md");

  // Create fresh session state
  const session = {
    started: new Date().toISOString(),
    reads: {},
    writes: {}
  };
  writeJSON(sessionFile, session);

  // Ensure cerebrum.md exists with template
  if (!existsSync(cerebrumFile)) {
    writeFileSync(
      cerebrumFile,
      `# Cerebrum — Learned Preferences\n\n## Conventions\n- (Add project conventions here)\n\n## Do-Not-Repeat\n- (Add patterns to avoid here, e.g., - Never use \`moment.js\`, prefer \`date-fns\`)\n\n## Learnings\n- (Auto-populated as Claude discovers patterns)\n`,
      "utf8"
    );
    warn("📝 Created .wolf/cerebrum.md — add your Do-Not-Repeat rules there.");
  }

  // Ensure buglog.json exists
  if (!existsSync(buglogFile)) {
    writeJSON(buglogFile, []);
  }

  // Ensure anatomy.md exists
  if (!existsSync(anatomyFile)) {
    writeFileSync(
      anatomyFile,
      `# Project Anatomy\n\n| File | Lines | Tokens |\n|------|-------|--------|\n`,
      "utf8"
    );
  }

  // Ensure memory.md exists
  if (!existsSync(memoryFile)) {
    writeFileSync(
      memoryFile,
      `# Session Memory\n\n`,
      "utf8"
    );
  }

  // Append session header to memory
  const ts = timestamp();
  appendMd(memoryFile, `\n---\n### Session: ${ts}\n| Time | Action | File | Summary | Tokens |\n|------|--------|------|---------|--------|\n`);

  // Check cerebrum freshness
  try {
    const cerebrumStat = statSync(cerebrumFile);
    const daysSinceUpdate = (Date.now() - cerebrumStat.mtimeMs) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 3) {
      warn(`⚠️ cerebrum.md hasn't been updated in ${Math.floor(daysSinceUpdate)} days. Consider reviewing your Do-Not-Repeat list.`);
    }
  } catch { /* skip */ }

  // Check cerebrum has content
  const cerebrum = readMd(cerebrumFile);
  const dnrSection = cerebrum.match(/##\s*Do-Not-Repeat([\s\S]*?)(?=\n##|\n$|$)/i);
  if (dnrSection) {
    const rules = dnrSection[1].split("\n").filter((l) => l.trim().startsWith("-") && !l.includes("(Add"));
    if (rules.length === 0) {
      warn("💡 cerebrum.md has no Do-Not-Repeat rules yet. Add patterns to avoid repeated mistakes.");
    }
  }

  // Check buglog size
  const buglog = readJSON(buglogFile, []);
  if (buglog.length > 0) {
    warn(`📊 Session started. ${buglog.length} bugs in buglog, anatomy active.`);
  } else {
    warn("📊 Session started. Wolf hooks active.");
  }
} catch {
  // Silent fail
}

process.exit(0);
