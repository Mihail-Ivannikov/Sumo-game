// network.js
export default function setupNetwork(socket, onStateUpdate, onGameStart, onGameOver) {
    let playerId = null;
    let roomId = null;

    // ==== Join room automatically ====
    socket.emit("join-room");

    socket.on("joined-room", (data) => {
        playerId = data.playerId;
        roomId = data.roomId;
        console.log(`Joined room ${roomId} as ${playerId}`);
    });

    // ==== State updates from server ====
    socket.on("state", (gameState) => {
        // Pass the state to your renderer
        if (onStateUpdate) onStateUpdate(gameState);
    });

    // ==== Game start ====
    socket.on("start", () => {
        console.log("Game started!");
        if (onGameStart) onGameStart();
    });

    // ==== Game over ====
    socket.on("game-over", (winnerId) => {
        console.log(`Game over! Winner: ${winnerId}`);
        if (onGameOver) onGameOver(winnerId);
    });

    // ==== Send input to server ====
    function sendInput(inputData) {
        socket.emit("input", inputData);
    }

    // ==== Ready ====
    function ready() {
        socket.emit("ready");
    }

    return {
        playerId,
        roomId,
        sendInput,
        ready
    };
}
