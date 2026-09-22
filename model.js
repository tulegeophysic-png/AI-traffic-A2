// model.js - Quản lý tải mô hình và parse kết quả YOLOv10 chuẩn hóa

export let session = null;
const CLASSES = ['person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck']; 

export async function loadModel(setStatusCallback, onReadyCallback) {
    try {
        if (setStatusCallback) setStatusCallback('loading', 'ĐANG TẢI MÔ HÌNH AI...');
        
        if (typeof ort !== 'undefined') {
            ort.env.wasm.numThreads = 1;
            ort.env.wasm.simd = false; 
            session = await ort.InferenceSession.create('./yolov10n.onnx', { executionProviders: ['wasm'] });
        } else {
            throw new Error('ONNX Runtime chưa được tải.');
        }

        if (setStatusCallback) setStatusCallback('ready', 'MÔ HÌNH SẴN SÀNG');
        if (onReadyCallback) onReadyCallback();
    } catch (e) {
        console.error('Không thể tải mô hình ONNX:', e);
        if (setStatusCallback) setStatusCallback('error', 'LỖI TẢI MODEL AI');
    }
}

export function preprocessWithLetterbox(canvas, targetSize = 640) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const ratio = Math.min(targetSize / width, targetSize / height);
    const newW = Math.round(width * ratio);
    const newH = Math.round(height * ratio);
    const dw = (targetSize - newW) / 2;
    const dh = (targetSize - newH) / 2;

    const offscreen = document.createElement('canvas');
    offscreen.width = targetSize;
    offscreen.height = targetSize;
    const oCtx = offscreen.getContext('2d');

    oCtx.fillStyle = '#000000';
    oCtx.fillRect(0, 0, targetSize, targetSize);
    oCtx.drawImage(canvas, 0, 0, width, height, dw, dh, newW, newH);

    const imgData = oCtx.getImageData(0, 0, targetSize, targetSize);
    const { data } = imgData;
    
    const float32Data = new Float32Array(3 * targetSize * targetSize);
    for (let i = 0; i < targetSize * targetSize; i++) {
        float32Data[i] = data[i * 4] / 255.0;
        float32Data[targetSize * targetSize + i] = data[i * 4 + 1] / 255.0;
        float32Data[2 * targetSize * targetSize + i] = data[i * 4 + 2] / 255.0;
    }

    const tensor = new ort.Tensor('float32', float32Data, [1, 3, targetSize, targetSize]);
    return { tensor, ratio, dw, dh };
}

export function parseYolov10Output(outputTensor, originalWidth, originalHeight, ratio, dw, dh) {
    if (!outputTensor || !outputTensor.data) return [];

    let dets = [];
    const data = outputTensor.data;
    const dims = outputTensor.dims; 
    const numBoxes = dims[1] || (data.length / 6);
    
    for (let i = 0; i < numBoxes; i++) {
        const offset = i * 6;
        let x1 = data[offset];
        let y1 = data[offset + 1];
        let x2 = data[offset + 2];
        let y2 = data[offset + 3];
        let score = data[offset + 4];
        let classId = Math.round(data[offset + 5]);

        // Hạ ngưỡng điểm xuống 0.15 để dễ dàng bắt được vật thể
        if (score < 0.15) continue;

        x1 = (x1 - dw) / ratio;
        y1 = (y1 - dh) / ratio;
        x2 = (x2 - dw) / ratio;
        y2 = (y2 - dh) / ratio;

        let rawName = CLASSES[classId] || 'car';
        let className = 'car';
        if (rawName === 'motorcycle' || rawName === 'motorbike') className = 'motorcycle';
        else if (rawName === 'bus') className = 'bus';
        else if (rawName === 'truck') className = 'truck';
        else if (rawName === 'car') className = 'car';
        else continue; 

        dets.push({ box: [x1, y1, x2, y2], score, className });
    }
    return dets;
}