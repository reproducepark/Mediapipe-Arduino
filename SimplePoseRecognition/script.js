// DOM 요소 가져오기
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusElement = document.getElementById('status');
const peopleCountElement = document.getElementById('peopleCount');

// MediaPipe Pose 설정
const pose = new Pose({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
});

// Pose 설정 옵션
pose.setOptions({
    modelComplexity: 1, // 모델 복잡도 (0, 1, 2)
    smoothLandmarks: true, // 랜드마크 스무딩
    enableSegmentation: false, // 세그멘테이션 활성화 여부
    smoothSegmentation: false, // 세그멘테이션 스무딩
    minDetectionConfidence: 0.5, // 최소 감지 신뢰도
    minTrackingConfidence: 0.5 // 최소 추적 신뢰도
});

// 포즈 감지 결과 처리
pose.onResults(onResults);

// 카메라 객체
let camera = null;
let isCameraRunning = false;

// 포즈 랜드마크 연결 정보 (스켈레톤 그리기용)
const POSE_CONNECTIONS = [
    // 얼굴
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],
    // 상체
    [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    [11, 23], [12, 24], [23, 24],
    // 하체
    [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30],
    [29, 31], [30, 32], [27, 31], [28, 32]
];

// 주요 관절 포인트 인덱스
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
    rightAnkle: 28
};

// 포즈 감지 결과 처리 함수
function onResults(results) {
    // 카메라가 실행 중이 아니면 렌더링하지 않음
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
    
    // 감지된 사람 수 업데이트 (MediaPipe Pose는 한 번에 한 사람만 감지)
    const peopleCount = results.poseLandmarks ? 1 : 0;
    peopleCountElement.textContent = `감지된 사람: ${peopleCount}`;
    
    // 포즈가 감지되었을 때
    if (results.poseLandmarks) {
        const landmarks = results.poseLandmarks;
        
        // 스켈레톤 그리기
        drawConnections(landmarks);
        
        // 랜드마크 점 그리기
        drawLandmarks(landmarks);
        
        // 머리 위에 "Person" 라벨 표시
        if (landmarks[0]) {
            drawPersonLabel(landmarks[0]);
        }
    }
    
    canvasCtx.restore();
}

// 사람 라벨 그리기
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

// 스켈레톤 연결선 그리기
function drawConnections(landmarks) {
    canvasCtx.strokeStyle = '#00ff88';
    canvasCtx.lineWidth = 4;
    
    for (const connection of POSE_CONNECTIONS) {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];
        
        // 가시성이 낮은 연결은 그리지 않음
        if (start.visibility < 0.3 || end.visibility < 0.3) {
            continue;
        }
        
        canvasCtx.globalAlpha = Math.min(start.visibility, end.visibility);
        canvasCtx.beginPath();
        canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
        canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
        canvasCtx.stroke();
    }
    canvasCtx.globalAlpha = 1.0;
}

// 랜드마크 점 그리기
function drawLandmarks(landmarks) {
    for (let i = 0; i < landmarks.length; i++) {
        const landmark = landmarks[i];
        
        // 가시성이 낮은 랜드마크는 그리지 않음
        if (landmark.visibility < 0.3) {
            continue;
        }
        
        const x = landmark.x * canvasElement.width;
        const y = landmark.y * canvasElement.height;
        
        canvasCtx.globalAlpha = landmark.visibility;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 8, 0, 2 * Math.PI);
        
        // 주요 관절은 다른 색상으로 표시
        if (i === KEY_POINTS.nose) { // 코 (얼굴 중심)
            canvasCtx.fillStyle = '#ff0066';
        } else if ([KEY_POINTS.leftShoulder, KEY_POINTS.rightShoulder, 
                   KEY_POINTS.leftHip, KEY_POINTS.rightHip].includes(i)) { // 어깨, 엉덩이
            canvasCtx.fillStyle = '#ffd700';
        } else if ([KEY_POINTS.leftWrist, KEY_POINTS.rightWrist,
                   KEY_POINTS.leftAnkle, KEY_POINTS.rightAnkle].includes(i)) { // 손목, 발목
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

// 카메라 시작
function startCamera() {
    camera = new Camera(videoElement, {
        onFrame: async () => {
            await pose.send({image: videoElement});
        },
        width: 1280,
        height: 720
    });
    
    isCameraRunning = true;
    camera.start();
    
    // 버튼 상태 업데이트
    startButton.disabled = true;
    stopButton.disabled = false;
    statusElement.textContent = '카메라가 실행 중입니다. 전신이 보이도록 카메라에서 떨어져 서세요!';
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
    peopleCountElement.textContent = '감지된 사람: 0';
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

// 초기 캔버스 메시지 그리기
function drawInitialCanvasMessage() {
    canvasCtx.fillStyle = '#f5f5f5';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.font = '30px Arial';
    canvasCtx.fillStyle = '#000000';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('카메라를 시작하여 사람을 인식하세요', canvasElement.width / 2, canvasElement.height / 2);
}
