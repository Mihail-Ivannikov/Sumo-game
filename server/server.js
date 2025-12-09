const express = require("express");
const http = require("http");
const path = require("path"); 
const { Server } = require("socket.io");
const RoomManager = require("./RoomManager");

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "../client")));

const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});

const rooms = new RoomManager(io);

io.on("connection", (socket) => {
    console.log(`[Connect] ${socket.id}`);
    let player = null;
    let room = null;

    // --- HELPER: Handle cleanup when player leaves/disconnects ---
    const handleLeave = () => {
        if (!player || !room) return;
        
        const roomId = rooms.removePlayer(player.id);
        console.log(`[Left] ${player.username} (${roomId})`);

        if (roomId) {
            const r = rooms.getRoom(roomId);
            if (r) {
                io.to(roomId).emit("room-updated", { players: r.players.map(p => p.toJSON()) });
                if (r.readyInterval) {
                    clearInterval(r.readyInterval);
                    r.startReadyTimer = null;
                    r.readyInterval = null;
                    io.to(roomId).emit("ready-timer", "Waiting for players...");
                }
            }
        }
        player = null;
        room = null;
    };

    socket.on("join-game", (username) => {
        if (player || room) return;

        const result = rooms.addPlayer(socket);
        room = result.room;
        player = result.player;
        player.username = username.slice(0, 10);

        console.log(`[Join] ${player.username} -> ${room.id}`);

        socket.emit("joined-room", { roomId: room.id, playerId: player.id });
        io.to(room.id).emit("room-updated", { players: room.players.map(p => p.toJSON()) });
    });

    socket.on("leave-lobby", handleLeave);
    socket.on("disconnect", handleLeave);

    socket.on("player-ready", () => {
        if (!player || !room) return;

        player.ready = true;
        io.to(room.id).emit("room-updated", { players: room.players.map(p => p.toJSON()) });

        if (room.players.length < 2) return;

        // Timer Logic
        const resetTimer = () => {
            if (room.readyInterval) {
                clearInterval(room.readyInterval);
                room.startReadyTimer = null;
                room.readyInterval = null;
            }
        };

        if (room.allReady()) {
            resetTimer();
            room.startTimer = 3;
            room.startGame(io);
        } else if (!room.startReadyTimer) {
            room.startReadyTimer = 20;
            room.readyInterval = setInterval(() => {
                room.startReadyTimer--;
                io.to(room.id).emit("ready-timer", room.startReadyTimer);

                if (!room.players.every(p => p.ready)) {
                    resetTimer();
                    return;
                }

                if (room.startReadyTimer <= 0) {
                    resetTimer();
                    room.startTimer = 3;
                    room.startGame(io);
                }
            }, 1000);
        }
    });

    socket.on("input", (data) => {
        if (player?.alive) {
            player.inputX = data.vx || 0;
            player.inputY = data.vy || 0;
        }
    });

    socket.on("ability", (data) => {
        if (player?.alive) {
            const name = typeof data === 'string' ? data : data.name;
            const params = typeof data === 'object' ? data : {};
            
            if (player.useAbility(name, params)) {
                io.to(room.id).emit("ability-used", { playerId: player.id, ability: name });
            }
        }
    });
});

server.listen(3000, () => {
    console.log(`Server running on http://localhost:3000`);
});