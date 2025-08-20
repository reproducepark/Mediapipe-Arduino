import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// DOM 요소들
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusElement = document.getElementById('status');
const gestureResultElement = document.getElementById('gestureResult');
const gestureConfidenceElement = document.getElementById('gestureConfidence');
const handCountElement = document.getElementById('handCount');
const handednessElement = document.getElementById('handedness');

let gestureRecognizer = undefined;
let runningMode = 'VIDEO';
let isCameraRunning = false;
let mediaStream = null;
let lastVideoTime = -1;
let results = undefined;

// 동작 인식기 생성
async function createGestureRecognizer() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
  );
  
  try {
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 
          'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
        // delegate: 'CPU',
        delegate: 'GPU',
      },
      runningMode,
      numHands: 2, // 최대 2개의 손 감지
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
  } catch (e) {
    console.error('GestureRecognizer 생성 실패', e);
    statusElement.textContent = 'GPU 초기화 실패: 브라우저/WebGL 설정을 확인하세요.';
    throw e;
  }
}

// 손 랜드마크 그리기
function drawLandmarks(landmarks, handedness) {
  const connections = [
    // 엄지
    [0, 1], [1, 2], [2, 3], [3, 4],
    // 검지
    [0, 5], [5, 6], [6, 7], [7, 8],
    // 중지
    [0, 9], [9, 10], [10, 11], [11, 12],
    // 약지
    [0, 13], [13, 14], [14, 15], [15, 16],
    // 새끼
    [0, 17], [17, 18], [18, 19], [19, 20]
  ];

  // 손의 색상 결정 (왼손/오른손)
  const isLeftHand = handedness === 'Left';
  const jointColor = isLeftHand ? '#ff6b6b' : '#4ecdc4';
  const connectionColor = isLeftHand ? '#ff9999' : '#7fdddd';

  // 연결선 그리기
  canvasCtx.strokeStyle = connectionColor;
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  
  for (const [start, end] of connections) {
    const startPoint = landmarks[start];
    const endPoint = landmarks[end];
    canvasCtx.moveTo(startPoint.x * canvasElement.width, startPoint.y * canvasElement.height);
    canvasCtx.lineTo(endPoint.x * canvasElement.width, endPoint.y * canvasElement.height);
  }
  canvasCtx.stroke();

  // 관절점 그리기
  canvasCtx.fillStyle = jointColor;
  for (const landmark of landmarks) {
    canvasCtx.beginPath();
    canvasCtx.arc(
      landmark.x * canvasElement.width, 
      landmark.y * canvasElement.height, 
      4, 
      0, 
      2 * Math.PI
    );
    canvasCtx.fill();
  }
}

// 동작 이름 한국어 변환
function getKoreanGestureName(englishName) {
  const gestureMap = {
    'Closed_Fist': '주먹 쥐기',
    'Open_Palm': '손바닥 펴기',
    'Pointing_Up': '위로 가리키기',
    'Thumb_Up': '엄지 올리기',
    'Thumb_Down': '엄지 내리기',
    'Victory': '브이 사인',
    'ILoveYou': '사랑해 사인',
    'None': '인식 안됨'
  };
  return gestureMap[englishName] || englishName;
}

// 동작 결과 그리기
function drawGestureResults() {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  if (!results) {
    canvasCtx.restore();
    return;
  }

  const { landmarks, worldLandmarks, handednesses, gestures } = results;
  
  // 손 정보 업데이트
  handCountElement.textContent = `감지된 손: ${landmarks.length}`;
  
  // 손잡이 정보 업데이트
  if (handednesses.length > 0) {
    const handednessInfo = handednesses.map((h, index) => 
      `${index + 1}번: ${h[0].categoryName === 'Left' ? '왼손' : '오른손'} (${(h[0].score * 100).toFixed(1)}%)`
    ).join(', ');
    handednessElement.textContent = `손잡이: ${handednessInfo}`;
  } else {
    handednessElement.textContent = '손잡이: 없음';
  }

  // 동작 정보 업데이트
  if (gestures.length > 0 && gestures[0].length > 0) {
    const topGesture = gestures[0][0];
    const koreanName = getKoreanGestureName(topGesture.categoryName);
    gestureResultElement.textContent = koreanName;
    gestureConfidenceElement.textContent = `신뢰도: ${(topGesture.score * 100).toFixed(1)}%`;
    
    // 신뢰도에 따른 색상 변경
    if (topGesture.score > 0.8) {
      gestureResultElement.style.color = '#00ff88';
    } else if (topGesture.score > 0.5) {
      gestureResultElement.style.color = '#ffbb33';
    } else {
      gestureResultElement.style.color = '#ff6b6b';
    }
  } else {
    gestureResultElement.textContent = '없음';
    gestureConfidenceElement.textContent = '신뢰도: 0%';
    gestureResultElement.style.color = '#666666';
  }

  // 손 랜드마크 그리기
  for (let i = 0; i < landmarks.length; i++) {
    const handedness = handednesses[i] ? handednesses[i][0].categoryName : 'Unknown';
    drawLandmarks(landmarks[i], handedness);
  }

  canvasCtx.restore();
}

