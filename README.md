# 한판 세계여행

주사위를 굴려 세계 도시를 사고 통행료를 주고받는 보드게임. 컴퓨터와, 휴대폰 하나로 돌아가며, 또는 각자 휴대폰으로 온라인에서 2~4명이 함께 해요.

- 주소: https://2juwon.github.io/world-trip/
- 온라인 서버: https://world-trip.2juwon.workers.dev (Cloudflare Workers + Durable Objects)

## 화면
- 비스듬히 놓인 3D 판 위에 말과 건물이 서 있어요(메뉴에서 '위에서 판 보기'로 평면 전환)
- 주사위 두 개가 판 위로 던져져 튀고 구르다 멈춰요
- 땅을 사면 문서 카드가 뒤집혀 나타나 도장이 찍히고 내 쪽으로 날아와요. 모은 카드는 '여행 카드첩'에서 지역별로 봐요

## 규칙 (원작 보드게임 바탕)
- 40칸: 출발·무인도·사회복지기금 받는 곳·우주여행 모서리, 황금열쇠 6칸, 도시 23곳, 관광지 3곳(제주도·부산·서울), 탈것 3개
- 시작 자금 293만 원, 출발 지나면 월급 20만, 더블이면 한 번 더(세 번이면 무인도 — 설정)
- 도시는 다음에 다시 서면 별장 2채 → 빌딩 → 호텔로 키움(설정으로 산 차례에도)
- 무인도 세 번, 더블이나 무전기로 탈출 / 우주여행: 다음 차례에 원하는 칸으로, 왕복선 주인에게 20만
- 복지기금: 내는 곳 15만, 받는 곳에서 모인 돈 모두
- 돈이 모자라면 은행에 들인 돈의 절반으로 팔아 갚기, 그래도 모자라면 파산(땅은 은행으로)
- 판 길이: 끝까지 / 10·20·30바퀴 / 20·30·45·60분 — 바퀴·시간이 끝나면 총자산(현금+땅+건물 값) 순위

## 구조
- `src/engine.js` 규칙 엔진 `WT` (JSON 상태 + `apply`, 화면용 `viewFor`는 황금열쇠 순서를 가림)
- `src/ai.js` 컴퓨터 `WAI` (느긋한 / 야무진)
- `src/ui.html` 화면 → `node build.js` → `index.html`(Pages, `config.json` 서버 주소) · `dist/world-trip.html`(아티팩트, 컴퓨터와·한 기기로만)
- `server/` 온라인 서버 (Room·Lobby). `main`에 server/·엔진·컴퓨터가 바뀌면 Actions '서버 배포'가 올림 — 저장소 Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 필요

## 시험
- `node test/rules.test.js` 규칙 35개
- `node test/sim.js 200` 컴퓨터끼리
- `python3 test/browser.py dist/world-trip.html` 브라우저 자동 플레이
- `cd server && npx wrangler dev --var FAST_TEST:1` → `node test/online.test.mjs` 온라인 봇 시험 25개
- `npx wrangler dev --var SPEED:0.5` + `SERVER=http://127.0.0.1:8787 node build.js` → `python3 test/online_browser.py index.html` (끝나면 `node build.js`로 되돌리기)
