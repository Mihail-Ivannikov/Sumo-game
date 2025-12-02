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
    }

    useAbility(abilityName) {
        const now = Date.now();
        if (this.abilitiesCooldowns[abilityName] > now) {
            console.log(`[${new Date().toISOString()}] Player ${this.id} tried to use ${abilityName}, but it's on cooldown`);
            return false;
        }

        switch (abilityName) {
            case "push":
                this.abilitiesCooldowns.push = now + 20000; // 20 sec cooldown
                this.pushing = true;
                setTimeout(() => { 
                    this.pushing = false; 
                    console.log(`[${new Date().toISOString()}] Player ${this.id} push ended`);
                }, 100); // короткий момент push
                console.log(`[${new Date().toISOString()}] Player ${this.id} used PUSH`);
                break;
            case "sprint":
                this.abilitiesCooldowns.sprint = now + 20000;
                this.isSprinting = true;
                setTimeout(() => { 
                    this.isSprinting = false; 
                    console.log(`[${new Date().toISOString()}] Player ${this.id} sprint ended`);
                }, 5000); // 5 sec
                console.log(`[${new Date().toISOString()}] Player ${this.id} started SPRINT`);
                break;
            case "slide":
                this.abilitiesCooldowns.slide = now + 10000;
                this.isSliding = true;
                const slideDistance = 20;
                this.x += this.vx * slideDistance;
                this.y += this.vy * slideDistance;
                setTimeout(() => { 
                    this.isSliding = false; 
                    console.log(`[${new Date().toISOString()}] Player ${this.id} slide ended`);
                }, 500); // 0.5 sec
                console.log(`[${new Date().toISOString()}] Player ${this.id} used SLIDE`);
                break;
            case "invul":
                this.abilitiesCooldowns.invul = now + 40000;
                this.isInvulnerable = true;
                setTimeout(() => { 
                    this.isInvulnerable = false; 
                    console.log(`[${new Date().toISOString()}] Player ${this.id} invulnerability ended`);
                }, 3000); // 3 sec
                console.log(`[${new Date().toISOString()}] Player ${this.id} activated INVULNERABILITY`);
                break;
        }

        return true;
    }

    updatePosition(deltaTime = 1) {
        if (!this.alive) return;

        let vx = this.vx;
        let vy = this.vy;

        // Normalize diagonal
        const norm = Math.sqrt(vx*vx + vy*vy);
        if (norm > 1) {
            vx /= norm;
            vy /= norm;
        }

        const maxSpeed = this.isSprinting ? 2 : 1;
        const speed = Math.min(Math.sqrt(this.vx**2 + this.vy**2) * this.speedMultiplier, maxSpeed);

        const oldX = this.x;
        const oldY = this.y;

        this.x += vx * speed * deltaTime;
        this.y += vy * speed * deltaTime;

        console.log(`[${new Date().toISOString()}] Player ${this.id} moved from (${oldX.toFixed(2)}, ${oldY.toFixed(2)}) to (${this.x.toFixed(2)}, ${this.y.toFixed(2)})`);
    }

    // Check if ability is ready
    canUseAbility(abilityName) {
        return Date.now() >= this.abilitiesCooldowns[abilityName];
    }

    // Activate ability and set cooldown (duplicate logic preserved) with logs
    useAbility(abilityName) {
        if (!this.canUseAbility(abilityName)) {
            console.log(`[${new Date().toISOString()}] Player ${this.id} tried to use ${abilityName}, but it's on cooldown`);
            return false;
        }

        const now = Date.now();
        switch (abilityName) {
            case "push":
                this.abilitiesCooldowns.push = now + 20000; // 20 sec
                console.log(`[${new Date().toISOString()}] Player ${this.id} push activated`);
                break;
            case "sprint":
                this.abilitiesCooldowns.sprint = now + 20000; // 20 sec
                this.isSprinting = true;
                setTimeout(() => { 
                    this.isSprinting = false; 
                    console.log(`[${new Date().toISOString()}] Player ${this.id} sprint ended`);
                }, 5000); 
                console.log(`[${new Date().toISOString()}] Player ${this.id} sprint activated`);
                break;
            case "slide":
                this.abilitiesCooldowns.slide = now + 10000; // 10 sec
                this.isSliding = true;
                setTimeout(() => { 
                    this.isSliding = false; 
                    console.log(`[${new Date().toISOString()}] Player ${this.id} slide ended`);
                }, 500); 
                console.log(`[${new Date().toISOString()}] Player ${this.id} slide activated`);
                break;
            case "invul":
                this.abilitiesCooldowns.invul = now + 40000; // 40 sec
                this.isInvulnerable = true;
                setTimeout(() => { 
                    this.isInvulnerable = false; 
                    console.log(`[${new Date().toISOString()}] Player ${this.id} invulnerability ended`);
                }, 3000); 
                console.log(`[${new Date().toISOString()}] Player ${this.id} invulnerability activated`);
                break;
            default:
                console.log(`[${new Date().toISOString()}] Player ${this.id} tried unknown ability: ${abilityName}`);
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
