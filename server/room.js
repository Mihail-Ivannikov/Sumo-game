// room.js
const Player = require("./player");

class Room {
    constructor(id) {
        this.id = id;
        this.players = [];

        // Game state
        this.gameStarted = false;
        this.startTimer = 5; // countdown before game starts
        this.arenaRadius = 500;

        this.gameLoopInterval = null;
    }

    // Add a new player to the room
    addPlayer(playerId) {
        const player = new Player(playerId);
        this.players.push(player);
        return player;
    }

    // Remove a player from the room
    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
    }

    // Check if all players are ready
    allReady() {
        return this.players.length > 1 && this.players.every(p => p.ready);
    }

    // Start the game with countdown
    startGame(io) {
        if (this.gameStarted) return;
        this.gameStarted = true;

        this.broadcast(io, "game-starting", { countdown: this.startTimer });

        const countdownInterval = setInterval(() => {
            this.startTimer--;
            this.broadcast(io, "countdown", this.startTimer);

            if (this.startTimer <= 0) {
                clearInterval(countdownInterval);
                this.runGameLoop(io);
            }
        }, 1000);
    }

    // Main Game Loop (~30 FPS)
    runGameLoop(io) {
        this.broadcast(io, "game-start", { players: this.players.map(p => p.toJSON()) });

        this.gameLoopInterval = setInterval(() => {
            this.updatePhysics();
            this.handleCollisions();
            this.checkArenaBounds();
            this.checkCooldowns();
            this.checkGameOver(io);

            // Send updated state to clients
            this.broadcast(io, "state-update", {
                players: this.players.map(p => p.toJSON()),
                arenaRadius: this.arenaRadius
            });

        }, 33); // ~30 updates/sec
    }

    // Update player positions
    updatePhysics() {
        for (const p of this.players) {
            if (!p.alive) continue;

            // Limit speed
            const maxSpeed = p.isSprinting ? 2 : 1;
            let speed = Math.min(Math.sqrt(p.vx ** 2 + p.vy ** 2) * p.speedMultiplier, maxSpeed);

            // Normalize diagonal movement
            if (p.vx !== 0 && p.vy !== 0) {
                p.vx /= Math.sqrt(2);
                p.vy /= Math.sqrt(2);
            }

            // Update position
            p.x += p.vx * speed;
            p.y += p.vy * speed;
        }
    }

    // Handle player collisions
    handleCollisions() {
        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                const p1 = this.players[i];
                const p2 = this.players[j];

                if (!p1.alive || !p2.alive) continue;
                if (p1.isInvulnerable || p2.isInvulnerable) continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = 50; // character radius

                if (distance < minDistance) {
                    // Push apart proportionally to velocity difference
                    const forceX = (p2.vx - p1.vx) * 0.5;
                    const forceY = (p2.vy - p1.vy) * 0.5;

                    p1.x -= forceX;
                    p1.y -= forceY;
                    p2.x += forceX;
                    p2.y += forceY;
                }
            }
        }
    }

    // Check arena boundaries
    checkArenaBounds() {
        for (const p of this.players) {
            if (!p.alive) continue;

            const dist = Math.sqrt(p.x ** 2 + p.y ** 2);
            if (dist > this.arenaRadius) {
                p.alive = false;
            }
        }
    }

    // Reduce ability cooldowns
    checkCooldowns() {
        const delta = 33; // ms per tick
        for (const p of this.players) {
            Object.keys(p.abilitiesCooldowns).forEach(ability => {
                if (p.abilitiesCooldowns[ability] > 0) {
                    p.abilitiesCooldowns[ability] -= delta;
                    if (p.abilitiesCooldowns[ability] < 0) p.abilitiesCooldowns[ability] = 0;
                }
            });
        }
    }

    // Check for game over
    checkGameOver(io) {
        const alive = this.players.filter(p => p.alive);
        if (alive.length <= 1 && this.gameStarted) {
            const winner = alive[0] ? alive[0].id : null;
            this.broadcast(io, "game-over", { winner });
            clearInterval(this.gameLoopInterval);
            this.gameStarted = false;
        }
    }

    // Send events to all clients in the room
    broadcast(io, event, data) {
        io.to(this.id).emit(event, data);
    }
}

module.exports = Room;
