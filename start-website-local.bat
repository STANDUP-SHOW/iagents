@echo off
REM iAgents Local Website Server
REM Serves the built frontend on http://localhost:5000

echo 🚀 Starting iAgents Local Website Server...
echo.

REM Check if dist folder exists
if not exist "frontend\dist" (
    echo ❌ Error: frontend\dist not found
    echo Building frontend first...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

REM Check for Python
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Using Python HTTP Server
    echo 🌐 Website available at: http://localhost:5000
    echo 📊 Agent Catalogue: http://localhost:5000
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    cd frontend\dist
    python -m http.server 5000
    goto :end
)

REM Check for Node http-server
where http-server >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Using Node http-server
    echo 🌐 Website available at: http://localhost:5000
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    cd frontend\dist
    http-server -p 5000
    goto :end
)

REM If neither found
echo ❌ No HTTP server found
echo Please install one of:
echo   - Python 3
echo   - http-server: npm install -g http-server
pause

:end
