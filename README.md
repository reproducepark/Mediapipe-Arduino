## MediaPipe.js 교육용 예시 모음 (+ Web Serial 예제)

웹 브라우저에서 카메라를 활용해 손/사람을 인식해보는 간단한 교육용 예시와, Web Serial API 기반의 시리얼 콘솔 예제를 포함합니다.

- **SimpleHandRecognition**: MediaPipe Hands로 실시간 손 랜드마크(21포인트)와 스켈레톤을 표시
- **SimplePeopleRecognition**: MediaPipe Pose로 전신 포즈 랜드마크와 스켈레톤을 표시 및 라벨 출력
- **SimpleSerialConsole**: Web Serial API 기반 시리얼 콘솔 (기본 보드레이트 9600bps)

### 요구사항
- 최신 브라우저 (Chrome/Edge/Firefox/Safari)
- 카메라 예제: 카메라가 연결된 환경에서 동작
- SimpleSerialConsole: Chrome/Edge(Chromium 계열) 필요, HTTPS 또는 localhost에서만 동작

### 디렉터리 구조
```text
objectDet/
  ├─ SimpleHandRecognition/    # 손 인식 예시 (Hands)
  ├─ SimplePeopleRecognition/  # 사람 포즈 인식 예시 (Pose)
  └─ SimpleSerialConsole/      # Web Serial 콘솔 (9600bps)
```

### SimpleSerialConsole 사용법
1. 로컬 서버를 띄운 뒤 브라우저에서 `http://localhost:8000/SimpleSerialConsole/` 접속 (아래 Python 예시 참고)
2. 상단의 "시리얼 연결" 버튼을 눌러 포트를 선택하면 기본 보드레이트 9600bps로 연결됩니다
3. 입력창에 보낼 텍스트를 적고 `Enter` 또는 `전송` 버튼으로 송신
4. `No EOL / LF / CRLF` 줄바꿈 옵션 선택 가능 (기본: CRLF)
5. 수신 데이터는 하단 로그에 실시간 표시, `로그 지우기`로 클리어

주의: Web Serial API는 Chrome/Edge에서만 지원되며, HTTPS 페이지 또는 `localhost`에서만 동작합니다.

### 간단한 웹서버 실행 (Python)
프로젝트 루트(`objectDet/`)에서 아래 명령을 실행하세요.

macOS / Linux (Python 3):
```bash
python3 -m http.server 8000
```

Windows (Python launcher):
```bash
py -m http.server 8000
```

그 후 브라우저에서 다음 주소로 접속합니다.
- 카메라 예제: `http://localhost:8000/SimpleHandRecognition/`, `http://localhost:8000/SimplePeopleRecognition/`
- 시리얼 예제: `http://localhost:8000/SimpleSerialConsole/`

### 참고
- MediaPipe Hands: [Link](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- MediaPipe Pose: [Link](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker)

