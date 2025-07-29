import api from './api';

class CheckInQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    async add(uuid) {
        return new Promise((resolve, reject) => {
            // เพิ่ม request เข้า queue พร้อมกับ callback functions
            this.queue.push({
                uuid,
                resolve,
                reject
            });

            // ถ้ายังไม่มีการประมวลผล queue ให้เริ่มประมวลผล
            if (!this.isProcessing) {
                this.processQueue();
            }
        });
    }

    async processQueue() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const { uuid, resolve, reject } = this.queue.shift();

        try {
            // เรียก API check-in
            const response = await api.post(`/checkin/${uuid}`);
            resolve(response);
        } catch (error) {
            reject(error);
        }

        // ประมวลผล request ถัดไปใน queue
        this.processQueue();
    }
}

// สร้าง singleton instance
export const checkInQueue = new CheckInQueue();
