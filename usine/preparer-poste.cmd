@echo off
rem Lanceur pour un double-clic ou un clic droit "Executer en tant qu'administrateur".
rem Les options passent telles quelles : preparer-poste.cmd -Essai
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preparer-poste.ps1" %*
pause
