// server/RoomManager.js
const Room = require("./room");
const Player = require("./player");
const { v4: uuid } = require("uuid");

const MAX_PLAYERS_PER_ROOM = 4;

class RoomManager {
    constructor(io) {
        this.rooms = [];
        this.io = io;
    }

    createRoom() {
        // Simple ID generation (room_1, room_2...)
        // In a production app, you might recycle IDs or use UUIDs
        const id = "room_" + (this.rooms.length + 1) + "_" + Date.now().toString().slice(-4);
        const room = new Room(id);
        this.rooms.push(room);
        console.log(`[RoomManager] Created new room: ${id}`);
        return room;
    }

    // --- LOGIC CHANGE: FIND BEST ROOM ---
    findBestAvailableRoom() {
        // Look for a room that:
        // 1. Is NOT running a game currently (!gameStarted)
        // 2. Has space (< 4 players)
        // 3. (Optional) We could sort by most players to fill lobbies faster, 
        //    but finding the first available one is standard and fast.
        return this.rooms.find(r => !r.gameStarted && r.players.length < MAX_PLAYERS_PER_ROOM);
    }

    addPlayer(socket) {
        // 1. Try to find an existing open lobby
        let room = this.findBestAvailableRoom();

        // 2. If no open lobby exists, create a new one
        if (!room) {
            room = this.createRoom();
        }

        // 3. Create and add the player
        const playerId = uuid();
        const player = room.addPlayer(playerId); 
        socket.join(room.id);

        return { room, player };
    }

    removePlayer(playerId) {
        // Find which room the player is in
        const room = this.rooms.find(r => r.players.find(p => p.id === playerId));

        if (room) {
            room.removePlayer(playerId);
            console.log(`[RoomManager] Removed player ${playerId} from ${room.id}`);

            // Logic: If game hasn't started, unready everyone so the countdown stops
            // and they realize someone left.
            if (!room.gameStarted) {
                room.players.forEach(p => p.ready = false);
                
                // If the room had a countdown running (e.g. 3..2..), room.js logic 
                // usually handles cancelling it, but setting ready=false ensures safety.
            }

            // --- CLEANUP LOGIC ---
            // If the room is now empty, delete it to save server memory.
            if (room.players.length === 0) {
                console.log(`[RoomManager] Room ${room.id} is empty. Deleting.`);
                // Stop any intervals running inside the room class
                room.stopSyncLoop(); 
                if(room.readyInterval) clearInterval(room.readyInterval);
                if(room.gameLoopInterval) clearInterval(room.gameLoopInterval);
                if(room.readyCountdown) clearInterval(room.readyCountdown);

                // Remove from array
                this.rooms = this.rooms.filter(r => r.id !== room.id);
            }

            return room.id;
        }
        return null;
    }

    getRoom(roomId) {
        return this.rooms.find(r => r.id === roomId);
    }
}

module.exports = RoomManager;