## MediaPipe.js 교육용 예시 모음

웹 브라우저에서 카메라를 활용해 손/사람을 인식해보는 간단한 교육용 예시를 모아두었습니다. Google MediaPipe의 웹용 라이브러리(미디어파이프 JS)를 사용합니다.

- **SimpleHandRecognition**: MediaPipe Hands로 실시간 손 랜드마크(21포인트)와 스켈레톤을 표시
- **SimplePeopleRecognition**: MediaPipe Pose로 전신 포즈 랜드마크와 스켈레톤을 표시 및 라벨 출력

### 요구사항
- 최신 브라우저 (Chrome/Edge/Firefox/Safari)
- 카메라가 연결된 환경에서 동작

### 디렉터리 구조
```text
mpExample/
  ├─ SimpleHandRecognition/   # 손 인식 예시 (Hands)
  └─ SimplePeopleRecognition/ # 사람 포즈 인식 예시 (Pose)
```

### 참고
- MediaPipe Hands: [Link](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- MediaPipe Pose: [Link](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker)

