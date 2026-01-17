@echo off
echo ============================================
echo  LiveHub Backend - Development Mode
echo ============================================
echo.
echo PREREQUISITES:
echo   1. Docker services running (docker compose -f docker-compose.dev.yml up -d)
echo   2. Conda environment activated (conda activate py311)
echo.
echo ============================================
echo  Starting Services...
echo ============================================
echo.

REM Start API in new window
start "LiveHub API" cmd /k "cd /d D:\LiveHub\backend && conda activate py311 && uvicorn app.main:app --reload --port 8080"

REM Wait a moment for API to start
timeout /t 3 /nobreak >nul

REM Start Worker in new window  
start "LiveHub Worker" cmd /k "cd /d D:\LiveHub\backend && conda activate py311 && python worker.py"

echo.
echo ============================================
echo  Services Started!
echo ============================================
echo.
echo  API:    http://localhost:8080
echo  Docs:   http://localhost:8080/docs
echo  Worker: Running in background
echo.
echo  To stop: Close the terminal windows
echo ============================================
