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
    console.log(`[${new Date().toISOString()}] Connection: ${socket.id}`);

    // Add player to a room immediately (in background)
    const { room, player } = rooms.addPlayer(socket);

    // Send room info to player
    socket.emit("joined-room", {
        roomId: room.id,
        playerId: player.id
    });

    // We do NOT broadcast "room-updated" yet because the player 
    // hasn't entered their username. They are invisible in the lobby.

    // ----------------------
    // NEW: JOIN GAME (Set Username)
    // ----------------------
    socket.on("join-game", (username) => {
        player.username = username.slice(0, 10); // Limit length
        console.log(`Player ${player.id} set username: ${player.username}`);

        // NOW we broadcast to the room so they appear in the lobby
        io.to(room.id).emit("room-updated", {
            players: room.players.map(p => p.toJSON())
        });
    });

    // ----------------------
    // PLAYER READY
    // ----------------------
    socket.on("player-ready", () => {
        player.ready = true;
        console.log(`[${new Date().toISOString()}] ${player.username} is READY`);

        io.to(room.id).emit("room-updated", {
            players: room.players.map(p => p.toJSON())
        });

        // 20s Waiting Logic
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
                    // Trigger the 3-2-1 countdown
                    room.startTimer = 3; 
                    room.startGame(io);
                }
            }, 1000);
        }

        // Immediate Start Logic
        if (room.allReady()) {
            if (room.readyInterval) {
                clearInterval(room.readyInterval);
                room.startReadyTimer = null;
                room.readyInterval = null;
            }
            // Trigger the 3-2-1 countdown
            room.startTimer = 3; 
            room.startGame(io);
        }
    });

    socket.on("input", (data) => {
        if (!player.alive) return;
        player.inputX = data.vx || 0;
        player.inputY = data.vy || 0;
    });

    socket.on("ability", (data) => {
        if (!player.alive) return;
        const abilityName = typeof data === 'string' ? data : data.name;
        const params = typeof data === 'object' ? data : {};

        const used = player.useAbility(abilityName, params);
        if (!used) return;

        io.to(room.id).emit("ability-used", {
            playerId: player.id,
            ability: abilityName
        });
    });

    socket.on("disconnect", () => {
        const roomId = rooms.removePlayer(player.id);
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
                }
            }
        }
    });
});

server.listen(3000, () => {
    console.log(`[${new Date().toISOString()}] Server running on http://localhost:3000`);
});