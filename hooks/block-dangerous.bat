@echo off
echo %CLAUDE_TOOL_INPUT_COMMAND% | findstr /i "rm -rf DROP TABLE git push git commit docker vercel railway" >nul
if %errorlevel%==0 (
    echo Blocked: dangerous command detected. 1>&2
    exit 2
)
exit 0