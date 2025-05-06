"use client"
///Real File
import { useEffect, useCallback, useState } from "react"
import { useParams } from "next/navigation"
import { useSocket } from "@/providers/SocketProvider"
import peer from "@/service/peer"

import ReactPlayer from "react-player"

export default function RoomPage() {
  const socket = useSocket()
  const [remoteSocketId, setRemoteSocketId] = useState(null)
  const { id: roomId } = useParams()
  const [myStream, setMyStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connectionStatus, setConnectionStatus] = useState("Disconnected")

  const handleCallUser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      })

      setMyStream(stream)

      // Add all tracks to peer connection before creating offer
      stream.getTracks().forEach((track) => {
        peer.peer.addTrack(track, stream)
      })

      const offer = await peer.getOffer()
      socket?.emit("user:call", { to: remoteSocketId, offer })

      setConnectionStatus("Calling...")
    } catch (error) {
      console.error("Error getting media devices:", error)
      alert("Could not access camera or microphone. Please check permissions.")
    }
  }, [remoteSocketId, socket])

  const handleUserJoined = useCallback(({ username, id }: any) => {
    console.log(`Username ${username} joined room`)
    setRemoteSocketId(id)
  }, [])

  const handleIncomingCall = useCallback(
    async ({ from, offer }: any) => {
      console.log("Incoming call from:", from)
      setRemoteSocketId(from)
      setConnectionStatus("Incoming call...")

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        })

        setMyStream(stream)

        // Add all tracks to peer connection before creating answer
        stream.getTracks().forEach((track) => {
          peer.peer.addTrack(track, stream)
        })

        const ans = await peer.getAnswer(offer)
        socket?.emit("call:accepted", { to: from, ans })

        setConnectionStatus("Connected")
      } catch (error) {
        console.error("Error handling incoming call:", error)
        alert("Could not access camera or microphone. Please check permissions.")
      }
    },
    [socket],
  )

  // We don't need sendStreams anymore since we're adding tracks before creating offer/answer
  const handleCallAccepted = useCallback(({ from, ans }: any) => {
    console.log("Call accepted by:", from)
    peer.setLocalDescription(ans)
    setConnectionStatus("Connected")
  }, [])

  const handleNegoNeeded = useCallback(async () => {
    console.log("Negotiation needed")
    try {
      const offer = await peer.getOffer()
      socket?.emit("peer:nego:needed", { offer, to: remoteSocketId })
    } catch (error) {
      console.error("Error during negotiation:", error)
    }
  }, [remoteSocketId, socket])

  const handleNegoNeedIncoming = useCallback(
    async ({ from, offer }: any) => {
      console.log("Incoming negotiation from:", from)
      try {
        const ans = await peer.getAnswer(offer)
        socket?.emit("peer:nego:done", { to: from, ans })
      } catch (error) {
        console.error("Error handling negotiation:", error)
      }
    },
    [socket],
  )

  const handleNegoNeedFinal = useCallback(async ({ ans }: any) => {
    console.log("Final negotiation step")
    try {
      await peer.setLocalDescription(ans)
    } catch (error) {
      console.error("Error setting local description:", error)
    }
  }, [])

  // Handle ICE candidates
  useEffect(() => {
    // Set up ICE candidate handling
    const handleICECandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        console.log("New ICE candidate:", event.candidate)
        socket?.emit("ice:candidate", {
          to: remoteSocketId,
          candidate: event.candidate,
        })
      }
    }

    const handleICEConnectionStateChange = () => {
      console.log("ICE connection state:", peer.peer.iceConnectionState)
      setConnectionStatus(peer.peer.iceConnectionState)
    }

    peer.peer.addEventListener("icecandidate", handleICECandidate)
    peer.peer.addEventListener("iceconnectionstatechange", handleICEConnectionStateChange)

    return () => {
      peer.peer.removeEventListener("icecandidate", handleICECandidate)
      peer.peer.removeEventListener("iceconnectionstatechange", handleICEConnectionStateChange)
    }
  }, [remoteSocketId, socket])

  // Handle incoming ICE candidates
  useEffect(() => {
    const handleIncomingICECandidate = async ({ from, candidate }: any) => {
      console.log("Received ICE candidate from:", from)
      try {
        await peer.peer.addIceCandidate(new RTCIceCandidate(candidate))
        console.log("Added ICE candidate")
      } catch (error) {
        console.error("Error adding ICE candidate:", error)
      }
    }

    socket?.on("ice:candidate", handleIncomingICECandidate)

    return () => {
      socket?.off("ice:candidate", handleIncomingICECandidate)
    }
  }, [socket])

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      console.log("Got remote track:", ev.track.kind)
      const remoteStream = ev.streams
      if (remoteStream[0]) {
        console.log("Setting remote stream")
        setRemoteStream(remoteStream[0])
      }
    })
  }, [])

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded)
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded)
    }
  }, [handleNegoNeeded])

  useEffect(() => {
    socket?.on("user:joined", handleUserJoined)
    socket?.on("incoming:call", handleIncomingCall)
    socket?.on("call:accepted", handleCallAccepted)
    socket?.on("peer:nego:needed", handleNegoNeedIncoming)
    socket?.on("peer:nego:final", handleNegoNeedFinal)

    return () => {
      socket?.off("user:joined", handleUserJoined)
      socket?.off("incoming:call", handleIncomingCall)
      socket?.off("call:accepted", handleCallAccepted)
      socket?.off("peer:nego:needed", handleNegoNeedIncoming)
      socket?.off("peer:nego:final", handleNegoNeedFinal)
    }
  }, [socket, handleUserJoined, handleIncomingCall, handleCallAccepted, handleNegoNeedIncoming, handleNegoNeedFinal])

  // Function to end call and clean up
  const handleEndCall = useCallback(() => {
    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop())
    }

    // Close peer connection
    peer.peer.close()

    // Reset states
    setMyStream(null)
    setRemoteStream(null)
    setConnectionStatus("Disconnected")

    // Notify server
    socket?.emit("call:end", { to: remoteSocketId })

    // Reload the page to reset peer connection
    window.location.reload()
  }, [myStream, remoteSocketId, socket])

  return (
    <div className="flex flex-col min-h-screen bg-black text-white p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Room: {roomId}</h1>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded text-sm ${
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "connecting"
                  ? "bg-yellow-500"
                  : connectionStatus === "disconnected"
                    ? "bg-red-500"
                    : "bg-gray-500"
            }`}
          >
            {connectionStatus}
          </span>
          <button onClick={handleEndCall} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">
            End Call
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {/* My Stream */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          {myStream ? (
            <div className="aspect-video w-full">
              <ReactPlayer playing muted width="100%" height="100%" url={myStream} className="rounded-lg" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full aspect-video">
              <p>Your camera is off</p>
            </div>
          )}
          <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full">You</div>
        </div>

        {/* Remote Stream */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          {remoteStream ? (
            <div className="aspect-video w-full">
              <ReactPlayer playing width="100%" height="100%" url={remoteStream} className="rounded-lg" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full aspect-video">
              <p>Waiting for other participant...</p>
            </div>
          )}
          {remoteStream && (
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full">Remote User</div>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-4">
        {!myStream && remoteSocketId && (
          <button
            onClick={handleCallUser}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-full font-medium"
          >
            Start Call
          </button>
        )}
      </div>
    </div>
  )
}
