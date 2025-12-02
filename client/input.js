// input.js
export default function setupInput(socket) {
    // Current input state
    const inputState = {
        up: false,
        down: false,
        left: false,
        right: false,
        push: false,
        sprint: false,
        slide: false,
        invulnerable: false
    };

    // Map keys to inputState
    const keyMap = {
        "ArrowUp": "up",
        "ArrowDown": "down",
        "ArrowLeft": "left",
        "ArrowRight": "right",
        "w": "up",
        "s": "down",
        "a": "left",
        "d": "right",
        "q": "push",
        "e": "slide",
        "Shift": "sprint",
        "r": "invulnerable"
    };

    // Keydown
    document.addEventListener("keydown", e => {
        const key = keyMap[e.key];
        if (key && !inputState[key]) {
            inputState[key] = true;
            console.log(`Key down: ${e.key} -> ${key}`);
            sendInput();
        }
    });

    // Keyup
    document.addEventListener("keyup", e => {
        const key = keyMap[e.key];
        if (key && inputState[key]) {
            inputState[key] = false;
            console.log(`Key up: ${e.key} -> ${key}`);
            sendInput();
        }
    });

    // Ready button
    const readyBtn = document.getElementById("readyBtn");
    if (readyBtn) {
        readyBtn.addEventListener("click", () => {
            socket.emit("player-ready");
            console.log("Ready button clicked!");
        });
    }

    // Abilities buttons
    const abilitiesMap = {
        pushBtn: "push",
        sprintBtn: "sprint",
        slideBtn: "slide",
        invulBtn: "invulnerable"
    };

    Object.keys(abilitiesMap).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener("click", () => {
                socket.emit("ability", abilitiesMap[btnId]);
                console.log(`Ability button clicked: ${abilitiesMap[btnId]}`);
            });
        }
    });

    // Send input to server
    function sendInput() {
        // Convert booleans to vx, vy
        const vx = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
        const vy = (inputState.down ? 1 : 0) - (inputState.up ? 1 : 0);

        socket.emit("input", {
            vx,
            vy,
            abilities: {
                push: inputState.push,
                sprint: inputState.sprint,
                slide: inputState.slide,
                invulnerable: inputState.invulnerable
            }
        });

        console.log("Sent input:", {
            vx,
            vy,
            abilities: {
                push: inputState.push,
                sprint: inputState.sprint,
                slide: inputState.slide,
                invulnerable: inputState.invulnerable
            }
        });
    }

    return inputState;
}
