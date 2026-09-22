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
    // 1. BẢO VỆ AN TOÀN: Nếu dets không phải là mảng hoặc rỗng thì return ngay, tránh crash
    if (!dets || !Array.isArray(dets)) {
        return;
    }

    let currentCentroids = [];

    // Lấy tọa độ trung tâm của các đối tượng vừa detect được trong frame hiện tại
    dets.forEach(det => {
        if (!det.box || det.box.length < 4) return;
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

    let objectIDs = Object.keys(trackedObjects);
    
    currentCentroids.forEach(item => {
        let [cx, cy] = item.centroid;
        let minDist = Infinity;
        let matchedID = null;

        objectIDs.forEach(id => {
            let tObj = trackedObjects[id];
            if (tObj.className === item.className) {
                let dist = Math.hypot(tObj.centroid[0] - cx, tObj.centroid[1] - cy);
                if (dist < minDist && dist < 60) {
                    minDist = dist;
                    matchedID = id;
                }
            }
        });

        if (matchedID !== null) {
            let oldY = trackedObjects[matchedID].centroid[1];
            let newY = cy;
            let countingLine = lineY || (canvasHeight / 2);
            
            if (!countedTrackIDs.has(matchedID)) {
                if ((oldY < countingLine && newY >= countingLine) || (oldY > countingLine && newY <= countingLine)) {
                    let type = item.className;
                    if (vehicleStats[type]) {
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
            trackedObjects[nextObjectID] = {
                centroid: [cx, cy],
                className: item.className,
                counted: false,
                lastSeen: 0
            };
            nextObjectID++;
        }
    });

    // Dọn dẹp các đối tượng đã biến mất khỏi khung hình
    Object.keys(trackedObjects).forEach(id => {
        trackedObjects[id].lastSeen++;
        if (trackedObjects[id].lastSeen > 20) {
            delete trackedObjects[id];
        }
    });
}