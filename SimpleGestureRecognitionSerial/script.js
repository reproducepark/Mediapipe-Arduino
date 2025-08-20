import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// DOM 요소들 - 비디오/캔버스
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');

// DOM 요소들 - 카메라 컨트롤
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');

// DOM 요소들 - 정보 표시
const statusElement = document.getElementById('status');
const gestureResultElement = document.getElementById('gestureResult');
const gestureConfidenceElement = document.getElementById('gestureConfidence');
const handCountElement = document.getElementById('handCount');
const handednessElement = document.getElementById('handedness');

// DOM 요소들 - 시리얼 컨트롤
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const transmitModeSelect = document.getElementById('transmitMode');
const gestureFilterSelect = document.getElementById('gestureFilter');
const specificGestureSelect = document.getElementById('specificGesture');

// DOM 요소들 - 시리얼 정보
const serialStatusElement = document.getElementById('serialStatus');
const lastSentElement = document.getElementById('lastSent');
const transmitCountElement = document.getElementById('transmitCount');

// 동작 인식 상태
let gestureRecognizer = undefined;
let runningMode = 'VIDEO';
let isCameraRunning = false;
let mediaStream = null;
let lastVideoTime = -1;
let results = undefined;

// 시리얼 통신 상태
let port = null;
let writer = null;
let reader = null;
let readLoopAbortController = null;

// 전송 상태 관리
let lastSentData = '';
let transmitCount = 0;
let lastGestureData = null;
let currentGestureData = null;
let currentHandData = null;
let serialTransmitInterval = null;

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
      numHands: 2,
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
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20]
  ];

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

// 시리얼 데이터 생성
function createSerialData(gestureData, handData) {
  const mode = transmitModeSelect.value;
  const filter = gestureFilterSelect.value;
  const specificGesture = specificGestureSelect.value;
  
  // 동작 필터링
  let shouldTransmitGesture = false;
  let gestureInfo = '';
  
  if (gestureData && gestureData.name !== 'None') {
    const confidence = Math.round(gestureData.confidence * 100);
    
    if (filter === 'all') {
      shouldTransmitGesture = true;
    } else if (filter === 'highConfidence' && confidence >= 80) {
      shouldTransmitGesture = true;
    } else if (filter === 'specific' && gestureData.name === specificGesture) {
      shouldTransmitGesture = true;
    }
    
    if (shouldTransmitGesture) {
      gestureInfo = `${gestureData.name}:${confidence}`;
    }
  }
  
  // 전송 모드에 따른 데이터 생성
  switch (mode) {
    case 'gesture':
      return shouldTransmitGesture ? `${gestureInfo}` : '';
      
    case 'handCount':
      return `HANDS:${handData.count}`;
      
    case 'handedness':
      if (handData.handedness.length > 0) {
        const handednessInfo = handData.handedness.map(h => 
          `${h.name}:${Math.round(h.confidence * 100)}`
        ).join(',');
        return `HANDEDNESS:${handednessInfo}`;
      }
      return '';
      
    case 'all':
      const parts = [];
      if (shouldTransmitGesture && gestureInfo) {
        parts.push(`G:${gestureInfo}`);
      }
      parts.push(`H:${handData.count}`);
      if (handData.handedness.length > 0) {
        const handednessInfo = handData.handedness.map(h => 
          `${h.name}:${Math.round(h.confidence * 100)}`
        ).join(',');
        parts.push(`HD:${handednessInfo}`);
      }
      return parts.length > 0 ? `ALL:${parts.join(':')}` : '';
      
    default:
      return '';
  }
}

// 동작 결과 그리기 및 시리얼 전송
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
  const handData = {
    count: landmarks.length,
    handedness: []
  };
  
  if (handednesses.length > 0) {
    const handednessInfo = handednesses.map((h, index) => {
      const handInfo = {
        name: h[0].categoryName,
        confidence: h[0].score
      };
      handData.handedness.push(handInfo);
      return `${index + 1}번: ${h[0].categoryName === 'Left' ? '왼손' : '오른손'} (${(h[0].score * 100).toFixed(1)}%)`;
    }).join(', ');
    handednessElement.textContent = `손잡이: ${handednessInfo}`;
  } else {
    handednessElement.textContent = '손잡이: 없음';
  }

  // 동작 정보 업데이트
  let gestureData = null;
  if (gestures.length > 0 && gestures[0].length > 0) {
    const topGesture = gestures[0][0];
    const koreanName = getKoreanGestureName(topGesture.categoryName);
    gestureResultElement.textContent = koreanName;
    gestureConfidenceElement.textContent = `신뢰도: ${(topGesture.score * 100).toFixed(1)}%`;
    
    gestureData = {
      name: topGesture.categoryName,
      confidence: topGesture.score,
      koreanName: koreanName
    };
    
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
  
  // 현재 데이터 저장 (1초마다 전송하기 위해)
  currentGestureData = gestureData;
  currentHandData = handData;
}

