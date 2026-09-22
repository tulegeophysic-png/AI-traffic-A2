// tracking.js - Quản lý Centroid Tracker, Phân làn Trái/Phải và Tính tốc độ phương tiện

let nextVehicleId = 1;
let trackedVehicles = new Map(); // Lưu trữ các xe đang tracking: Map<id, {x1, y1, x2, y2, class, lane, speed, counted}>

// Thống kê đếm xe theo phân loại và làn
export const vehicleStats = {
    car: { left: 0, right: 0, total: 0 },
    motorcycle: { left: 0, right: 0, total: 0 },
    bus: { left: 0, right: 0, total: 0 },
    truck: { left: 0, right: 0, total: 0 }
};

export function resetVehicleStats() {
    for (let key in vehicleStats) {
        vehicleStats[key].left = 0;
        vehicleStats[key].right = 0;
        vehicleStats[key].total = 0;
    }
    trackedVehicles.clear();
    nextVehicleId = 1;
}

/**
 * Xác định xe thuộc Làn Trái hay Làn Phải dựa vào vị trí trung tâm theo chiều ngang của khung hình
 */
function determineLane(x1, x2, frameWidth = 1280) {
    const centerX = (x1 + x2) / 2;
    const splitX = frameWidth / 2; // Ranh giới chia đôi màn hình thành 2 làn
    return centerX < splitX ? 'left' : 'right';
}

/**
 * Tính vận tốc (km/h) dựa trên quãng đường dịch chuyển pixel giữa các frame
 */
function calculateSpeed(prevX, prevY, currX, currY, fps = 30) {
    const pixelDistance = Math.hypot(currX - prevX, currY - prevY);
    
    // Hệ số quy đổi pixel ra mét (Calibration). Có thể tinh chỉnh theo góc quay camera thực tế.
    const METERS_PER_PIXEL = 0.05; 
    const distanceMeters = pixelDistance * METERS_PER_PIXEL;

    const timeInterval = 1 / fps; 
    if (timeInterval <= 0) return 0;

    const speedMps = distanceMeters / timeInterval;
    let speedKmh = speedMps * 3.6;

    if (speedKmh < 3) speedKmh = 0; // Lọc nhiễu khi xe đứng yên
    return Math.round(speedKmh);
}

/**
 * Thực hiện ghép nối ID xe qua từng frame, phân làn, tính tốc độ và đếm xe
 */
export function matchAndCountVehicles(detections, frameWidth = 1280, frameHeight = 720, currentFps = 30) {
    const currentFrameVehicles = [];

    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const lane = determineLane(x1, x2, frameWidth);

        currentFrameVehicles.push({
            x1, y1, x2, y2,
            centerX, centerY,
            class: det.class.toLowerCase(),
            score: det.score,
            lane,
            assigned: false
        });
    });

    const updatedTrackedVehicles = new Map();

    currentFrameVehicles.forEach(curr => {
        let bestMatchId = null;
        let minDistance = 60; // Ngưỡng khoảng cách tối đa để nhận diện cùng một xe

        trackedVehicles.forEach((tracked, id) => {
            if (tracked.class === curr.class && !tracked.assigned) {
                const dist = Math.hypot(curr.centerX - tracked.centerX, curr.centerY - tracked.centerY);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestMatchId = id;
                }
            }
        });

        if (bestMatchId !== null) {
            const tracked = trackedVehicles.get(bestMatchId);
            
            // Tính toán và làm mượt tốc độ
            const instantaneousSpeed = calculateSpeed(tracked.centerX, tracked.centerY, curr.centerX, curr.centerY, currentFps);
            tracked.speed = tracked.speed ? Math.round(tracked.speed * 0.7 + instantaneousSpeed * 0.3) : instantaneousSpeed;

            tracked.x1 = curr.x1;
            tracked.y1 = curr.y1;
            tracked.x2 = curr.x2;
            tracked.y2 = curr.y2;
            tracked.centerX = curr.centerX;
            tracked.centerY = curr.centerY;
            tracked.lane = curr.lane;
            tracked.assigned = true;

            // Đệ trình đếm xe khi phương tiện di chuyển qua nửa khung hình theo chiều dọc
            const countingLineY = frameHeight / 2;
            if (!tracked.counted && tracked.centerY > countingLineY) {
                tracked.counted = true;
                const cls = tracked.class;
                if (vehicleStats[cls]) {
                    if (tracked.lane === 'left') {
                        vehicleStats[cls].left++;
                    } else {
                        vehicleStats[cls].right++;
                    }
                    vehicleStats[cls].total = vehicleStats[cls].left + vehicleStats[cls].right;
                }
            }

            updatedTrackedVehicles.set(bestMatchId, tracked);
        } else {
            // Cấp ID mới cho xe xuất hiện lần đầu
            const newId = nextVehicleId++;
            updatedTrackedVehicles.set(newId, {
                ...curr,
                id: newId,
                speed: 0,
                counted: false,
                assigned: true
            });
        }
    });

    trackedVehicles = updatedTrackedVehicles;

    const resultList = [];
    trackedVehicles.forEach(v => resultList.push(v));
    return resultList;
}