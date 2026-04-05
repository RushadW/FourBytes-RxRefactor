@echo off
echo Starting AntonRx...
echo.

if exist ".venv\Scripts\uvicorn.exe" (
    set UVICORN=.venv\Scripts\uvicorn.exe
    set PYTHON=.venv\Scripts\python.exe
    echo Using .venv
) else (
    set UVICORN=uvicorn
    set PYTHON=python
    echo Using system Python
)

REM Start FastAPI — serves frontend_html/index.html at / and API at /api/v1/*
start "AntonRx" cmd /k "%UVICORN% backend.main:app --reload --port 8000"

echo.
echo  App:      http://localhost:8000
echo  API Docs: http://localhost:8000/docs
echo.
echo  Mockup sandbox (no backend needed):
echo    %PYTHON% mockup/mock_server.py 8001
echo    then open http://localhost:8001
echo.
echo  Promote mockup to live frontend:
echo    promote_frontend.bat
echo.
pause
