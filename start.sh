#!/bin/bash

echo "=================================="
echo "🚀 NURSEAI MULTI-AGENT SYSTEM"
echo "=================================="
echo ""

# Check if we're on Windows (Git Bash)
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo "Detected Windows environment"
    PYTHON_CMD="python"
else
    PYTHON_CMD="python3"
fi

# Start backend
echo "📦 Starting Backend..."
echo "   → Running: cd backend && uvicorn main:app --reload --port 8000"
cd backend
$PYTHON_CMD -m uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

echo "   ✓ Backend starting on http://localhost:8000"
echo ""

# Wait a moment for backend to initialize
sleep 3

# Start frontend
echo "🎨 Starting Frontend..."
echo "   → Running: npm start"
npm start &
FRONTEND_PID=$!

echo ""
echo "=================================="
echo "✅ NURSEAI IS RUNNING!"
echo "=================================="
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔌 Backend:  http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
