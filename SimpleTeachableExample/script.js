const MODEL_URL = "https://teachablemachine.withgoogle.com/models/0eNpRibO2/";

let model = null;
let maxPredictions = 0;
let webcam = null;
let mediaStream = null;
let isRunning = false;

const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusElement = document.getElementById('status');
const predictionsContainer = document.getElementById('predictions');

async function loadModel() {
  const modelURL = MODEL_URL + "model.json";
  const metadataURL = MODEL_URL + "metadata.json";
  model = await window.tmImage.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();
}

function buildPredictionRows() {
  predictionsContainer.innerHTML = "";
  for (let i = 0; i < maxPredictions; i += 1) {
    const row = document.createElement('div');
    row.className = 'prediction-row';

    const label = document.createElement('div');
    label.className = 'prediction-label';
    label.textContent = '-';

    const bar = document.createElement('div');
    bar.className = 'prediction-bar';
    const barFill = document.createElement('div');
    barFill.className = 'prediction-bar-fill';
    bar.appendChild(barFill);

    const score = document.createElement('div');
    score.className = 'prediction-score';
    score.textContent = '0.00';

    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(score);
    predictionsContainer.appendChild(row);
  }
}

function updatePredictionRows(prediction) {
  const rows = predictionsContainer.querySelectorAll('.prediction-row');
  for (let i = 0; i < prediction.length; i += 1) {
    const { className, probability } = prediction[i];
    const row = rows[i];
    const label = row.querySelector('.prediction-label');
    const barFill = row.querySelector('.prediction-bar-fill');
    const score = row.querySelector('.prediction-score');

    label.textContent = className;
    const pct = Math.round(probability * 100);
    barFill.style.width = `${pct}%`;
    score.textContent = probability.toFixed(2);
  }
}

function drawVideoToCanvas() {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
}

async function predictLoop() {
  if (!isRunning) return;
  drawVideoToCanvas();
  const prediction = await model.predict(canvasElement);
  updatePredictionRows(prediction);
  window.requestAnimationFrame(predictLoop);
}

async function start() {
  try {
    startButton.disabled = true;
    statusElement.textContent = '모델 로딩 중...';
    if (!model) {
      await loadModel();
    }
    statusElement.textContent = '카메라 접근 중...';
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoElement.srcObject = mediaStream;
    await videoElement.play();

    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;

    buildPredictionRows();
    statusElement.textContent = '실행 중입니다. 아래에서 예측 결과를 확인하세요.';
    statusElement.innerHTML += ' <span class="loading"></span>';

    isRunning = true;
    stopButton.disabled = false;
    window.requestAnimationFrame(predictLoop);
  } catch (err) {
    console.error(err);
    statusElement.textContent = '시작 실패: 브라우저 권한 또는 환경을 확인하세요.';
    startButton.disabled = false;
  }
}

function stop() {
  isRunning = false;
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  stopButton.disabled = true;
  startButton.disabled = false;
  statusElement.textContent = '카메라를 시작하려면 버튼을 클릭하세요.';
}

startButton.addEventListener('click', start);
stopButton.addEventListener('click', stop);

window.addEventListener('load', () => {
  canvasElement.width = 1280;
  canvasElement.height = 720;
  // 초기 배경
  canvasCtx.fillStyle = '#f5f5f5';
  canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.font = '30px Arial';
  canvasCtx.fillStyle = '#000000';
  canvasCtx.textAlign = 'center';
  canvasCtx.fillText('카메라를 시작하여 예측을 확인하세요', canvasElement.width / 2, canvasElement.height / 2);
});
