import { ObjectDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// DOM
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusElement = document.getElementById('status');
const objectCountElement = document.getElementById('objectCount');

let objectDetector = undefined;
let runningMode = 'VIDEO';
let isCameraRunning = false;
let mediaStream = null;
let lastVideoTime = -1;
let results = undefined;

async function createObjectDetector() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
  );
  try {
    objectDetector = await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float32/latest/efficientdet_lite2.tflite',
          // 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite',
        delegate: 'GPU',
      },
      scoreThreshold: 0.5,
      runningMode,
      maxResults: 5,
    });
  } catch (e) {
    console.error('GPU delegate 생성 실패', e);
    statusElement.textContent = 'GPU 초기화 실패: 브라우저/WebGL 설정을 확인하세요.';
    throw e;
  }
}

function drawDetections() {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  const detections = results?.detections ?? [];
  objectCountElement.textContent = `감지된 객체: ${detections.length}`;

  for (const det of detections) {
    const cat = det.categories?.[0];
    const name = cat?.categoryName ?? 'object';
    const score = cat?.score ?? 0;
    const b = det.boundingBox; // {originX, originY, width, height}

    // 상자
    canvasCtx.strokeStyle = '#00ff88';
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeRect(b.originX, b.originY, b.width, b.height);

    // 라벨 배경
    const label = `${name} ${(score * 100).toFixed(1)}%`;
    canvasCtx.font = 'bold 16px Arial';
    const textMetrics = canvasCtx.measureText(label);
    const textW = textMetrics.width + 10;
    const textH = 22;
    canvasCtx.fillStyle = 'rgba(0,0,0,0.6)';
    canvasCtx.fillRect(b.originX, Math.max(0, b.originY - textH), textW, textH);

    // 라벨 텍스트
    canvasCtx.fillStyle = '#00ff88';
    canvasCtx.fillText(label, b.originX + 5, Math.max(14, b.originY - 6));
  }
  canvasCtx.restore();
}

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
    results = objectDetector.detectForVideo(videoElement, now);
  }
  drawDetections();
  if (isCameraRunning && typeof videoElement.requestVideoFrameCallback === 'function') {
    videoElement.requestVideoFrameCallback(predictWebcamVFC);
  }
}

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
    results = objectDetector.detectForVideo(videoElement, now);
  }
  drawDetections();
  if (isCameraRunning) {
    window.requestAnimationFrame(predictWebcamRAF);
  }
}

async function startCamera() {
  if (!objectDetector) {
    statusElement.textContent = '모델 로딩 중...';
    await createObjectDetector();
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoElement.srcObject = mediaStream;
    // 메타데이터가 로드되어 실제 영상 크기를 알 때까지 대기
    if (!videoElement.readyState || videoElement.readyState < 1) {
      await new Promise((resolve) => {
        const onLoaded = () => { videoElement.removeEventListener('loadedmetadata', onLoaded); resolve(); };
        videoElement.addEventListener('loadedmetadata', onLoaded);
      });
    }
    await videoElement.play();
    isCameraRunning = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    statusElement.textContent = '카메라가 실행 중입니다. 객체를 카메라에 보여주세요!';
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
  objectCountElement.textContent = '감지된 객체: 0';
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
  canvasCtx.fillText('카메라를 시작하여 객체를 인식하세요', canvasElement.width / 2, canvasElement.height / 2);
}


