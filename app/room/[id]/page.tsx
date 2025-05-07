"use client"

import { useEffect, useCallback, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSocket } from "@/providers/SocketProvider"
import peer from "@/service/peer"
import ReactPlayer from "react-player"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Camera, CameraOff, Mic, MicOff, PhoneCall, PhoneOff } from "lucide-react"

export default function RoomPage() {
  const socket = useSocket()
  const router = useRouter()
  const [remoteSocketId, setRemoteSocketId] = useState(null)
  const { id: roomId } = useParams()
  const [myStream, setMyStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connectionStatus, setConnectionStatus] = useState("Disconnected")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAudioOnly, setIsAudioOnly] = useState(false)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [isMicEnabled, setIsMicEnabled] = useState(true)

  // Function to get user media with progressive fallbacks
  const getUserMedia = useCallback(async (audioOnly = false) => {
    // Clear previous errors
    setErrorMessage(null)

    // Try different approaches in sequence
    const approaches = [
      // Approach 1: Try with ideal constraints
      async () => {
        console.log("Trying approach 1: Ideal constraints")
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: audioOnly
            ? false
            : {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 },
              },
        })
      },

      // Approach 2: Try with minimal video constraints
      async () => {
        if (audioOnly) throw new Error("Skip to audio only")
        console.log("Trying approach 2: Minimal video constraints")
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 15 },
          },
        })
      },

      // Approach 3: Try with just boolean constraints
      async () => {
        if (audioOnly) throw new Error("Skip to audio only")
        console.log("Trying approach 3: Boolean constraints")
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        })
      },

      // Approach 4: Try audio only
      async () => {
        console.log("Trying approach 4: Audio only")
        setIsAudioOnly(true)
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        })
      },
    ]

    // Try each approach in sequence
    for (let i = 0; i < approaches.length; i++) {
      try {
        const stream = await approaches[i]()
        console.log(`Approach ${i + 1} succeeded`)
        return stream
      } catch (error) {
        console.error(`Approach ${i + 1} failed:`, error)
        // If this is the last approach, throw the error
        if (i === approaches.length - 1) {
          throw error
        }
      }
    }

    // This should never be reached due to the throw in the loop
    throw new Error("All approaches failed")
  }, [])

  const handleCallUser = useCallback(async () => {
    try {
      console.log("Starting call process...")

      // Get user media with fallbacks
      const stream = await getUserMedia(false)
      console.log("Got media stream:", stream)

      // Set stream state
      setMyStream(stream)
      setIsAudioOnly(!stream.getVideoTracks().length)

      // Add all tracks to peer connection
      stream.getTracks().forEach((track) => {
        console.log(`Adding ${track.kind} track to peer connection`)
        peer.peer.addTrack(track, stream)
      })

      // Create and send offer
      console.log("Creating offer...")
      const offer = await peer.getOffer()
      console.log("Sending offer to:", remoteSocketId)
      socket?.emit("user:call", { to: remoteSocketId, offer })

      setConnectionStatus("Calling...")
    } catch (error) {
      console.error("Final error getting media:", error)

      // Set a user-friendly error message
      if (error instanceof DOMException) {
        if (error.name === "NotFoundError") {
          setErrorMessage("No camera or microphone found. Please connect a device and try again.")
        } else if (error.name === "NotAllowedError") {
          setErrorMessage("Camera or microphone access denied. Please check your browser permissions.")
        } else if (error.name === "NotReadableError") {
          setErrorMessage(
            "Could not access your camera. It may be in use by another application or there might be a hardware issue.",
          )
        } else if (error.name === "OverconstrainedError") {
          setErrorMessage(
            "Your camera doesn't support the requested quality settings. Please try again with different settings.",
          )
        } else {
          setErrorMessage(`Media error: ${error.name}. Please check your hardware and permissions.`)
        }
      } else {
        setErrorMessage("An unexpected error occurred. Please try again or use a different device.")
      }
    }
  }, [remoteSocketId, socket, getUserMedia])

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
        // Get user media with fallbacks
        const stream = await getUserMedia(false)

        // Set stream state
        setMyStream(stream)
        setIsAudioOnly(!stream.getVideoTracks().length)

        // Add all tracks to peer connection
        stream.getTracks().forEach((track) => {
          peer.peer.addTrack(track, stream)
        })

        // Create and send answer
        const ans = await peer.getAnswer(offer)
        socket?.emit("call:accepted", { to: from, ans })

        setConnectionStatus("Connected")
      } catch (error) {
        console.error("Error handling incoming call:", error)
        setErrorMessage("Could not access your camera or microphone. Please check your hardware and permissions.")
      }
    },
    [socket, getUserMedia],
  )

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

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (!myStream) return

    const videoTracks = myStream.getVideoTracks()
    if (videoTracks.length === 0) {
      // No video tracks, try to add one
      getUserMedia(false)
        .then((newStream) => {
          // Replace the audio track in the new stream with the current audio track
          const audioTrack = myStream.getAudioTracks()[0]
          if (audioTrack) {
            newStream.removeTrack(newStream.getAudioTracks()[0])
            newStream.addTrack(audioTrack)
          }

          // Replace the stream
          setMyStream(newStream)
          setIsAudioOnly(false)

          // Add the video track to the peer connection
          const videoTrack = newStream.getVideoTracks()[0]
          if (videoTrack) {
            peer.peer.getSenders().forEach((sender) => {
              if (sender.track && sender.track.kind === "video") {
                sender.replaceTrack(videoTrack)
              }
            })
          }
        })
        .catch((error) => {
          console.error("Error adding video track:", error)
          setErrorMessage("Could not enable camera. Please check your hardware and permissions.")
        })
    } else {
      // Toggle existing video tracks
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsCameraEnabled(!isCameraEnabled)
    }
  }, [myStream, isCameraEnabled, getUserMedia])

  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (!myStream) return

    const audioTracks = myStream.getAudioTracks()
    audioTracks.forEach((track) => {
      track.enabled = !track.enabled
    })
    setIsMicEnabled(!isMicEnabled)
  }, [myStream, isMicEnabled])

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
    // Stop all media tracks
    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop())
    }

    // Close peer connection
    peer.peer.close()

    // Reset states
    setMyStream(null)
    setRemoteStream(null)
    setConnectionStatus("Disconnected")
    setIsAudioOnly(false)
    setErrorMessage(null)

    // Notify server
    socket?.emit("call:end", { to: remoteSocketId })

    // Navigate to home page instead of reloading
    router.push("/")
  }, [myStream, remoteSocketId, socket, router])

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
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Audio only indicator */}
      {isAudioOnly && myStream && (
        <Alert className="mb-4 bg-yellow-500/20 border-yellow-500 text-yellow-500">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Audio Only Mode</AlertTitle>
          <AlertDescription>Your call is in audio-only mode. Video could not be enabled.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {/* My Stream */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          {myStream ? (
            isAudioOnly ? (
              <div className="flex items-center justify-center h-full aspect-video bg-gray-800">
                <div className="text-center">
                  <CameraOff className="h-16 w-16 mx-auto mb-2 text-gray-400" />
                  <p>Audio Only</p>
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full">
                <ReactPlayer playing muted width="100%" height="100%" url={myStream} className="rounded-lg" />
              </div>
            )
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

      {/* Call controls */}
      <div className="mt-4 flex justify-center gap-4">
        {!myStream && remoteSocketId && (
          <Button
            onClick={handleCallUser}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-full font-medium"
          >
            <PhoneCall className="mr-2 h-4 w-4" />
            Start Call
          </Button>
        )}

        {myStream && (
          <>
            <Button
              onClick={toggleMic}
              variant="outline"
              className="rounded-full"
              title={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              {isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>

            {!isAudioOnly && (
              <Button
                onClick={toggleCamera}
                variant="outline"
                className="rounded-full"
                title={isCameraEnabled ? "Turn off camera" : "Turn on camera"}
              >
                {isCameraEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
              </Button>
            )}

            <Button onClick={handleEndCall} className="bg-red-600 hover:bg-red-700 rounded-full" title="End call">
              <PhoneOff className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
