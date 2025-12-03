// renderer.js
class Renderer {
    constructor(canvasId, arenaRadius) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.arenaRadius = arenaRadius;
        this.players = {}; // playerId => {x, y, targetX, targetY, alive, cooldowns, firstUpdate}
        this.interpolationFactor = 0.1;
    }

    // Update server state
    updateState(state) {
        state.players.forEach(p => {
            if (!this.players[p.id]) {
                // First time we see this player: snap to position instantly
                this.players[p.id] = {
                    x: p.x,
                    y: p.y,
                    targetX: p.x,
                    targetY: p.y,
                    alive: p.alive,
                    cooldowns: { ...p.abilitiesCooldowns },
                    firstUpdate: true
                };
            } else {
                // Update target positions for interpolation
                this.players[p.id].targetX = p.x;
                this.players[p.id].targetY = p.y;
                this.players[p.id].alive = p.alive;
                this.players[p.id].cooldowns = { ...p.abilitiesCooldowns };
            }
        });
    }

    // Draw arena
    drawArena() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.beginPath();
        ctx.arc(0, 0, this.arenaRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#eee";
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
    }

    // Draw players
    drawPlayers() {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);

        Object.values(this.players).forEach(p => {
            // Snap first update instantly to target
            if (p.firstUpdate) {
                p.x = p.targetX;
                p.y = p.targetY;
                p.firstUpdate = false;
            } else {
                // Interpolate positions smoothly
                p.x += (p.targetX - p.x) * this.interpolationFactor;
                p.y += (p.targetY - p.y) * this.interpolationFactor;
            }

            // Player circle
            ctx.beginPath();
            ctx.arc(p.x, p.y, 25, 0, Math.PI * 2);
            ctx.fillStyle = p.alive ? "green" : "red";
            ctx.fill();
            ctx.strokeStyle = "#000";
            ctx.stroke();

            // ID text
            ctx.fillStyle = "white";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(p.id.slice(0, 2), p.x, p.y + 4);
        });

        ctx.restore();
    }

    // Main render loop
    render() {
        this.drawArena();
        this.drawPlayers();
        requestAnimationFrame(() => this.render());
    }
}

// ===== Usage =====
const renderer = new Renderer("arena", 250); // canvas id + radius
renderer.render();

// Socket integration
const socket = io("http://localhost:3000");
socket.on("sync", (data) => {
    renderer.updateState(data);
});
