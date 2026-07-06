@echo off
cd /d "%~dp0"
echo 正在啟動 PWA 本機開發測試環境...
start http://localhost:5173
npm run dev
pause
