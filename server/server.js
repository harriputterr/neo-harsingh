import express from "express";
import http from "http";
import https from "https";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Determine if we should use HTTPS
const useHttps = process.env.USE_HTTPS === "true";
let server;

if (useHttps) {
  try {
    // Path is relative to the server directory
    const certsDir = path.join(__dirname, "..", "certs");
    const certPath = path.join(certsDir, "cert.pem");
    const keyPath = path.join(certsDir, "key.pem");

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
      server = https.createServer(httpsOptions, app);
      console.log("Using HTTPS server");
    } else {
      console.warn("SSL certificates not found, falling back to HTTP");
      server = http.createServer(app);
    }
  } catch (error) {
    console.error("Error setting up HTTPS:", error);
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

const io = new Server(server, {
  cors: {
    origin: "*", // In production, you'd want to be more specific
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  pingTimeout: 60000, // Increase ping timeout for better connection stability
});

app.use(cors());
app.use(express.json());

// Store active rooms
const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new room
  socket.on("create-room", (username) => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      host: socket.id,
      participants: [{ id: socket.id, username }],
      created: new Date(),
    });

    socket.join(roomId);
    socket.emit("room-created", { roomId, username });
    console.log(`Room created: ${roomId} by ${username}`);
  });

  // Join an existing room
  socket.on("join-room", ({ roomId, username }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("room-error", { message: "Room not found" });
      return;
    }

    // Check if user is already in the room (reconnection case)
    const existingParticipant = room.participants.find(
      (p) => p.id === socket.id
    );
    if (!existingParticipant) {
      // Add participant to room
      room.participants.push({ id: socket.id, username });
    }

    socket.join(roomId);

    // Notify others in the room
    socket.to(roomId).emit("user-joined", { id: socket.id, username });

    // Send list of existing participants to the new user
    const otherParticipants = room.participants
      .filter((p) => p.id !== socket.id)
      .map((p) => ({ id: p.id, username: p.username }));

    socket.emit("room-joined", { roomId, participants: otherParticipants });
    console.log(`User ${username} joined room: ${roomId}`);
  });

  // WebRTC signaling
  socket.on("offer", ({ target, offer, sender }) => {
    console.log(`Forwarding offer from ${sender} to ${target}`);
    socket.to(target).emit("offer", { offer, sender });
  });

  socket.on("answer", ({ target, answer, sender }) => {
    console.log(`Forwarding answer from ${sender} to ${target}`);
    socket.to(target).emit("answer", { answer, sender });
  });

  socket.on("ice-candidate", ({ target, candidate, sender }) => {
    console.log(`Forwarding ICE candidate from ${sender} to ${target}`);
    socket.to(target).emit("ice-candidate", { candidate, sender });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Find and clean up rooms
    for (const [roomId, room] of rooms.entries()) {
      const participantIndex = room.participants.findIndex(
        (p) => p.id === socket.id
      );

      if (participantIndex !== -1) {
        const username = room.participants[participantIndex].username;
        room.participants.splice(participantIndex, 1);

        // Notify others that user left
        socket.to(roomId).emit("user-left", { id: socket.id, username });

        // If room is empty, remove it
        if (room.participants.length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }

        console.log(`User ${username} left room: ${roomId}`);
      }
    }
  });
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(
    `Server running on ${useHttps ? "https" : "http"}://localhost:${PORT}`
  );
});

export default server;
