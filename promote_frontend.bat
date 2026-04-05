@echo off
echo Promoting mockup to live frontend...
copy /Y "mockup\index.html" "frontend_html\index.html"
echo Done. Refresh http://localhost:8000 to see changes.
