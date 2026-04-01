/**
 * Shared utilities for wolf hooks.
 * All hooks use $CLAUDE_PROJECT_DIR/.wolf/ for per-project state.
 * Hooks fail silently (exit 0) on any error — never block Claude.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "fs";
import { join } from "path";

export function getWolfDir() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (!projectDir) return null;
  return join(projectDir, ".wolf");
}

export function ensureWolfDir() {
  const dir = getWolfDir();
  if (!dir) return null;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    return null;
  }
}

export function readJSON(filePath, fallback = null) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJSON(filePath, data) {
  try {
    const tmp = filePath + ".tmp";
    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmp, filePath);
    return true;
  } catch {
    return false;
  }
}

export function readMd(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

export function appendMd(filePath, content) {
  try {
    const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
    writeFileSync(filePath, existing + content, "utf8");
    return true;
  } catch {
    return false;
  }
}

export function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

export function warn(msg) {
  process.stderr.write(`[wolf] ${msg}\n`);
}

export function estimateTokens(text) {
  if (!text) return 0;
  const codePattern = /[{};=()=>]/;
  const ratio = codePattern.test(text) ? 3.5 : 4.0;
  return Math.ceil(text.length / ratio);
}

export function timestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}
