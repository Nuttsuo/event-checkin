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
        origin: "*", // อนุญาตทุก domain (สำหรับ development)
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// เปิด CORS สำหรับทุก origin
app.use(cors({
    origin: "*", // อนุญาตทุก domain
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
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
            Company as company,
            Phone_No as phone,
            Allergies as allergies,
            checked_in,
            checked_in_time,
            Food,
            Position,
            remark
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
    const { name, email, company, phone, allergies, food, position, remark } = req.body;
    const uuid = uuidv4();

    db.query(
        'INSERT INTO guestinfo (uuid, Name, Email, Company, Phone_No, Allergies, Food, Position, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuid, name, email || '', company, phone, allergies, food || '', position || '', remark || ''],
        (err, result) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // ส่ง event เพื่อ refresh data ในทุกเครื่อง
            io.emit('data-updated', { 
                type: 'guest-added',
                uuid: uuid,
                name: name
            });
            
            res.json({ id: result.insertId, uuid });
        }
    );
});

app.post('/api/checkin/:uuid', (req, res) => {
    const { uuid } = req.params;

    // ก่อนอื่นให้เช็คว่าแขกมีอยู่จริงหรือไม่
    db.query('SELECT uuid, Name as name, Company as company, checked_in FROM guestinfo WHERE uuid = ?', [uuid], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (results.length === 0) {
            // ไม่เจอแขก
            res.status(404).json({ message: 'Guest not found' });
            return;
        }

        const guest = results[0];
        
        if (guest.checked_in === 'TRUE') {
            // แขกเช็คอินแล้ว
            res.status(409).json({ 
                message: 'Already checked in', 
                guest: {
                    name: guest.name,
                    company: guest.company
                }
            });
            return;
        }

        // ถ้าแขกยังไม่เช็คอิน ให้ทำการเช็คอิน
        db.query(
            'UPDATE guestinfo SET checked_in = "TRUE", checked_in_time = DATE_FORMAT(NOW(), "%d-%m-%Y %H:%i") WHERE uuid = ?',
            [uuid],
            (err, result) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                // Emit check-in event to all connected clients
                io.emit('guest-checkin', guest);
                
                // ส่ง event เพื่อ refresh data ในทุกเครื่อง
                io.emit('data-updated', { 
                    type: 'guest-checkin',
                    uuid: uuid,
                    name: guest.name
                });

                res.json(guest);
            }
        );
    });
});

