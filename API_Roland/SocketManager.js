// Single clean SocketManager implementation
const { Server } = require("socket.io");

let io = null;
// userId (string) -> Set of socketIds
const userSockets = new Map();

function init(server) {
  if (io) return io;
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("[SocketManager] connection", socket.id);

    socket.on("register", (data) => {
      // accept either a plain userId string or { userId }
      const userId = data && (data.userId || data);
      if (!userId) return;
      const key = userId.toString();
      const set = userSockets.get(key) || new Set();
      set.add(socket.id);
      userSockets.set(key, set);
      socket.data = socket.data || {};
      socket.data.userId = key;
      console.log(`[SocketManager] registered user=${key} socket=${socket.id}`);
      socket.emit("registered", { ok: true, userId: key });
    });

    socket.on("disconnect", () => {
      const key = socket.data && socket.data.userId;
      if (!key) return;
      const set = userSockets.get(key);
      if (!set) return;
      set.delete(socket.id);
      if (set.size === 0) userSockets.delete(key);
      console.log(`[SocketManager] disconnected user=${key} socket=${socket.id}`);
    });
  });

  return io;
}

function broadcast(event, payload) {
  if (!io) return false;
  io.emit(event, payload);
  return true;
}

function notifyUser(userId, event, payload) {
  if (!io) return false;
  const key = userId && userId.toString();
  const set = userSockets.get(key);
  if (!set || set.size === 0) return false;
  for (const socketId of set) {
    io.to(socketId).emit(event, payload);
  }
  return true;
}

module.exports = {
  init,
  broadcast,
  notifyUser,
  _debug: () => ({ ioInitialized: !!io, users: Array.from(userSockets.keys()) }),
};
