// client/input.js
export default function setupInput(socket) {
    const inputState = {
        up: false, down: false, left: false, right: false
    };

    let slideCooldown = false;
    const debugEl = document.getElementById("debug");

    // Helper to update the green debug box on screen
    function logScreen(msg) {
        if(debugEl) {
            debugEl.innerText = msg;
            // Optional: Log to console too
            // console.log("[INPUT]", msg);
        }
    }

    // Use PHYSICAL keys (e.code) to map inputs
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

        // Calculate direction based on held keys
        const dx = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
        const dy = (inputState.down ? 1 : 0) - (inputState.up ? 1 : 0);

        // Only slide if actually moving
        if (dx !== 0 || dy !== 0) {
            logScreen(`SLIDE FIRED! Dir: ${dx}, ${dy}`); 

            socket.emit("ability", { 
                name: "slide", 
                dir: { x: dx, y: dy } 
            });

            slideCooldown = true;
            setTimeout(() => {
                slideCooldown = false;
                logScreen("Slide Ready");
            }, 500);
        } else {
            logScreen("Slide Ignored: Not moving");
        }
    }

    // ==== Event Listeners ====

    // Listener on window to catch everything (better than canvas focus for now)
    window.addEventListener("keydown", (e) => {
        if (e.repeat) return;

        const dir = keyMap[e.code];

        // 1. Handle Movement
        if (dir) {
            inputState[dir] = true;
            sendInput();
            
            // Scenario A: Holding Shift, then pressed W/A/S/D
            if (e.shiftKey) {
                attemptSlide();
            }
        }

        // 2. Handle Abilities
        if (e.code === "KeyQ") { socket.emit("ability", "push"); logScreen("Ability: PUSH"); }
        if (e.code === "KeyE") { socket.emit("ability", "sprint"); logScreen("Ability: SPRINT"); }
        if (e.code === "KeyR") { socket.emit("ability", "invul"); logScreen("Ability: INVUL"); }

        // 3. Handle Shift
        // Scenario B: Holding W/A/S/D, then pressed Shift
        if (e.key === "Shift") {
            attemptSlide();
        }
    });

    window.addEventListener("keyup", (e) => {
        const dir = keyMap[e.code];
        if (dir) {
            inputState[dir] = false;
            sendInput();
        }
    });

    // Make sure we click the game to focus it (Visual feedback)
    window.addEventListener("click", () => {
        const arena = document.getElementById("arena");
        if(arena) arena.focus();
        logScreen("Game Focused - Ready to play");
    });

    // Ready button logic
    const readyBtn = document.getElementById("readyBtn");
    if (readyBtn) {
        readyBtn.addEventListener("click", () => {
            socket.emit("player-ready");
            logScreen("Sent: Player Ready");
        });
    }

    return inputState;
}