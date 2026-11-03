# POWER CHART AND BACKTEST

강력한 차트 + 매달 장마감가로 사는 적립식 백테스트. Market Board와 같은 어두운 화면·큰 글씨·전체화면.
기획서: [SPEC.md](SPEC.md) · **작업 현황(어디까지 했나): [STATUS.md](STATUS.md)** · 해마다 할 일·경제 자료 출처: [MAINTENANCE.md](MAINTENANCE.md)

## 받기·새 버전으로 바꾸기
- 이 저장소의 **Releases**에서 `POWER-CHART-AND-BACKTEST.exe`를 받는다. 설치 없이 EXE 하나로 켜진다. WebView2 필요 — Win11·최신 Win10 기본
- 새 버전: **앱을 끄고 EXE만 새것으로 바꿔 켜면 끝.** 차트 데이터·관심종목·그린 것·키는 EXE가 아니라 `%APPDATA%\power-chart-and-backtest`와 Windows 자격 증명 관리자에 있어서 그대로 남는다 (차트를 다시 받지 않아도 된다)
- 서명이 없는 EXE라 "Windows의 PC 보호" 창이 뜨면 "추가 정보 → 실행"

## 쓰기
- 프로그램은 **EXE 하나** (이 PC들에서는 `release\POWER CHART AND BACKTEST.exe`, 바탕화면 바로가기도 이것). 버전은 창 제목·⚙ 설정 맨 위, 바뀐 것은 [CHANGELOG.md](CHANGELOG.md)
- 다른 PC로: `release\읽어보기.txt` (EXE + "💾 백업 만들기"로 생긴 폴더 두 개만 가져가면 된다)
- 처음 켜면 관심종목 일봉을 상장일부터 받아 `%APPDATA%\power-chart-and-backtest\market.db`에 쌓는다. 그다음부터는 빠진 부분만 이어 받는다 (🔄 버튼으로도)
- 미국 주식 분봉: ⚙ 설정 → 데이터 → 알파카 키 입력 (Windows 자격 증명 관리자에만 저장, 파일·로그에 남지 않음)
- 어디서 받는지: 차트 머리줄 오른쪽 표시(예: `Alpaca 실시간`, `Yahoo 15분 늦음`, `BTC 24h`)에 마우스를 올리면 현재가·일봉·분봉 출처가 나온다
- 바이낸스 코인 차트(BTC 등)는 처음에 봉마다 최근 4,500개만 받는다 (5분봉 보름치). 차트를 왼쪽 끝까지 밀면 그 앞을 더 받아 온다 (1.3.0). 한 번에 많이 보려면 **📥 2년치 받기**: 5분·15분봉을 밀어 받으면 뜨는 알림, 또는 ⚙ 설정 → 데이터 → "📥 차트 봉 2년씩 받기" (보기 ▾에서 바로 감). 5분·15분·30분·1시간·4시간봉을 같은 날짜까지 받고, 누를 때마다 2년씩 더 (1분봉은 안 받음). 국내 주식은 토스 키가 있으면 토스 1분봉으로 약 4년까지
- 장 밖에도 실시간으로 보고 싶으면: 종목 찾기에서 주식 바로 밑 `↳ … 24시간 실시간`(Binance·Hyperliquid 무기한선물)을 고른다. 코인(BTC-USD 등)은 자동으로 Binance로 연다
- 국내 실시간: Market Board에 토스 키가 있으면 같은 키·토큰을 같이 써서 장중 현재가·최근 1분봉을 토스로 받는다 (두 앱이 서로 끊지 않음, 다른 PC가 가져가면 Yahoo로 대신)
- 미국 실시간: 알파카 키가 있으면 보이는 미국 종목(최대 30개)의 체결을 웹소켓으로 받는다 (시세 전용 `stream.data.alpaca.markets`)
- CSV 가져오기: 일봉 CSV 파일(Yahoo·Investing)을 창에 끌어다 놓기
- 그리기: 도구를 한 번 고르면 계속 그린다(🔁 계속 그리기, 기본 켬). 그냥 누르면 점, 누른 채 끌면 차트가 앞뒤로 움직인다(붓만 끌면 그려짐). 우클릭·Esc = 그리던 것 취소 → 한 번 더 = 그만
- 상태 줄: `🏦 FOMC 날짜 (예상 동결, 직전 인상)` · `📈 CPI 날짜 (예상 3.8%, 직전 3.7%)`. 금리는 뉴욕 연준, FOMC 예상은 그 주면 ForexFactory 시장 예상·아니면 금리 선물(FedWatch 방식), CPI는 클리블랜드 연준(실제 값·예측)·그 주면 시장 예상. 마우스를 올리면 자세히. 한 달에 한 번 나오는 자료라 **켤 때(받은 지 하루 넘었으면)·🔄 누를 때·발표 직후 한 번**만 받는다 (금리·선물·일정은 켜 둔 채면 하루 한 번, 클리블랜드는 일주일에 한 번)
- 차트의 FOMC 표시는 기본 꺼짐, 실적일은 켜짐 → `보기 ▾`에서 바로 켜고 끈다 (FOMC 날짜는 연준 홈페이지 일정에서 일주일마다 자동으로 받는다. CPI 발표일은 노동통계국이 프로그램 접속을 막아서 `web/core/events.js`의 표(2026·2027, 백악관 OMB 일정표 PDF에서) + 발표 주 ForexFactory — 표가 끝나면 "N월 중순"으로 표시)
- 다른 PC로 옮기기: ⚙ 설정 → 데이터 → `💾 백업 만들기` → 생긴 `POWER-CHART-날짜` 폴더를 새 PC의 **EXE와 같은 폴더**에 두고 처음 켜면 자동으로 가져온다(데이터가 이미 있으면 덮어쓰지 않음). 어디에 있든 `📂 파일에서 가져오기`로 그 폴더의 market.db를 골라도 된다. 키는 새 PC에서 다시 넣기

