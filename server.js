const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// إعداد CORS للسماح بالاتصال من أي نطاق (Frontend)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// لتقديم الملفات الثابتة في حال أردت تشغيله محلياً
app.use(express.static(__dirname));

// كائن لتخزين بيانات الغرف واللاعبين
const rooms = {};

io.on('connection', (socket) => {
    console.log('مستخدم جديد متصل، المعرف:', socket.id);

    // معالجة الانضمام إلى غرفة
    socket.on('joinRoom', (roomCode) => {
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [] };
        }

        const room = rooms[roomCode];

        if (room.players.length === 0) {
            room.players.push({ id: socket.id, color: 'white' });
            socket.join(roomCode);
            socket.emit('roomJoined', { color: 'white' });
            console.log(`اللاعب ${socket.id} انضم كأبيض للغرفة: ${roomCode}`);
            
        } else if (room.players.length === 1) {
            room.players.push({ id: socket.id, color: 'black' });
            socket.join(roomCode);
            socket.emit('roomJoined', { color: 'black' });
            console.log(`اللاعب ${socket.id} انضم كأسود للغرفة: ${roomCode}`);
            
        } else {
            socket.emit('roomFull');
        }
    });

    // استقبال الحركة من لاعب وإرسالها للخصم
    socket.on('move', (data) => {
        socket.to(data.room).emit('receiveMove', data);
    });

    // استقبال رمية النرد وإرسالها للخصم
    socket.on('diceRolled', (data) => {
        socket.to(data.room).emit('receiveDice', data);
    });

    // معالجة قطع الاتصال (خروج لاعب)
    socket.on('disconnect', () => {
        console.log('مستخدم غادر:', socket.id);
        
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                socket.to(roomCode).emit('opponentLeft');
                
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`سيرفر لعبة الطاولة يعمل بنجاح على البورت ${PORT}`);
});