// DOM 요소 가져오기
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusElement = document.getElementById('status');
const handCountElement = document.getElementById('handCount');

// MediaPipe Hands 설정
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

// Hands 설정 옵션
hands.setOptions({
    maxNumHands: 2, // 최대 감지할 손의 개수
    modelComplexity: 1, // 모델 복잡도 (0, 1)
    minDetectionConfidence: 0.5, // 최소 감지 신뢰도
    minTrackingConfidence: 0.5 // 최소 추적 신뢰도
});

// 손 감지 결과 처리
hands.onResults(onResults);

// 카메라 객체
let camera = null;
let isCameraRunning = false;

// 손 랜드마크 연결 정보 (스켈레톤 그리기용)
const HAND_CONNECTIONS = [
    // 엄지손가락
    [0, 1], [1, 2], [2, 3], [3, 4],
    // 검지손가락
    [0, 5], [5, 6], [6, 7], [7, 8],
    // 중지손가락
    [5, 9], [9, 10], [10, 11], [11, 12],
    // 약지손가락
    [9, 13], [13, 14], [14, 15], [15, 16],
    // 새끼손가락
    [13, 17], [17, 18], [18, 19], [19, 20],
    // 손바닥
    [0, 17]
];

// 손 감지 결과 처리 함수
function onResults(results) {
    // 카메라가 실행 중이 아니면 렌더링하지 않음 (중지 직후 마지막 프레임 덮어쓰기 방지)
    if (!isCameraRunning) {
        return;
    }
    // 캔버스 크기 설정
    canvasElement.width = results.image.width;
    canvasElement.height = results.image.height;
    
    // 캔버스 초기화
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 비디오 이미지 그리기
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    // 감지된 손의 개수 업데이트
    const handCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
    handCountElement.textContent = `감지된 손: ${handCount}`;
    
    // 손이 감지되었을 때
    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let index = 0; index < results.multiHandLandmarks.length; index++) {
            const landmarks = results.multiHandLandmarks[index];
            const handedness = results.multiHandedness[index];
            
            // 손의 종류 (왼손/오른손) 표시
            const handLabel = handedness.label === 'Left' ? 'Right' : 'Left';
            drawHandLabel(landmarks[0], handLabel);
            
            // 스켈레톤 그리기
            drawConnections(landmarks);
            
            // 랜드마크 점 그리기
            drawLandmarks(landmarks);
        }
    }
    
    canvasCtx.restore();
}

// 손 라벨 그리기
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

// 스켈레톤 연결선 그리기
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

// 랜드마크 점 그리기
function drawLandmarks(landmarks) {
    for (let i = 0; i < landmarks.length; i++) {
        const landmark = landmarks[i];
        const x = landmark.x * canvasElement.width;
        const y = landmark.y * canvasElement.height;
        
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 6, 0, 2 * Math.PI);
        
        // 손가락 끝과 손목은 다른 색상으로 표시
        if (i === 0) { // 손목
            canvasCtx.fillStyle = '#ff0066';
        } else if ([4, 8, 12, 16, 20].includes(i)) { // 손가락 끝
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

// 카메라 시작
function startCamera() {
    camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
        },
        width: 1280,
        height: 720
    });
    
    isCameraRunning = true;
    camera.start();
    
    // 버튼 상태 업데이트
    startButton.disabled = true;
    stopButton.disabled = false;
    statusElement.textContent = '카메라가 실행 중입니다. 손을 카메라에 보여주세요!';
    statusElement.innerHTML += ' <span class="loading"></span>';
}

// 카메라 중지
function stopCamera() {
    if (camera) {
        isCameraRunning = false;
        camera.stop();
        camera = null;
    }
    
    // 캔버스 초기화
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    drawInitialCanvasMessage();
    
    // 버튼 상태 업데이트
    startButton.disabled = false;
    stopButton.disabled = true;
    statusElement.textContent = '카메라를 시작하려면 버튼을 클릭하세요.';
    handCountElement.textContent = '감지된 손: 0';
}

// 이벤트 리스너 등록
startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);

// 페이지 로드 시 초기화
window.addEventListener('load', () => {
    // 캔버스 초기 크기 설정
    canvasElement.width = 1280;
    canvasElement.height = 720;
    
    // 초기 메시지 표시
    drawInitialCanvasMessage();
});

// 초기 캔버스 메시지 그리기 (박스 색상과 동일한 배경)
function drawInitialCanvasMessage() {
    canvasCtx.fillStyle = '#f5f5f5';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.font = '30px Arial';
    canvasCtx.fillStyle = '#000000';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('카메라를 시작하여 손을 인식하세요', canvasElement.width / 2, canvasElement.height / 2);
}
