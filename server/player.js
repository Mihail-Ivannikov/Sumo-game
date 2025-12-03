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

    // Input state (from client)
    this.inputX = 0;
    this.inputY = 0;

    // Abilities state
    this.isInvulnerable = false;
    this.isSprinting = false;
    this.isSliding = false;
    this.pushing = false;

    // Ability cooldowns (timestamp when ability is next available)
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

  /**
   * Activates an ability.
   * @param {string} abilityName - The name of the ability (push, sprint, slide, invul)
   * @param {object} params - Optional parameters (e.g., direction for slide)
   */
  useAbility(abilityName, params = {}) {
    if (!this.canUseAbility(abilityName)) return false;

    const now = Date.now();

    switch (abilityName) {
      case "push":
        this.abilitiesCooldowns.push = now + 20000; // 20s cooldown
        this.pushing = true;
        setTimeout(() => {
          this.pushing = false;
        }, 100);
        break;

      case "sprint":
        this.abilitiesCooldowns.sprint = now + 20000; // 20s cooldown
        this.isSprinting = true;
        setTimeout(() => {
          this.isSprinting = false;
        }, 5000);
        break;

      case "slide":
        this.abilitiesCooldowns.slide = now + 5000; // 5s cooldown
        this.isSliding = true;

        // 1. Determine Direction
        // If client sent specific direction (Shift+WASD), use it. 
        // Otherwise, use current velocity or face forward.
        let dirX = 0;
        let dirY = 0;

        if (params.dir && (params.dir.x !== 0 || params.dir.y !== 0)) {
          dirX = params.dir.x;
          dirY = params.dir.y;
        } else {
          // Fallback to current movement direction
          dirX = this.vx;
          dirY = this.vy;
        }

        // 2. Normalize Vector (prevent diagonal speed boost)
        const mag = Math.sqrt(dirX * dirX + dirY * dirY);
        if (mag > 0) {
          dirX /= mag;
          dirY /= mag;
        } else {
          // If completely stationary and no input, default to sliding "down" or "up" just to move
          // Or just don't move. Let's default to no movement if mag is 0.
          dirX = 0;
          dirY = 0;
        }

        // 3. Apply Slide Impulse
        // We set velocity directly to a high value. 
        // Friction in updatePosition will slow it down over time.
        const slideSpeed = 15; 
        if (dirX !== 0 || dirY !== 0) {
            this.vx = dirX * slideSpeed;
            this.vy = dirY * slideSpeed;
        }

        // Slide state lasts 400ms (sets max speed cap higher)
        setTimeout(() => {
          this.isSliding = false;
        }, 200);
        break;

      case "invul":
        this.abilitiesCooldowns.invul = now + 40000; // 40s cooldown

        // Clear any existing timer to prevent conflicts
        if (this.invulTimeout) {
          clearTimeout(this.invulTimeout);
        }

        this.isInvulnerable = true;

        // Disable invul after 3 seconds
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

    // Physics Constants
    const accel = 0.5 * (this.isSprinting ? 2 : 1); 
    const friction = 0.9;

    // Apply input acceleration (unless sliding, optional choice, but usually allows steering)
    // If you want to lock direction during slide, wrap this in "if (!this.isSliding)"
    this.vx += this.inputX * accel;
    this.vy += this.inputY * accel;

    // Apply friction
    this.vx *= friction;
    this.vy *= friction;

    // Limit max speed
    let maxSpeed = this.isSprinting ? 15 : 8; // Normal limits

    // If sliding, significantly increase max speed cap
    if (this.isSliding) {
      maxSpeed = 30; 
    }

    // Clamp velocity to maxSpeed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    // Apply velocity to position
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