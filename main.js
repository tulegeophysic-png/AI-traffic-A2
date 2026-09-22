// main.js - File trung tâm điều phối ứng dụng AI Giám sát Giao thông

import { updateUIStats, setStatus, initDashboardEvents } from './dashboard.js';
import { startAI, stopAI, captureFrame, setupLiveCamera, resetSystem, initVideoModule } from './video.js';
import { loadModel } from './model.js';

export let canvas, ctx;
export let inferenceCanvas, inferenceCtx;
let running = false;
let inferencing = false;
let videoObjectUrl = null;

export function isRunning() { return running; }
export function setRunning(val) { running = val; }

export function isInferencing() { return inferencing; }
export function setInferencing(val) { inferencing = val; }

document.addEventListener('DOMContentLoaded', async () => {
    canvas = document.getElementById('canvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
    }

    inferenceCanvas = document.createElement('canvas');
    inferenceCtx = inferenceCanvas.getContext('2d');

    initVideoModule();

    const videoElement = document.getElementById('video-source');
    const uploadInput = document.getElementById('upload-video');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnCapture = document.getElementById('btn-capture');
    const btnReset = document.getElementById('btn-reset');

    if (uploadInput && videoElement) {
        uploadInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (running) stopAI();
                if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
                
                videoObjectUrl = URL.createObjectURL(file);
                videoElement.src = videoObjectUrl;
                videoElement.load();
                
                videoElement.onloadedmetadata = function() {
                    if (canvas) {
                        canvas.width = videoElement.videoWidth;
                        canvas.height = videoElement.videoHeight;
                        inferenceCanvas.width = canvas.width;
                        inferenceCanvas.height = canvas.height;
                        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    }
                    if (btnStart) btnStart.disabled = false;
                    setStatus('ready', 'SẴN SÀNG CHẠY AI');
                };
            }
        });
    }

    initDashboardEvents();

    if (btnStart) btnStart.addEventListener('click', startAI);
    if (btnStop) btnStop.addEventListener('click', stopAI);
    if (btnCapture) btnCapture.addEventListener('click', captureFrame);
    if (btnReset) btnReset.addEventListener('click', resetSystem);

    const btnConnectCamera = document.getElementById('btn-live-camera');
    if (btnConnectCamera) btnConnectCamera.addEventListener('click', setupLiveCamera);

    // Tải mô hình AI ONNX
    await loadModel(setStatus, () => {
        if (videoElement && videoElement.src && btnStart) {
            btnStart.disabled = false;
        }
    });

    setStatus('ready', 'HỆ THỐNG SẴN SÀNG');
    updateUIStats();
});