// 1초마다 시리얼 데이터 전송 처리
function transmitSerialDataPeriodically() {
  if (!writer || !port) return;
  
  // 현재 데이터가 없으면 전송하지 않음
  if (!currentGestureData && !currentHandData) return;
  
  const serialData = createSerialData(currentGestureData, currentHandData);
  if (!serialData) return;
  
  // 중복 전송 방지 (동일한 데이터는 전송하지 않음)
  if (serialData === lastSentData) return;
  
  lastSentData = serialData;
  sendSerialLine(serialData);
  
  // UI 업데이트
  transmitCount++;
  lastSentElement.textContent = `마지막 전송: ${serialData}`;
  transmitCountElement.textContent = `전송 횟수: ${transmitCount}`;
}

// 시리얼 전송 타이머 시작
function startSerialTransmitTimer() {
  if (serialTransmitInterval) {
    clearInterval(serialTransmitInterval);
  }
  serialTransmitInterval = setInterval(transmitSerialDataPeriodically, 1000); // 1초마다 실행
}

// 시리얼 전송 타이머 중지
function stopSerialTransmitTimer() {
  if (serialTransmitInterval) {
    clearInterval(serialTransmitInterval);
    serialTransmitInterval = null;
  }
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

// 시리얼 UI 업데이트
function updateSerialUI(connected) {
  connectButton.disabled = connected;
  disconnectButton.disabled = !connected;
  serialStatusElement.textContent = connected ? '시리얼: 연결됨 (9600 bps, 1초 간격 전송)' : '시리얼: 연결되지 않음';
}

// 시리얼 연결
async function connectSerial() {
  if (!('serial' in navigator)) {
    alert('이 브라우저는 Web Serial API를 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.');
    return;
  }
  
  try {
    serialStatusElement.textContent = '시리얼: 포트 선택 대기 중...';
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    writer = port.writable.getWriter();
    
    readLoopAbortController = new AbortController();
    startReadLoop(readLoopAbortController.signal);
    updateSerialUI(true);
    
    // 1초 간격 전송 타이머 시작
    startSerialTransmitTimer();
    
    // 연결 성공 메시지 전송
    sendSerialLine('GESTURE_RECOGNITION_READY');
  } catch (err) {
    console.error(err);
    serialStatusElement.textContent = '시리얼: 연결 실패 - ' + err.message;
  }
}

// 시리얼 읽기 루프
async function startReadLoop(abortSignal) {
  try {
    reader = port.readable.getReader();
    const decoder = new TextDecoder();
    while (!abortSignal.aborted) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      console.log('[Serial RX]', decoder.decode(value));
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.error('Read error:', err);
  } finally {
    try { reader?.releaseLock(); } catch (_) {}
  }
}

// 시리얼 라인 전송
async function sendSerialLine(line) {
  if (!writer || !port) return;
  try {
    const encoded = new TextEncoder().encode(line + '\r\n');
    await writer.write(encoded);
    console.log('[Serial TX]', line);
  } catch (err) {
    console.error('Write error:', err);
  }
}

// 시리얼 연결 해제
async function disconnectSerial() {
  try {
    // 전송 타이머 중지
    stopSerialTransmitTimer();
    
    readLoopAbortController?.abort();
    try { reader?.cancel(); } catch (_) {}
    try { reader?.releaseLock(); } catch (_) {}
    try { writer?.releaseLock(); } catch (_) {}
    await port?.close();
  } catch (err) {
    console.error('Disconnect error:', err);
  } finally {
    reader = null;
    writer = null;
    port = null;
    updateSerialUI(false);
    lastSentData = '';
    lastSentElement.textContent = '마지막 전송: 없음';
    currentGestureData = null;
    currentHandData = null;
  }
}

// 이벤트 리스너
startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
connectButton.addEventListener('click', connectSerial);
disconnectButton.addEventListener('click', disconnectSerial);

// 시리얼 설정 변경 이벤트
gestureFilterSelect.addEventListener('change', () => {
  const isSpecific = gestureFilterSelect.value === 'specific';
  specificGestureSelect.disabled = !isSpecific;
  lastSentData = ''; // 필터 변경 시 중복 전송 방지 초기화
});

transmitModeSelect.addEventListener('change', () => {
  lastSentData = ''; // 전송 모드 변경 시 중복 전송 방지 초기화
});

specificGestureSelect.addEventListener('change', () => {
  lastSentData = ''; // 특정 동작 변경 시 중복 전송 방지 초기화
});

// 페이지 로드 시 초기화
window.addEventListener('load', () => {
  canvasElement.width = 1280;
  canvasElement.height = 720;
  drawInitialCanvasMessage();
  updateSerialUI(false);
  transmitCountElement.textContent = '전송 횟수: 0';
  lastSentElement.textContent = '마지막 전송: 없음';
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
