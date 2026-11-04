#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "==================================================="
echo "            QuantLab Platform Launcher             "
echo "==================================================="

# 1. Environment file check
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        echo "[*] Creating backend/.env from backend/.env.example..."
        cp backend/.env.example backend/.env
    else
        echo "[*] Creating default backend/.env..."
        cat <<EOF > backend/.env
INDIAN_API_KEY=your_indian_api_key_here
INDIAN_API_BASE_URL=https://stock.indianapi.in
GEMINI_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
EOF
    fi
fi

# 2. Python virtual environment
if [ ! -d ".venv" ]; then
    echo "[*] Creating python virtual environment (.venv)..."
    python3 -m venv .venv || python -m venv .venv
    source .venv/bin/activate
    echo "[*] Installing backend dependencies..."
    pip install --upgrade pip
    pip install -r backend/requirements.txt
else
    source .venv/bin/activate
fi

# 3. Node modules check
if [ ! -d "frontend/node_modules" ]; then
    echo "[*] Installing frontend dependencies..."
    (cd frontend && npm install)
fi

echo "==================================================="
echo "  Starting Backend & Frontend Services...          "
echo "==================================================="

# 4. Launch backend in background
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# 5. Launch frontend
(cd frontend && npm run dev -- --host 127.0.0.1 --port 5173) &
FRONTEND_PID=$!

# 6. Open in default browser
sleep 3
if which xdg-open > /dev/null 2>&1; then
    xdg-open http://127.0.0.1:5173 &
elif which open > /dev/null 2>&1; then
    open http://127.0.0.1:5173 &
fi

echo "QuantLab running at:"
echo " - Frontend: http://127.0.0.1:5173"
echo " - Backend:  http://127.0.0.1:8000"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait

