@echo off
setlocal
if exist "%~dp0NeuralResonance\NeuralResonance.exe" (
    start "" "%~dp0NeuralResonance\NeuralResonance.exe"
    exit /b 0
)
echo This is the source edition. Run Start-Windows.ps1 using PowerShell 7,
echo or extract the complete Windows application package next to this launcher.
pause
exit /b 1
