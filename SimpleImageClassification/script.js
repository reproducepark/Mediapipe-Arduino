import { ImageClassifier, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// DOM 요소들
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusElement = document.getElementById('status');
const classificationResultElement = document.getElementById('classificationResult');
const classificationConfidenceElement = document.getElementById('classificationConfidence');
const modelNameElement = document.getElementById('modelName');
const processingTimeElement = document.getElementById('processingTime');

// 상위 3개 예측 결과 요소들
const prediction1Element = document.getElementById('prediction1');
const score1Element = document.getElementById('score1');
const prediction2Element = document.getElementById('prediction2');
const score2Element = document.getElementById('score2');
const prediction3Element = document.getElementById('prediction3');
const score3Element = document.getElementById('score3');

let imageClassifier = undefined;
let runningMode = 'VIDEO';
let isCameraRunning = false;
let mediaStream = null;
let lastVideoTime = -1;
let results = undefined;
let lastProcessingTime = 0;

// 이미지 분류기 생성
async function createImageClassifier() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
  );
  
  try {
    imageClassifier = await ImageClassifier.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 
          'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite',
        // delegate: 'CPU',
        delegate: 'GPU',
      },
      runningMode,
      maxResults: 3, // 상위 3개 결과 반환
      scoreThreshold: 0.1 // 최소 신뢰도 10%
    });
    
    modelNameElement.textContent = 'EfficientNet Lite0 (GPU 가속)';
  } catch (e) {
    console.error('ImageClassifier 생성 실패', e);
    statusElement.textContent = 'GPU 초기화 실패: 브라우저/WebGL 설정을 확인하세요.';
    
    // CPU 모드로 재시도
    try {
      imageClassifier = await ImageClassifier.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 
            'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite',
          delegate: 'CPU',
        },
        runningMode,
        maxResults: 3,
        scoreThreshold: 0.1
      });
      
      modelNameElement.textContent = 'EfficientNet Lite0 (CPU)';
    } catch (cpuError) {
      console.error('CPU 모드 ImageClassifier 생성도 실패', cpuError);
      throw cpuError;
    }
  }
}

