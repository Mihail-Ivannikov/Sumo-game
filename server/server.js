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
    console.log("Player connected:", socket.id);

    // Add player to a room
    const { room, player } = rooms.addPlayer(socket);

    // Send room info to player
    socket.emit("joined-room", {
        roomId: room.id,
        playerId: player.id
    });

    console.log(`Player ${player.id} joined room ${room.id}`);

    // Broadcast updated room state
    io.to(room.id).emit("room-updated", {
        players: room.players.map(p => p.toJSON())
    });

    // ----------------------
    // PLAYER READY
    // ----------------------
    socket.on("player-ready", () => {
        rooms.setReady(player.id, true); // updates ready status and may auto-start game
        console.log(`Player ${player.id} in room ${room.id} is READY`);

        // Broadcast updated room state
        io.to(room.id).emit("room-updated", {
            players: room.players.map(p => p.toJSON())
        });

        // If all ready, start game
        if (room.allReady() && !room.gameStarted) {
            room.startGame(io);
        }
    });

    // ----------------------
    // PLAYER INPUT (movement)
    // ----------------------
    socket.on("input", (data) => {
        if (!player.alive) return;
        player.vx = data.vx;
        player.vy = data.vy;
    });

    // ----------------------
    // PLAYER USES ABILITY
    // ----------------------
    socket.on("ability", (abilityName) => {
        // Ability handling should be implemented inside Room/Player
        console.log(`Player ${player.id} used ability: ${abilityName}`);
        // Example: room.handleAbility(player, abilityName);
    });

    // ----------------------
    // PLAYER DISCONNECT
    // ----------------------
    socket.on("disconnect", () => {
        const roomId = rooms.removePlayer(player.id);
        console.log(`Player ${player.id} disconnected from room ${roomId}`);

        // Update remaining players
        if (roomId) {
            const r = rooms.getRoom(roomId);
            if (r) {
                io.to(roomId).emit("room-updated", {
                    players: r.players.map(p => p.toJSON())
                });
            }
        }
    });
});

// ----------------------
// START SERVER
// ----------------------
server.listen(3000, () => {
    console.log("Server listening on port 3000");
});
