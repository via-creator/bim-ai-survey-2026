# 충남건축사회 BIM·AI위원회 2026 통합 수요조사 웹앱

BIM(Revit) 실무교육 및 AI 실무활용 세미나 통합 수요조사 폼입니다. 단일 HTML 페이지에서 응답을 받아, Google Apps Script 엔드포인트로 POST 전송하면 Google Sheets에 자동 기록 및 집계가 됩니다.

---

## 구성

```
.
├── index.html      # 설문 프론트엔드 (단일 파일, 정적 호스팅)
├── Code.gs         # Google Apps Script 백엔드 (Sheets 자동 기록 + 대시보드 갱신)
├── vercel.json     # Vercel 배포 설정 (캐시 무효화 · SPA 라우팅)
├── .gitignore
└── README.md
```

### 데이터 흐름

```
[브라우저: index.html]
      │  fetch POST  (text/plain;charset=utf-8 · CORS-safe)
      ▼
[Apps Script /exec 엔드포인트: Code.gs]
      │
      ▼
[Google Sheets]
   ├ 원본응답         (전체 응답 row)
   ├ 참여자명단       (제출일시·성함·사무소·지역·연락처)
   └ 집계대시보드     (총응답수 · 자가진단 평균 · 라이선스 비율 · 분포)
```

---

## Apps Script URL 교체 위치

`index.html` 하단 `<script>` 블록의 `ENDPOINT` 상수를 본인의 Apps Script 웹 앱 `/exec` URL로 교체합니다.

```js
// index.html 약 906번째 줄
const ENDPOINT = 'https://script.google.com/macros/s/.................../exec';
```

### Apps Script 배포 방법

1. https://script.google.com 접속 → 새 프로젝트
2. `Code.gs` 내용을 그대로 붙여넣기
3. 상단 `SPREADSHEET_ID` 상수를 사용하실 Google Sheets 문서 ID로 교체
4. **배포 → 새 배포 → 유형: 웹 앱**
   - 실행 사용자: **나**
   - 액세스 권한: **모든 사용자**
5. 발급된 `https://script.google.com/macros/s/.../exec` URL 을 복사
6. `index.html` 의 `ENDPOINT` 값에 붙여넣기 후 커밋

> **주의** Apps Script 코드를 수정한 뒤에는 반드시 **새 배포** 또는 **기존 배포 관리 → 새 버전 게시**를 해야 변경 사항이 적용됩니다.

---

## Vercel 배포 방법

### A. GitHub 연동 (권장)

1. https://vercel.com 접속 후 GitHub 계정으로 로그인
2. **Add New → Project → Import Git Repository**
3. `via-creator/bim-ai-survey-2026` 선택
4. **Framework Preset: Other** (자동 감지) · 빌드 명령 없음 · Output Directory 기본값
5. **Deploy** 클릭 → 1~2분 후 `https://<프로젝트명>.vercel.app` 발급
6. 이후 `git push` 시 자동 재배포

### B. Vercel CLI

```bash
npm i -g vercel
cd C:\bim-ai-survey-2026
vercel login
vercel           # 미리보기 배포
vercel --prod    # 프로덕션 배포
```

### 캐시 정책

`vercel.json` 에서 `Cache-Control: no-store, no-cache, must-revalidate` 로 응답하므로, **수정 후 push → 재배포** 시 즉시 최신 버전이 모든 사용자에게 반영됩니다(브라우저·CDN 캐시 우회).

---

## 로컬 미리보기

별도 빌드 없이 정적 HTML이므로 `index.html` 더블클릭으로도 열리지만, fetch 호출이 `file://` 에서는 차단되므로 **간이 서버**로 띄우길 권장합니다.

```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .
```

브라우저에서 `http://localhost:8080` 접속.

---

## 운영 체크리스트

- [ ] Google Sheets ID 확인 (Code.gs `SPREADSHEET_ID`)
- [ ] Apps Script `/exec` URL 발급 및 `index.html` `ENDPOINT` 반영
- [ ] Apps Script 권한 승인 (최초 실행 시 1회)
- [ ] Vercel 배포 후 실제 폼에서 테스트 응답 1건 제출 → 시트 3개 자동 생성 확인
- [ ] 모바일(360~430px) 폼 동작 확인
- [ ] 응답 마감 후 `참여자명단` 시트로 사전 안내 발송 대상 확정

---

## 라이선스 / 운영

© 2026 ARCHIVIA. 충청남도건축사회 BIM·AI위원회. 외부 재배포 금지.
