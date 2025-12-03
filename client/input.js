// input.js
export default function setupInput(socket) {
    const inputState = {
        up: false,
        down: false,
        left: false,
        right: false
    };

    let slideCooldown = false;

    const keyMap = {
        "ArrowUp": "up",
        "ArrowDown": "down",
        "ArrowLeft": "left",
        "ArrowRight": "right",
        "w": "up",
        "s": "down",
        "a": "left",
        "d": "right"
    };

    function sendInput() {
        socket.emit("input", {
            vx: (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0),
            vy: (inputState.down ? 1 : 0) - (inputState.up ? 1 : 0)
        });
    }

    document.addEventListener("keydown", (e) => {
        const key = e.key.toLowerCase();
        let changed = false;

        // Movement
        if (keyMap[e.key] || keyMap[key]) {
            const dir = keyMap[e.key] || keyMap[key];
            if (!inputState[dir]) { inputState[dir] = true; changed = true; }
        }

        // Abilities: just emit to server
        if (key === "q") socket.emit("ability", "push");
        if (key === "e") socket.emit("ability", "sprint");
        if (key === "r") socket.emit("ability", "invul");

        // Slide (Shift + WASD)
        if (e.shiftKey && ["w","a","s","d"].includes(key) && !slideCooldown) {
            socket.emit("ability", "slide");
            slideCooldown = true;
            setTimeout(() => { slideCooldown = false; }, 200); // short cooldown to prevent spam
        }

        if (changed) sendInput();
    });

    document.addEventListener("keyup", (e) => {
        const key = e.key.toLowerCase();
        let changed = false;

        if (key === "w" || key === "arrowup") { inputState.up = false; changed = true; }
        if (key === "s" || key === "arrowdown") { inputState.down = false; changed = true; }
        if (key === "a" || key === "arrowleft") { inputState.left = false; changed = true; }
        if (key === "d" || key === "arrowright") { inputState.right = false; changed = true; }

        if (changed) sendInput();
    });

    // Ready button
    const readyBtn = document.getElementById("readyBtn");
    if (readyBtn) readyBtn.addEventListener("click", () => {
        socket.emit("player-ready");
    });

    return inputState;
}
