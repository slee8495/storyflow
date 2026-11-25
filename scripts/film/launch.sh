#!/bin/bash
# Installed copy lives at ~/.slstudio/storyflow-film/launch.sh (launchd com.slstudio.storyflow-film,
# every 4 hours: 03 07 11 15 19 23시). Keeps the loop's own clone of the repo at origin/main (or the
# film branch until it's merged) so the loop never depends on — or disturbs — the working copy.
export PATH="/Users/stanlee/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
BASE="$HOME/.slstudio/storyflow-film"
REPO="$BASE/repo"
mkdir -p "$BASE/logs"
if [ ! -d "$REPO/.git" ]; then git clone -q https://github.com/slee8495/storyflow.git "$REPO" || exit 1; fi
cd "$REPO" || exit 1
git fetch -q origin
REF=origin/main
git cat-file -e origin/main:scripts/film/film.ts 2>/dev/null || REF=origin/worktree-chapter-film
OLD_LOCK=$(git rev-parse -q HEAD:package-lock.json 2>/dev/null)
git checkout -q --detach "$REF" || exit 1
[ -d node_modules ] && [ "$OLD_LOCK" = "$(git rev-parse -q HEAD:package-lock.json)" ] || npm ci --silent >> "$BASE/logs/film.log" 2>&1
cp /Users/stanlee/SLStudio/storyflow/.env.local .env.local
# Storyflow has no Blob store of its own yet, so films go to Wordflow's (public) store under
# storyflow-films/ — unless the storyflow env already carries its own token.
if ! grep -q '^BLOB_READ_WRITE_TOKEN=' .env.local; then
  grep '^BLOB_READ_WRITE_TOKEN=' /Users/stanlee/SLStudio/wordflow/.env.local >> .env.local
fi
exec /bin/bash scripts/film/film.sh
