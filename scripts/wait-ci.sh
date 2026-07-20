#!/usr/bin/env bash
# wait-ci.sh — блокирует пока последний GitHub Actions run для указанного
# коммита (по умолчанию HEAD) не завершится. Возвращает exit 0 при success,
# exit 1 при failure/cancelled/timed_out.
#
# Использование (после `git push`):
#   bash scripts/wait-ci.sh
# или для конкретного коммита:
#   bash scripts/wait-ci.sh <sha>
#
# Требования: curl. gh CLI не нужен — публичный read-only API GitHub'а.
#
# Правило для Claude Code: после каждого `git push origin main` вызывать
# эту команду. Не отдавать управление владельцу пока не зелёный. Если
# красный — сразу читать логи через тот же API, чинить, репушить.

set -euo pipefail

REPO="${GITHUB_REPO:-antonbillionaire/staffix}"
SHA="${1:-$(git rev-parse HEAD)}"
API="https://api.github.com/repos/${REPO}/actions/runs?head_sha=${SHA}&per_page=1"
DEADLINE=$(( SECONDS + 600 ))  # 10 минут максимум

echo "[wait-ci] Watching CI for ${REPO}@${SHA:0:7}..."

# Небольшая пауза перед первым poll — GitHub обычно создаёт run через 2-5 сек.
sleep 8

while [ $SECONDS -lt $DEADLINE ]; do
  RESP=$(curl -s -H "Accept: application/vnd.github+json" "$API")
  STATUS=$(echo "$RESP" | node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      try {
        const r = JSON.parse(s).workflow_runs?.[0];
        if (!r) { console.log('none'); return; }
        console.log(r.status + '|' + (r.conclusion || 'null') + '|' + r.html_url);
      } catch { console.log('parse-error'); }
    });
  ")

  IFS='|' read -r RUN_STATUS CONCLUSION URL <<< "$STATUS"

  if [ "$RUN_STATUS" = "none" ]; then
    echo "[wait-ci] No run yet for this commit, waiting..."
  elif [ "$RUN_STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
      echo "[wait-ci] ✅ CI GREEN — $URL"
      exit 0
    else
      echo "[wait-ci] ❌ CI FAILED (conclusion=$CONCLUSION) — $URL"
      exit 1
    fi
  else
    echo "[wait-ci] status=$RUN_STATUS ($(date +%H:%M:%S))..."
  fi

  sleep 15
done

echo "[wait-ci] ⚠️ Timed out after 10 minutes"
exit 2
