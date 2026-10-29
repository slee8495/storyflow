#!/bin/bash
# Nightly chapter pregeneration on the operator's Claude subscription. launchd (~/Library/LaunchAgents/
# com.slstudio.storyflow-nightly.plist) runs this at 06:00; it only needs the Mac awake, not an open
# Claude session. src/db/nextJobs.ts picks up to 8 untranslated chapters following the reading plan
# (the app's "Projected order" page — ingesting a book from Gutenberg when its turn comes), then
# `claude -p` (prompt.md) translates and imports them. With nothing left it just says so once.
cd "$(dirname "$0")/../.." || exit 1
export PATH="/Users/stanlee/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
# Headless `claude -p` stops background subagents 10 min after its last turn; translating 4 chapters
# takes longer, so wait for them (the 3-hour perl alarm below is the real ceiling).
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
WORK="$HOME/Library/Caches/storyflow-nightly"
LOG="$WORK/nightly.log"
LOCK="$WORK/.lock"
mkdir -p "$WORK"
log() { echo "$(date '+%m-%d %H:%M') $*" >> "$LOG"; }

if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +240 2>/dev/null)" ]; then rmdir "$LOCK"; mkdir "$LOCK" || exit 0
  else log "already running"; exit 0; fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

BATCH="$WORK/batch-$(date +%Y%m%d-%H%M)"
OUT=$(npx tsx --env-file=.env.local src/db/nextJobs.ts "$BATCH" 8 2>>"$LOG") || { log "nextJobs failed"; exit 1; }
PENDING=$(echo "$OUT" | tail -1)
log "jobs: $PENDING"
if [ "$PENDING" = "ALL_DONE" ]; then
  if [ ! -f "$WORK/.all-done-notified" ]; then
    osascript -e 'display notification "읽을 책 목록의 번역이 모두 끝났어요" with title "Storyflow"' 2>/dev/null
    touch "$WORK/.all-done-notified"
  fi
  exit 0
fi
rm -f "$WORK/.all-done-notified"

# 컨트롤 타워 예산 게이트(10-26 사용자: "Max 주간 한도·맥 부하를 지휘") — 넘기라고 하면 이번 차례는 모델을 부르지 않는다. 타워가 없거나 고장이면 그냥 진행. 상태: ~/.slstudio/tower/STATUS.md
TOWER_GATE="$HOME/.slstudio/tower/gate"; if [ -x "$TOWER_GATE" ] && ! "$TOWER_GATE" storyflow; then log "control tower: skipped this run"; exit 0; fi
PROMPT=$(sed -e "s|{{BATCH_DIR}}|$BATCH|" -e "s|{{PENDING}}|$PENDING|" scripts/nightly/prompt.md)
perl -e 'alarm shift; exec @ARGV' 10800 claude -p "$PROMPT" --model opus --permission-mode acceptEdits \
  --allowedTools "Bash Read Edit Write Grep Glob Agent" >> "$LOG" 2>&1
log "claude exited $?"
find "$WORK" -maxdepth 1 -name 'batch-*' -mtime +14 -exec rm -rf {} +
