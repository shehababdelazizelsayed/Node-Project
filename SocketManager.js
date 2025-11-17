const { Server } = require("socket.io");

let io = null;
const userSockets = new Map();

function init(server) {
  if (io) return io;

  const corsOrigin =
    process.env.NODE_ENV === "production"
      ? process.env.ALLOWED_ORIGIN
      : [
          "http://localhost:4200",
          "http://localhost:3000",
          "http://127.0.0.1:4200",
        ];

  io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
      allowEIO3: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    socket.on("register", (data) => {
      const userId = data && (data.userId || data);
      if (!userId) return;

      const key = userId.toString();
      const set = userSockets.get(key) || new Set();
      set.add(socket.id);
      userSockets.set(key, set);

      socket.data = { userId: key };
      socket.emit("registered", { ok: true, userId: key });
    });

    socket.on("disconnect", () => {
      const key = socket.data?.userId;
      if (!key) return;

      const set = userSockets.get(key);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(key);
      }
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
  if (!io || !userId) return false;

  const key = userId.toString();
  const set = userSockets.get(key);
  if (!set?.size) return false;

  for (const socketId of set) {
    io.to(socketId).emit(event, payload);
  }
  return true;
}

module.exports = {
  init,
  broadcast,
  notifyUser,
};
