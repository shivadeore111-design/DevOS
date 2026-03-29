@echo off
cd /d "%~dp0\.."
pip install pystray pillow keyboard requests --quiet --break-system-packages 2>nul
python scripts\quick_action.py
