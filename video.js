// video.js - Quản lý nguồn video, vòng lặp AI, vẽ khung nhận diện và đếm phương tiện

import { canvas, ctx, inferenceCanvas, inferenceCtx, isRunning, setRunning, isInferencing, setInferencing } from './main.js';
import { session, preprocessWithLetterbox, parseYolov10Output } from './model.js';
import { matchAndCountVehicles, vehicleStats, resetVehicleStats } from './tracking.js';
import { updateUIStats, setStatus } from './dashboard.js';

let videoElement = null;
let lastTime = performance.now();
let frameCount = 0;
let latestDetections = []; // Lưu lại kết quả nhận diện mới nhất để vẽ liên tục

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

    // 2. Vẽ vạch đếm xe màu đỏ ngang màn hình (Ví dụ ở vị trí 50 chiều cao canvas)
    const lineY = canvas.height * 0.5;
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(canvas.width, lineY);
    ctx.stroke();

    // 3. Vẽ lại các khung bounding box của xe đã detect lên màn hình
    if (Array.isArray(latestDetections) && latestDetections.length > 0) {
        latestDetections.forEach(det => {
            let [x1, y1, x2, y2] = det.box;
            
            // Vẽ hộp nhận diện
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 2;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

            // Vẽ nhãn tên xe và độ tự tin
            ctx.fillStyle = '#00ffcc';
            ctx.font = '14px Arial';
            ctx.fillText(`${det.className} (${(det.score * 100).toFixed(0)}%)`, x1, Math.max(y1 - 5, 15));
        });
    }

    // 4. Gửi sang luồng AI ngầm để xử lý liên tục
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
                    latestDetections = dets; // Lưu lại để vẽ ở frame tiếp theo
                    matchAndCountVehicles(dets, canvas.width, canvas.height, lineY);
                    updateUIStats();
                }
            } catch (err) {
                console.error('Lỗi khi xử lý frame AI:', err);
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