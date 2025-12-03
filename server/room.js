const Player = require("./player");

class Room {
  constructor(id) {
    this.id = id;
    this.players = [];
    this.gameStarted = false;
    this.startTimer = 5; // countdown before main game loop
    this.arenaRadius = 250;
    this.gameLoopInterval = null;

    // Ready logic
    this.readyCountdown = null; // interval для готовності
    this.readyTimer = 20; // таймер 20 секунд для частково готових
    this.io = null;
  }

  addPlayer(playerId) {
    const player = new Player(playerId);
    this.players.push(player);

    console.log(
      `[${new Date().toISOString()}] Player ${playerId} added to room ${this.id}`,
    );

    const count = this.players.length;
    const index = count - 1;

    // Safe spawn radius: arena radius minus player radius minus padding
    const playerRadius = 25;
    const padding = 10;
    const spawnRadius = this.arenaRadius - playerRadius - padding;

    // Assign angle evenly around a circle
    const angle = (index / count) * Math.PI * 2;

    // Convert polar coordinates to Cartesian
    player.x = Math.cos(angle) * spawnRadius;
    player.y = Math.sin(angle) * spawnRadius;

    console.log(`PLAYER X = ${player.x} PLAYER Y = ${player.y}`);

    // Zero velocity
    player.vx = 0;
    player.vy = 0;

    console.log(
      `Spawned player ${playerId} at x:${player.x.toFixed(1)}, y:${player.y.toFixed(1)}`,
    );

    return player;
  }

  // Видалити гравця
  removePlayer(playerId) {
    this.players = this.players.filter((p) => p.id !== playerId);
    console.log(
      `[${new Date().toISOString()}] Player ${playerId} removed from room ${this.id}`,
    );
    if (this.readyCountdown) {
      clearInterval(this.readyCountdown);
      this.readyCountdown = null;
      console.log(
        `[${new Date().toISOString()}] Ready countdown reset in room ${this.id}`,
      );
    }
  }

  // Перевірка чи всі готові
  allReady() {
    return this.players.length > 0 && this.players.every((p) => p.ready);
  }

