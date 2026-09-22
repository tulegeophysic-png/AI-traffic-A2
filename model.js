// model.js - Quản lý tải mô hình ONNX Runtime Web và xử lý suy luận YOLOv10

export let session = null;
const CLASSES = ['person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck']; 

export async function loadModel(setStatusCallback, onReadyCallback) {
    try {
        if (setStatusCallback) setStatusCallback('loading', 'ĐANG TẢI MÔ HÌNH AI...');
        
        if (typeof ort !== 'undefined') {
            // Cấu hình bắt buộc để tránh lỗi thiếu file jsep.mjs từ CDN
            ort.env.wasm.numThreads = 1;
            ort.env.wasm.simd = false; 
            
            // Khởi tạo session từ file onnx trong thư mục gốc
            session = await ort.InferenceSession.create('./yolov10n.onnx', { executionProviders: ['wasm'] });
        } else {
            throw new Error('ONNX Runtime chưa được tải vào trang.');
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

    const targetW = targetSize;
    const targetH = targetSize;

    const ratio = Math.min(targetW / width, targetH / height);
    const newW = Math.round(width * ratio);
    const newH = Math.round(height * ratio);

    const dw = (targetW - newW) / 2;
    const dh = (targetH - newH) / 2;

    const offscreen = document.createElement('canvas');
    offscreen.width = targetW;
    offscreen.height = targetH;
    const oCtx = offscreen.getContext('2d');

    oCtx.fillStyle = '#000000';
    oCtx.fillRect(0, 0, targetW, targetH);
    oCtx.drawImage(canvas, 0, 0, width, height, dw, dh, newW, newH);

    const imgData = oCtx.getImageData(0, 0, targetW, targetH);
    const { data } = imgData;
    
    const float32Data = new Float32Array(3 * targetW * targetH);
    for (let i = 0; i < targetW * targetH; i++) {
        float32Data[i] = data[i * 4] / 255.0;                     // R
        float32Data[targetW * targetH + i] = data[i * 4 + 1] / 255.0; // G
        float32Data[2 * targetW * targetH + i] = data[i * 4 + 2] / 255.0; // B
    }

    const tensor = new ort.Tensor('float32', float32Data, [1, 3, targetH, targetW]);
    return { tensor, ratio, dw, dh };
}

export function parseYolov10Output(outputTensor, originalWidth, originalHeight, ratio, dw, dh) {
    if (!outputTensor || !outputTensor.data) {
        return [];
    }

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

        if (score < 0.25) continue;

        x1 = (x1 - dw) / ratio;
        y1 = (y1 - dh) / ratio;
        x2 = (x2 - dw) / ratio;
        y2 = (y2 - dh) / ratio;

        let rawClassName = CLASSES[classId] || 'car';
        let className = 'car';
        if (rawClassName === 'motorcycle' || rawClassName === 'motorbike') className = 'motorcycle';
        else if (rawClassName === 'bus') className = 'bus';
        else if (rawClassName === 'truck') className = 'truck';
        else if (rawClassName === 'car') className = 'car';
        else continue; 

        dets.push({
            box: [x1, y1, x2, y2],
            score: score,
            className: className
        });
    }

    return dets;
}