// Update guest status endpoint
app.put('/api/guests/:uuid', (req, res) => {
    const { uuid } = req.params;
    const { checked_in, Food } = req.body;

    console.log('=== PUT /api/guests/:uuid ===');
    console.log('UUID:', uuid);
    console.log('Request body:', req.body);
    console.log('checked_in:', checked_in);
    console.log('Food:', Food);

    // ก่อนอัพเดต ให้ดึงข้อมูลเดิมมาตรวจสอบก่อน
    db.query('SELECT checked_in FROM guestinfo WHERE uuid = ?', [uuid], (err, currentResults) => {
        if (err) {
            console.error('Error getting current guest data:', err);
            res.status(500).json({ message: err.message });
            return;
        }

        if (currentResults.length === 0) {
            res.status(404).json({ message: 'Guest not found' });
            return;
        }

        const currentCheckedIn = currentResults[0].checked_in;
        console.log('Current checked_in status:', currentCheckedIn);
        console.log('New checked_in status:', checked_in);

        // ตรวจสอบว่าต้องการอัพเดตอะไร
        if (checked_in !== undefined && Food !== undefined) {
            // อัพเดตทั้ง checked_in และ Food
            let timeQuery;
            if (checked_in === 'TRUE') {
                timeQuery = 'UPDATE guestinfo SET checked_in = ?, Food = ?, checked_in_time = DATE_FORMAT(NOW(), "%d-%m-%Y %H:%i") WHERE uuid = ?';
            } else {
                timeQuery = 'UPDATE guestinfo SET checked_in = ?, Food = ?, checked_in_time = NULL WHERE uuid = ?';
            }

            db.query(
                timeQuery,
                [checked_in, Food, uuid],
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

                    console.log('Updated both checked_in and Food successfully');

                    // ส่ง event เพื่อ refresh data ในทุกเครื่อง
                    io.emit('data-updated', { 
                        type: 'guest-updated',
                        uuid: uuid,
                        checked_in: checked_in,
                        food: Food
                    });

                    // **ส่ง toast ไป landing page เฉพาะตอนที่เปลี่ยนจาก FALSE เป็น TRUE เท่านั้น**
                    const isNewCheckIn = (currentCheckedIn === 'FALSE' || currentCheckedIn === false) && checked_in === 'TRUE';
                    console.log('Is new check-in?', isNewCheckIn);

                    if (isNewCheckIn) {
                        db.query('SELECT uuid, Name as name, Company as company FROM guestinfo WHERE uuid = ?', [uuid], (err, results) => {
                            if (err) {
                                res.status(500).json({ message: err.message });
                                return;
                            }

                            const guest = results[0];
                            // ส่ง event ไปให้ landing page แสดง popup
                            io.emit('guest-checkin', guest);
                            console.log('Sent guest-checkin event to landing page');

                            res.json({ 
                                message: 'Guest checked in successfully',
                                guest: guest,
                                showPopup: true 
                            });
                        });
                    } else {
                        // ไม่ใช่ check-in ใหม่ แค่อัพเดตข้อมูล
                        res.json({ 
                            message: checked_in === 'TRUE' ? 'Guest data updated (already checked in)' : 'Guest data updated successfully',
                            showPopup: false 
                        });
                    }
                }
            );
        } else if (checked_in !== undefined) {
            // อัพเดต checked_in เท่านั้น
            let timeQuery;
            if (checked_in === 'TRUE') {
                timeQuery = 'UPDATE guestinfo SET checked_in = ?, checked_in_time = DATE_FORMAT(NOW(), "%d-%m-%Y %H:%i") WHERE uuid = ?';
            } else {
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

                    console.log('Updated checked_in successfully');

                    // ส่ง event เพื่อ refresh data ในทุกเครื่อง
                    io.emit('data-updated', { 
                        type: 'guest-status-changed',
                        uuid: uuid,
                        checked_in: checked_in
                    });

                    // **ส่ง toast ไป landing page เฉพาะตอนที่เปลี่ยนจาก FALSE เป็น TRUE เท่านั้น**
                    const isNewCheckIn = (currentCheckedIn === 'FALSE' || currentCheckedIn === false) && checked_in === 'TRUE';
                    console.log('Is new check-in?', isNewCheckIn);

                    if (isNewCheckIn) {
                        db.query('SELECT uuid, Name as name, Company as company FROM guestinfo WHERE uuid = ?', [uuid], (err, results) => {
                            if (err) {
                                res.status(500).json({ message: err.message });
                                return;
                            }

                            const guest = results[0];
                            // ส่ง event ไปให้ landing page แสดง popup
                            io.emit('guest-checkin', guest);
                            console.log('Sent guest-checkin event to landing page');

                            res.json({ 
                                message: 'Guest checked in successfully',
                                guest: guest,
                                showPopup: true 
                            });
                        });
                    } else {
                        res.json({ 
                            message: checked_in === 'TRUE' ? 'Guest data updated (already checked in)' : 'Guest status updated successfully',
                            showPopup: false 
                        });
                    }
                }
            );
        } else if (Food !== undefined) {
            // อัพเดต Food เท่านั้น
            db.query(
                'UPDATE guestinfo SET Food = ? WHERE uuid = ?',
                [Food, uuid],
                (err, result) => {
                    if (err) {
                        console.error('Error updating guest food:', err);
                        res.status(500).json({ message: err.message });
                        return;
                    }

                    if (result.affectedRows === 0) {
                        res.status(404).json({ message: 'Guest not found' });
                        return;
                    }

                    console.log('Updated Food successfully');

                    // ส่ง event เพื่อ refresh data ในทุกเครื่อง
                    io.emit('data-updated', { 
                        type: 'guest-food-changed',
                        uuid: uuid,
                        food: Food
                    });

                    res.json({ 
                        message: 'Guest food preference updated successfully',
                        food: Food,
                        showPopup: false  // ไม่ส่ง popup สำหรับการอัพเดต food
                    });
                }
            );
        } else {
            res.status(400).json({ message: 'No valid fields to update' });
        }
    });
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

            // ส่ง event เพื่อ refresh data ในทุกเครื่อง
            io.emit('data-updated', { 
                type: 'guest-deleted',
                uuid: uuid
            });

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
const HOST = '0.0.0.0'; // Listen on all interfaces

server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    // console.log(`Accessible from network at http://192.168.1.137:${PORT}`);
});
