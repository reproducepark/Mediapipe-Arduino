import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// DOM 요소 가져오기
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusElement = document.getElementById('status');
const handCountElement = document.getElementById('handCount');

let handLandmarker = undefined;
let runningMode = 'IMAGE';
let isCameraRunning = false;
let lastVideoTime = -1;
let results = undefined;
let mediaStream = null;

async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode,
    numHands: 2,
  });
}

function drawHandLabel(landmark, label) {
  const x = landmark.x * canvasElement.width;
  const y = landmark.y * canvasElement.height - 20;
  canvasCtx.font = 'bold 16px Arial';
  canvasCtx.fillStyle = '#00ff88';
  canvasCtx.strokeStyle = '#000000';
  canvasCtx.lineWidth = 3;
  canvasCtx.strokeText(label, x, y);
  canvasCtx.fillText(label, x, y);
}

function drawConnections(landmarks) {
  canvasCtx.strokeStyle = '#00ff88';
  canvasCtx.lineWidth = 3;
  for (const connection of HAND_CONNECTIONS) {
    const start = landmarks[connection[0]];
    const end = landmarks[connection[1]];
    canvasCtx.beginPath();
    canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
    canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
    canvasCtx.stroke();
  }
}

function drawLandmarks(landmarks) {
  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];
    const x = landmark.x * canvasElement.width;
    const y = landmark.y * canvasElement.height;
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 6, 0, 2 * Math.PI);
    if (i === 0) {
      canvasCtx.fillStyle = '#ff0066';
    } else if ([4, 8, 12, 16, 20].includes(i)) {
      canvasCtx.fillStyle = '#ffd700';
    } else {
      canvasCtx.fillStyle = '#ffffff';
    }
    canvasCtx.fill();
    canvasCtx.strokeStyle = '#000000';
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
  }
}

function renderDetections() {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
  const handCount = results && results.landmarks ? results.landmarks.length : 0;
  handCountElement.textContent = `감지된 손: ${handCount}`;
  if (results && results.landmarks) {
    for (let i = 0; i < results.landmarks.length; i++) {
      const landmarks = results.landmarks[i];
      const handedness = results.handednesses?.[i]?.[0]?.categoryName;
      const label = handedness === 'Left' ? 'Right' : handedness === 'Right' ? 'Left' : '';
      if (landmarks[0] && label) {
        drawHandLabel(landmarks[0], label);
      }
      drawConnections(landmarks);
      drawLandmarks(landmarks);
    }
  }
  canvasCtx.restore();
}

async function predictWebcam() {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  if (runningMode === 'IMAGE') {
    runningMode = 'VIDEO';
    await handLandmarker.setOptions({ runningMode: 'VIDEO' });
  }
  const nowMs = performance.now();
  if (lastVideoTime !== videoElement.currentTime) {
    lastVideoTime = videoElement.currentTime;
    results = handLandmarker.detectForVideo(videoElement, nowMs);
  }
  renderDetections();
  if (isCameraRunning) {
    window.requestAnimationFrame(predictWebcam);
  }
}

async function startCamera() {
  if (!handLandmarker) {
    statusElement.textContent = '모델 로딩 중...';
    await createHandLandmarker();
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoElement.srcObject = mediaStream;
    await videoElement.play();
    isCameraRunning = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    statusElement.textContent = '카메라가 실행 중입니다. 손을 카메라에 보여주세요!';
    statusElement.innerHTML += ' <span class="loading"></span>';
    window.requestAnimationFrame(predictWebcam);
  } catch (e) {
    console.error(e);
    statusElement.textContent = '카메라 접근 실패: 브라우저 권한을 확인하세요.';
  }
}

function stopCamera() {
  isCameraRunning = false;
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  startButton.disabled = false;
  stopButton.disabled = true;
  statusElement.textContent = '카메라를 시작하려면 버튼을 클릭하세요.';
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  drawInitialCanvasMessage();
}

startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);

window.addEventListener('load', () => {
  canvasElement.width = 1280;
  canvasElement.height = 720;
  drawInitialCanvasMessage();
});

function drawInitialCanvasMessage() {
  canvasCtx.fillStyle = '#f5f5f5';
  canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.font = '30px Arial';
  canvasCtx.fillStyle = '#000000';
  canvasCtx.textAlign = 'center';
  canvasCtx.fillText('카메라를 시작하여 손을 인식하세요', canvasElement.width / 2, canvasElement.height / 2);
}
