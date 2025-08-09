## MediaPipe.js + Arduino Examples

개발환경 구축이 어려운 학생들이 브라우저 엔진을 통해 추론을 하고 아두이노를 조작할 수 있도록 합니다.

- **SimpleHandRecognition**: MediaPipe Tasks Hand Landmarker로 실시간 손 랜드마크(21포인트) 및 스켈레톤 표시
- **SimplePoseRecognition**: MediaPipe Tasks Pose Landmarker로 전신 포즈 랜드마크/스켈레톤 표시 및 라벨 출력 (스무딩 적용)
- **SimpleObjectDetection**: MediaPipe Tasks Object Detector로 실시간 객체 감지(바운딩 박스/라벨)
- **SimpleSerialConsole**: Web Serial API 기반 시리얼 콘솔 (기본 보드레이트 9600bps)
- **SimpleTeachableExample**: Teachable Machine 이미지 모델로 웹캠 프레임 분류, 하단에 클래스별 확률 막대(bar) 표시

### 요구사항
- 최신 브라우저 (Chrome/Edge/Firefox/Safari)
- 카메라 예제: 카메라가 연결된 환경에서 동작
- SimpleSerialConsole: Chrome/Edge(Chromium 계열) 필요, HTTPS 또는 localhost에서만 동작

### 디렉터리 구조
```text
objectDet/
  ├─ SimpleHandRecognition/     # 손 인식 (Hand Landmarker)
  ├─ SimplePoseRecognition/     # 사람 포즈 인식 (Pose Landmarker)
  ├─ SimpleObjectDetection/     # 객체 감지 (Object Detector)
  ├─ SimpleTeachableExample/    # Teachable Machine 이미지 분류 (웹캠 + 확률 막대)
  └─ SimpleSerialConsole/       # Web Serial 콘솔 (9600bps)
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
- 카메라 예제: `http://localhost:8000/SimpleHandRecognition/`, `http://localhost:8000/SimplePoseRecognition/`, `http://localhost:8000/SimpleObjectDetection/`, `http://localhost:8000/SimpleTeachableExample/`
- 시리얼 예제: `http://localhost:8000/SimpleSerialConsole/`

카메라 예제는 `navigator.mediaDevices.getUserMedia` 권한이 필요합니다. 로컬(`localhost`) 또는 HTTPS 환경에서 동작합니다.

모델과 WASM은 CDN에서 로드되므로 인터넷 연결이 필요합니다.

### 참고
- Hand Landmarker: [문서](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- Pose Landmarker: [문서](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker)
- Object Detector: [문서](https://developers.google.com/mediapipe/solutions/vision/object_detector)