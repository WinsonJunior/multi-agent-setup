@echo off
setlocal enabledelayedexpansion

REM Auto-approve low-risk tool calls to reduce approval friction.
REM Covers: read-only commands, npm scripts, prettier, lint, type-check.
REM Does NOT override deny rules — those always take precedence.

set "cmd=%CLAUDE_TOOL_INPUT_COMMAND%"

REM Auto-approve read-only bash commands
echo !cmd! | findstr /i /b "ls dir cat type head tail find grep rg tree wc" >nul
if !errorlevel!==0 (
    echo {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "permissionDecisionReason": "Read-only command"}}
    exit 0
)

REM Auto-approve npm/npx/node scripts
echo !cmd! | findstr /i /b "npm npx node pnpm yarn" >nul
if !errorlevel!==0 (
    echo {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "permissionDecisionReason": "Package manager or node command"}}
    exit 0
)

REM Auto-approve php artisan (non-destructive)
echo !cmd! | findstr /i /b "php artisan" >nul
if !errorlevel!==0 (
    REM Block migrate:fresh, migrate:reset, db:wipe
    echo !cmd! | findstr /i "migrate:fresh migrate:reset db:wipe" >nul
    if !errorlevel!==0 (
        echo {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "permissionDecisionReason": "Safe artisan command"}}
        exit 0
    )
)

REM Auto-approve python test/lint commands
echo !cmd! | findstr /i /b "python -m pytest python -m ruff python -m mypy" >nul
if !errorlevel!==0 (
    echo {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "permissionDecisionReason": "Python test or lint command"}}
    exit 0
)

REM Auto-approve prettier, eslint, pint
echo !cmd! | findstr /i /b "prettier eslint pint" >nul
if !errorlevel!==0 (
    echo {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "permissionDecisionReason": "Formatter or linter"}}
    exit 0
)

REM No match — let the normal permission prompt appear
exit 0