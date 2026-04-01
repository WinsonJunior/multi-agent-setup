@echo off
set TIMESTAMP=%DATE% %TIME%
set AGENT_NAME=%CLAUDE_SUBAGENT_NAME%
if "%AGENT_NAME%"=="" set AGENT_NAME=unknown
echo - [%TIMESTAMP%] Agent completed: %AGENT_NAME% >> %USERPROFILE%\.claude\agent-log.md