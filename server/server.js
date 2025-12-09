// server/server.js
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
    console.log(`[${new Date().toISOString()}] Connection established: ${socket.id} (Waiting for login)`);

    // 1. Initialize variables as NULL. 
    let player = null;
    let room = null;

    // ----------------------
    // JOIN GAME
    // ----------------------
    socket.on("join-game", (username) => {
        if (player || room) return;

        const result = rooms.addPlayer(socket);
        room = result.room;
        player = result.player;

        player.username = username.slice(0, 10); 
        console.log(`[${new Date().toISOString()}] Player joined room ${room.id} as ${player.username}`);

        socket.emit("joined-room", {
            roomId: room.id,
            playerId: player.id
        });

        io.to(room.id).emit("room-updated", {
            players: room.players.map(p => p.toJSON())
        });
    });

    // ----------------------
    // LEAVE LOBBY (NEW)
    // ----------------------
    socket.on("leave-lobby", () => {
        if (player && room) {
            const roomId = rooms.removePlayer(player.id);
            console.log(`[${new Date().toISOString()}] Player ${player.username} left lobby manually`);

            if (roomId) {
                const r = rooms.getRoom(roomId);
                if (r) {
                    io.to(roomId).emit("room-updated", {
                        players: r.players.map(p => p.toJSON())
                    });
                    // If countdown was happening, it will be stopped by removePlayer logic
                    // but we ensure UI update here if needed
                    if (r.readyInterval) {
                        clearInterval(r.readyInterval);
                        r.startReadyTimer = null;
                        r.readyInterval = null;
                        io.to(roomId).emit("ready-timer", "Waiting for players...");
                    }
                }
            }
        }
        
        // CRITICAL: Reset these so the socket can join a new room
        player = null;
        room = null;
    });

    // ----------------------
    // PLAYER READY
    // ----------------------
    socket.on("player-ready", () => {
        if (!player || !room) return; 

        player.ready = true;
        console.log(`[${new Date().toISOString()}] ${player.username} is READY`);

        io.to(room.id).emit("room-updated", {
            players: room.players.map(p => p.toJSON())
        });

        // Don't start if < 2 players
        if (room.players.length < 2) {
            return;
        }

        if (!room.startReadyTimer) {
            room.startReadyTimer = 20;
            room.readyInterval = setInterval(() => {
                room.startReadyTimer--;
                io.to(room.id).emit("ready-timer", room.startReadyTimer);

                if (!room.players.every(p => p.ready)) {
                    clearInterval(room.readyInterval);
                    room.startReadyTimer = null;
                    room.readyInterval = null;
                    return;
                }

                if (room.startReadyTimer <= 0) {
                    clearInterval(room.readyInterval);
                    room.startReadyTimer = null;
                    room.readyInterval = null;
                    room.startTimer = 3; 
                    room.startGame(io);
                }
            }, 1000);
        }

        if (room.allReady()) {
            if (room.readyInterval) {
                clearInterval(room.readyInterval);
                room.startReadyTimer = null;
                room.readyInterval = null;
            }
            room.startTimer = 3; 
            room.startGame(io);
        }
    });

    socket.on("input", (data) => {
        if (!player || !room || !player.alive) return;
        player.inputX = data.vx || 0;
        player.inputY = data.vy || 0;
    });

    socket.on("ability", (data) => {
        if (!player || !room || !player.alive) return;
        const abilityName = typeof data === 'string' ? data : data.name;
        const params = typeof data === 'object' ? data : {};
        const used = player.useAbility(abilityName, params);
        if (!used) return;
        io.to(room.id).emit("ability-used", {
            playerId: player.id,
            ability: abilityName
        });
    });

    // ----------------------
    // DISCONNECT
    // ----------------------
    socket.on("disconnect", () => {
        if (player && room) {
            const roomId = rooms.removePlayer(player.id);
            console.log(`[${new Date().toISOString()}] Player ${player.username} disconnected`);

            if (roomId) {
                const r = rooms.getRoom(roomId);
                if (r) {
                    io.to(roomId).emit("room-updated", {
                        players: r.players.map(p => p.toJSON())
                    });
                    if (r.readyInterval) {
                        clearInterval(r.readyInterval);
                        r.startReadyTimer = null;
                        r.readyInterval = null;
                        io.to(roomId).emit("ready-timer", "Waiting for players...");
                    }
                }
            }
        }
    });
});

server.listen(3000, () => {
    console.log(`[${new Date().toISOString()}] Server running on http://localhost:3000`);
});