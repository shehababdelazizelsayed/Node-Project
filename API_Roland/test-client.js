const io = require("socket.io-client");
const path = require("path");
process.chdir(path.dirname(__filename));

const userId = "68f61a0f9b17f815a76ad3d6";
const serverUrl = process.env.SERVER_URL || "http://localhost:5000";

console.log(`[Test Client] Connecting to ${serverUrl}`);

const socket = io(serverUrl, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log(`[Test Client] Connected with socket.id=${socket.id}`);
  socket.emit("register", userId);
});

socket.on("connect_error", (error) => {
  console.error("[Test Client] Connection error:", error.message);
});

socket.on("registered", (data) => {
  console.log("[Test Client] Registration confirmed:", data);
  console.log("\nReady to receive notifications!");
});

socket.on("payment_notification", (data) => {
  console.log("[Test Client] Received payment notification:", data);
});

process.on("SIGINT", () => {
  console.log("\n[Test Client] Disconnecting...");
  socket.disconnect();
  process.exit(0);
});
