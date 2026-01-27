#!/bin/bash
set -e

# Start Xvfb
Xvfb :99 -screen 0 1024x768x16 &
export DISPLAY=:99

# Check if gunicorn is installed, if not install it
pip list | grep gunicorn || pip install gunicorn

# Check if we should run in development or production mode
if [ "$FLASK_ENV" = "development" ]; then
    echo "Starting in development mode..."
    python flask_backend.py
else
    echo "Starting in production mode..."
    # Check if gunicorn is available
    if command -v gunicorn &> /dev/null; then
        echo "Using gunicorn server..."
        gunicorn --bind 0.0.0.0:5000 --workers 4 "flask_backend:app"
    else
        echo "Gunicorn not available, using Flask development server..."
        python flask_backend.py
    fi
fi