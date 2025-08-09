// DOM Elements
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const sendButton = document.getElementById('sendButton');
const clearLogButton = document.getElementById('clearLogButton');
const inputText = document.getElementById('inputText');
const lineEnding = document.getElementById('lineEnding');
const logElement = document.getElementById('log');
const statusElement = document.getElementById('status');

// Serial state
let port = null;
let reader = null;
let writer = null;
let readLoopAbortController = null;

// Helpers
function appendLog(text) {
  logElement.textContent += text;
  logElement.parentElement.scrollTop = logElement.parentElement.scrollHeight;
}

function getEol() {
  switch (lineEnding.value) {
    case 'lf':
      return '\n';
    case 'crlf':
      return '\r\n';
    default:
      return '';
  }
}

function updateUIConnected(connected) {
  connectButton.disabled = connected;
  disconnectButton.disabled = !connected;
  sendButton.disabled = !connected;
  inputText.disabled = !connected;
  lineEnding.disabled = !connected;
}

function setStatus(message, loading = false) {
  statusElement.innerHTML = message + (loading ? ' <span class="loading"></span>' : '');
}

// Connect
async function connectSerial() {
  if (!('serial' in navigator)) {
    alert('이 브라우저는 Web Serial API를 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.');
    return;
  }

  try {
    setStatus('포트 선택 대기 중...');
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    writer = port.writable.getWriter();

    readLoopAbortController = new AbortController();
    startReadLoop(readLoopAbortController.signal);

    updateUIConnected(true);
    setStatus('연결됨 (9600 bps)', true);
    appendLog('[Connected]\r\n');
  } catch (err) {
    console.error(err);
    setStatus('연결 실패: ' + err.message);
  }
}

// Read loop
async function startReadLoop(abortSignal) {
  try {
    reader = port.readable.getReader();
    const decoder = new TextDecoder();
    while (!abortSignal.aborted) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      appendLog(decoder.decode(value));
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error('Read error:', err);
      appendLog(`\r\n[Read error] ${err.message}\r\n`);
    }
  } finally {
    try { reader?.releaseLock(); } catch (_) {}
  }
}

// Write
async function sendText() {
  if (!writer || !port) return;
  const data = inputText.value + getEol();
  if (data.length === 0) return;
  try {
    const encoded = new TextEncoder().encode(data);
    await writer.write(encoded);
    appendLog(`> ${inputText.value}\r\n`);
    inputText.value = '';
  } catch (err) {
    console.error('Write error:', err);
    appendLog(`\r\n[Write error] ${err.message}\r\n`);
  }
}

// Disconnect
async function disconnectSerial() {
  try {
    appendLog('[Disconnecting...]\r\n');
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
    updateUIConnected(false);
    setStatus('연결 해제됨. "시리얼 연결" 버튼으로 다시 연결하세요.');
    appendLog('[Disconnected]\r\n');
  }
}

// Events
connectButton.addEventListener('click', connectSerial);
disconnectButton.addEventListener('click', disconnectSerial);
sendButton.addEventListener('click', sendText);
inputText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendText();
  }
});
clearLogButton.addEventListener('click', () => {
  logElement.textContent = '';
});

// Auto-disable inputs until connected
updateUIConnected(false);


