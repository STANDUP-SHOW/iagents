@echo off
cd /d "%~dp0"

echo Rebuilding frontend...
cd frontend
call npm install
call npm run build
cd ..

echo.
echo ============================================
echo Starting LocalAgent Web Server
echo ============================================
echo.
echo Opening http://localhost:8080 in Chrome...
echo.

timeout /t 2 /nobreak

start chrome http://localhost:8080

echo Server running on http://localhost:8080
echo Press Ctrl+C to stop
echo.

cd frontend\dist
python -m http.server 8080