  // Гравець став ready
  setPlayerReady(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;
    player.ready = true;
    console.log(
      `[${new Date().toISOString()}] Player ${playerId} is READY in room ${this.id}`,
    );

    const readyPlayers = this.players.filter((p) => p.ready);

    // Не починати гру, якщо готові менше 2 гравців
    if (readyPlayers.length < 2) {
      console.log(
        `[${new Date().toISOString()}] Only ${readyPlayers.length} player(s) ready in room ${this.id}, waiting for more...`,
      );
      return;
    }

    // Якщо всі готові — запуск 3…2…1
    if (this.allReady()) {
      if (this.readyCountdown) clearInterval(this.readyCountdown);
      let countdown = 3;
      console.log(
        `[${new Date().toISOString()}] All players ready in room ${this.id}, starting countdown 3…2…1`,
      );
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
        console.log(
          `[${new Date().toISOString()}] Partial readiness in room ${this.id}, starting 20s timer`,
        );
        this.readyCountdown = setInterval(() => {
          timer--;
          this.broadcast("ready-timer", timer);

          const currentReady = this.players.filter((p) => p.ready);
          if (currentReady.length < 2) {
            clearInterval(this.readyCountdown);
            this.readyCountdown = null;
            console.log(
              `[${new Date().toISOString()}] Not enough players ready in room ${this.id}, timer stopped`,
            );
            return;
          }

          if (timer <= 0 || this.allReady()) {
            clearInterval(this.readyCountdown);
            this.readyCountdown = null;
            console.log(
              `[${new Date().toISOString()}] Ready timer ended in room ${this.id}, starting game`,
            );
            this.startGame(this.io);
          }
        }, 1000);
      }
    }
  }

  startGame(io) {
    if (this.gameStarted) return;
    this.gameStarted = true;
    this.io = io;

    console.log(
      `[${new Date().toISOString()}] Game starting in room ${this.id}`,
    );
    this.broadcast("game-starting", { countdown: this.startTimer });

    // Запуск циклу синхронізації
    this.startSyncLoop();

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
    this.broadcast("game-start", {
      players: this.players.map((p) => p.toJSON()),
    });

    this.gameLoopInterval = setInterval(() => {
      this.updatePhysics();
      this.handleCollisions();
      this.checkArenaBounds();
      this.checkCooldowns();
      this.checkGameOver(io);

      this.broadcast("state-update", {
        players: this.players.map((p) => p.toJSON()),
        arenaRadius: this.arenaRadius,
      });
    }, 33);
  }

  // Інтервал синхронізації з клієнтами
  startSyncLoop() {
    // Відправляємо кожні 50–70 мс
    this.syncInterval = setInterval(() => {
      if (!this.io) return;

      const playersState = this.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        alive: p.alive,
        invulnerable: p.isInvulnerable,
        abilitiesCooldowns: { ...p.abilitiesCooldowns },
      }));

      const readyState = this.players.map((p) => p.ready);

      this.io.to(this.id).emit("sync", {
        players: playersState,
        timer: this.startTimer,
        readyState,
        gameStarted: this.gameStarted,
      });
    }, 60); // 60 мс ≈ 16-17 FPS, між 50–70 мс
  }

  // Зупинка синхронізації
  stopSyncLoop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  updatePhysics() {
    this.players.forEach((p) => {
      if (!p.alive) return;
      p.updatePosition();
    });
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
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Normal collision push-apart
        const minDist = 50;
        if (dist < minDist) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          const p1Speed = Math.sqrt(p1.vx * p1.vx + p1.vy * p1.vy);
          const p2Speed = Math.sqrt(p2.vx * p2.vx + p2.vy * p2.vy);
          const total = p1Speed + p2Speed || 1;

          const p1Push = p2Speed / total;
          const p2Push = p1Speed / total;

          p1.x -= nx * overlap * p1Push;
          p1.y -= ny * overlap * p1Push;

          p2.x += nx * overlap * p2Push;
          p2.y += ny * overlap * p2Push;
        }

        // PUSH ability: knockback exactly 50px
        const pushRange = 100; // only push players within 100px
        const pushDistance = 50; // fixed 50px displacement
        if (p1.pushing && dist <= pushRange) {
          const nx = dx / dist;
          const ny = dy / dist;

          p2.x += nx * pushDistance;
          p2.y += ny * pushDistance;

          console.log(
            `[${new Date().toISOString()}] Player ${p1.id} pushed player ${p2.id} by 50px`,
          );
        }

        if (p2.pushing && dist <= pushRange) {
          const nx = -dx / dist;
          const ny = -dy / dist;

          p1.x += nx * pushDistance;
          p1.y += ny * pushDistance;

          console.log(
            `[${new Date().toISOString()}] Player ${p2.id} pushed player ${p1.id} by 50px`,
          );
        }
      }
    }
  }

  checkArenaBounds() {
    this.players.forEach((p) => {
      if (!p.alive) return;
      const dist = Math.sqrt(p.x * p.x + p.y * p.y);
      if (dist > this.arenaRadius) {
        p.alive = false;
        this.broadcast("player-out", p.id);
        this.checkGameOver();
      }
    });
  }

  checkCooldowns() {
    const delta = 33;
    this.players.forEach((p) => {
      Object.keys(p.abilitiesCooldowns).forEach((a) => {
        if (p.abilitiesCooldowns[a] > 0) {
          p.abilitiesCooldowns[a] -= delta;
          if (p.abilitiesCooldowns[a] < 0) p.abilitiesCooldowns[a] = 0;
        }
      });
    });
  }

  checkGameOver(io) {
    const alive = this.players.filter((p) => p.alive);
    if (alive.length <= 1 && this.gameStarted) {
      const winner = alive[0]?.id || null;
      this.broadcast("game-over", { winner });
      clearInterval(this.gameLoopInterval);
      this.gameStarted = false;

      // Зупиняємо sync loop
      this.stopSyncLoop();
    }
  }

  broadcast(event, data) {
    if (this.io) this.io.to(this.id).emit(event, data);
  }
}

module.exports = Room;