// 비디오 프레임 처리 (Video Frame Callback 방식)
function predictWebcamVFC(now) {
  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    if (isCameraRunning && typeof videoElement.requestVideoFrameCallback === 'function') {
      videoElement.requestVideoFrameCallback(predictWebcamVFC);
    }
    return;
  }
  
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  
  if (lastVideoTime !== videoElement.currentTime) {
    lastVideoTime = videoElement.currentTime;
    results = gestureRecognizer.recognizeForVideo(videoElement, now);
  }
  
  drawGestureResults();
  
  if (isCameraRunning && typeof videoElement.requestVideoFrameCallback === 'function') {
    videoElement.requestVideoFrameCallback(predictWebcamVFC);
  }
}

// 비디오 프레임 처리 (Request Animation Frame 방식)
function predictWebcamRAF() {
  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    if (isCameraRunning) window.requestAnimationFrame(predictWebcamRAF);
    return;
  }
  
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  const now = performance.now();
  
  if (lastVideoTime !== videoElement.currentTime) {
    lastVideoTime = videoElement.currentTime;
    results = gestureRecognizer.recognizeForVideo(videoElement, now);
  }
  
  drawGestureResults();
  
  if (isCameraRunning) {
    window.requestAnimationFrame(predictWebcamRAF);
  }
}

// 카메라 시작
async function startCamera() {
  if (!gestureRecognizer) {
    statusElement.textContent = '모델 로딩 중...';
    await createGestureRecognizer();
  }
  
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoElement.srcObject = mediaStream;
    
    // 비디오 메타데이터 로딩 대기
    if (!videoElement.readyState || videoElement.readyState < 1) {
      await new Promise((resolve) => {
        const onLoaded = () => { 
          videoElement.removeEventListener('loadedmetadata', onLoaded); 
          resolve(); 
        };
        videoElement.addEventListener('loadedmetadata', onLoaded);
      });
    }
    
    await videoElement.play();
    isCameraRunning = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    statusElement.textContent = '카메라가 실행 중입니다. 손 동작을 보여주세요!';
    statusElement.innerHTML += ' <span class="loading"></span>';
    
    // 브라우저가 지원하는 방식에 따라 프레임 처리 방식 선택
    if (typeof videoElement.requestVideoFrameCallback === 'function') {
      videoElement.requestVideoFrameCallback(predictWebcamVFC);
    } else {
      window.requestAnimationFrame(predictWebcamRAF);
    }
  } catch (e) {
    console.error(e);
    statusElement.textContent = '카메라 접근 실패: 브라우저 권한을 확인하세요.';
  }
}

// 카메라 중지
function stopCamera() {
  isCameraRunning = false;
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  startButton.disabled = false;
  stopButton.disabled = true;
  statusElement.textContent = '카메라를 시작하려면 버튼을 클릭하세요.';
  
  // 정보 초기화
  gestureResultElement.textContent = '없음';
  gestureConfidenceElement.textContent = '신뢰도: 0%';
  handCountElement.textContent = '감지된 손: 0';
  handednessElement.textContent = '손잡이: 없음';
  gestureResultElement.style.color = '#666666';
  
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  drawInitialCanvasMessage();
}

// 이벤트 리스너
startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);

// 페이지 로드 시 초기화
window.addEventListener('load', () => {
  canvasElement.width = 1280;
  canvasElement.height = 720;
  drawInitialCanvasMessage();
});

// 초기 캔버스 메시지
function drawInitialCanvasMessage() {
  canvasCtx.fillStyle = '#f5f5f5';
  canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.font = '30px Arial';
  canvasCtx.fillStyle = '#000000';
  canvasCtx.textAlign = 'center';
  canvasCtx.fillText('카메라를 시작하여 손 동작을 인식하세요', canvasElement.width / 2, canvasElement.height / 2);
}
