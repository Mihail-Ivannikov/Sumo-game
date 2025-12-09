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
    // The user is connected, but NOT in a room yet.
    let player = null;
    let room = null;

    // ----------------------
    // JOIN GAME (Triggered by "Join Game" button)
    // ----------------------
    socket.on("join-game", (username) => {
        // Guard: If already in a room, ignore (prevents double clicking)
        if (player || room) return;

        // 2. NOW we add the player to a room
        const result = rooms.addPlayer(socket);
        room = result.room;
        player = result.player;

        // Set username
        player.username = username.slice(0, 10); 
        console.log(`[${new Date().toISOString()}] Player joined room ${room.id} as ${player.username}`);

        // Send room info to THIS player
        socket.emit("joined-room", {
            roomId: room.id,
            playerId: player.id
        });

        // Broadcast to EVERYONE in the room (so they see the new name)
        io.to(room.id).emit("room-updated", {
            players: room.players.map(p => p.toJSON())
        });
    });

    // ----------------------
    // PLAYER READY
    // ----------------------
    socket.on("player-ready", () => {
        if (!player || !room) return; // Security check

        player.ready = true;
        console.log(`[${new Date().toISOString()}] ${player.username} is READY`);

        io.to(room.id).emit("room-updated", {
            players: room.players.map(p => p.toJSON())
        });

        // --- NEW CHECK: Don't start any timers if there is only 1 player ---
        // If there are less than 2 players, we just sit and wait.
        if (room.players.length < 2) {
            return;
        }
        // -------------------------------------------------------------------

        // Start 20s countdown if not all ready yet
        if (!room.startReadyTimer) {
            room.startReadyTimer = 20;
            room.readyInterval = setInterval(() => {
                room.startReadyTimer--;
                io.to(room.id).emit("ready-timer", room.startReadyTimer);

                // Check if players unreadied or left
                if (!room.players.every(p => p.ready)) {
                    clearInterval(room.readyInterval);
                    room.startReadyTimer = null;
                    room.readyInterval = null;
                    return;
                }

                // Timer expired → start game
                if (room.startReadyTimer <= 0) {
                    clearInterval(room.readyInterval);
                    room.startReadyTimer = null;
                    room.readyInterval = null;
                    room.startTimer = 3; 
                    room.startGame(io);
                }
            }, 1000);
        }

        // Immediate Start Logic (if everyone pressed ready and count >= 2)
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

    // ----------------------
    // INPUTS & ABILITIES
    // ----------------------
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
        // Only try to remove if they actually joined a room
        if (player && room) {
            const roomId = rooms.removePlayer(player.id);
            console.log(`[${new Date().toISOString()}] Player ${player.username} disconnected`);

            if (roomId) {
                const r = rooms.getRoom(roomId);
                if (r) {
                    io.to(roomId).emit("room-updated", {
                        players: r.players.map(p => p.toJSON())
                    });
                    
                    // Reset ready timer if someone disconnected
                    if (r.readyInterval) {
                        clearInterval(r.readyInterval);
                        r.startReadyTimer = null;
                        r.readyInterval = null;
                        // Optional: Clear the timer on client screen too
                        io.to(roomId).emit("ready-timer", "Waiting for players..."); 
                    }
                }
            }
        } else {
            console.log(`[${new Date().toISOString()}] Socket disconnected (was at login screen)`);
        }
    });
});

server.listen(3000, () => {
    console.log(`[${new Date().toISOString()}] Server running on http://localhost:3000`);
});