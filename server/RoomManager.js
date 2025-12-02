// RoomManager.js
const Room = require("./room");  // your Room class
const Player = require("./player"); 
const { v4: uuid } = require("uuid");

class RoomManager {
    constructor(io) {
        this.rooms = [];
        this.io = io; // for broadcasting events
    }

    // Create a new room
    createRoom() {
        const id = "room_" + (this.rooms.length + 1);
        const room = new Room(id);
        this.rooms.push(room);
        return room;
    }

    // Find a room with free space or create a new one
    getAvailableRoom() {
        const last = this.rooms[this.rooms.length - 1];
        if (!last || last.players.length >= 4 || last.gameStarted) {
            return this.createRoom();
        }
        return last;
    }

    // Add a player
    addPlayer(socket) {
        const room = this.getAvailableRoom();
        const playerId = uuid();

        const player = room.addPlayer(playerId); // Room creates Player instance
        socket.join(room.id);

        return { room, player };
    }

    // Remove a player
    removePlayer(playerId) {
        for (let room of this.rooms) {
            const player = room.players.find(p => p.id === playerId);
            if (player) {
                room.removePlayer(playerId);

                // Reset ready if game hasn't started
                if (!room.gameStarted) {
                    room.players.forEach(p => p.ready = false);
                }

                // Delete room if empty
                if (room.players.length === 0) {
                    this.rooms = this.rooms.filter(r => r !== room);
                }
                return room.id;
            }
        }
        return null;
    }

    // Set ready/unready for a player
    setReady(playerId, value) {
        for (let room of this.rooms) {
            const player = room.players.find(p => p.id === playerId);
            if (player) {
                player.ready = value;

                // Auto-start game if all ready
                if (room.allReady()) {
                    room.startGame(this.io);
                }

                return true;
            }
        }
        return false;
    }

    getRoom(roomId) {
        return this.rooms.find(r => r.id === roomId);
    }
}

module.exports = RoomManager;
