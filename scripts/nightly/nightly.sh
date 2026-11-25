#!/bin/bash
# Nightly chapter pregeneration on the operator's Claude subscription. launchd (~/Library/LaunchAgents/
# com.slstudio.storyflow-nightly.plist) runs this at 06:00; it only needs the Mac awake, not an open
# Claude session. Two jobs, both up to 8 chapters a day:
# - translation: src/db/nextJobs.ts picks untranslated chapters following the reading plan (the
#   app's "Projected order" page — ingesting a book from Gutenberg when its turn comes), then
#   `claude -p` (prompt.md) translates and imports them.
# - pictures (2026-11-24): scripts/pictures/pictures.ts draws photoreal scene pictures for the
#   chapters from where the operator is reading up to the end of the NEXT book, then rests until
#   they catch up. Images are drawn locally (mflux); Claude only writes the prompts.
# With nothing left in either it just says so once.
# 2026-11-25: translation, like pictures, only covers the current + next plan book (src/lib/translationWindow.ts).
cd "$(dirname "$0")/../.." || exit 1
export PATH="/Users/stanlee/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
# Headless `claude -p` stops background subagents 10 min after its last turn; translating 4 chapters
# takes longer, so wait for them (the 3-hour with_timeout below is the real ceiling).
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
WORK="$HOME/Library/Caches/storyflow-nightly"
LOG="$WORK/nightly.log"
LOCK="$WORK/.lock"
mkdir -p "$WORK"
# Time limit that kills the whole process tree. `perl -e 'alarm shift; exec @ARGV'` only killed
# npx and left tsx/node (and the mflux it spawned) running past the ceiling (2026-11-25).
with_timeout() {
  perl -e '$t = shift; $p = fork; if (!$p) { setpgrp(0, 0); exec @ARGV or exit 127 }
    $SIG{ALRM} = sub { kill "TERM", -$p; sleep 10; kill "KILL", -$p; $to = 1 };
    alarm $t; waitpid($p, 0); exit($to ? 124 : $? >> 8)' "$@"
}
log() { echo "$(date '+%m-%d %H:%M') $*" >> "$LOG"; }

if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +300 2>/dev/null)" ]; then rmdir "$LOCK"; mkdir "$LOCK" || exit 0
  else log "already running"; exit 0; fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

BATCH="$WORK/batch-$(date +%Y%m%d-%H%M)"
OUT=$(npx tsx --env-file=.env.local src/db/nextJobs.ts "$BATCH" 8 2>>"$LOG") || { log "nextJobs failed"; exit 1; }
PENDING=$(echo "$OUT" | tail -1)
log "jobs: $PENDING"
PICS=$(npx tsx --env-file=.env.local scripts/pictures/pictures.ts --plan 2>>"$LOG")
PICS_TODO=$(echo "$PICS" | grep -c "^todo ")
log "pictures: $PICS_TODO to draw $(echo "$PICS" | grep '^REST' || true)"

if [ "$PENDING" = "ALL_DONE" ] && [ "$PICS_TODO" = "0" ]; then
  if [ ! -f "$WORK/.all-done-notified" ]; then
    osascript -e 'display notification "지금 책·다음 책까지 번역·그림 끝 — 다음 책으로 넘어가면 다시 시작해요" with title "Storyflow"' 2>/dev/null
    touch "$WORK/.all-done-notified"
  fi
  exit 0
fi
rm -f "$WORK/.all-done-notified"

# Claude 로그인 토큰(2026-11-10) — 키체인 로그인이 끊겨도 루프가 돈다. 파일이 없으면 그대로.
if [ -f "$HOME/.slstudio/claude_env" ]; then . "$HOME/.slstudio/claude_env"; fi
# 컨트롤 타워 예산 게이트(10-26 사용자: "Max 주간 한도·맥 부하를 지휘") — 넘기라고 하면 이번 차례는 모델을 부르지 않는다. 타워가 없거나 고장이면 그냥 진행. 상태: ~/.slstudio/tower/STATUS.md
TOWER_GATE="$HOME/.slstudio/tower/gate"; if [ -x "$TOWER_GATE" ] && ! "$TOWER_GATE" storyflow; then log "control tower: skipped this run"; exit 0; fi

# Pictures run alongside the translation (one is the Mac's GPU, the other mostly waiting on Claude).
# Wordflow's 02:00 film loop uses the same image model — let it finish first (up to an hour).
if [ "$PICS_TODO" != "0" ]; then
  (
    for _ in $(seq 60); do [ -d "$HOME/.slstudio/wordflow-film/.lock" ] || break; sleep 60; done
    with_timeout 14400 npx tsx --env-file=.env.local scripts/pictures/pictures.ts >> "$LOG" 2>&1
    log "pictures exited $?"
  ) &
fi

if [ "$PENDING" != "ALL_DONE" ]; then
  PROMPT=$(sed -e "s|{{BATCH_DIR}}|$BATCH|" -e "s|{{PENDING}}|$PENDING|" scripts/nightly/prompt.md)
  with_timeout 10800 claude -p "$PROMPT" --model opus --permission-mode acceptEdits \
    --allowedTools "Bash Read Edit Write Grep Glob Agent" >> "$LOG" 2>&1
  log "claude exited $?"
fi
wait
find "$WORK" -maxdepth 1 -name 'batch-*' -mtime +14 -exec rm -rf {} +
