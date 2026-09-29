@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  === Pret Materiel : demarrage ===
echo.
docker version >nul 2>&1
if errorlevel 1 (
  echo  Docker n'est pas lance. Ouvre Docker Desktop, attends qu'il soit pret, puis relance ce fichier.
  pause
  exit /b 1
)
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo  Erreur au demarrage. Copie le message ci-dessus et envoie-le.
  pause
  exit /b 1
)
echo.
echo  Attente du site...
:wait
timeout /t 3 >nul
curl -s -o nul http://localhost:3000 || goto wait
echo.
echo  C'est pret !
echo    Site            : http://localhost:3000
echo    Boite mail test : http://localhost:8025
echo    Admin           : admin@pret.local / admin1234  (modifiable dans .env)
echo.
start http://localhost:3000
pause
