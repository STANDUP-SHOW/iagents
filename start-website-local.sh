#!/bin/bash

# iAgents Local Website Server
# Serves the built frontend on http://localhost:5000

set -e

echo "🚀 Starting iAgents Local Website Server..."
echo ""

# Check if dist folder exists
if [ ! -d "frontend/dist" ]; then
    echo "❌ Error: frontend/dist not found"
    echo "Building frontend first..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

# Install simple-http-server or use Python
if command -v python3 &> /dev/null; then
    echo "✅ Using Python HTTP Server"
    echo "🌐 Website available at: http://localhost:5000"
    echo "📊 Agent Catalogue: http://localhost:5000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    cd frontend/dist
    python3 -m http.server 5000
else
    echo "❌ Python 3 not found"
    echo "Please install Python 3 or use: npm install -g http-server"
    exit 1
fi
