// tracking.js - Quản lý tracking, gán ID và đếm phương tiện giao thông

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
}

let trackedObjects = {};
let nextObjectID = 1;
let countedTrackIDs = new Set();

export function getTrackedObjects() {
    return trackedObjects;
}

export function matchAndCountVehicles(dets, canvasWidth, canvasHeight, lineY) {
    if (!dets || !Array.isArray(dets)) return;

    let currentCentroids = [];
    dets.forEach(det => {
        if (!det.box || det.box.length < 4) return;
        let [x1, y1, x2, y2] = det.box;
        let cx = (x1 + x2) / 2;
        let cy = (y1 + y2) / 2;
        currentCentroids.push({ centroid: [cx, cy], box: det.box, className: det.className, score: det.score });
    });

    if (Object.keys(trackedObjects).length === 0) {
        currentCentroids.forEach(item => {
            trackedObjects[nextObjectID] = { centroid: item.centroid, className: item.className, counted: false, lastSeen: 0 };
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
            if (tObj && tObj.className === item.className) {
                let dist = Math.hypot(tObj.centroid[0] - cx, tObj.centroid[1] - cy);
                if (dist < minDist && dist < 100) { // Khoảng cách tối đa giữa 2 frame liên tiếp
                    minDist = dist;
                    matchedID = id;
                }
            }
        });

        if (matchedID !== null) {
            let oldY = trackedObjects[matchedID].centroid[1];
            let newY = cy;
            let countingLine = lineY || (canvasHeight / 2);
            
            // Kiểm tra xem xe đã vượt qua vạch đếm chưa
            if (!countedTrackIDs.has(matchedID)) {
                if ((oldY < countingLine && newY >= countingLine) || (oldY > countingLine && newY <= countingLine)) {
                    let type = item.className;
                    if (vehicleStats[type]) {
                        let isLeft = cx < (canvasWidth / 2);
                        if (isLeft) vehicleStats[type].left++;
                        else vehicleStats[type].right++;
                        vehicleStats[type].total++;
                        
                        countedTrackIDs.add(matchedID);
                        trackedObjects[matchedID].counted = true;
                    }
                }
            }
            trackedObjects[matchedID].centroid = [cx, cy];
            trackedObjects[matchedID].lastSeen = 0;
        } else {
            trackedObjects[nextObjectID] = { centroid: [cx, cy], className: item.className, counted: false, lastSeen: 0 };
            nextObjectID++;
        }
    });

    // Dọn dẹp các đối tượng mất tích quá lâu trên khung hình
    Object.keys(trackedObjects).forEach(id => {
        trackedObjects[id].lastSeen++;
        if (trackedObjects[id].lastSeen > 25) {
            delete trackedObjects[id];
        }
    });
}