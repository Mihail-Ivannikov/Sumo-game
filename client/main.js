import setupInput from './input.js';
import GameRenderer from './renderer.js';

const socket = io("http://localhost:3000");
let playerId;
let isGameActive = false;

const myInput = setupInput(socket);
const renderer = new GameRenderer("arena", {
    push: { slot: "slot-push", overlay: "cd-push" },
    sprint: { slot: "slot-sprint", overlay: "cd-sprint" },
    slide: { slot: "slot-slide", overlay: "cd-slide" },
    invul: { slot: "slot-invul", overlay: "cd-invul" }
}, myInput);

const screens = {
    login: document.getElementById("login-screen"),
    lobby: document.getElementById("lobby-screen"),
    game: document.getElementById("game-screen")
};
const ui = {
    username: document.getElementById("usernameInput"),
    joinBtn: document.getElementById("joinBtn"),
    lobbyList: document.getElementById("lobby-list"),
    lobbyStatus: document.getElementById("lobbyStatus"),
    readyBtn: document.getElementById("readyBtn"),
    exitBtn: document.getElementById("exitBtn"),
    countdown: document.getElementById("countdown-overlay"),
    modal: document.getElementById("gameOverModal"),
    winnerText: document.getElementById("winnerText"),
    restartBtn: document.getElementById("restartBtn")
};

function showScreen(name) {
    Object.values(screens).forEach(el => el.classList.remove("active-screen"));
    if(screens[name]) {
        screens[name].classList.add("active-screen");
        isGameActive = (name === "game");
    }
}

function renderLobby(players) {
    ui.lobbyList.innerHTML = "";
    let readyCount = 0;
    
    const me = players.find(p => p.id === playerId);
    if (me) {
        ui.readyBtn.disabled = me.ready;
        ui.readyBtn.innerText = me.ready ? "WAITING..." : "I AM READY";
        ui.readyBtn.style.backgroundColor = me.ready ? "#555" : "#4CAF50";
    }

    players.forEach(p => {
        if(p.ready) readyCount++;
        const div = document.createElement("div");
        div.className = "lobby-player";
        
        const nameSpan = document.createElement("span");
        nameSpan.innerText = p.username || "Unknown";
        if(p.id === playerId) nameSpan.style.color = "#4CAF50"; 

        const statusSpan = document.createElement("span");
        statusSpan.innerText = p.ready ? "READY" : "WAITING";
        statusSpan.className = p.ready ? "status-ready" : "status-waiting";

        div.appendChild(nameSpan); div.appendChild(statusSpan);
        ui.lobbyList.appendChild(div);
    });
    ui.lobbyStatus.innerText = `${readyCount} / ${players.length} Players Ready`;
}

ui.joinBtn.onclick = () => {
    const name = ui.username.value.trim() || "Player";
    socket.emit("join-game", name); 
    showScreen("lobby");
};

ui.readyBtn.onclick = () => {
    socket.emit("player-ready");
    ui.readyBtn.disabled = true;
};

ui.exitBtn.onclick = () => {
    socket.emit("leave-lobby");
    ui.lobbyList.innerHTML = "";
    showScreen("login");
};

ui.restartBtn.onclick = () => {
    ui.modal.style.display = "none";
    ui.countdown.style.display = "none";
    showScreen("lobby");
};

socket.on("joined-room", (data) => { playerId = data.playerId; });

socket.on("room-updated", (data) => { renderLobby(data.players); });

socket.on("state-update", (data) => {
    if(isGameActive) renderer.draw(data, playerId);
});

socket.on("ability-used", (data) => {
    if(data.ability === "push") renderer.triggerAnimation(data.playerId, "push");
});

socket.on("countdown", num => {
    if (num === null || num < 0) {
        ui.countdown.style.display = "none";
        return;
    }
    if(!isGameActive) {
        showScreen("game");
        document.getElementById("arena").focus();
    }
    ui.countdown.style.display = "block";
    ui.countdown.innerText = num > 0 ? num : "FIGHT!";
    if (num <= 0) setTimeout(() => { ui.countdown.style.display = "none"; }, 1000);
});

socket.on("game-over", (data) => {
    if (data.winner) {
        if (data.winner === playerId) {
            ui.winnerText.innerText = "🏆 YOU WON! 🏆";
            ui.winnerText.style.color = "#4CAF50";
        } else {
            ui.winnerText.innerText = "You Lost!";
            ui.winnerText.style.color = "white";
        }
    } else {
        ui.winnerText.innerText = "Draw / Everyone died";
        ui.winnerText.style.color = "#aaa";
    }
    ui.modal.style.display = "flex";
});