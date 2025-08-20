import { ObjectDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// DOM: video/canvas
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
// DOM: camera controls
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
// DOM: info
const statusElement = document.getElementById('status');
const objectCountElement = document.getElementById('objectCount');
const serialStatusElement = document.getElementById('serialStatus');
const selectedCountElement = document.getElementById('selectedCount');
// DOM: serial controls
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const classSelect = document.getElementById('classSelect');

// Object detection state
let objectDetector = undefined;
let runningMode = 'VIDEO';
let isCameraRunning = false;
let mediaStream = null;
let lastVideoTime = -1;
let results = undefined;

// Serial state
let port = null;
let writer = null;
let reader = null;
let readLoopAbortController = null;

// Class count cache for the currently selected class
let selectedClassName = '';
let lastSentCount = null;

// Create detector
async function createObjectDetector() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
  );
  try {
    objectDetector = await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float32/latest/efficientdet_lite2.tflite',
        // delegate: 'CPU',
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

// Populate class select lazily using first detection set, then keep union of seen classes
const knownClasses = new Set();
function ensureClassOptionExists(name) {
  if (!name || knownClasses.has(name)) return;
  knownClasses.add(name);
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  classSelect.appendChild(opt);
}

function drawDetections() {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  const detections = results?.detections ?? [];
  objectCountElement.textContent = `감지된 객체: ${detections.length}`;

  const counts = {};
  for (const det of detections) {
    const cat = det.categories?.[0];
    const name = cat?.categoryName ?? 'object';
    const score = cat?.score ?? 0;
    const b = det.boundingBox;

    // maintain class list
    ensureClassOptionExists(name);

    // count per class
    counts[name] = (counts[name] ?? 0) + 1;

    // draw box
    canvasCtx.strokeStyle = '#00ff88';
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeRect(b.originX, b.originY, b.width, b.height);

    // label bg
    const label = `${name} ${(score * 100).toFixed(1)}%`;
    canvasCtx.font = 'bold 16px Arial';
    const textMetrics = canvasCtx.measureText(label);
    const textW = textMetrics.width + 10;
    const textH = 22;
    canvasCtx.fillStyle = 'rgba(0,0,0,0.6)';
    canvasCtx.fillRect(b.originX, Math.max(0, b.originY - textH), textW, textH);

    // label text
    canvasCtx.fillStyle = '#00ff88';
    canvasCtx.fillText(label, b.originX + 5, Math.max(14, b.originY - 6));
  }
  canvasCtx.restore();

  // Update selected class count badge
  const sel = selectedClassName || classSelect.value || '';
  const currentCount = sel ? counts[sel] ?? 0 : 0;
  selectedClassName = sel;
  selectedCountElement.textContent = `선택 클래스 수: ${currentCount}`;

  // Auto-send if changed
  maybeSendSelectedCount(sel, currentCount);
}

function maybeSendSelectedCount(name, count) {
  if (!name) return;
  if (lastSentCount !== null && lastSentCount === count) return;
  lastSentCount = count;
  sendSerialLine(`${name} : ${count}`);
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

// Serial helpers
function updateSerialUI(connected) {
  connectButton.disabled = connected;
  disconnectButton.disabled = !connected;
  serialStatusElement.textContent = connected ? '시리얼: 연결됨 (9600 bps)' : '시리얼: 연결되지 않음';
}

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
  } catch (err) {
    console.error(err);
    serialStatusElement.textContent = '시리얼: 연결 실패 - ' + err.message;
  }
}

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

async function sendSerialLine(line) {
  if (!writer || !port) return;
  try {
    const encoded = new TextEncoder().encode(line + '\r\n');
    await writer.write(encoded);
  } catch (err) {
    console.error('Write error:', err);
  }
}

async function disconnectSerial() {
  try {
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
  }
}

// Events
startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
connectButton.addEventListener('click', connectSerial);
disconnectButton.addEventListener('click', disconnectSerial);
classSelect.addEventListener('change', () => {
  selectedClassName = classSelect.value || '';
  lastSentCount = null; // force re-send on next frame for new class
});

// Init
window.addEventListener('load', () => {
  canvasElement.width = 1280;
  canvasElement.height = 720;
  drawInitialCanvasMessage();
  updateSerialUI(false);
});

function drawInitialCanvasMessage() {
  canvasCtx.fillStyle = '#f5f5f5';
  canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.font = '30px Arial';
  canvasCtx.fillStyle = '#000000';
  canvasCtx.textAlign = 'center';
  canvasCtx.fillText('카메라를 시작하여 객체를 인식하세요', canvasElement.width / 2, canvasElement.height / 2);
}


