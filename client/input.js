export default function setupInput(socket) {
    const inputState = { up: false, down: false, left: false, right: false };
    let slideCooldown = false;
    const debugEl = document.getElementById("debug");

    function logScreen(msg) {
        if(debugEl) debugEl.innerText = msg;
    }

    const keyMap = {
        "KeyW": "up",    "ArrowUp": "up",
        "KeyS": "down",  "ArrowDown": "down",
        "KeyA": "left",  "ArrowLeft": "left",
        "KeyD": "right", "ArrowRight": "right"
    };

    function sendInput() {
        socket.emit("input", {
            vx: (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0),
            vy: (inputState.down ? 1 : 0) - (inputState.up ? 1 : 0)
        });
    }

    function attemptSlide() {
        if (slideCooldown) return;
        const dx = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
        const dy = (inputState.down ? 1 : 0) - (inputState.up ? 1 : 0);

        if (dx !== 0 || dy !== 0) {
            logScreen(`SLIDE: ${dx}, ${dy}`); 
            socket.emit("ability", { name: "slide", dir: { x: dx, y: dy } });
            slideCooldown = true;
            setTimeout(() => { slideCooldown = false; }, 500);
        }
    }

    window.addEventListener("keydown", (e) => {
        if (e.repeat) return;
        const dir = keyMap[e.code];

        if (dir) {
            inputState[dir] = true;
            sendInput();
            if (e.shiftKey) attemptSlide();
        }

        if (e.code === "KeyQ") { socket.emit("ability", "push"); logScreen("Ability: PUSH"); }
        if (e.code === "KeyE") { socket.emit("ability", "sprint"); logScreen("Ability: SPRINT"); }
        if (e.code === "KeyR") { socket.emit("ability", "invul"); logScreen("Ability: INVUL"); }
        if (e.key === "Shift") attemptSlide();
    });

    window.addEventListener("keyup", (e) => {
        const dir = keyMap[e.code];
        if (dir) {
            inputState[dir] = false;
            sendInput();
        }
    });

    window.addEventListener("click", () => {
        const arena = document.getElementById("arena");
        if(arena) arena.focus();
    });

    return inputState;
}