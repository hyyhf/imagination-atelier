@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 scripts\publish.py --repo hyyhf/imagination-atelier --login
) else (
  python scripts\publish.py --repo hyyhf/imagination-atelier --login
)
pause
