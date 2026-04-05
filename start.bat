@echo off
echo Starting AntonRx Medical Benefit Drug Policy Tracker...
echo.

REM Use venv if it exists, otherwise fall back to system Python
if exist ".venv\Scripts\python.exe" (
    set PYTHON=.venv\Scripts\python.exe
    set UVICORN=.venv\Scripts\uvicorn.exe
    set STREAMLIT=.venv\Scripts\streamlit.exe
    echo Using venv: .venv\
) else (
    set PYTHON=python
    set UVICORN=uvicorn
    set STREAMLIT=streamlit
    echo Using system Python
)

echo.

REM Start FastAPI backend (serves UI + API at port 8000)
start "AntonRx Backend" cmd /k "%UVICORN% backend.main:app --reload --port 8000"

REM Wait for backend to start
timeout /t 3 /nobreak > nul

REM Start Streamlit frontend
start "AntonRx Streamlit" cmd /k "%STREAMLIT% run frontend/app.py --server.port 8501 --server.headless true"

echo.
echo  App (mockup UI):   http://localhost:8000
echo  Streamlit UI:      http://localhost:8501
echo  API Docs:          http://localhost:8000/docs
echo.
echo To load demo data, open a new terminal and run:
echo   %PYTHON% scripts/seed_demo.py
echo.
pause