| 파일 | 내용 |
|---|---|
| `%APPDATA%\power-chart-and-backtest\config.json` | 관심종목·화면 구성·지표·알림·백테스트 조건 |
| `%APPDATA%\power-chart-and-backtest\drawings.json` | 그린 것 (종목마다) |
| `%APPDATA%\power-chart-and-backtest\market.db` | 받은 봉·분할·배당 |
| `%APPDATA%\power-chart-and-backtest\logs\app.log` | 기록 (키 같은 값은 지움) |
| `사진\POWER CHART\` | 📷 차트 캡처 |
| `문서\POWER CHART\` | 백테스트 CSV |
| `문서\POWER CHART\백업\` | 다른 PC로 옮길 백업 (market.db·config.json·drawings.json) |

## 단축키
| 키 | 하는 일 |
|---|---|
| 글자·숫자 입력 / `/` | 종목 찾기 (SOXL, MU, 삼성, 247540, ㅅㅅ…). 숫자 하나(1~8)만 치고 Enter = 그 봉으로 |
| `Alt+1`~`Alt+8` | 1분 5분 15분 30분 1시간 4시간 일 주 (1.3.0에 30분봉이 들어와 Alt+4부터 한 칸씩 밀림) |
| `↑` `↓` | 관심종목 위·아래 (차트 화면에서) |
| `Ctrl+I` | 지표 |
| `Ctrl+B` | 차트 ↔ 백테스트 |
| `Ctrl+,` | 설정 |
| `Ctrl+G` | 📅 날짜로 가기 |
| `Alt+M` / Shift+끌기 | 📏 구간 측정 |
| `Alt+L` | 로그 눈금 켜고 끄기 |
| `Alt+T` `Alt+I` `Alt+H` `Alt+J` `Alt+F` `Alt+G` `Alt+A` `Alt+B` `Alt+X` | 추세선·인포선·수평선·수평 반직선·피보나치·삼각수렴·앵커드 VWAP·붓·글자 |
| `Delete` | 선택한 그림 지우기 |
| `Esc` | 그리던 것 취소 → 그리기 그만 → 선택 풀기 → 측정 끄기 → 칸 크게 보기 풀기 (그리는 중엔 우클릭도 같음) |
| `Space` `→` `Shift+→` | ▶ 리플레이 중 재생/멈춤 · 보는 봉 하나 앞으로 (1시간봉이면 1시간) · 1분만 앞으로 |
| `Ctrl+클릭` | 분할 화면 칸 여러 개 고르기 (지표 맞추기·날짜로 가기) · 칸 이름 줄 끌기 = 자리 바꾸기 |
| `Tab` | 관심종목 접기 |
| `F11` | 전체화면 |
| `Ctrl +` `Ctrl −` `Ctrl 0` | 글씨 크기 |

## 개발
- 화면은 번들러 없는 ES 모듈(`web/`). lightweight-charts v5.2.1은 `web/vendor`에 들어 있다
- 브라우저로 개발: `python tools/devserver.py 5180` → http://localhost:5180 (Rust 명령을 파이썬으로 흉내, 데이터는 `tools/dev-data/`. 알파카는 안 씀)
- 시험: http://localhost:5180/tests/test.html (지표가 교과서·TradingView 정의와 같은지, 백테스트가 손계산과 센트 단위까지 같은지)
- 백테스트 손계산 따로 확인: `python tools/verify_backtest.py tools/dev-data/market.db`
- EXE 만들기: `cd src-tauri` → `cargo tauri build --no-bundle`
- Rust 시험: `cd src-tauri` → `cargo test --release`
- **새 지표 넣기** (예: 1.1.0 RSI 다이버전스): 계산은 `web/indicators/calc.js`(순수 함수 + `web/tests/tests.js`에 시험), 그리는 법은 `web/indicators/index.js`의 `INDICATORS`에 한 칸 + `ORDER`에 이름, 설명은 `web/indicators/explain.js`. 화면 파일은 EXE 안에 들어가므로 **EXE를 다시 만들어야** 프로그램에 나온다. 다른 PC는 새 EXE 하나만 바꾸면 된다 (설정·차트 데이터는 PC마다 `%APPDATA%`에 따로 있어서 그대로)

## 안전
- 주문 기능 없음. 알파카는 Rust의 허용 목록 관문으로만 (GET, `data.alpaca.markets`, 정해진 경로만). 주문·계좌 주소는 코드에 없다
- 키는 Windows 자격 증명 관리자에만. 화면·파일·로그에 키가 나오지 않는다
