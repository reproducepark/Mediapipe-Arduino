## MediaPipe.js + Arduino Examples

개발환경 구축이 어려운 학생들이 브라우저 엔진을 통해 추론을 하고 아두이노를 조작할 수 있도록 합니다.

- **SimpleHandRecognition**: MediaPipe Tasks Hand Landmarker로 실시간 손 랜드마크(21포인트) 및 스켈레톤 표시
- **SimplePoseRecognition**: MediaPipe Tasks Pose Landmarker로 전신 포즈 랜드마크/스켈레톤 표시 및 라벨 출력 (스무딩 적용)
- **SimpleObjectDetection**: MediaPipe Tasks Object Detector로 실시간 객체 감지(바운딩 박스/라벨)
- **SimpleGestureRecognition**: MediaPipe Tasks Gesture Recognizer로 실시간 손 동작 인식 (7가지 동작 + 손 랜드마크 표시)
- **SimpleSerialConsole**: Web Serial API 기반 시리얼 콘솔 (기본 보드레이트 9600bps)
- **SimpleTeachableExample**: Teachable Machine 이미지 모델로 웹캠 프레임 분류, 하단에 클래스별 확률 막대(bar) 표시
- **SimpleObjectDetectionSerial**: 객체 감지 + 시리얼 통합. 드롭다운에서 전송할 클래스를 선택하면 해당 클래스의 개수를 "Classname : 3" 형식으로 9600bps로 전송
- **SimpleGestureRecognitionSerial**: 손 동작 인식 + 시리얼 통합. 인식된 동작, 손 개수, 손잡이 정보를 선택 가능한 모드로 9600bps로 전송
- **SimpleTeachableSerial**: Teachable Machine 이미지 분류 + 시리얼 통합. 가장 높은 확률의 클래스 라벨을 9600bps로 자동 전송 (클래스가 바뀔 때만 전송)

### 요구사항
- 최신 브라우저 (Chrome/Edge/Firefox/Safari)
- 카메라 예제: 카메라가 연결된 환경에서 동작
 - SimpleSerialConsole, SimpleObjectDetectionSerial: Chrome/Edge(Chromium 계열) 필요, HTTPS 또는 localhost에서만 동작

### 디렉터리 구조
```text
objectDet/
  ├─ SimpleHandRecognition/     # 손 인식 (Hand Landmarker)
  ├─ SimplePoseRecognition/     # 사람 포즈 인식 (Pose Landmarker)
  ├─ SimpleObjectDetection/     # 객체 감지 (Object Detector)
  ├─ SimpleGestureRecognition/  # 손 동작 인식 (Gesture Recognizer)
  ├─ SimpleObjectDetectionSerial/ # 객체 감지 + 시리얼 전송 통합
  ├─ SimpleGestureRecognitionSerial/ # 손 동작 인식 + 시리얼 전송 통합
  ├─ SimpleTeachableExample/    # Teachable Machine 이미지 분류 (웹캠 + 확률 막대)
  ├─ SimpleTeachableSerial/     # Teachable Machine + 시리얼 통합
  └─ SimpleSerialConsole/       # Web Serial 콘솔 (9600bps)
```

### SimpleSerialConsole 사용법
1. 로컬 서버를 띄운 뒤 브라우저에서 `http://localhost:8000/SimpleSerialConsole/` 접속 (아래 Python 예시 참고)
2. 상단의 "시리얼 연결" 버튼을 눌러 포트를 선택하면 기본 보드레이트 9600bps로 연결됩니다
3. 입력창에 보낼 텍스트를 적고 `Enter` 또는 `전송` 버튼으로 송신
4. `No EOL / LF / CRLF` 줄바꿈 옵션 선택 가능 (기본: CRLF)
5. 수신 데이터는 하단 로그에 실시간 표시, `로그 지우기`로 클리어

주의: Web Serial API는 Chrome/Edge에서만 지원되며, HTTPS 페이지 또는 `localhost`에서만 동작합니다.

### SimpleGestureRecognition 사용법
1. 로컬 서버 실행 후 브라우저에서 `http://localhost:8000/SimpleGestureRecognition/` 접속
2. "카메라 시작"을 눌러 웹캠을 켭니다.
3. 손을 카메라에 보여주면 다음과 같이 표시됩니다:
   - 실시간 손 랜드마크 (21개 관절점)과 연결선
   - 인식된 동작 이름 (한국어)
   - 동작 신뢰도 (퍼센트)
   - 감지된 손의 개수 및 손잡이 정보 (왼손/오른손)
