@echo off
setlocal
set "ROOT=%~dp0"
rem The packaged copy goes through Start-Windows.ps1 first: it compares the bundle
rem with these source files and falls back to the source edition when they differ.
rem Launching the exe directly skipped that check, so a stale package could run
rem while the source had already changed.
rem goto is used instead of a parenthesised block: %errorlevel% inside a block is
rem expanded when the block is parsed, which would discard pwsh's exit code.
where pwsh >nul 2>nul
if errorlevel 1 goto :packaged
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%Start-Windows.ps1" %*
exit /b %errorlevel%
:packaged
if not exist "%ROOT%NeuralResonance\NeuralResonance.exe" goto :source
echo PowerShell 7 is not installed, so the packaged copy cannot be compared
echo with the source files in this folder. Starting it as it is.
start "" "%ROOT%NeuralResonance\NeuralResonance.exe"
exit /b 0
:source
echo This is the source edition. Install PowerShell 7 and run Start-Windows.ps1,
echo or extract the complete Windows application package next to this launcher.
pause
exit /b 1
