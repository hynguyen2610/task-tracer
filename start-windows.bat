@echo off
cd /D "%~dp0"
cd backend
start "backend" npm run dev
cd ../frontend
start "frontend" npm run dev
