// player.js
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

    // Movement multiplier (sprint, slide)
    this.speedMultiplier = 1;

    // Abilities state
    this.isInvulnerable = false;
    this.isSprinting = false;
    this.isSliding = false;

    // Ability cooldowns (timestamp when ability is next available)
    const now = Date.now();
    this.abilitiesCooldowns = {
      push: now,
      sprint: now,
      slide: now,
      invul: now,
    };

    this.invulTimeout = null;

    // Lobby state
    this.ready = false;

    // Game state
    this.alive = true;

    this.isSprinting = false;
    this.isSliding = false;
    this.pushing = false;

    this.inputX = 0;
    this.inputY = 0;
  }

  useAbility(abilityName) {
    if (!this.canUseAbility(abilityName)) return false;

    const now = Date.now();

    switch (abilityName) {
      case "push":
        this.abilitiesCooldowns.push = now + 20000; // 20 sec cooldown
        this.pushing = true;
        setTimeout(() => {
          this.pushing = false;
        }, 100);
        break;

      case "sprint":
        this.abilitiesCooldowns.sprint = now + 20000;
        this.isSprinting = true;
        setTimeout(() => {
          this.isSprinting = false;
        }, 5000);
        break;

      case "slide":
        this.abilitiesCooldowns.slide = now + 10000;
        this.isSliding = true;
        const slideDistance = 20;
        this.x += this.vx * slideDistance;
        this.y += this.vy * slideDistance;
        setTimeout(() => {
          this.isSliding = false;
        }, 500);
        break;

      case "invul":
        this.abilitiesCooldowns.invul = now + 40000;

        // Clear any existing timer
        if (this.invulTimeout) {
          clearTimeout(this.invulTimeout);
        }

        this.isInvulnerable = true;

        // Automatically disable invul after 3 seconds
        this.invulTimeout = setTimeout(() => {
          this.isInvulnerable = false;
          this.invulTimeout = null; // clear reference
          console.log(
            `[${new Date().toISOString()}] Player ${this.id} invulnerability ended`,
          );
        }, 3000);
        break;

      default:
        return false;
    }

    return true;
  }

  updatePosition(delta = 1) {
    if (!this.alive) return;

    // ACCELERATION
    const accel = 0.5 * (this.isSprinting ? 2 : 1); // double acceleration if sprinting
    const friction = 0.9;

    // Apply acceleration from input
    this.vx += this.inputX * accel;
    this.vy += this.inputY * accel;

    // Apply friction
    this.vx *= friction;
    this.vy *= friction;

    // Limit max speed
    const maxSpeed = this.isSprinting ? 15 : 8; // faster max speed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    // Apply movement
    this.x += this.vx * delta;
    this.y += this.vy * delta;
  }

  // Check if ability is ready
  canUseAbility(abilityName) {
    return Date.now() >= this.abilitiesCooldowns[abilityName];
  }

  // Convert to JSON for client
  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      speedMultiplier: this.speedMultiplier,
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
