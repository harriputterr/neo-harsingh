import { io, type Socket } from "socket.io-client"

export class SocketService {
  private socket: Socket | null = null
  private serverUrl: string
  private debug = true

  constructor(serverUrl?: string) {
    if (serverUrl) {
      this.serverUrl = serverUrl
    } else {
      // For custom Socket.IO host from environment variable
      if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SOCKET_HOST) {
        const protocol = "https"
        const host = process.env.NEXT_PUBLIC_SOCKET_HOST
        const port = process.env.NEXT_PUBLIC_SOCKET_PORT || "443"

        // If port is 443 (default HTTPS), don't include it in the URL
        this.serverUrl = port === "443" ? `${protocol}://${host}` : `${protocol}://${host}:${port}`

        this.log(`Using custom Socket.IO host: ${this.serverUrl}`)
      }
      // For ngrok: if the window location is an ngrok URL, use that domain with the socket port
      else if (typeof window !== "undefined" && window.location.hostname.includes("ngrok")) {
        // When using ngrok, we need to use the same domain but different port
        const protocol = "https"
        const host = window.location.hostname
        const port = process.env.NEXT_PUBLIC_SOCKET_PORT || "3001"

        this.serverUrl = `${protocol}://${host}:${port}`
        this.log(`Ngrok detected, using: ${this.serverUrl}`)
      } else {
        // Regular local development
        const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http"
        const host = typeof window !== "undefined" ? window.location.hostname : "localhost"
        const port = process.env.NEXT_PUBLIC_SOCKET_PORT || "3001"

        // Construct URL properly
        this.serverUrl = `${protocol}://${host}:${port}`
      }

      this.log(`Socket.IO will connect to: ${this.serverUrl}`)
    }
  }

  private log(...args: any[]) {
    if (this.debug) {

    }
  }

  public connect(): Socket {
    if (!this.socket) {
      // Add debug options to see what's happening with the connection
      this.socket = io(this.serverUrl, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: true,
      })

      // Add connection event listeners for debugging
      this.socket.on("connect", () => {
        this.log("Connected successfully with ID:", this.socket?.id)
      })

      this.socket.on("connect_error", (error) => {
        console.error("Connection error:", error)
      })

      this.socket.on("disconnect", (reason) => {
        this.log("Disconnected:", reason)

        // Attempt to reconnect on certain disconnect reasons
        if (reason === "io server disconnect" || reason === "transport close") {
          this.socket?.connect()
        }
      })

      this.socket.on("reconnect", (attemptNumber) => {
        this.log("Reconnected after", attemptNumber, "attempts")
      })

      this.socket.on("reconnect_attempt", (attemptNumber) => {
        this.log("Reconnection attempt:", attemptNumber)
      })

      this.socket.on("reconnect_error", (error) => {
        console.error("Reconnection error:", error)
      })

      this.socket.on("reconnect_failed", () => {
        console.error("Failed to reconnect")
      })

      this.log("Connection initialized to:", this.serverUrl)
    }
    return this.socket
  }

  public getSocket(): Socket {
    if (!this.socket) {
      return this.connect()
    }
    return this.socket
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.log("Disconnected")
    }
  }

  public createRoom(username: string): void {
    const socket = this.socket
    if (socket) {
      socket.emit("create-room", username)
      this.log("Emitted create-room event with username:", username)
    } else {
      console.error("Socket not initialized. Call connect() first.")
    }
  }

  public joinRoom(roomId: string, username: string): void {
    const socket = this.socket
    if (socket) {
      socket.emit("join-room", { roomId, username })
      this.log("Emitted join-room event with roomId:", roomId, "and username:", username)
    } else {
      console.error("Socket not initialized. Call connect() first.")
    }
  }
}