4. 인식 가능한 7가지 동작: 주먹 쥐기, 손바닥 펴기, 위로 가리키기, 엄지 올리기, 엄지 내리기, 브이 사인, 사랑해 사인

### SimpleGestureRecognitionSerial 사용법
1. 로컬 서버 실행 후 브라우저에서 `http://localhost:8000/SimpleGestureRecognitionSerial/` 접속
2. "카메라 시작"을 눌러 웹캠을 켭니다.
3. "시리얼 연결"을 눌러 포트를 선택하면 9600bps로 연결됩니다.
4. 전송 설정을 선택할 수 있습니다:
   - **전송 모드**: 동작만 / 손 개수 / 손잡이 정보 / 모든 정보
   - **동작 필터**: 모든 동작 / 고신뢰도만 (80%+) / 특정 동작만
5. 설정에 따라 다음 형식으로 자동 전송됩니다:
   - 동작만: `GESTURE:Thumb_Up:85`
   - 손 개수: `HANDS:2`
   - 손잡이: `HANDEDNESS:Left:90,Right:95`
   - 모든 정보: `ALL:G:Thumb_Up:85:H:2:HD:Left:90,Right:95`

주의: Web Serial API 제약(Chromium/HTTPS/localhost)은 여기에도 동일하게 적용됩니다.

### SimpleObjectDetectionSerial 사용법
1. 로컬 서버 실행 후 브라우저에서 `http://localhost:8000/SimpleObjectDetectionSerial/` 접속
2. "카메라 시작"을 눌러 웹캠을 켭니다. 화면에 객체가 보이면 감지/라벨이 표시됩니다.
3. "시리얼 연결"을 눌러 포트를 선택하면 9600bps로 연결됩니다.
4. 드롭다운에서 전송할 클래스를 선택합니다. 감지된 클래스가 나타날 때 자동으로 목록에 추가됩니다.
5. 선택된 클래스의 개수가 변할 때마다 자동으로 `Classname : 3` 형식으로 CRLF(`\r\n`)를 포함해 송신됩니다.

주의: Web Serial API 제약(Chromium/HTTPS/localhost)은 여기에도 동일하게 적용됩니다.

### 간단한 웹서버 실행 (Python)
프로젝트 루트(`objectDet/`)에서 아래 명령을 실행하세요.

macOS / Linux (Python 3):
```bash
python3 -m http.server 8000
```

Windows (Python):
```bash
python -m http.server 8000
```

그 후 브라우저에서 다음 주소로 접속합니다.
- 카메라 예제: `http://localhost:8000/SimpleHandRecognition/`, `http://localhost:8000/SimplePoseRecognition/`, `http://localhost:8000/SimpleObjectDetection/`, `http://localhost:8000/SimpleGestureRecognition/`, `http://localhost:8000/SimpleTeachableExample/`
- 시리얼 예제: `http://localhost:8000/SimpleSerialConsole/`
- 통합 예제: `http://localhost:8000/SimpleObjectDetectionSerial/`, `http://localhost:8000/SimpleGestureRecognitionSerial/`, `http://localhost:8000/SimpleTeachableSerial/`

카메라 예제는 `navigator.mediaDevices.getUserMedia` 권한이 필요합니다. 로컬(`localhost`) 또는 HTTPS 환경에서 동작합니다.

모델과 WASM은 CDN에서 로드되므로 인터넷 연결이 필요합니다.

### 참고
- Hand Landmarker: [문서](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- Pose Landmarker: [문서](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker)
- Object Detector: [문서](https://developers.google.com/mediapipe/solutions/vision/object_detector)
- Gesture Recognizer: [문서](https://developers.google.com/mediapipe/solutions/vision/gesture_recognizer)

### SimpleTeachableSerial 사용법
1. 로컬 서버 실행 후 브라우저에서 `http://localhost:8000/SimpleTeachableSerial/` 접속
2. "카메라 시작"을 눌러 웹캠을 켭니다. 하단에 클래스별 확률 막대가 표시됩니다.
3. "시리얼 연결"을 눌러 포트를 선택하면 9600bps로 연결됩니다.
4. 분류 결과의 최상위(가장 높은 확률) 클래스 라벨이 바뀔 때마다 자동으로 해당 라벨이 CRLF(`\r\n`)를 포함해 송신됩니다.
   - 예: `cat` → `dog`로 바뀌면, `dog\r\n` 전송
   - 동일 라벨이 유지되면 중복 전송을 방지합니다.