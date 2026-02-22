#!/bin/sh

# Start FastAPI backend in background on port 8080
cd /app/backend
uvicorn main:app --host 127.0.0.1 --port 8080 &

# Start nginx in foreground
nginx -g "daemon off;"
