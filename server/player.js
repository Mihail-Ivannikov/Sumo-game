const { v4: uuid } = require("uuid");

const ABILITY_DURATION = {
    push: 3000,
    sprint: 10000,
    slide: 3000,
    invul: 20000
};

class Player {
    constructor(id = uuid()) {
        this.id = id;
        this.username = "Unknown";
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.inputX = 0;
        this.inputY = 0;

        this.isInvulnerable = false;
        this.isSprinting = false;
        this.isSliding = false;
        this.pushing = false;

        this.abilitiesCooldowns = { push: 0, sprint: 0, slide: 0, invul: 0 };
        this.invulTimeout = null;
        this.ready = false;
        this.alive = true;
    }

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
        this.abilitiesCooldowns = { push: 0, sprint: 0, slide: 0, invul: 0 };

        if (this.invulTimeout) {
            clearTimeout(this.invulTimeout);
            this.invulTimeout = null;
        }
    }

    useAbility(abilityName, params = {}) {
        if (!this.canUseAbility(abilityName)) return false;

        this.abilitiesCooldowns[abilityName] = ABILITY_DURATION[abilityName] || 0;

        switch (abilityName) {
            case "push":
                this.pushing = true;
                setTimeout(() => { this.pushing = false; }, 100);
                break;
            case "sprint":
                this.isSprinting = true;
                setTimeout(() => { this.isSprinting = false; }, 3000);
                break;
            case "slide":
                this.isSliding = true;
                let dirX = params.dir?.x || this.vx;
                let dirY = params.dir?.y || this.vy;
                const mag = Math.sqrt(dirX * dirX + dirY * dirY);
                if (mag > 0) {
                    this.vx = (dirX / mag) * 25;
                    this.vy = (dirY / mag) * 25;
                }
                setTimeout(() => { this.isSliding = false; }, 400);
                break;
            case "invul":
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

        let maxSpeed = this.isSliding ? 30 : (this.isSprinting ? 15 : 8);
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        this.x += this.vx * delta;
        this.y += this.vy * delta;
    }

    canUseAbility(name) {
        return this.abilitiesCooldowns[name] <= 0;
    }

    toJSON() {
        return {
            id: this.id,
            username: this.username,
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