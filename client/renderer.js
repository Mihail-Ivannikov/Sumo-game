// renderer.js

class Renderer {
    constructor(canvasId, arenaRadius) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.arenaRadius = arenaRadius;
        this.players = {}; // playerId => {x, y, targetX, targetY, alive, cooldowns}
        this.lastTimestamp = performance.now();
        this.interpolationFactor = 0.1;
    }

    // Оновлення стану від сервера
    updateState(state) {
        state.players.forEach(p => {
            if (!this.players[p.id]) {
                this.players[p.id] = {
                    x: p.x,
                    y: p.y,
                    targetX: p.x,
                    targetY: p.y,
                    alive: p.alive,
                    cooldowns: {...p.abilitiesCooldowns}
                };
            } else {
                this.players[p.id].targetX = p.x;
                this.players[p.id].targetY = p.y;
                this.players[p.id].alive = p.alive;
                this.players[p.id].cooldowns = {...p.abilitiesCooldowns};
            }
        });
    }

    // Малювання арени
    drawArena() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.translate(this.canvas.width/2, this.canvas.height/2);
        ctx.beginPath();
        ctx.arc(0, 0, this.arenaRadius, 0, Math.PI*2);
        ctx.fillStyle = "#eee";
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
    }

    // Малювання гравців
    drawPlayers() {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.canvas.width/2, this.canvas.height/2);

        Object.values(this.players).forEach(p => {
            // Інтерполяція
            p.x += (p.targetX - p.x) * this.interpolationFactor;
            p.y += (p.targetY - p.y) * this.interpolationFactor;

            // Колір
            ctx.fillStyle = p.alive ? "green" : "red";

            // Коло гравця
            ctx.beginPath();
            ctx.arc(p.x, p.y, 20, 0, Math.PI*2);
            ctx.fill();

            // Cooldowns
            const abilities = Object.keys(p.cooldowns);
            abilities.forEach((ab, i) => {
                const cd = p.cooldowns[ab];
                const ratio = Math.max(0, cd/40000); // максимальний cooldown ~40s
                ctx.fillStyle = `rgba(0,0,0,0.5)`;
                ctx.fillRect(p.x - 20, p.y - 25 - i*6, 40*ratio, 4);
            });
        });

        ctx.restore();
    }

    render() {
        this.drawArena();
        this.drawPlayers();
        requestAnimationFrame(() => this.render());
    }
}

// --- Використання ---
// В main client.js або index.html:
const renderer = new Renderer("arena", 500); // canvas id + radius
renderer.render();

// Коли приходить state-update
socket.on("state-update", (data) => {
    renderer.updateState(data);
});
