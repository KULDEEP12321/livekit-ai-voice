#!/usr/bin/env bash
# Show status of the voice agent + dashboard.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Find the agent log wherever it lives (start.sh writes to logs/, manual runs often use /tmp/).
AGENT_LOG=""
for candidate in "$ROOT/logs/agent.log" "/tmp/agent.log"; do
    if [ -s "$candidate" ]; then
        AGENT_LOG="$candidate"
        break
    fi
done

echo "=== agent ==="
pgrep -af "agent\.py start" | grep -v grep | head -1 || echo "  not running"

echo
echo "=== dashboard ==="
pgrep -af "next-server" | grep -v grep | head -1 || echo "  not running"

echo
echo "=== last agent log lines (${AGENT_LOG:-none}) ==="
if [ -n "$AGENT_LOG" ]; then
    grep -E '"registered worker"|ERROR|Exception' "$AGENT_LOG" 2>/dev/null | tail -3
else
    echo "  no log yet"
fi

echo
echo "=== /api/calls health (10s timeout) ==="
curl -sS -m 10 http://localhost:3000/api/calls 2>&1 | head -c 300
echo
