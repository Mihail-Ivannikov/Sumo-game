// server/player.js
const { v4: uuid } = require("uuid");

class Player {
  constructor(id = uuid()) {
    this.id = id;

    // Position
    this.x = 0;
    this.y = 0;

    // Velocity
    this.vx = 0;
    this.vy = 0;

    // Input state
    this.inputX = 0;
    this.inputY = 0;

    // Abilities state
    this.isInvulnerable = false;
    this.isSprinting = false;
    this.isSliding = false;
    this.pushing = false;

    // Ability cooldowns
    const now = Date.now();
    this.abilitiesCooldowns = {
      push: now,
      sprint: now,
      slide: now,
      invul: now,
    };

    this.invulTimeout = null;

    // Game state
    this.ready = false;
    this.alive = true;
  }

  // --- NEW METHOD: Reset state for a new round ---
  reset() {
    this.alive = true;
    this.vx = 0;
    this.vy = 0;
    this.isInvulnerable = false;
    this.isSprinting = false;
    this.isSliding = false;
    this.pushing = false;
    this.inputX = 0;
    this.inputY = 0;

    // Reset cooldowns so everyone starts fresh
    const now = Date.now();
    this.abilitiesCooldowns = {
      push: now,
      sprint: now,
      slide: now,
      invul: now,
    };
    
    // Clear any active timeouts
    if (this.invulTimeout) {
        clearTimeout(this.invulTimeout);
        this.invulTimeout = null;
    }
  }

  useAbility(abilityName, params = {}) {
    if (!this.canUseAbility(abilityName)) return false;

    const now = Date.now();

    switch (abilityName) {
      case "push":
        this.abilitiesCooldowns.push = now + 20000;
        this.pushing = true;
        setTimeout(() => { this.pushing = false; }, 100);
        break;

      case "sprint":
        this.abilitiesCooldowns.sprint = now + 20000;
        this.isSprinting = true;
        setTimeout(() => { this.isSprinting = false; }, 5000);
        break;

      case "slide":
        this.abilitiesCooldowns.slide = now + 5000;
        this.isSliding = true;

        let dirX = 0;
        let dirY = 0;

        if (params.dir && (params.dir.x !== 0 || params.dir.y !== 0)) {
          dirX = params.dir.x;
          dirY = params.dir.y;
        } else {
          dirX = this.vx;
          dirY = this.vy;
        }

        const mag = Math.sqrt(dirX * dirX + dirY * dirY);
        if (mag > 0) {
          dirX /= mag;
          dirY /= mag;
        } else {
          dirX = 0;
          dirY = 0;
        }

        const slideSpeed = 25; // Adjusted based on your preference
        if (dirX !== 0 || dirY !== 0) {
            this.vx = dirX * slideSpeed;
            this.vy = dirY * slideSpeed;
        }

        setTimeout(() => { this.isSliding = false; }, 400);
        break;

      case "invul":
        this.abilitiesCooldowns.invul = now + 40000;
        if (this.invulTimeout) clearTimeout(this.invulTimeout);
        this.isInvulnerable = true;
        this.invulTimeout = setTimeout(() => {
          this.isInvulnerable = false;
          this.invulTimeout = null;
        }, 3000);
        break;

      default:
        return false;
    }
    return true;
  }

  updatePosition(delta = 1) {
    if (!this.alive) return;

    const accel = 0.5 * (this.isSprinting ? 2 : 1); 
    const friction = 0.9;

    this.vx += this.inputX * accel;
    this.vy += this.inputY * accel;
    this.vx *= friction;
    this.vy *= friction;

    let maxSpeed = this.isSprinting ? 15 : 8;
    if (this.isSliding) maxSpeed = 30;

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx * delta;
    this.y += this.vy * delta;
  }

  canUseAbility(abilityName) {
    return Date.now() >= this.abilitiesCooldowns[abilityName];
  }

  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      isInvulnerable: this.isInvulnerable,
      isSprinting: this.isSprinting,
      isSliding: this.isSliding,
      abilitiesCooldowns: this.abilitiesCooldowns,
      ready: this.ready,
      alive: this.alive,
    };
  }
}

module.exports = Player;