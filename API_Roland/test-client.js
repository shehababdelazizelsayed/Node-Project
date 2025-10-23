#!/usr/bin/env node
// WebSocket Test Client
// Usage: node test-client.js [userId]
// Examples:
//   node test-client.js alice
//   node test-client.js bob
//   # or use environment variable:
//   $env:USER_ID='alice'; node test-client.js

// Ensure we can find node_modules regardless of working directory
const path = require("path");
process.chdir(path.dirname(__filename));

const io = require("socket.io-client");

// Use authenticated user ID from login response
const userId = "68f61a0f9b17f815a76ad3d6"; // Your actual user ID from login
const serverUrl = process.env.SERVER_URL || "http://localhost:5000";

console.log(
  `[Test Client] Connecting to ${serverUrl} as authenticated user (${userId})`
);

const socket = io(serverUrl, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Connection events
socket.on("connect", () => {
  console.log(`[Test Client] Connected with socket.id=${socket.id}`);
  console.log("[Test Client] Registering as userId:", userId);
  socket.emit("register", userId);
});

socket.on("connect_error", (error) => {
  console.error("[Test Client] Connection error:", error.message);
});

socket.on("reconnect_attempt", (attemptNumber) => {
  console.log(`[Test Client] Reconnection attempt #${attemptNumber}`);
});

// Application events
socket.on("registered", (data) => {
  console.log("[Test Client] Registration confirmed:", data);
  console.log("\nReady to receive notifications!");
  console.log("Try these commands in another terminal:");
  console.log(`  # Broadcast to all users:`);
  console.log(
    `  curl -X POST http://localhost:5000/api/notify -H "Content-Type: application/json" -d '{"event":"notification","payload":{"message":"Hello everyone!"}}'`
  );
  console.log(`\n  # Notify just ${userId}:`);
  console.log(
    `  curl -X POST http://localhost:5000/api/notify/${userId} -H "Content-Type: application/json" -d '{"event":"notification","payload":{"message":"Hello ${userId}!"}}'`
  );
});

socket.on("notification", (data) => {
  console.log("[Test Client] Received notification:", data);
});

// Debug: log all events
socket.onAny((event, payload) => {
  if (!["notification", "registered"].includes(event)) {
    console.log("[Test Client] Event:", event, payload);
  }
});

// Cleanup
process.on("SIGINT", () => {
  console.log("\n[Test Client] Disconnecting...");
  socket.disconnect();
  process.exit(0);
});
