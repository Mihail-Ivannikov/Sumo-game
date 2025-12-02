// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const RoomManager = require("./RoomManager");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Initialize RoomManager
const rooms = new RoomManager(io);

// ----------------------
// CLIENT CONNECTION
// ----------------------
io.on("connection", (socket) => {
    console.log(`[${new Date().toISOString()}] Player connected: socketId=${socket.id}`);

    // Add player to a room (RoomManager returns actual Room instance)
    const { room, player } = rooms.addPlayer(socket);

    // Send room info to player
    socket.emit("joined-room", {
        roomId: room.id,
        playerId: player.id
    });

    console.log(`[${new Date().toISOString()}] Player ${player.id} joined room ${room.id}`);
    console.log(`[${new Date().toISOString()}] Room state: players=${room.players.map(p => p.id).join(", ")}`);

    // Broadcast updated room state to all in the room
    io.to(room.id).emit("room-updated", {
        players: room.players.map(p => p.toJSON())
    });

    // ----------------------
    // PLAYER READY
    // ----------------------
    socket.on("player-ready", () => {
        player.ready = true;
        console.log(`[${new Date().toISOString()}] Player ${player.id} in room ${room.id} is READY`);

        io.to(room.id).emit("room-updated", {
            players: room.players.map(p => p.toJSON())
        });

        // Start 20s countdown if not all ready yet
        if (!room.startReadyTimer) {
            room.startReadyTimer = 20;
            room.readyInterval = setInterval(() => {
                room.startReadyTimer--;
                io.to(room.id).emit("ready-timer", room.startReadyTimer);
                console.log(`[${new Date().toISOString()}] Room ${room.id} ready-timer=${room.startReadyTimer}`);

                // Reset timer if someone becomes unready or disconnects
                if (!room.players.every(p => p.ready)) {
                    clearInterval(room.readyInterval);
                    room.startReadyTimer = null;
                    room.readyInterval = null;
                    console.log(`[${new Date().toISOString()}] Room ${room.id} ready-timer reset (someone unready/disconnected)`);
                    return;
                }

                // Timer expired → start game
                if (room.startReadyTimer <= 0) {
                    clearInterval(room.readyInterval);
                    room.startReadyTimer = null;
                    room.readyInterval = null;

                    console.log(`[${new Date().toISOString()}] Room ${room.id} partial ready timer expired, starting game`);
                    room.startTimer = 3; // 3…2…1 countdown
                    room.startGame(io);
                }
            }, 1000);
        }

        // If all ready before 20s, start 3…2…1 countdown
        if (room.allReady()) {
            if (room.readyInterval) {
                clearInterval(room.readyInterval);
                room.startReadyTimer = null;
                room.readyInterval = null;
            }
            console.log(`[${new Date().toISOString()}] All players ready in room ${room.id}, starting countdown`);
            room.startTimer = 3; // 3…2…1 countdown
            room.startGame(io);
        }
    });

    // ----------------------
    // PLAYER INPUT (movement)
    // ----------------------
    socket.on("input", (data) => {
        if (!player.alive) return;
        player.inputX = data.vx;
        player.inputY = data.vy;


        console.log(`[${new Date().toISOString()}] Player ${player.id} input: vx=${player.vx}, vy=${player.vy}`);
    });

    // ----------------------
    // PLAYER USES ABILITY
    // ----------------------
    socket.on("ability", (abilityName) => {
        if (!player.alive) return;

        const used = player.useAbility(abilityName);
        if (!used) {
            console.log(`[${new Date().toISOString()}] Player ${player.id} tried to use ability ${abilityName} but it's on cooldown`);
            return;
        }

        console.log(`[${new Date().toISOString()}] Player ${player.id} used ability: ${abilityName}`);
        if (abilityName === "push") player.pushing = true;

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
        console.log(`[${new Date().toISOString()}] Player ${player.id} disconnected from room ${roomId}`);

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
                    console.log(`[${new Date().toISOString()}] Room ${roomId} ready-timer reset due to disconnect`);
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
});
