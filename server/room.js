// server/room.js
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
  }

  addPlayer(playerId) {
    const player = new Player(playerId);
    player.x = 0;
    player.y = 0;
    this.players.push(player);
    return player;
  }

  removePlayer(playerId) {
    this.players = this.players.filter((p) => p.id !== playerId);
    if (this.readyCountdown) {
      clearInterval(this.readyCountdown);
      this.readyCountdown = null;
    }
  }

  allReady() {
    return this.players.length > 0 && this.players.every((p) => p.ready);
  }

  spawnPlayers() {
    const count = this.players.length;
    const playerRadius = 25;
    const padding = 20; 
    const spawnRadius = this.arenaRadius - playerRadius - padding;

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

    // Reset positions
    this.spawnPlayers();

    // 1. Send initial Countdown (e.g. "3")
    // Client listens to "countdown" to switch from Lobby to Game Screen
    this.broadcast("countdown", this.startTimer);

    // 2. Start the 1-second interval
    let countdownInterval = setInterval(() => {
      this.startTimer--;
      this.broadcast("countdown", this.startTimer); // Sends 2, 1, 0

      if (this.startTimer <= 0) {
        clearInterval(countdownInterval);
        // Start the actual physics loop
        this.runGameLoop(io);
      }
    }, 1000);

    this.startSyncLoop();
  }

  runGameLoop(io) {
    // broadcast game-start just in case, though countdown 0 implies it
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

  startSyncLoop() {
    this.syncInterval = setInterval(() => {
      if (!this.io) return;
      const playersState = this.players.map((p) => ({
        id: p.id,
        username: p.username,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        alive: p.alive,
        invulnerable: p.isInvulnerable,
        isSliding: p.isSliding,
        abilitiesCooldowns: { ...p.abilitiesCooldowns },
      }));
      const readyState = this.players.map((p) => p.ready);
      this.io.to(this.id).emit("sync", {
        players: playersState,
        timer: this.startTimer,
        readyState,
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
    this.players.forEach((p) => {
      if (!p.alive) return;
      p.updatePosition();
    });
  }

  handleCollisions() {
      // (Keep existing collision logic from previous message)
      // Copy the content of handleCollisions from the previous code block here
      // It is large, but logic is identical.
      for (let i = 0; i < this.players.length; i++) {
        const p1 = this.players[i];
        if (!p1.alive) continue;
  
        for (let j = i + 1; j < this.players.length; j++) {
          const p2 = this.players[j];
          if (!p2.alive) continue;
  
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1; 
  
          const minDist = 50;
          if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
  
            if (!p1.isInvulnerable && !p2.isInvulnerable) {
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
          }
          const pushRange = 100;
          const pushDistance = 50;
          if (p1.pushing && dist <= pushRange && !p2.isInvulnerable && !p1.isInvulnerable) {
            const nx = dx / dist;
            const ny = dy / dist;
            p2.x += nx * pushDistance;
            p2.y += ny * pushDistance;
            p1.pushing = false; 
          }
          if (p2.pushing && dist <= pushRange && !p1.isInvulnerable && !p2.isInvulnerable) {
            const nx = -dx / dist;
            const ny = -dy / dist;
            p1.x += nx * pushDistance;
            p1.y += ny * pushDistance;
            p2.pushing = false; 
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
      this.startTimer = 3; // Reset for next time

      // Mark everyone unready so they go back to lobby logic
      this.players.forEach(p => p.ready = false);
      
      this.broadcast("room-updated", {
         players: this.players.map(p => p.toJSON())
      });

      this.stopSyncLoop();
    }
  }

  broadcast(event, data) {
    if (this.io) this.io.to(this.id).emit(event, data);
  }
}

module.exports = Room;