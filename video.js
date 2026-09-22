// video.js - Quản lý nguồn video, camera, vòng lặp AI và tính FPS

import { canvas, ctx, inferenceCanvas, inferenceCtx, isRunning, setRunning, isInferencing, setInferencing } from './main.js';
import { session, preprocessWithLetterbox, parseYolov10Output } from './model.js';
import { matchAndCountVehicles, vehicleStats, resetVehicleStats } from './tracking.js';
import { updateUIStats, setStatus } from './dashboard.js';

let videoElement = null;
let lastTime = performance.now();
let frameCount = 0;

export function initVideoModule() {
    videoElement = document.getElementById('video-source');
}

export async function startAI() {
    if (!videoElement || !videoElement.src || !session) return;
    try {
        await videoElement.play();
    } catch (err) {
        console.error('Không thể phát video:', err);
        stopAI();
        return;
    }
    setRunning(true);
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-stop').disabled = false;
    document.getElementById('btn-capture').disabled = false;
    setStatus('active', 'ĐANG CHẠY AI');
    requestAnimationFrame(processFrame);
}

export function stopAI() {
    setRunning(false);
    if (videoElement) videoElement.pause();
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnCapture = document.getElementById('btn-capture');
    
    if (btnStart) btnStart.disabled = !(videoElement && videoElement.src && session);
    if (btnStop) btnStop.disabled = true;
    if (btnCapture) btnCapture.disabled = true;
    setStatus('stopped', 'ĐÃ DỪNG AI');
}

export function resetSystem() {
    stopAI();
    resetVehicleStats();
    updateUIStats();
    if (videoElement && videoElement.src) {
        videoElement.currentTime = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    }
}

function processFrame() {
    if (!isRunning()) return;
    if (videoElement.paused || videoElement.ended) {
        stopAI();
        return;
    }

    const now = performance.now();
    frameCount++;
    if (now - lastTime >= 1000) {
        const currentFps = (frameCount * 1000) / (now - lastTime);
        const fpsEl = document.getElementById('fps-display');
        if (fpsEl) fpsEl.innerText = currentFps.toFixed(1);
        frameCount = 0;
        lastTime = now;
    }

    // Vẽ frame hiện tại lên màn hình chính
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Gửi sang luồng AI ngầm để không giật khung hình
    if (!isInferencing()) {
        setInferencing(true);
        inferenceCtx.drawImage(videoElement, 0, 0, inferenceCanvas.width, inferenceCanvas.height);
        
        setTimeout(async () => {
            try {
                const { tensor, ratio, dw, dh } = preprocessWithLetterbox(inferenceCanvas, 640);
                const results = await session.run({ [session.inputNames[0]]: tensor });
                const dets = parseYolov10Output(results[session.outputNames[0]], canvas.width, canvas.height, ratio, dw, dh);
                
                matchAndCountVehicles(dets, canvas.width, canvas.height, 30);
                updateUIStats();
            } catch (err) {
                console.error('Lỗi khi xử lý frame AI:', err);
                setStatus('error', 'LỖI AI');
                stopAI();
            } finally {
                setInferencing(false);
            }
        }, 0);
    }

    requestAnimationFrame(processFrame);
}

export function captureFrame() {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `traffic-capture-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

export async function setupLiveCamera() {
    alert('Tính năng kết nối trực tiếp Camera RTSP đang được kích hoạt.');
}