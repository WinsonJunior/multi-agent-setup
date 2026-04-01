@echo off
setlocal enabledelayedexpansion

REM Windows toast notification when Claude needs attention.
REM Triggers on: permission prompts, idle prompts, task completion.

set "msg=%CLAUDE_HOOK_INPUT_MESSAGE%"
set "title=Claude Code"

if "%msg%"=="" set "msg=Claude Code needs your attention"

powershell -NoProfile -Command "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.BalloonTipTitle = '%title%'; $n.BalloonTipText = '%msg%'; $n.Visible = $true; $n.ShowBalloonTip(5000); Start-Sleep -Milliseconds 5100; $n.Dispose()" 2>nul

exit 0