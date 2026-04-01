/**
 * PreToolUse hook on Read — token waste prevention.
 * - Tracks files read this session in .wolf/session.json
 * - Warns on repeated reads with token estimate
 * - Cross-references .wolf/anatomy.md for file descriptions
 */

import { join } from "path";
import {
  ensureWolfDir, readJSON, writeJSON, readMd,
  readStdin, warn, estimateTokens
} from "./wolf-shared.js";

try {
  const wolfDir = ensureWolfDir();
  if (!wolfDir) process.exit(0);

  const input = readStdin();
  const filePath = input?.tool_input?.file_path;
  if (!filePath) process.exit(0);

  // Skip .wolf internal files
  if (filePath.includes(".wolf")) process.exit(0);

  const sessionFile = join(wolfDir, "session.json");
  const anatomyFile = join(wolfDir, "anatomy.md");

  const session = readJSON(sessionFile, { reads: {}, writes: {}, started: new Date().toISOString() });

  // Check anatomy for file description
  const anatomy = readMd(anatomyFile);
  if (anatomy) {
    const escaped = filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = anatomy.match(new RegExp(`${escaped}[^\\n]*\\n([^\\n]+)`));
    if (match) {
      warn(`📄 ${match[1].trim()}`);
    }
  }

  // Check for repeated read
  if (session.reads[filePath]) {
    const count = session.reads[filePath].count;
    const tokens = session.reads[filePath].tokens || "unknown";
    warn(`⚠️ Repeated read #${count + 1}: ${filePath} (~${tokens} tokens). Consider caching the content.`);
    session.reads[filePath].count = count + 1;
  } else {
    // Estimate tokens from anatomy or default
    let tokenEstimate = 0;
    if (anatomy) {
      const tokenMatch = anatomy.match(new RegExp(`${filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*?(\\d+)\\s*tokens`));
      if (tokenMatch) tokenEstimate = parseInt(tokenMatch[1]);
    }
    session.reads[filePath] = { count: 1, tokens: tokenEstimate, first: new Date().toISOString() };
  }

  writeJSON(sessionFile, session);
} catch {
  // Silent fail — never block Claude
}

process.exit(0);
