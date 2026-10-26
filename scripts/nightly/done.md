[Storyflow 새벽 번역 — 끝남. nightly.sh 가 두 책 모두 남은 챕터 0 을 확인하고 한 번만 실행한다.]

1. PushNotification 도구가 있으면 한국어로 짧게 "안나 카레니나·삼국지 번역 완료" 를 보낸다.
2. docs/project-context.md 의 'Pregeneration on the operator's Claude subscription' 항목에 "안나 카레니나·삼국지 전 챕터 생성 완료 ({{TODAY}})" 한 줄을 추가한다.
3. 그 파일만 커밋하고 push 한다. src/lib/speak.ts 의 미커밋 WIP 는 절대 커밋하지 않는다(`git add docs/project-context.md` 만). 커밋 메시지 끝에:

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
