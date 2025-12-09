const Player = require("./player");

class Room {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.gameStarted = false;
        this.startTimer = 3;
        this.arenaRadius = 250;
        this.gameLoopInterval = null;
        this.readyCountdown = null;
        this.readyTimer = 20;
        this.io = null;
        this.syncInterval = null;
    }

    addPlayer(playerId) {
        const player = new Player(playerId);
        this.players.push(player);
        return player;
    }

    removePlayer(playerId) {
        this.players = this.players.filter((p) => p.id !== playerId);
        if (this.readyCountdown) {
            clearInterval(this.readyCountdown);
            this.readyCountdown = null;
            this.broadcast("countdown", -1);
        }
    }

    allReady() {
        return this.players.length >= 2 && this.players.every((p) => p.ready);
    }

    spawnPlayers() {
        const count = this.players.length;
        const spawnRadius = this.arenaRadius - 45;

        this.players.forEach((player, index) => {
            player.reset();
            const angle = (index * (2 * Math.PI)) / count;
            player.x = Math.cos(angle - Math.PI / 2) * spawnRadius;
            player.y = Math.sin(angle - Math.PI / 2) * spawnRadius;
        });
    }

    startGame(io) {
        if (this.gameStarted) return;
        this.gameStarted = true;
        this.io = io;

        this.spawnPlayers();
        this.broadcast("countdown", this.startTimer);

        let countdownInterval = setInterval(() => {
            this.startTimer--;
            this.broadcast("countdown", this.startTimer);
            if (this.startTimer <= 0) {
                clearInterval(countdownInterval);
                this.runGameLoop();
            }
        }, 1000);

        this.startSyncLoop();
    }

    runGameLoop() {
        this.broadcast("game-start", { players: this.players.map(p => p.toJSON()) });

        this.gameLoopInterval = setInterval(() => {
            this.updatePhysics();
            this.handleCollisions();
            this.checkArenaBounds();
            this.checkCooldowns();
            this.checkGameOver();
            
            this.broadcast("state-update", {
                players: this.players.map(p => p.toJSON()),
                arenaRadius: this.arenaRadius,
            });
        }, 33);
    }

    startSyncLoop() {
        this.syncInterval = setInterval(() => {
            if (!this.io) return;
            this.io.to(this.id).emit("sync", {
                players: this.players.map(p => p.toJSON()),
                timer: this.startTimer,
                readyState: this.players.map(p => p.ready),
                gameStarted: this.gameStarted,
            });
        }, 60);
    }

    stopSyncLoop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    updatePhysics() {
        this.players.forEach(p => { if (p.alive) p.updatePosition(); });
    }

    handleCollisions() {
        for (let i = 0; i < this.players.length; i++) {
            const p1 = this.players[i];
            if (!p1.alive) continue;

            for (let j = i + 1; j < this.players.length; j++) {
                const p2 = this.players[j];
                if (!p2.alive) continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                // 1. Body Collision (Elastic Push)
                if (dist < 50) {
                    const overlap = 50 - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;

                    if (!p1.isInvulnerable && !p2.isInvulnerable) {
                        const totalSpeed = Math.sqrt(p1.vx**2 + p1.vy**2) + Math.sqrt(p2.vx**2 + p2.vy**2) || 1;
                        const p1Factor = Math.sqrt(p2.vx**2 + p2.vy**2) / totalSpeed;
                        const p2Factor = Math.sqrt(p1.vx**2 + p1.vy**2) / totalSpeed;

                        p1.x -= nx * overlap * p1Factor;
                        p1.y -= ny * overlap * p1Factor;
                        p2.x += nx * overlap * p2Factor;
                        p2.y += ny * overlap * p2Factor;
                    }
                }

                // 2. Ability Push Logic
                const pushRange = 100;
                const pushForce = 50;
                
                const applyPush = (attacker, victim, dirX, dirY) => {
                    if (attacker.pushing && dist <= pushRange && !victim.isInvulnerable && !attacker.isInvulnerable) {
                        victim.x += dirX * pushForce;
                        victim.y += dirY * pushForce;
                        attacker.pushing = false;
                    }
                };

                applyPush(p1, p2, dx / dist, dy / dist); // P1 pushes P2
                applyPush(p2, p1, -dx / dist, -dy / dist); // P2 pushes P1
            }
        }
    }

    checkArenaBounds() {
        this.players.forEach(p => {
            if (!p.alive) return;
            if (Math.sqrt(p.x * p.x + p.y * p.y) > this.arenaRadius) {
                p.alive = false;
                this.broadcast("player-out", p.id);
                this.checkGameOver();
            }
        });
    }

    checkCooldowns() {
        const delta = 33;
        this.players.forEach(p => {
            for (const key in p.abilitiesCooldowns) {
                if (p.abilitiesCooldowns[key] > 0) {
                    p.abilitiesCooldowns[key] = Math.max(0, p.abilitiesCooldowns[key] - delta);
                }
            }
        });
    }

    checkGameOver() {
        const alive = this.players.filter(p => p.alive);
        if (alive.length <= 1 && this.gameStarted) {
            this.broadcast("game-over", { winner: alive[0]?.id || null });
            
            clearInterval(this.gameLoopInterval);
            this.gameStarted = false;
            this.startTimer = 3;
            this.players.forEach(p => p.ready = false);
            this.broadcast("room-updated", { players: this.players.map(p => p.toJSON()) });
            this.stopSyncLoop();
        }
    }

    broadcast(event, data) {
        if (this.io) this.io.to(this.id).emit(event, data);
    }
}

module.exports = Room;