// video.js - Quản lý nguồn video, vòng lặp AI, vẽ khung, hiển thị ID và đếm trực tiếp

import { canvas, ctx, inferenceCanvas, inferenceCtx, isRunning, setRunning, isInferencing, setInferencing } from './main.js';
import { session, preprocessWithLetterbox, parseYolov10Output } from './model.js';
import { matchAndCountVehicles, vehicleStats, resetVehicleStats, getTrackedObjects } from './tracking.js';
import { updateUIStats, setStatus } from './dashboard.js';

let videoElement = null;
let lastTime = performance.now();
let frameCount = 0;
let latestDetections = [];

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
    latestDetections = [];
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

    // 1. Vẽ frame video lên canvas chính
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // 2. Vẽ các khung nhận diện (Bounding Boxes) lên canvas
    if (Array.isArray(latestDetections) && latestDetections.length > 0) {
        latestDetections.forEach(det => {
            let [x1, y1, x2, y2] = det.box;
            
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 2;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

            ctx.fillStyle = '#00ffcc';
            ctx.font = '13px Arial';
            ctx.fillText(`${det.className} (${(det.score * 100).toFixed(0)}%)`, x1, Math.max(y1 - 5, 15));
        });
    }

    // 3. Hiển thị ID Tracking trực quan lên xe đang chạy
    if (typeof getTrackedObjects === 'function') {
        const trackedObjs = getTrackedObjects();
        Object.entries(trackedObjs).forEach(([id, obj]) => {
            let [cx, cy] = obj.centroid;
            ctx.fillStyle = '#ff00ff';
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`ID: ${id}`, cx + 6, cy + 4);
        });
    }

    // 4. Gửi frame sang luồng suy luận ngầm
    if (!isInferencing() && session) {
        setInferencing(true);
        inferenceCtx.drawImage(videoElement, 0, 0, inferenceCanvas.width, inferenceCanvas.height);
        
        setTimeout(async () => {
            try {
                const { tensor, ratio, dw, dh } = preprocessWithLetterbox(inferenceCanvas, 640);
                const results = await session.run({ [session.inputNames[0]]: tensor });
                
                const outputTensor = results[session.outputNames[0]];
                const dets = parseYolov10Output(outputTensor, canvas.width, canvas.height, ratio, dw, dh);
                
                if (Array.isArray(dets)) {
                    latestDetections = dets;
                    // Gọi tracking và đếm trực tiếp không cần vạch
                    matchAndCountVehicles(dets, canvas.width, canvas.height);
                    updateUIStats();
                }
            } catch (err) {
                console.error('Lỗi suy luận AI:', err);
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