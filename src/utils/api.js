import axios from 'axios';

// สร้าง axios instance with default config
const api = axios.create({
    baseURL: 'http://localhost:3001/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

export default api;
