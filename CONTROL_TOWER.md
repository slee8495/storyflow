# 컨트롤 타워 (대표님 지시 전달)

> 2026-10-26 사용자: "모든 루프의 Claude 사용량이 수요일 리셋 전에 절대 바닥나지 않게, 맥북도 지키게" — SL Studio 전체를 `claude_usage_control_tower` 가 지휘한다.

- **누가**: launchd `com.slstudio.control-tower` (15분마다, `~/.slstudio/tower/`). 모델을 안 부른다.
- **무엇을 보나**: Claude Max 주간 한도(수 03:59 PT 리셋)·페이블 한도·5시간 세션 한도(`claude -p /usage` 실측), 맥 디스크·메모리·부하, 동시에 도는 `claude -p` 수.
- **지금 상태**: `~/.slstudio/tower/STATUS.md` (모드: normal / conserve / critical / emergency)
- **최우선**: SL Capital U7·U10·U11(VPS). 빠듯하면 맥 루프부터 줄인다.

## 이 레포에서 지킬 것

1. **백그라운드에서 `claude -p` 를 부르는 루프(launchd·cron 스크립트)는 모델 부르기 직전에 게이트를 묻는다.** 타워가 "넘겨"라고 하면 그 차례는 모델 없이 끝낸다. 타워가 없거나 고장이면 그냥 진행(fail-open):
   ```bash
   # 컨트롤 타워 예산 게이트 — 넘기라고 하면 이번 차례는 모델을 부르지 않는다. 타워가 없거나 고장이면 그냥 진행.
   TOWER_GATE="$HOME/.slstudio/tower/gate"; if [ -x "$TOWER_GATE" ] && ! "$TOWER_GATE" <이름>; then exit 0; fi
   ```
   새 루프를 만들면 `claude_usage_control_tower/config.json` 의 `projects` 에 `<이름>` 과 등급(A = 사람이 기다리는 가벼운 일, B = 무거운 연구·배치)을 추가해 달라고 타워 레포에 남긴다.
2. **`TOWER_GATE` 줄을 지우거나 우회하지 않는다.** 줄이 거슬리면 타워 레포(`../claude_usage_control_tower`)에 말한다.
3. 루프 간격·모델을 크게 늘릴 때(예: 5분마다 Opus)는 `~/.slstudio/tower/STATUS.md` 의 모드부터 본다. conserve 이상이면 늘리지 않는다.
4. 레포 안 `*.log` 가 50MB 를 넘기면 타워가 최근 2만 줄만 남기고 줄인다(매일 04시).
5. **크롬을 쓰는 루프는 쓴 뒤 닫는다** (2026-10-28 사용자: "앞으로도 크롬 썼으면 창 닫으라고"). 맥 메모리가 16GB 라 늘 떠 있는 크롬이 맥의 가장 큰 짐이다(스왑이 SSD 를 닳게 함).
   - 그 차례에 연 탭은 끝날 때 닫는다(처음부터 있던 탭은 둔다).
   - **차례가 끝나면 전용 크롬도 닫는다.** 다음 차례에 봇의 `connect()` 가 다시 켜고, 로그인은 전용 프로필 폴더에 남는다:
     ```bash
     # 컨트롤 타워: 차례가 끝나면 전용 크롬을 닫는다(다음 차례에 봇이 다시 켬, 로그인은 프로필에 남음)
     pid=$(/usr/sbin/lsof -ti tcp:<포트> -sTCP:LISTEN 2>/dev/null | head -1); [ -n "$pid" ] && kill "$pid"
     ```
   - **예외**: 사람이 대신 해 줘야 하는 단계(로그인·캡차·2단계 인증·생일 입력 등)에서 멈췄으면 닫지 않고 그대로 둔 채 앱/푸시로 알린다. 사용자가 맥 화면(컨트롤 타워 앱 → Mac → Mac screen)으로 이어서 한다.
   - 전용 크롬 포트: 스미스 9333 · SL Seller 9334 · 브라우니 심부름 9335. 새 크롬 루프는 9336 부터.

## 이 레포의 게이트

| 스크립트 | 게이트 이름 | 등급 |
|---|---|---|
| `scripts/nightly/nightly.sh` | `storyflow` | B — 2026-10-30부터 매일 06:00 다시 돈다(사용자: 읽을 책 목록 하루 8장) |

넣기 전 원본: `~/.slstudio/tower/backup/`. 게이트가 넘기면 그 루프 로그에 `컨트롤 타워: 이번 차례 넘김` 이 남는다.
