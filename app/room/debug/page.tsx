"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SocketService } from "@/lib/socket-service"
import { WebRTCService } from "@/lib/webrtc-service"

export default function RoomDebug() {
  const [username, setUsername] = useState<string>("")
  const [roomId, setRoomId] = useState<string>("")
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [connectionState, setConnectionState] = useState<string>("Initializing...")
  const [logs, setLogs] = useState<string[]>([])
  const [remoteParticipants, setRemoteParticipants] = useState<any[]>([])
  const [webrtcState, setWebrtcState] = useState<string>("")

  const socketService = useRef<SocketService>(new SocketService())
  const webRTCService = useRef<WebRTCService | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
    console.log(message)
  }

  useEffect(() => {
    // Get username and roomId from session storage
    const storedUsername = sessionStorage.getItem("username")
    const storedRoomId = searchParams.get("id") || sessionStorage.getItem("roomId")

    if (!storedUsername || !storedRoomId) {
      router.push("/")
      return
    }

    setUsername(storedUsername)
    setRoomId(storedRoomId)
    addLog(`Debug mode for room: ${storedRoomId}, user: ${storedUsername}`)

    // Connect to socket server
    const socket = socketService.current.connect()
    addLog(`Socket connected with ID: ${socket.id}`)

    // Setup socket listeners
    socket.on("user-joined", ({ id, username }) => {
      addLog(`User joined: ${username} (${id})`)
      setRemoteParticipants((prev) => [...prev, { id, username }])
    })

    socket.on("user-left", ({ id, username }) => {
      addLog(`User left: ${username} (${id})`)
      setRemoteParticipants((prev) => prev.filter((p) => p.id !== id))
    })

    socket.on("room-joined", ({ participants }) => {
      addLog(`Joined room with ${participants.length} participants`)
      setRemoteParticipants(participants)
    })

    // Initialize WebRTC service
    webRTCService.current = new WebRTCService(
      socket,
      (stream, peerId) => {
        addLog(`Received stream from ${peerId}`)
        updateWebRTCState()
      },
      (peerId) => {
        addLog(`Stream removed from ${peerId}`)
        updateWebRTCState()
      },
    )

    // Initialize local stream
    if (webRTCService.current) {
      webRTCService.current
        .initLocalStream()
        .then((stream) => {
          setLocalStream(stream)
          addLog(`Local stream initialized with ${stream.getTracks().length} tracks`)
          updateWebRTCState()
        })
        .catch((error) => {
          addLog(`Error initializing local stream: ${error.message}`)
        })
    }

    // Join the room
    socket.emit("join-room", { roomId: storedRoomId, username: storedUsername })
    addLog(`Joining room: ${storedRoomId}`)

    return () => {
      // Clean up
      if (webRTCService.current) {
        webRTCService.current.closeAllConnections()
      }
      socket.disconnect()
    }
  }, [router, searchParams])

  const updateWebRTCState = () => {
    if (webRTCService.current) {
      // @ts-ignore - Using our custom method
      const state = webRTCService.current.dumpConnectionState()
      setWebrtcState(state)
    }
  }

  const initiateCall = (peerId: string) => {
    if (webRTCService.current) {
      addLog(`Manually initiating call to ${peerId}`)
      webRTCService.current
        .initiateCall(peerId)
        .then(() => {
          addLog(`Call initiated to ${peerId}`)
          updateWebRTCState()
        })
        .catch((err) => {
          addLog(`Error initiating call: ${err.message}`)
        })
    }
  }

  const forceReconnect = (peerId: string) => {
    if (webRTCService.current) {
      addLog(`Forcing reconnection with ${peerId}`)
      // @ts-ignore - Using our custom method
      webRTCService.current.forceReconnect(peerId)
      setTimeout(updateWebRTCState, 1000)
    }
  }

  const restartIce = (peerId: string) => {
    if (webRTCService.current) {
      addLog(`Restarting ICE for ${peerId}`)
      webRTCService.current.restartIce(peerId)
      setTimeout(updateWebRTCState, 1000)
    }
  }

  const restartAllConnections = () => {
    if (webRTCService.current) {
      addLog("Restarting all connections")
      webRTCService.current.restartAllConnections()
      setTimeout(updateWebRTCState, 1000)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">WebRTC Debug Room: {roomId}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-2">Room Information</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Username:</span> {username}
            </div>
            <div>
              <span className="font-medium">Room ID:</span> {roomId}
            </div>
            <div>
              <span className="font-medium">Local Stream:</span> {localStream ? "Available" : "Not available"}
            </div>
            <div>
              <Button onClick={updateWebRTCState} size="sm">
                Refresh State
              </Button>
              <Button onClick={restartAllConnections} size="sm" className="ml-2">
                Restart All
              </Button>
              <Button onClick={() => router.push(`/room?id=${roomId}`)} size="sm" className="ml-2">
                Back to Room
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-2">Remote Participants</h2>
          {remoteParticipants.length === 0 ? (
            <div className="text-gray-500">No remote participants</div>
          ) : (
            <div className="space-y-4">
              {remoteParticipants.map((participant) => (
                <div key={participant.id} className="p-2 border rounded">
                  <div>
                    <span className="font-medium">Name:</span> {participant.username}
                  </div>
                  <div>
                    <span className="font-medium">ID:</span> {participant.id}
                  </div>
                  <div className="mt-2">
                    <Button onClick={() => initiateCall(participant.id)} size="sm" className="mr-2">
                      Call
                    </Button>
                    <Button onClick={() => forceReconnect(participant.id)} size="sm" className="mr-2">
                      Reconnect
                    </Button>
                    <Button onClick={() => restartIce(participant.id)} size="sm">
                      Restart ICE
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">WebRTC State</h2>
        <div className="bg-gray-100 p-2 rounded h-64 overflow-y-auto font-mono text-sm whitespace-pre">
          {webrtcState}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Debug Logs</h2>
        <div className="bg-gray-100 p-2 rounded h-64 overflow-y-auto font-mono text-sm">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
