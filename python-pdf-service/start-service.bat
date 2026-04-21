@echo off
echo ========================================
echo  Lancement du Service PDF Extractor
echo ========================================
echo.

REM Ajouter Python au PATH
set PATH=%PATH%;C:\Program Files\Python311;C:\Program Files\Python311\Scripts;C:\Users\zayan\AppData\Roaming\Python\Python311\Scripts

REM Verifier que Python est accessible
python --version >nul 2>&1
if errorlevel 1 (
    echo ERREUR: Python n'est pas trouve!
    echo Verifiez l'installation de Python 3.11
    pause
    exit /b 1
)

echo Python detecte:
python --version
echo.

REM Lancer le service
echo Lancement du service sur http://localhost:8000
echo Appuyez sur Ctrl+C pour arreter
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000

pause
