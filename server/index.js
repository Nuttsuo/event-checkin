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
        'INSERT INTO stg.guestinfo (uuid, Name, Email, Company, Phone_No, Allergies) VALUES (?, ?, ?, ?, ?, ?)',
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

app.post('/api/checkin/:uuid', (req, res) => {
    const { uuid } = req.params;

    db.query(
        'UPDATE stg.guestinfo SET checked_in = TRUE, checked_in_time = NOW() WHERE uuid = ? AND checked_in = FALSE',
        [uuid],
        (err, result) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (result.affectedRows === 0) {
                res.status(404).json({ message: 'Guest not found or already checked in' });
                return;
            }

            // Get guest details
            db.query('SELECT * FROM stg.guestinfo WHERE uuid = ?', [uuid], (err, results) => {
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
