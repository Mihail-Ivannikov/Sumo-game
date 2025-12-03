// server/server.js
const express = require("express");
const http = require("http");
const path = require("path"); // IMPORT PATH MODULE
const { Server } = require("socket.io");

const RoomManager = require("./RoomManager");

const app = express();
const server = http.createServer(app);

// 1. ENABLE STATIC FILE SERVING
// This allows you to go to http://localhost:3000 and play the game
// properly without needing a separate client server for testing.
app.use(express.static(path.join(__dirname, "../client")));

// 2. SOCKET SETUP
// cors: "*" allows connections from GitHub Pages or other domains later.
const io = new Server(server, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    } 
});

// Initialize RoomManager
const rooms = new RoomManager(io);

// ----------------------
// CLIENT CONNECTION
// ----------------------
io.on("connection", (socket) => {
    console.log(`[${new Date().toISOString()}] Player connected: socketId=${socket.id}`);

    // Add player to a room
    const { room, player } = rooms.addPlayer(socket);

    // Send room info to player
    socket.emit("joined-room", {
        roomId: room.id,
        playerId: player.id
    });

    console.log(`[${new Date().toISOString()}] Player ${player.id} joined room ${room.id}`);

    // Broadcast updated room state to all in the room
    io.to(room.id).emit("room-updated", {
        players: room.players.map(p => p.toJSON())
    });

    // ----------------------
    // PLAYER READY
    // ----------------------
    socket.on("player-ready", () => {
        player.ready = true;
        console.log(`[${new Date().toISOString()}] Player ${player.id} is READY`);

        io.to(room.id).emit("room-updated", {
            players: room.players.map(p => p.toJSON())
        });

        // Start 20s countdown if not all ready yet
        if (!room.startReadyTimer) {
            room.startReadyTimer = 20;
            room.readyInterval = setInterval(() => {
                room.startReadyTimer--;
                io.to(room.id).emit("ready-timer", room.startReadyTimer);

                // Reset timer if someone becomes unready or disconnects
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

        // If all ready before 20s, start 3…2…1 countdown immediately
        if (room.allReady()) {
            if (room.readyInterval) {
                clearInterval(room.readyInterval);
                room.startReadyTimer = null;
                room.readyInterval = null;
            }
            console.log(`[${new Date().toISOString()}] All players ready, starting game...`);
            room.startTimer = 3; 
            room.startGame(io);
        }
    });

    // ----------------------
    // PLAYER INPUT (Movement)
    // ----------------------
    socket.on("input", (data) => {
        if (!player.alive) return;

        // Use vx/vy from client
        player.inputX = data.vx || 0;
        player.inputY = data.vy || 0;

        // Trigger abilities if sent in input packet (legacy support)
        if (data.abilities) {
            Object.keys(data.abilities).forEach(ability => {
                if (data.abilities[ability]) player.useAbility(ability);
            });
        }
        
        // Commented out to reduce console spam during development
        // console.log(`Input: ${player.inputX}, ${player.inputY}`);
    });

    // ----------------------
    // PLAYER ABILITY (Slide, Push, etc)
    // ----------------------
    socket.on("ability", (data) => {
        if (!player.alive) return;

        // HANDLE OBJECT PAYLOAD (Fix for Shift+WASD Slide)
        // If 'data' is a string ("push"), use it.
        // If 'data' is object ({name: "slide", dir: {x,y}}), extract name and params.
        const abilityName = typeof data === 'string' ? data : data.name;
        const params = typeof data === 'object' ? data : {};

        // Pass the extra params (like direction) to useAbility
        const used = player.useAbility(abilityName, params);
        
        if (!used) {
            // Ability on cooldown
            return;
        }

        console.log(`[${new Date().toISOString()}] Player ${player.id} used: ${abilityName}`);
        if (params.dir) {
            console.log(`   -> Direction: x:${params.dir.x}, y:${params.dir.y}`);
        }

        // Broadcast to others so they can see effects
        io.to(room.id).emit("ability-used", {
            playerId: player.id,
            ability: abilityName
        });
    });

    // ----------------------
    // PLAYER DISCONNECT
    // ----------------------
    socket.on("disconnect", () => {
        const roomId = rooms.removePlayer(player.id);
        console.log(`[${new Date().toISOString()}] Player ${player.id} disconnected`);

        if (roomId) {
            const r = rooms.getRoom(roomId);
            if (r) {
                io.to(roomId).emit("room-updated", {
                    players: r.players.map(p => p.toJSON())
                });

                // Reset ready timer if someone disconnected during countdown
                if (r.readyInterval) {
                    clearInterval(r.readyInterval);
                    r.startReadyTimer = null;
                    r.readyInterval = null;
                }
            }
        }
    });
});

// ----------------------
// START SERVER
// ----------------------
server.listen(3000, () => {
    console.log(`[${new Date().toISOString()}] Server listening on port 3000`);
    console.log(`   -> Open http://localhost:3000 in your browser to play`);
});