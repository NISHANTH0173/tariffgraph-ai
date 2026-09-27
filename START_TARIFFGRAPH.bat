@echo off
title TariffGraph AI Launcher

cd /d "D:\hackathon\tariff-graph-app"

echo ==========================================
echo        TARIFFGRAPH AI STARTING...
echo ==========================================
echo.

echo [1/2] Starting Local IBM Granite backend...
start "TariffGraph - Backend" cmd /k "node server.mjs"

echo [2/2] Starting Vite frontend...
start "TariffGraph - Frontend" cmd /k "npm.cmd run dev -- --host 0.0.0.0"

echo.
echo Waiting for the website to start...
timeout /t 5 /nobreak >nul

echo Opening TariffGraph AI...
start "" "http://localhost:5173"

echo.
echo TariffGraph AI is starting.
echo Keep the Backend and Frontend windows open.
echo.
pause
