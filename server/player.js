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
            invul: now
        };

        // Lobby state
        this.ready = false;

        // Game state
        this.alive = true;

        this.isSprinting = false;
        this.isSliding = false;
        this.isInvulnerable = false;
        this.pushing = false;

        this.inputX = 0;
        this.inputY = 0;


    }

    useAbility(abilityName) {
    const now = Date.now();
    if (this.abilitiesCooldowns[abilityName] > now) return false;

    switch (abilityName) {
        case "push":
            this.abilitiesCooldowns.push = now + 20000; // 20 sec cooldown
            this.pushing = true;
            setTimeout(() => { this.pushing = false; }, 100); // короткий момент push
            break;
        case "sprint":
            this.abilitiesCooldowns.sprint = now + 20000;
            this.isSprinting = true;
            setTimeout(() => { this.isSprinting = false; }, 5000); // 5 sec
            break;
        case "slide":
            this.abilitiesCooldowns.slide = now + 10000;
            this.isSliding = true;
            const slideDistance = 20;
            this.x += this.vx * slideDistance;
            this.y += this.vy * slideDistance;
            setTimeout(() => { this.isSliding = false; }, 500); // 0.5 sec
            break;
        case "invul":
            this.abilitiesCooldowns.invul = now + 40000;
            this.isInvulnerable = true;
            setTimeout(() => { this.isInvulnerable = false; }, 3000); // 3 sec
            break;
    }

    return true;
}

updatePosition(delta = 1) {
    if (!this.alive) return;

    // ACCELERATION
    const accel = 0.5;
    const friction = 0.90;

    // Apply acceleration from input
    this.vx += this.inputX * accel;
    this.vy += this.inputY * accel;

    // Apply friction
    this.vx *= friction;
    this.vy *= friction;

    // Limit max speed
    const maxSpeed = this.isSprinting ? 15 : 8;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxSpeed) {
        this.vx = (this.vx / speed) * maxSpeed;
        this.vy = (this.vy / speed) * maxSpeed;
    }

    // Apply movement
    this.x += this.vx;
    this.y += this.vy;
}



    // Check if ability is ready
    canUseAbility(abilityName) {
        return Date.now() >= this.abilitiesCooldowns[abilityName];
    }

    // Activate ability and set cooldown
    useAbility(abilityName) {
        if (!this.canUseAbility(abilityName)) return false;

        const now = Date.now();
        switch (abilityName) {
            case "push":
                this.abilitiesCooldowns.push = now + 20000; // 20 sec
                break;
            case "sprint":
                this.abilitiesCooldowns.sprint = now + 20000; // 20 sec
                this.isSprinting = true;
                setTimeout(() => { this.isSprinting = false; }, 5000); // sprint lasts 5 sec
                break;
            case "slide":
                this.abilitiesCooldowns.slide = now + 10000; // 10 sec
                this.isSliding = true;
                setTimeout(() => { this.isSliding = false; }, 500); // slide lasts 0.5 sec
                break;
            case "invul":
                this.abilitiesCooldowns.invul = now + 40000; // 40 sec
                this.isInvulnerable = true;
                setTimeout(() => { this.isInvulnerable = false; }, 3000); // 3 sec invul
                break;
            default:
                return false;
        }

        return true;
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
            alive: this.alive
        };
    }
}

module.exports = Player;
