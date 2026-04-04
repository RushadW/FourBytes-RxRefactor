@echo off
echo Starting Medical Benefit Drug Policy Tracker...
echo.

REM Start FastAPI backend in a new window
start "FastAPI Backend" cmd /k "uvicorn backend.main:app --reload --port 8000"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start Streamlit frontend in a new window
start "Streamlit Frontend" cmd /k "streamlit run frontend/app.py --server.port 8501"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:8501
echo API Docs: http://localhost:8000/docs
echo.
echo To load demo data, run in a new terminal:
echo   python scripts/seed_demo.py
echo.
pause
