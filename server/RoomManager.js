const Room = require("./room");
const { v4: uuid } = require("uuid");

const MAX_PLAYERS_PER_ROOM = 4;

class RoomManager {
    constructor(io) {
        this.rooms = [];
        this.io = io;
    }

    createRoom() {
        const id = "room_" + (this.rooms.length + 1) + "_" + Date.now().toString().slice(-4);
        const room = new Room(id);
        this.rooms.push(room);
        console.log(`[RoomManager] Created room: ${id}`);
        return room;
    }

    findBestAvailableRoom() {
        return this.rooms.find(r => !r.gameStarted && r.players.length < MAX_PLAYERS_PER_ROOM);
    }

    addPlayer(socket) {
        let room = this.findBestAvailableRoom() || this.createRoom();
        const player = room.addPlayer(uuid());
        socket.join(room.id);
        return { room, player };
    }

    removePlayer(playerId) {
        const room = this.rooms.find(r => r.players.find(p => p.id === playerId));
        if (room) {
            room.removePlayer(playerId);
            
            if (!room.gameStarted) {
                room.players.forEach(p => p.ready = false);
            }

            if (room.players.length === 0) {
                console.log(`[RoomManager] Deleting empty room ${room.id}`);
                room.stopSyncLoop();
                if(room.readyInterval) clearInterval(room.readyInterval);
                if(room.gameLoopInterval) clearInterval(room.gameLoopInterval);
                if(room.readyCountdown) clearInterval(room.readyCountdown);
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