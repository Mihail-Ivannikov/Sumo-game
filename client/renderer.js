const imgPlayerIdle = new Image(); imgPlayerIdle.src = "./img/Player.png"; 
const imgPlayerRun1 = new Image(); imgPlayerRun1.src = "./img/Player_run_1.png";
const imgPlayerRun2 = new Image(); imgPlayerRun2.src = "./img/Player_run_2.png";
const imgEnemyIdle = new Image();  imgEnemyIdle.src = "./img/Player_enemy.png"; 
const imgEnemyRun1 = new Image();  imgEnemyRun1.src = "./img/Player_enemy_run_1.png";
const imgEnemyRun2 = new Image();  imgEnemyRun2.src = "./img/Player_enemy_run_2.png";

const MAX_CD = { push: 3000, sprint: 10000, slide: 3000, invul: 20000 };

export default class GameRenderer {
    constructor(canvasId, abilityBarIds, inputState) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.arenaRadius = 250;
        this.animations = [];
        this.playerAngles = {};
        this.inputState = inputState; 
        
        this.cdEls = {
            push: document.getElementById(abilityBarIds.push.overlay),
            sprint: document.getElementById(abilityBarIds.sprint.overlay),
            slide: document.getElementById(abilityBarIds.slide.overlay),
            invul: document.getElementById(abilityBarIds.invul.overlay)
        };
        this.slotEls = {
            push: document.getElementById(abilityBarIds.push.slot),
            sprint: document.getElementById(abilityBarIds.sprint.slot),
            slide: document.getElementById(abilityBarIds.slide.slot),
            invul: document.getElementById(abilityBarIds.invul.slot)
        };
    }

    triggerAnimation(playerId, type, duration = 200) {
        this.animations.push({ playerId, type, startTime: Date.now(), duration });
    }

    draw(gameState, myPlayerId) {
        const ctx = this.ctx;
        const now = Date.now();
        
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.translate(this.canvas.width/2, this.canvas.height/2);

        ctx.beginPath();
        ctx.arc(0, 0, this.arenaRadius, 0, Math.PI*2);
        ctx.fillStyle = "#ddd"; ctx.fill(); 
        ctx.lineWidth = 5; ctx.strokeStyle = "#444"; ctx.stroke();

        this.animations = this.animations.filter(anim => now - anim.startTime < anim.duration);

        gameState.players.forEach(p => {
            if(!p.alive && p.id !== myPlayerId) return;

            ctx.save();

            if (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1) {
                this.playerAngles[p.id] = Math.atan2(p.vy, p.vx);
            }
            let angle = this.playerAngles[p.id];
            if (angle === undefined) angle = Math.PI / 2;

            ctx.translate(p.x, p.y);
            ctx.rotate(angle - Math.PI / 2);

            const activeAnim = this.animations.find(a => a.playerId === p.id && a.type === "push");
            if (activeAnim) {
                const progress = (now - activeAnim.startTime) / activeAnim.duration;
                const offset = Math.sin(progress * Math.PI) * 15;
                ctx.translate(0, offset); 
                
                ctx.beginPath();
                ctx.arc(0, 40, 20 + (progress * 30), 0, Math.PI, false);
                ctx.lineWidth = 5 - (progress * 5);
                ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`; 
                ctx.stroke();
            }

            if (p.isInvulnerable) {
                ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI*2);
                ctx.fillStyle = "rgba(255, 215, 0, 0.5)"; ctx.fill();
            } else if (p.isSliding) {
                ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI*2);
                ctx.fillStyle = "rgba(0, 255, 255, 0.5)"; ctx.fill();
            }

            let sprite;
            const isMe = (p.id === myPlayerId);
            let isMoving = isMe ? (this.inputState.up || this.inputState.down || this.inputState.left || this.inputState.right) 
                                : (Math.abs(p.vx) > 0.5 || Math.abs(p.vy) > 0.5);
            if (p.isSliding) isMoving = true;

            if (!isMoving) {
                sprite = isMe ? imgPlayerIdle : imgEnemyIdle;
            } else {
                const frame = Math.floor(now / 150) % 2; 
                sprite = isMe ? (frame === 0 ? imgPlayerRun1 : imgPlayerRun2) 
                              : (frame === 0 ? imgEnemyRun1 : imgEnemyRun2);
            }

            if (!p.alive) ctx.globalAlpha = 0.5;
            const size = 60; 
            ctx.drawImage(sprite, -size/2, -size/2, size, size);
            ctx.restore(); 

            ctx.fillStyle = "black"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
            ctx.fillText(p.username || "Player", p.x, p.y + 40);
        });

        ctx.restore();

        const me = gameState.players.find(p => p.id === myPlayerId);
        if(me) this.updateAbilityUI(me);
    }

    updateAbilityUI(myPlayer) {
        const cds = myPlayer.abilitiesCooldowns;
        
        const updateSlot = (key, current) => {
            const max = MAX_CD[key];
            const overlay = this.cdEls[key];
            const slot = this.slotEls[key];

            if (current <= 0) {
                overlay.style.height = "0%";
                slot.classList.add("ready");
            } else {
                const percent = (current / max) * 100;
                overlay.style.height = percent + "%";
                slot.classList.remove("ready");
            }
        };

        updateSlot('push', cds.push);
        updateSlot('sprint', cds.sprint);
        updateSlot('slide', cds.slide);
        updateSlot('invul', cds.invul);
    }
}