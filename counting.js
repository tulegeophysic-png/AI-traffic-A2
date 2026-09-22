// counting.js - Hiển thị bounding box, ID, loại xe và tốc độ (Đã loại bỏ hoàn toàn mọi vạch kẻ trên video)

import { ctx, canvas } from './main.js';

export function drawScene(trackedDetections) {
    // Xóa sạch khung hình cũ ở mỗi frame để vẽ mới
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Không vẽ bất kỳ vạch phân làn hay vạch đếm nào lên giao diện video

    // Vẽ bounding box, nhãn tên, ID và tốc độ của từng xe đang tracking
    if (!trackedDetections) return;

    trackedDetections.forEach(veh => {
        const { x1, y1, x2, y2, class: cls, id, lane, speed } = veh;

        // Phân màu sắc khung bao quanh xe theo làn ngầm định (Làn Trái: Xanh dương, Làn Phải: Xanh lá)
        const strokeColor = lane === 'left' ? '#3b82f6' : '#10b981';

        // Vẽ khung Bounding Box
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Hiển thị nhãn thông tin: ID, Loại xe, Tốc độ (Ví dụ: #1 CAR | 45 km/h)
        const label = `#${id} ${cls.toUpperCase()} | ${speed || 0} km/h`;
        ctx.font = '12px Arial';
        const textWidth = ctx.measureText(label).width;
        
        ctx.fillStyle = strokeColor;
        ctx.fillRect(x1, y1 - 22, textWidth + 10, 22);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x1 + 5, y1 - 7);
    });
}