#!/usr/bin/env bash
# Start the voice agent + dashboard in the background.
# Safe to run from any directory.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT}/logs"
mkdir -p "$LOG_DIR"

echo "▶ Project root: $ROOT"

# 1. Agent
if pgrep -f "agent\.py start" > /dev/null; then
    echo "  agent     already running (skipping)"
else
    nohup "$ROOT/venv/bin/python" "$ROOT/agent.py" start \
        > "$LOG_DIR/agent.log" 2>&1 &
    disown
    echo "  agent     started → $LOG_DIR/agent.log"
fi

# 2. Dashboard
if pgrep -f "next-server" > /dev/null; then
    echo "  dashboard already running (skipping)"
else
    cd "$ROOT/dashboard"
    nohup npm run dev > "$LOG_DIR/dashboard.log" 2>&1 &
    disown
    echo "  dashboard started → $LOG_DIR/dashboard.log"
fi

echo
echo "✔ Done. Open http://localhost:3000"
echo "  Tail logs:  tail -f $LOG_DIR/agent.log $LOG_DIR/dashboard.log"
echo "  Stop all:   $ROOT/stop.sh"
