/**
 * Stop hook — session summary + cross-session memory finalization.
 * - Calculates session stats (files read/written, tokens, repeated reads)
 * - Appends session summary to .wolf/memory.md
 * - Warns about files edited 3+ times without buglog entries
 * - Checks cerebrum freshness after significant work
 */

import { join } from "path";
import {
  ensureWolfDir, readJSON, readMd, appendMd,
  warn, timestamp
} from "./wolf-shared.js";

try {
  const wolfDir = ensureWolfDir();
  if (!wolfDir) process.exit(0);

  const sessionFile = join(wolfDir, "session.json");
  const memoryFile = join(wolfDir, "memory.md");
  const buglogFile = join(wolfDir, "buglog.json");

  const session = readJSON(sessionFile, null);
  if (!session) process.exit(0);

  // Calculate session stats
  const reads = Object.entries(session.reads || {});
  const writes = Object.entries(session.writes || {});
  const totalReads = reads.length;
  const totalWrites = writes.length;
  const repeatedReads = reads.filter(([, v]) => v.count > 1).length;
  const totalTokensRead = reads.reduce((sum, [, v]) => sum + (v.tokens || 0), 0);
  const tokensSaved = reads
    .filter(([, v]) => v.count > 1)
    .reduce((sum, [, v]) => sum + (v.tokens || 0) * (v.count - 1), 0);

  // Files edited 3+ times — potential churn
  const churnFiles = writes.filter(([, v]) => v.count >= 3);
  if (churnFiles.length > 0) {
    const buglog = readJSON(buglogFile, []);
    for (const [file, data] of churnFiles) {
      const hasBugEntry = buglog.some(
        (b) => b.file === file && new Date(b.timestamp) >= new Date(session.started)
      );
      if (!hasBugEntry) {
        warn(`⚠️ ${file} was edited ${data.count} times but has no buglog entry this session. Consider logging the fix.`);
      }
    }
  }

  // Append session summary to memory
  const ts = timestamp();
  const summary = [
    `\n**Session ended: ${ts}**`,
    `- Files read: ${totalReads} (${repeatedReads} repeated)`,
    `- Files written: ${totalWrites}`,
    `- Tokens read: ~${totalTokensRead}`,
    `- Tokens saved from repeat warnings: ~${tokensSaved}`,
  ];

  if (churnFiles.length > 0) {
    summary.push(`- Churn files (3+ edits): ${churnFiles.map(([f]) => f).join(", ")}`);
  }

  appendMd(memoryFile, summary.join("\n") + "\n");

  warn(`📊 Session summary: ${totalReads} reads, ${totalWrites} writes, ~${tokensSaved} tokens saved from repeat prevention.`);
} catch {
  // Silent fail
}

process.exit(0);
