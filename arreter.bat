@echo off
cd /d "%~dp0"
docker compose down
echo Arrete. Tes donnees sont conservees.
pause
