import { io } from "socket.io-client"

// Get server URL from command line or use default
const serverUrl = process.argv[2] || "http://localhost:3001"

console.log(`Attempting to connect to Socket.IO server at: ${serverUrl}`)

const socket = io(serverUrl, {
  transports: ["websocket", "polling"],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  forceNew: true,
})

socket.on("connect", () => {
  console.log("✅ Connected successfully to Socket.IO server!")
  console.log(`Socket ID: ${socket.id}`)

  // Test emitting an event
  socket.emit("test", { message: "Hello from test client" })

  // Disconnect after 3 seconds
  setTimeout(() => {
    socket.disconnect()
    console.log("Disconnected from server")
    process.exit(0)
  }, 3000)
})

socket.on("connect_error", (error) => {
  console.error("❌ Connection error:", error.message)
})

socket.on("error", (error) => {
  console.error("❌ Socket error:", error)
})

// Add a timeout
setTimeout(() => {
  if (!socket.connected) {
    console.error("❌ Connection timed out after 5 seconds")
    process.exit(1)
  }
}, 5000)
