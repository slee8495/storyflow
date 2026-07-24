# Storyflow

개인 프로젝트. 읽고 싶었지만 원문이 두껍거나 늘어져서 완주하기 힘들었던 소설/대하 서사시를,
Claude가 쉽고 재미있는 이야기체로 다시 풀어써서 매일 조금씩 듣고 읽을 수 있게 해주는 앱.
[Wordflow](../wordflow)(성경 통독 앱)와 같은 폴더(`SL Studio`)의 자매 프로젝트로, 같은
"원문 → Claude 리라이팅 → 커서 기반 진도" 파이프라인을 소설에 적용한다.

전체 배경, 법적 스코프(개인 전용 — 배포/공유/수익화 금지), 후보 도서 목록, 아키텍처 계획은
[`docs/project-context.md`](docs/project-context.md) 참고. 이 문서 하나로 새 레포/새 세션에서도
이어서 작업할 수 있게 정리해둠.

## Status

아이디어 스코핑 완료, 첫 작품으로 **삼국지** 선정. 앱 + 인프라(Vercel + Neon Postgres) + 원문
120회 전체 인제스트까지 다 끝났고, 실제 DB에 챕터 1을 Claude로 직접 생성해서 파이프라인
전체(생성 → 캐싱 → 재조회)를 확인함. Next.js + Drizzle, Wordflow에서 그대로 가져온 TTS/오디오
스택, 이름 기반 로그인, Library/책/챕터 리딩 페이지, 설정(UI 언어/글씨 크기), Safari PWA 지원.
이번 스코프에서 남은 작업은 없음 — 이후는 다 새로운 요청 기준. 자세한 내용은
[`docs/project-context.md`](docs/project-context.md) 참고.
