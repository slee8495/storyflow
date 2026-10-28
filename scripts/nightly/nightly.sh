#!/bin/bash
# Nightly chapter pregeneration on the operator's Claude subscription. launchd (~/Library/LaunchAgents/
# com.slstudio.storyflow-nightly.plist) runs this at 02:47; it only needs the Mac awake, not an open
# Claude session. Exports pending jobs, hands up to 8 to `claude -p` (prompt.md), and when nothing is
# left runs done.md once and unloads itself.
cd "$(dirname "$0")/../.." || exit 1
export PATH="/Users/stanlee/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
# Headless `claude -p` stops background subagents 10 min after its last turn; translating 4 chapters
# takes longer, so wait for them (the 3-hour perl alarm below is the real ceiling).
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
WORK="$HOME/Library/Caches/storyflow-nightly"
LOG="$WORK/nightly.log"
LOCK="$WORK/.lock"
PLIST="$HOME/Library/LaunchAgents/com.slstudio.storyflow-nightly.plist"
mkdir -p "$WORK"
log() { echo "$(date '+%m-%d %H:%M') $*" >> "$LOG"; }

if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +240 2>/dev/null)" ]; then rmdir "$LOCK"; mkdir "$LOCK" || exit 0
  else log "already running"; exit 0; fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

BATCH="$WORK/batch-$(date +%Y%m%d-%H%M)"
PENDING=""; TOTAL=0
for slug in anna-karenina samgukji; do
  mkdir -p "$BATCH/$slug"
  OUT=$(npx tsx --env-file=.env.local src/db/exportPending.ts "$slug" "$BATCH/$slug" 2>&1) || { log "export $slug failed: $OUT"; exit 1; }
  N=$(echo "$OUT" | sed -n 's/^exported \([0-9]*\) jobs.*/\1/p')
  [ -z "$N" ] && { log "export $slug: unexpected output: $OUT"; exit 1; }
  TOTAL=$((TOTAL + N)); PENDING="$PENDING $slug=$N"
done
log "pending:$PENDING"

# 컨트롤 타워 예산 게이트(10-26 사용자: "Max 주간 한도·맥 부하를 지휘") — 넘기라고 하면 이번 차례는 모델을 부르지 않는다. 타워가 없거나 고장이면 그냥 진행. 상태: ~/.slstudio/tower/STATUS.md
TOWER_GATE="$HOME/.slstudio/tower/gate"; if [ -x "$TOWER_GATE" ] && ! "$TOWER_GATE" storyflow; then log "control tower: skipped this run"; exit 0; fi
if [ "$TOTAL" -eq 0 ]; then
  PROMPT=$(sed "s/{{TODAY}}/$(date +%Y-%m-%d)/" scripts/nightly/done.md)
  claude -p "$PROMPT" --model opus --permission-mode acceptEdits \
    --allowedTools "Bash Read Edit Write Grep Glob PushNotification" >> "$LOG" 2>&1
  osascript -e 'display notification "안나 카레니나·삼국지 번역 완료" with title "Storyflow"' 2>/dev/null
  log "all done — unloading launchd job"
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null
  exit 0
fi

PROMPT=$(sed -e "s|{{BATCH_DIR}}|$BATCH|" -e "s|{{PENDING}}|$PENDING|" scripts/nightly/prompt.md)
perl -e 'alarm shift; exec @ARGV' 10800 claude -p "$PROMPT" --model opus --permission-mode acceptEdits \
  --allowedTools "Bash Read Edit Write Grep Glob Agent" >> "$LOG" 2>&1
log "claude exited $?"
find "$WORK" -maxdepth 1 -name 'batch-*' -mtime +14 -exec rm -rf {} +
