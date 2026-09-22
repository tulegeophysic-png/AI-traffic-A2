// tracking.js - Quản lý thuật toán Centroid Tracker, phân làn và đếm phương tiện giao thông

import { updateUIStats } from './dashboard.js';

// Đối tượng lưu trữ thống kê số liệu xe
export const vehicleStats = {
    car: { left: 0, right: 0, total: 0 },
    motorcycle: { left: 0, right: 0, total: 0 },
    bus: { left: 0, right: 0, total: 0 },
    truck: { left: 0, right: 0, total: 0 }
};

// Đặt lại toàn bộ số liệu thống kê về 0
export function resetVehicleStats() {
    for (let key in vehicleStats) {
        vehicleStats[key].left = 0;
        vehicleStats[key].right = 0;
        vehicleStats[key].total = 0;
    }
}

// Lưu trữ trạng thái tracking các đối tượng qua các frame
let trackedObjects = {};
let nextObjectID = 1;
let countedTrackIDs = new Set(); // Đảm bảo mỗi xe chỉ đếm 1 lần khi qua vạch

export function matchAndCountVehicles(dets, canvasWidth, canvasHeight, lineY) {
    // 1. KIỂM TRA AN TOÀN: Tránh lỗi undefined is not iterable
    if (!dets || !Array.isArray(dets)) {
        return;
    }

    let currentCentroids = [];

    // Lấy tọa độ trung tâm của các đối tượng vừa detect được trong frame hiện tại
    dets.forEach(det => {
        let [x1, y1, x2, y2] = det.box;
        let cx = (x1 + x2) / 2;
        let cy = (y1 + y2) / 2;
        let className = det.className; // 'car', 'motorcycle', 'bus', 'truck'
        
        currentCentroids.push({
            centroid: [cx, cy],
            box: det.box,
            className: className,
            score: det.score
        });
    });

    // Nếu chưa có đối tượng nào đang tracking, khởi tạo mới
    if (Object.keys(trackedObjects).length === 0) {
        currentCentroids.forEach(item => {
            trackedObjects[nextObjectID] = {
                centroid: item.centroid,
                className: item.className,
                counted: false,
                lastSeen: 0
            };
            nextObjectID++;
        });
        return;
    }

    // Thuật toán gán ID dựa trên khoảng cách (Centroid Tracking đơn giản)
    let objectIDs = Object.keys(trackedObjects);
    
    currentCentroids.forEach(item => {
        let [cx, cy] = item.centroid;
        let minDist = Infinity;
        let matchedID = null;

        objectIDs.forEach(id => {
            let tObj = trackedObjects[id];
            // Chỉ so sánh các xe cùng loại để tránh nhầm ID
            if (tObj.className === item.className) {
                let dist = Math.hypot(tObj.centroid[0] - cx, tObj.centroid[1] - cy);
                if (dist < minDist && dist < 50) { // Ngưỡng khoảng cách tối đa để nhận diện cùng một xe
                    minDist = dist;
                    matchedID = id;
                }
            }
        });

        if (matchedID !== null) {
            // Cập nhật vị trí mới cho đối tượng cũ
            let oldY = trackedObjects[matchedID].centroid[1];
            let newY = cy;
            
            // Xử lý logic đếm khi xe cắt qua vạch đếm (lineY)
            // lineY mặc định hoặc vị trí vạch ngang trên màn hình
            let countingLine = lineY || (canvasHeight / 2);
            
            if (!countedTrackIDs.has(matchedID)) {
                // Kiểm tra nếu xe đi từ trên xuống hoặc dưới lên cắt qua vạch đếm
                if ((oldY < countingLine && newY >= countingLine) || (oldY > countingLine && newY <= countingLine)) {
                    let type = item.className;
                    if (vehicleStats[type]) {
                        // Phân làn trái / phải dựa vào vị trí trục X so với tâm màn hình
                        let isLeft = cx < (canvasWidth / 2);
                        
                        if (isLeft) {
                            vehicleStats[type].left++;
                        } else {
                            vehicleStats[type].right++;
                        }
                        vehicleStats[type].total++;
                        
                        countedTrackIDs.add(matchedID);
                        trackedObjects[matchedID].counted = true;
                    }
                }
            }

            trackedObjects[matchedID].centroid = [cx, cy];
            trackedObjects[matchedID].lastSeen = 0;
        } else {
            // Đăng ký đối tượng mới xuất hiện
            trackedObjects[nextObjectID] = {
                centroid: [cx, cy],
                className: item.className,
                counted: false,
                lastSeen: 0
            };
            nextObjectID++;
        }
    });

    // Dọn dẹp các đối tượng đã biến mất khỏi khung hình quá lâu
    Object.keys(trackedObjects).forEach(id => {
        trackedObjects[id].lastSeen++;
        if (trackedObjects[id].lastSeen > 15) { // Quá 15 khung hình không thấy thì xóa
            delete trackedObjects[id];
        }
    });
}