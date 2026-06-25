@echo off
echo ================================================
echo  TestPro - Online Test Platform
echo ================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/ (LTS version)
    echo After installing, run this script again.
    pause
    exit /b 1
)

echo Node.js found:
node --version

echo.
echo [1/4] Installing server dependencies...
cd /d "%~dp0server"
call npm install
if errorlevel 1 (
    echo ERROR: Server npm install failed
    pause
    exit /b 1
)

echo.
echo [2/4] Installing client dependencies...
cd /d "%~dp0client"
call npm install
if errorlevel 1 (
    echo ERROR: Client npm install failed
    pause
    exit /b 1
)

echo.
echo [3/4] Starting backend server (port 3001)...
cd /d "%~dp0server"
start "TestPro Backend" cmd /k "node index.js"

echo.
echo [4/4] Starting frontend (port 5173)...
cd /d "%~dp0client"
start "TestPro Frontend" cmd /k "npm run dev"

echo.
echo ================================================
echo  Both servers are starting...
echo  Open http://localhost:5173 in your browser
echo  Admin login: admin@otp.com / Admin@123
echo ================================================
echo.
timeout /t 3
start "" "http://localhost:5173"
