import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// MySQL Connection with connection pool
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'P@ssw0rd',
    database: 'event_checkin',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Routes
app.get('/api/guests', (req, res) => {
    if (!db) {
        res.status(500).json({ error: 'Database connection not established' });
        return;
    }

    db.promise().query(`
        SELECT 
            uuid,
            Name as name,
            Email as email,
            Company as company,
            Phone_No as phone,
            Allergies as allergies,
            checked_in,
            checked_in_time
        FROM guestinfo 
        ORDER BY Name
    `)
        .then(([rows]) => {
            console.log('Fetched guests:', rows.length);
            res.json(rows);
        })
        .catch(error => {
            console.error('Error fetching guests:', error);
            res.status(500).json({
                error: 'Failed to fetch guests',
                details: error.message
            });
        });
});

app.post('/api/guests', (req, res) => {
    const { name, email, company, phone, allergies } = req.body;
    const uuid = uuidv4();

    db.query(
        'INSERT INTO guestinfo (uuid, Name, Email, Company, Phone_No, Allergies) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid, name, email, company, phone, allergies],
        (err, result) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: result.insertId, uuid });
        }
    );
});

// Check-in guest Normal
// This endpoint is used to check in a guest by UUID
app.post('/api/checkin/:uuid', (req, res) => {
    const { uuid } = req.params;

    db.query(
        'UPDATE guestinfo SET checked_in = "TRUE", checked_in_time = DATE_FORMAT(NOW(), "%d-%m-%Y %H:%i") WHERE uuid = ? AND checked_in = "FALSE"',
        [uuid],
        (err, result) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (result.affectedRows === 0) {
                res.status(404).json({ message: 'Guest not found or already checked in'});
                return;
            }

            // Get guest details
            db.query('SELECT uuid, Name as name, Company as company FROM guestinfo WHERE uuid = ?', [uuid], (err, results) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                const guest = results[0];
                // Emit check-in event to all connected clients
                io.emit('guest-checkin', guest);

                res.json(guest);
            });
        }
    );
});

// Update guest status endpoint
app.put('/api/guests/:uuid', (req, res) => {
    const { uuid } = req.params;
    const { checked_in } = req.body;

    // กำหนดค่า checked_in_time ตามสถานะ
    let timeQuery;
    if (checked_in === 'TRUE') {
        // ถ้าเปลี่ยนเป็น TRUE ให้ stamp เวลาใหม่ (วันที่และเวลา)
        timeQuery = 'UPDATE guestinfo SET checked_in = ?, checked_in_time = DATE_FORMAT(NOW(), "%d-%m-%Y %H:%i") WHERE uuid = ?';
    } else {
        // ถ้าเปลี่ยนเป็น FALSE ให้ลบเวลา (NULL)
        timeQuery = 'UPDATE guestinfo SET checked_in = ?, checked_in_time = NULL WHERE uuid = ?';
    }

    db.query(
        timeQuery,
        [checked_in, uuid],
        (err, result) => {
            if (err) {
                console.error('Error updating guest:', err);
                res.status(500).json({ message: err.message });
                return;
            }

            if (result.affectedRows === 0) {
                res.status(404).json({ message: 'Guest not found' });
                return;
            }

            // ถ้าเปลี่ยนเป็น TRUE ให้ดึงข้อมูล guest และส่ง socket event
            if (checked_in === 'TRUE') {
                db.query('SELECT uuid, Name as name, Company as company FROM guestinfo WHERE uuid = ?', [uuid], (err, results) => {
                    if (err) {
                        res.status(500).json({ message: err.message });
                        return;
                    }

                    const guest = results[0];
                    // ส่ง event ไปให้ landing page แสดง popup
                    io.emit('guest-checkin', guest);

                    res.json({ 
                        message: 'Guest status updated successfully',
                        guest: guest,
                        showPopup: true 
                    });
                });
            } else {
                // ถ้าเปลี่ยนเป็น FALSE ไม่ต้องส่ง socket event
                res.json({ 
                    message: 'Guest status updated successfully',
                    showPopup: false 
                });
            }
        }
    );
});

// Delete guest endpoint
app.delete('/api/guests/:uuid', (req, res) => {
    const { uuid } = req.params;

    db.query(
        'DELETE FROM guestinfo WHERE uuid = ?',
        [uuid],
        (err, result) => {
            if (err) {
                console.error('Error deleting guest:', err);
                res.status(500).json({ error: 'Failed to delete guest' });
                return;
            }

            if (result.affectedRows === 0) {
                res.status(404).json({ error: 'Guest not found' });
                return;
            }

            res.json({ 
                message: 'Guest deleted successfully',
                deletedRows: result.affectedRows 
            });
        }
    );
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
