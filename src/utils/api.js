import axios from 'axios';

// ใช้ IP address ของเครื่องแทน localhost
// หรือใช้ environment variable
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
// const baseURL =  'http://localhost:3001/api';

// สร้าง axios instance with default config
const api = axios.create({
    baseURL: baseURL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

export default api;
