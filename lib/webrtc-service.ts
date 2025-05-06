import type { Socket } from "socket.io-client"

interface PeerConnection {
  connection: RTCPeerConnection
  streams: MediaStream[]
}

export class WebRTCService {
  private peerConnections: Map<string, PeerConnection> = new Map()
  private localStream: MediaStream | null = null
  private socket: Socket
  private onStreamCallback: (stream: MediaStream, peerId: string) => void
  private onStreamRemovedCallback: (peerId: string) => void
  private debug = true

  constructor(
    socket: Socket,
    onStream: (stream: MediaStream, peerId: string) => void,
    onStreamRemoved: (peerId: string) => void,
  ) {
    if (!socket) {
      throw new Error("Socket is required for WebRTCService")
    }
    this.socket = socket
    this.onStreamCallback = onStream
    this.onStreamRemovedCallback = onStreamRemoved

    this.setupSocketListeners()
  }

  private log(...args: any[]) {
    if (this.debug) {

    }
  }

  private setupSocketListeners() {
    // Handle incoming offers
    this.socket.on("offer", async ({ offer, sender }) => {
      this.log(`Received offer from ${sender}`)
      const peerConnection = this.createPeerConnection(sender)

      try {
        await peerConnection.connection.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await peerConnection.connection.createAnswer()
        await peerConnection.connection.setLocalDescription(answer)

        this.socket.emit("answer", {
          target: sender,
          answer,
          sender: this.socket.id,
        })
      } catch (error) {
        console.error("Error handling offer:", error)
      }
    })

    // Handle incoming answers
    this.socket.on("answer", async ({ answer, sender }) => {
      this.log(`Received answer from ${sender}`)
      const peerConnection = this.peerConnections.get(sender)

      if (peerConnection) {
        try {
          await peerConnection.connection.setRemoteDescription(new RTCSessionDescription(answer))
        } catch (error) {
          console.error("Error handling answer:", error)
        }
      }
    })

    // Handle ICE candidates
    this.socket.on("ice-candidate", async ({ candidate, sender }) => {
      this.log(`Received ICE candidate from ${sender}`)
      const peerConnection = this.peerConnections.get(sender)

      if (peerConnection) {
        try {
          await peerConnection.connection.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (error) {
          console.error("Error adding ICE candidate:", error)
        }
      }
    })

    // Handle user leaving
    this.socket.on("user-left", ({ id }) => {
      this.removePeer(id)
    })
  }

  private createPeerConnection(peerId: string): PeerConnection {
    this.log(`Creating peer connection for ${peerId}`)

    // Check if connection already exists
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!
    }

    // ICE servers configuration (STUN/TURN)
    const configuration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // Try these alternative TURN servers
        {
          urls: "turn:global.turn.twilio.com:3478?transport=tcp",
          username: "f4b4035eaa76f77e3ffae6b9eb2ba4f563469b4a355a73eddebdc52531f9520f",
          credential: "uWMWvVNtLZZKgbwPswvlKi7+JgzZ3Hf9tHjh6lMbKrQ=",
        },
        {
          urls: "turn:global.turn.twilio.com:3478?transport=udp",
          username: "f4b4035eaa76f77e3ffae6b9eb2ba4f563469b4a355a73eddebdc52531f9520f",
          credential: "uWMWvVNtLZZKgbwPswvlKi7+JgzZ3Hf9tHjh6lMbKrQ=",
        },
      ],
      iceCandidatePoolSize: 10,
    }

    const peerConnection = new RTCPeerConnection(configuration)

    // Add local tracks to the connection
    if (this.localStream) {
      this.log(`Adding ${this.localStream.getTracks().length} local tracks to peer connection`)
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!)
      })
    } else {
      this.log("No local stream to add to peer connection")
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.log(`Generated ICE candidate for ${peerId}`)
        this.socket.emit("ice-candidate", {
          target: peerId,
          candidate: event.candidate,
          sender: this.socket.id,
        })
      }
    }

    // Log ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      this.log(`ICE connection state for ${peerId}: ${peerConnection.iceConnectionState}`)
    }

    // Log signaling state changes
    peerConnection.onsignalingstatechange = () => {
      this.log(`Signaling state for ${peerId}: ${peerConnection.signalingState}`)
    }

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      this.log(`Connection state for ${peerId}: ${peerConnection.connectionState}`)
      if (
        peerConnection.connectionState === "disconnected" ||
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "closed"
      ) {
        this.removePeer(peerId)
      }
    }

    // Handle negotiation needed
    peerConnection.onnegotiationneeded = async () => {
      this.log(`Negotiation needed for ${peerId}`)
      try {
        await this.initiateCall(peerId)
      } catch (err) {
        console.error("Error during negotiation:", err)
      }
    }

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      this.log(`Received ${event.streams.length} tracks from ${peerId}`, event.streams)

      if (event.streams && event.streams.length > 0) {
        const [remoteStream] = event.streams

        // Store the stream
        const peerData = this.peerConnections.get(peerId)
        if (peerData) {
          peerData.streams.push(remoteStream)
        }

        // Notify about the new stream
        this.onStreamCallback(remoteStream, peerId)

        // Log track information
        remoteStream.getTracks().forEach((track) => {
          this.log(`Track from ${peerId}: ${track.kind}, enabled: ${track.enabled}, muted: ${track.muted}`)

          // Listen for track ended event
          track.onended = () => {
            this.log(`Track ${track.kind} from ${peerId} ended`)
          }

          // Listen for track mute/unmute events
          track.onmute = () => {
            this.log(`Track ${track.kind} from ${peerId} muted`)
          }

          track.onunmute = () => {
            this.log(`Track ${track.kind} from ${peerId} unmuted`)
          }
        })
      } else {
        this.log(`Received track event from ${peerId} but no streams available`)
      }
    }

    // Store the connection
    this.peerConnections.set(peerId, {
      connection: peerConnection,
      streams: [],
    })

    return { connection: peerConnection, streams: [] }
  }

  public async initLocalStream(
    constraints: MediaStreamConstraints = { video: true, audio: true },
  ): Promise<MediaStream> {
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("MediaDevices API not supported in this browser")
      }

      this.log("Requesting media with constraints:", constraints)
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)

      // Log track information
      this.localStream.getTracks().forEach((track) => {
        this.log(`Local ${track.kind} track initialized, enabled: ${track.enabled}`)
      })

      return this.localStream
    } catch (error) {
      console.error("Error accessing media devices:", error)

      // Try fallback for audio only if video fails
      if (constraints.video) {
        this.log("Trying audio only as fallback")
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          return this.localStream
        } catch (audioError) {
          console.error("Audio fallback also failed:", audioError)
          throw audioError
        }
      }

      throw error
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream
  }

  public async initiateCall(peerId: string): Promise<void> {
    this.log(`Initiating call to ${peerId}`)
    const peerConnection = this.createPeerConnection(peerId)

    try {
      const offer = await peerConnection.connection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      await peerConnection.connection.setLocalDescription(offer)

      this.socket.emit("offer", {
        target: peerId,
        offer,
        sender: this.socket.id,
      })
    } catch (error) {
      console.error("Error creating offer:", error)
      throw error
    }
  }

  public removePeer(peerId: string): void {
    this.log(`Removing peer ${peerId}`)
    const peerConnection = this.peerConnections.get(peerId)

    if (peerConnection) {
      // Close the connection
      peerConnection.connection.close()

      // Notify that streams are removed
      this.onStreamRemovedCallback(peerId)

      // Remove from our map
      this.peerConnections.delete(peerId)
    }
  }

  public closeAllConnections(): void {
    this.log("Closing all connections")

    // Close all peer connections
    for (const [peerId, peerData] of this.peerConnections.entries()) {
      peerData.connection.close()
      this.peerConnections.delete(peerId)
    }

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }
  }

  public toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled
        this.log(`Local audio track ${enabled ? "enabled" : "disabled"}`)
      })
    }
  }

  public toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled
        this.log(`Local video track ${enabled ? "enabled" : "disabled"}`)
      })
    }
  }

  public restartIce(peerId: string): void {
    const peerConnection = this.peerConnections.get(peerId)
    if (peerConnection) {
      this.log(`Restarting ICE for peer ${peerId}`)
      try {
        // Create a new offer with ICE restart flag
        peerConnection.connection
          .createOffer({ iceRestart: true })
          .then((offer) => peerConnection.connection.setLocalDescription(offer))
          .then(() => {
            this.socket.emit("offer", {
              target: peerId,
              offer: peerConnection.connection.localDescription,
              sender: this.socket.id,
            })
          })
          .catch((err) => console.error("Error restarting ICE:", err))
      } catch (error) {
        console.error("Error during ICE restart:", error)
      }
    }
  }

  public restartAllConnections(): void {
    this.log("Restarting all connections")
    for (const peerId of this.peerConnections.keys()) {
      this.restartIce(peerId)
    }
  }

  public dumpConnectionState(): string {
    let state = "WebRTC Connection State:\n"

    // Local stream info
    state += `Local Stream: ${this.localStream ? "Available" : "Not available"}\n`
    if (this.localStream) {
      state += `  Video Tracks: ${this.localStream.getVideoTracks().length} (${this.localStream.getVideoTracks()[0]?.enabled ? "enabled" : "disabled"})\n`
      state += `  Audio Tracks: ${this.localStream.getAudioTracks().length} (${this.localStream.getAudioTracks()[0]?.enabled ? "enabled" : "disabled"})\n`
    }

    // Peer connections info
    state += `Peer Connections: ${this.peerConnections.size}\n`
    for (const [peerId, peerData] of this.peerConnections.entries()) {
      const conn = peerData.connection
      state += `  Peer ${peerId}:\n`
      state += `    Connection State: ${conn.connectionState}\n`
      state += `    ICE Connection State: ${conn.iceConnectionState}\n`
      state += `    Signaling State: ${conn.signalingState}\n`
      state += `    Remote Streams: ${peerData.streams.length}\n`

      peerData.streams.forEach((stream, i) => {
        state += `      Stream ${i}: ${stream.id}\n`
        state += `        Video Tracks: ${stream.getVideoTracks().length}\n`
        state += `        Audio Tracks: ${stream.getAudioTracks().length}\n`
      })
    }

    return state
  }

  public forceReconnect(peerId: string): void {
    this.log(`Forcing reconnection with peer ${peerId}`)

    // Remove existing connection
    this.removePeer(peerId)

    // Wait a moment and create a new connection
    setTimeout(() => {
      this.initiateCall(peerId)
    }, 1000)
  }
}
