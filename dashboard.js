// dashboard.js - Quản lý giao diện, bảng điều khiển, thống kê đếm xe và xuất dữ liệu

import { vehicleStats, resetVehicleStats } from './tracking.js';

export function updateUIStats() {
    let car = vehicleStats.car;
    let moto = vehicleStats.motorcycle;
    let bus = vehicleStats.bus;
    let truck = vehicleStats.truck;

    // Cập nhật số liệu chi tiết Làn Trái / Làn Phải / Tổng từng loại xe
    setInnerText('count-car-left', car.left);
    setInnerText('count-car-right', car.right);
    setInnerText('count-car', car.total);

    setInnerText('count-moto-left', moto.left);
    setInnerText('count-moto-right', moto.right);
    setInnerText('count-moto', moto.total);

    setInnerText('count-bus-left', bus.left);
    setInnerText('count-bus-right', bus.right);
    setInnerText('count-bus', bus.total);

    setInnerText('count-truck-left', truck.left);
    setInnerText('count-truck-right', truck.right);
    setInnerText('count-truck', truck.total);

    const totalLeft = car.left + moto.left + bus.left + truck.left;
    const totalRight = car.right + moto.right + bus.right + truck.right;
    const grandTotal = totalLeft + totalRight;

    setInnerText('count-left-total', totalLeft);
    setInnerText('count-right-total', totalRight);
    setInnerText('count-total', grandTotal);

    updateDensityStatus(grandTotal);
}

function setInnerText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function updateDensityStatus(total) {
    let density = 'LOW';
    let dClass = 'density-low';
    if (total >= 40) {
        density = 'HIGH';
        dClass = 'density-high';
    } else if (total >= 15) {
        density = 'MEDIUM';
        dClass = 'density-med';
    }

    const badge = document.getElementById('density-status');
    if (badge) {
        badge.className = `density-badge ${dClass}`;
        badge.innerText = density;
    }

    const banner = document.getElementById('congestion-banner');
    if (banner) {
        if (density === 'HIGH') {
            banner.style.background = '#dc2626';
            banner.innerText = '⚠️ CẢNH BÁO UN TẮC GIAO THÔNG';
        } else {
            banner.style.background = '#16a34a';
            banner.innerText = '✓ GIAO THÔNG BÌNH THƯỜNG';
        }
    }
}

export function setStatus(type, message) {
    const statusBadge = document.getElementById('system-status');
    if (!statusBadge) return;
    statusBadge.innerText = message;
    statusBadge.className = `status-pill ${type}`;
}

export function initDashboardEvents() {
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            resetVehicleStats();
            updateUIStats();
        });
    }

    const btnExport = document.getElementById('btn-export-excel');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            exportToExcel();
        });
    }
}

export function exportToExcel() {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Loại phương tiện,Làn Trái,Làn Phải,Tổng cộng\n";
    
    for (let key in vehicleStats) {
        const item = vehicleStats[key];
        csvContent += `${key.toUpperCase()},${item.left},${item.right},${item.total}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `traffic_statistics_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}