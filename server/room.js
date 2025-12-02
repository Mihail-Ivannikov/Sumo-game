const Player = require("./player");

class Room {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.gameStarted = false;
        this.startTimer = 5;       // countdown before main game loop
        this.arenaRadius = 500;
        this.gameLoopInterval = null;

        // Ready logic
        this.readyCountdown = null; // interval для готовності
        this.readyTimer = 20;       // таймер 20 секунд для частково готових
        this.io = null;
    }

    // Додати гравця
    addPlayer(playerId) {
        const player = new Player(playerId);
        this.players.push(player);
        console.log(`[${new Date().toISOString()}] Player ${playerId} added to room ${this.id}`);
        return player;
    }

    // Видалити гравця
    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        console.log(`[${new Date().toISOString()}] Player ${playerId} removed from room ${this.id}`);
        if (this.readyCountdown) {
            clearInterval(this.readyCountdown);
            this.readyCountdown = null;
            console.log(`[${new Date().toISOString()}] Ready countdown reset in room ${this.id}`);
        }
    }

    // Перевірка чи всі готові
    allReady() {
        return this.players.length > 0 && this.players.every(p => p.ready);
    }

    // Гравець став ready
    setPlayerReady(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;
        player.ready = true;
        console.log(`[${new Date().toISOString()}] Player ${playerId} is READY in room ${this.id}`);

        const readyPlayers = this.players.filter(p => p.ready);

        // Не починати гру, якщо готові менше 2 гравців
        if (readyPlayers.length < 2) {
            console.log(`[${new Date().toISOString()}] Only ${readyPlayers.length} player(s) ready in room ${this.id}, waiting for more...`);
            return;
        }

        // Якщо всі готові — запуск 3…2…1
        if (this.allReady()) {
            if (this.readyCountdown) clearInterval(this.readyCountdown);
            let countdown = 3;
            console.log(`[${new Date().toISOString()}] All players ready in room ${this.id}, starting countdown 3…2…1`);
            this.broadcast("countdown", countdown);

            this.readyCountdown = setInterval(() => {
                countdown--;
                this.broadcast("countdown", countdown);
                if (countdown <= 0) {
                    clearInterval(this.readyCountdown);
                    this.readyCountdown = null;
                    this.startGame(this.io);
                }
            }, 1000);
        } else {
            // Часткова готовність (принаймні 2 гравці)
            if (!this.readyCountdown) {
                let timer = this.readyTimer;
                console.log(`[${new Date().toISOString()}] Partial readiness in room ${this.id}, starting 20s timer`);
                this.readyCountdown = setInterval(() => {
                    timer--;
                    this.broadcast("ready-timer", timer);

                    const currentReady = this.players.filter(p => p.ready);
                    if (currentReady.length < 2) {
                        clearInterval(this.readyCountdown);
                        this.readyCountdown = null;
                        console.log(`[${new Date().toISOString()}] Not enough players ready in room ${this.id}, timer stopped`);
                        return;
                    }

                    if (timer <= 0 || this.allReady()) {
                        clearInterval(this.readyCountdown);
                        this.readyCountdown = null;
                        console.log(`[${new Date().toISOString()}] Ready timer ended in room ${this.id}, starting game`);
                        this.startGame(this.io);
                    }
                }, 1000);
            }
        }
    }

    // Запуск гри
    startGame(io) {
        if (this.gameStarted) return;
        this.gameStarted = true;
        this.io = io;

        console.log(`[${new Date().toISOString()}] Game starting in room ${this.id}`);
        this.broadcast("game-starting", { countdown: this.startTimer });

        let countdownInterval = setInterval(() => {
            this.startTimer--;
            this.broadcast("countdown", this.startTimer);
            if (this.startTimer <= 0) {
                clearInterval(countdownInterval);
                this.runGameLoop(io);
            }
        }, 1000);
    }

    // Головний Game Loop (~30 FPS)
    runGameLoop(io) {
        this.broadcast("game-start", { players: this.players.map(p => p.toJSON()) });

        this.gameLoopInterval = setInterval(() => {
            this.updatePhysics();
            this.handleCollisions();
            this.checkArenaBounds();
            this.checkCooldowns();
            this.checkGameOver(io);

            this.broadcast("state-update", {
                players: this.players.map(p => p.toJSON()),
                arenaRadius: this.arenaRadius
            });
        }, 33);
    }

    updatePhysics() {
        this.players.forEach(p => {
            if (!p.alive) return;
            p.updatePosition();
        });
    }

    handleCollisions() {
        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                const p1 = this.players[i];
                const p2 = this.players[j];
                if (!p1.alive || !p2.alive || p1.isInvulnerable || p2.isInvulnerable) continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const minDistance = 50;

                if (distance < minDistance) {
                    const forceX = (p2.vx - p1.vx) * 0.5;
                    const forceY = (p2.vy - p1.vy) * 0.5;
                    p1.x -= forceX; p1.y -= forceY;
                    p2.x += forceX; p2.y += forceY;
                }

                if (p1.pushing && !p2.isInvulnerable) {
                    const factor = 5;
                    p2.vx += (dx / distance) * factor;
                    p2.vy += (dy / distance) * factor;
                    p1.pushing = false;
                }
                if (p2.pushing && !p1.isInvulnerable) {
                    const factor = 5;
                    p1.vx -= (dx / distance) * factor;
                    p1.vy -= (dy / distance) * factor;
                    p2.pushing = false;
                }
            }
        }
    }

    checkArenaBounds() {
        this.players.forEach(p => {
            if (!p.alive) return;
            const dist = Math.sqrt(p.x*p.x + p.y*p.y);
            if (dist > this.arenaRadius) {
                p.alive = false;
                this.broadcast("player-out", p.id);
            }
        });
    }

    checkCooldowns() {
        const delta = 33;
        this.players.forEach(p => {
            Object.keys(p.abilitiesCooldowns).forEach(a => {
                if (p.abilitiesCooldowns[a] > 0) {
                    p.abilitiesCooldowns[a] -= delta;
                    if (p.abilitiesCooldowns[a] < 0) p.abilitiesCooldowns[a] = 0;
                }
            });
        });
    }

    checkGameOver(io) {
        const alive = this.players.filter(p => p.alive);
        if (alive.length <= 1 && this.gameStarted) {
            const winner = alive[0]?.id || null;
            this.broadcast("game-over", { winner });
            clearInterval(this.gameLoopInterval);
            this.gameStarted = false;
        }
    }

    broadcast(event, data) {
        if (this.io) this.io.to(this.id).emit(event, data);
    }
}

module.exports = Room;
