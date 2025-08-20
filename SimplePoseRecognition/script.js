import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// DOM 요소 가져오기
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusElement = document.getElementById('status');
const peopleCountElement = document.getElementById('peopleCount');

let poseLandmarker = undefined;
let runningMode = 'VIDEO';
let isCameraRunning = false;
let mediaStream = null;
let lastVideoTime = -1;
let results = undefined;
let smoothedLandmarks = null;
const SMOOTHING_ALPHA = 0.7; // 높을수록 더 부드럽게(느리게) 반응

const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30],
  [29, 31], [30, 32], [27, 31], [28, 32]
];

const KEY_POINTS = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

async function createPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
      // delegate: 'CPU',
      delegate: 'GPU',
    },
    runningMode,
    numPoses: 1,
    minPoseDetectionConfidence: 0.6,
    minPosePresenceConfidence: 0.6,
    minTrackingConfidence: 0.7,
  });
}

function drawPersonLabel(noseLandmark) {
  const x = noseLandmark.x * canvasElement.width;
  const y = noseLandmark.y * canvasElement.height - 50;
  canvasCtx.font = 'bold 20px Arial';
  canvasCtx.fillStyle = '#00ff88';
  canvasCtx.strokeStyle = '#000000';
  canvasCtx.lineWidth = 3;
  canvasCtx.strokeText('Person', x - 30, y);
  canvasCtx.fillText('Person', x - 30, y);
}

function drawConnections(landmarks) {
  canvasCtx.strokeStyle = '#00ff88';
  canvasCtx.lineWidth = 4;
  for (const connection of POSE_CONNECTIONS) {
    const start = landmarks[connection[0]];
    const end = landmarks[connection[1]];
    if ((start.visibility ?? 1) < 0.3 || (end.visibility ?? 1) < 0.3) continue;
    canvasCtx.globalAlpha = Math.min(start.visibility ?? 1, end.visibility ?? 1);
    canvasCtx.beginPath();
    canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
    canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
    canvasCtx.stroke();
  }
  canvasCtx.globalAlpha = 1.0;
}

function drawLandmarks(landmarks) {
  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];
    if ((landmark.visibility ?? 1) < 0.3) continue;
    const x = landmark.x * canvasElement.width;
    const y = landmark.y * canvasElement.height;
    canvasCtx.globalAlpha = landmark.visibility ?? 1;
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 8, 0, 2 * Math.PI);
    if (i === KEY_POINTS.nose) {
      canvasCtx.fillStyle = '#ff0066';
    } else if ([KEY_POINTS.leftShoulder, KEY_POINTS.rightShoulder, KEY_POINTS.leftHip, KEY_POINTS.rightHip].includes(i)) {
      canvasCtx.fillStyle = '#ffd700';
    } else if ([KEY_POINTS.leftWrist, KEY_POINTS.rightWrist, KEY_POINTS.leftAnkle, KEY_POINTS.rightAnkle].includes(i)) {
      canvasCtx.fillStyle = '#ff6b6b';
    } else {
      canvasCtx.fillStyle = '#ffffff';
    }
    canvasCtx.fill();
    canvasCtx.strokeStyle = '#000000';
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
  }
  canvasCtx.globalAlpha = 1.0;
}

function renderDetections() {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
  const numPoses = results && results.landmarks ? results.landmarks.length : 0;
  peopleCountElement.textContent = `감지된 사람: ${numPoses}`;
  if (results && results.landmarks && results.landmarks[0]) {
    const current = results.landmarks[0];
    if (!smoothedLandmarks) {
      smoothedLandmarks = current.map((p) => ({ ...p }));
    } else {
      for (let i = 0; i < current.length; i++) {
        smoothedLandmarks[i].x = SMOOTHING_ALPHA * smoothedLandmarks[i].x + (1 - SMOOTHING_ALPHA) * current[i].x;
        smoothedLandmarks[i].y = SMOOTHING_ALPHA * smoothedLandmarks[i].y + (1 - SMOOTHING_ALPHA) * current[i].y;
        if (typeof current[i].z === 'number') {
          smoothedLandmarks[i].z = SMOOTHING_ALPHA * (smoothedLandmarks[i].z ?? current[i].z) + (1 - SMOOTHING_ALPHA) * current[i].z;
        }
        if (typeof current[i].visibility === 'number') {
          smoothedLandmarks[i].visibility = SMOOTHING_ALPHA * (smoothedLandmarks[i].visibility ?? current[i].visibility) + (1 - SMOOTHING_ALPHA) * current[i].visibility;
        }
      }
    }
    drawConnections(smoothedLandmarks);
    drawLandmarks(smoothedLandmarks);
    if (smoothedLandmarks[0]) drawPersonLabel(smoothedLandmarks[0]);
  }
  canvasCtx.restore();
}

async function predictWebcamRAF() {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  const nowMs = performance.now();
  if (lastVideoTime !== videoElement.currentTime) {
    lastVideoTime = videoElement.currentTime;
    results = poseLandmarker.detectForVideo(videoElement, nowMs);
  }
  renderDetections();
  if (isCameraRunning) {
    window.requestAnimationFrame(predictWebcamRAF);
  }
}

function predictWebcamVFC(now) {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  if (lastVideoTime !== videoElement.currentTime) {
    lastVideoTime = videoElement.currentTime;
    results = poseLandmarker.detectForVideo(videoElement, now);
  }
  renderDetections();
  if (isCameraRunning && typeof videoElement.requestVideoFrameCallback === 'function') {
    videoElement.requestVideoFrameCallback(predictWebcamVFC);
  }
}

async function startCamera() {
  if (!poseLandmarker) {
    statusElement.textContent = '모델 로딩 중...';
    await createPoseLandmarker();
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoElement.srcObject = mediaStream;
    await videoElement.play();
    isCameraRunning = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    statusElement.textContent = '카메라가 실행 중입니다. 전신이 보이도록 카메라에서 떨어져 서세요!';
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

function stopCamera() {
  isCameraRunning = false;
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  startButton.disabled = false;
  stopButton.disabled = true;
  statusElement.textContent = '카메라를 시작하려면 버튼을 클릭하세요.';
  peopleCountElement.textContent = '감지된 사람: 0';
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  drawInitialCanvasMessage();
  smoothedLandmarks = null;
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
  canvasCtx.fillText('카메라를 시작하여 사람을 인식하세요', canvasElement.width / 2, canvasElement.height / 2);
}