// 클래스 이름을 더 읽기 쉽게 변환
function formatClassName(className) {
  // 언더스코어를 공백으로 변경하고 각 단어의 첫 글자를 대문자로
  return className
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// 일반적인 객체의 한국어 번역 (주요 카테고리만)
function getKoreanClassName(englishName) {
  const classMap = {
    // 동물
    'person': '사람',
    'cat': '고양이',
    'dog': '개',
    'bird': '새',
    'horse': '말',
    'sheep': '양',
    'cow': '소',
    'elephant': '코끼리',
    'bear': '곰',
    'zebra': '얼룩말',
    'giraffe': '기린',
    
    // 음식
    'banana': '바나나',
    'apple': '사과',
    'orange': '오렌지',
    'broccoli': '브로콜리',
    'carrot': '당근',
    'pizza': '피자',
    'cake': '케이크',
    'coffee': '커피',
    
    // 교통수단
    'car': '자동차',
    'truck': '트럭',
    'bus': '버스',
    'train': '기차',
    'airplane': '비행기',
    'boat': '보트',
    'bicycle': '자전거',
    'motorcycle': '오토바이',
    
    // 전자제품
    'laptop': '노트북',
    'computer': '컴퓨터',
    'phone': '전화기',
    'television': 'TV',
    'keyboard': '키보드',
    'mouse': '마우스',
    
    // 가구/일상용품
    'chair': '의자',
    'table': '테이블',
    'bed': '침대',
    'book': '책',
    'cup': '컵',
    'bottle': '병',
    'bowl': '그릇',
    'spoon': '숟가락',
    'knife': '칼',
    'fork': '포크'
  };
  
  // 먼저 직접 매칭 시도
  if (classMap[englishName.toLowerCase()]) {
    return classMap[englishName.toLowerCase()];
  }
  
  // 부분 매칭 시도 (단어가 포함된 경우)
  for (const [eng, kor] of Object.entries(classMap)) {
    if (englishName.toLowerCase().includes(eng)) {
      return kor;
    }
  }
  
  // 매칭되지 않으면 포맷팅된 영어 이름 반환
  return formatClassName(englishName);
}

// 분류 결과 업데이트
function updateClassificationResults() {
  if (!results || !results.classifications || results.classifications.length === 0) {
    classificationResultElement.textContent = '없음';
    classificationConfidenceElement.textContent = '신뢰도: 0%';
    classificationResultElement.className = '';
    
    // 상위 3개 결과 초기화
    prediction1Element.textContent = '-';
    score1Element.textContent = '0%';
    prediction2Element.textContent = '-';
    score2Element.textContent = '0%';
    prediction3Element.textContent = '-';
    score3Element.textContent = '0%';
    
    return;
  }
  
  const classifications = results.classifications[0].categories;
  
  if (classifications.length > 0) {
    const topClassification = classifications[0];
    const koreanName = getKoreanClassName(topClassification.displayName || topClassification.categoryName);
    
    classificationResultElement.textContent = koreanName;
    classificationConfidenceElement.textContent = `신뢰도: ${(topClassification.score * 100).toFixed(1)}%`;
    
    // 신뢰도에 따른 색상 변경
    if (topClassification.score > 0.7) {
      classificationResultElement.className = 'confidence-high';
    } else if (topClassification.score > 0.4) {
      classificationResultElement.className = 'confidence-medium';
    } else {
      classificationResultElement.className = 'confidence-low';
    }
    
    // 애니메이션 효과
    classificationResultElement.parentElement.classList.add('updated');
    setTimeout(() => {
      classificationResultElement.parentElement.classList.remove('updated');
    }, 500);
  }
  
  // 상위 3개 결과 업데이트
  const predictionElements = [
    { name: prediction1Element, score: score1Element },
    { name: prediction2Element, score: score2Element },
    { name: prediction3Element, score: score3Element }
  ];
  
  predictionElements.forEach((elem, index) => {
    if (index < classifications.length) {
      const classification = classifications[index];
      const koreanName = getKoreanClassName(classification.displayName || classification.categoryName);
      elem.name.textContent = koreanName;
      elem.score.textContent = `${(classification.score * 100).toFixed(1)}%`;
    } else {
      elem.name.textContent = '-';
      elem.score.textContent = '0%';
    }
  });
}

// 분류 결과 시각화
function drawClassificationResults() {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  // 실시간 분류 결과를 화면에 오버레이로 표시
  if (results && results.classifications && results.classifications.length > 0) {
    const classifications = results.classifications[0].categories;
    
    if (classifications.length > 0) {
      const topClassification = classifications[0];
      const koreanName = getKoreanClassName(topClassification.displayName || topClassification.categoryName);
      const confidence = (topClassification.score * 100).toFixed(1);
      
      // 배경 박스 그리기
      const text = `${koreanName} (${confidence}%)`;
      canvasCtx.font = 'bold 24px Arial';
      const textWidth = canvasCtx.measureText(text).width;
      const padding = 20;
      const boxWidth = textWidth + padding * 2;
      const boxHeight = 50;
      const x = (canvasElement.width - boxWidth) / 2;
      const y = 30;
      
      // 신뢰도에 따른 색상
      let bgColor, textColor;
      if (topClassification.score > 0.7) {
        bgColor = 'rgba(255, 107, 107, 0.9)';
        textColor = '#ffffff';
      } else if (topClassification.score > 0.4) {
        bgColor = 'rgba(255, 171, 64, 0.9)';
        textColor = '#ffffff';
      } else {
        bgColor = 'rgba(136, 136, 136, 0.9)';
        textColor = '#ffffff';
      }
      
      // 배경 박스
      canvasCtx.fillStyle = bgColor;
      canvasCtx.roundRect(x, y, boxWidth, boxHeight, 10);
      canvasCtx.fill();
      
      // 텍스트
      canvasCtx.fillStyle = textColor;
      canvasCtx.textAlign = 'center';
      canvasCtx.fillText(text, canvasElement.width / 2, y + 32);
    }
  }
  
  // 처리 시간 표시
  canvasCtx.font = '14px Arial';
  canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  canvasCtx.textAlign = 'right';
  canvasCtx.fillText(`${lastProcessingTime.toFixed(1)}ms`, canvasElement.width - 10, canvasElement.height - 10);
  
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
    
    const startTime = performance.now();
    results = imageClassifier.classifyForVideo(videoElement, now);
    lastProcessingTime = performance.now() - startTime;
    
    updateClassificationResults();
    processingTimeElement.textContent = `처리 시간: ${lastProcessingTime.toFixed(1)}ms`;
  }
  
  drawClassificationResults();
  
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
    
    const startTime = performance.now();
    results = imageClassifier.classifyForVideo(videoElement, now);
    lastProcessingTime = performance.now() - startTime;
    
    updateClassificationResults();
    processingTimeElement.textContent = `처리 시간: ${lastProcessingTime.toFixed(1)}ms`;
  }
  
  drawClassificationResults();
  
  if (isCameraRunning) {
    window.requestAnimationFrame(predictWebcamRAF);
  }
}

// 카메라 시작
async function startCamera() {
  if (!imageClassifier) {
    statusElement.textContent = '모델 로딩 중...';
    statusElement.innerHTML += ' <span class="loading"></span>';
    try {
      await createImageClassifier();
    } catch (e) {
      statusElement.textContent = '모델 로딩 실패: 네트워크 연결을 확인하세요.';
      return;
    }
  }
  
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment' // 후면 카메라 우선
      }, 
      audio: false 
    });
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
    statusElement.textContent = '카메라가 실행 중입니다. 객체를 카메라에 보여주세요!';
    
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
  classificationResultElement.textContent = '없음';
  classificationConfidenceElement.textContent = '신뢰도: 0%';
  processingTimeElement.textContent = '처리 시간: 0ms';
  classificationResultElement.className = '';
  
  // 상위 3개 결과 초기화
  prediction1Element.textContent = '-';
  score1Element.textContent = '0%';
  prediction2Element.textContent = '-';
  score2Element.textContent = '0%';
  prediction3Element.textContent = '-';
  score3Element.textContent = '0%';
  
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
  canvasCtx.fillText('카메라를 시작하여 이미지를 분류하세요', canvasElement.width / 2, canvasElement.height / 2);
  
  // 설명 텍스트
  canvasCtx.font = '18px Arial';
  canvasCtx.fillStyle = '#666666';
  canvasCtx.fillText('1000개 카테고리의 객체를 실시간으로 인식합니다', canvasElement.width / 2, canvasElement.height / 2 + 40);
}

// Canvas의 roundRect 폴리필 (구형 브라우저 지원)
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}
