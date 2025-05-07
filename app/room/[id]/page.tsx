"use client"

import { useEffect, useCallback, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSocket } from "@/providers/SocketProvider"
import peer from "@/service/peer"
import ReactPlayer from "react-player"
import Image from "next/image"
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
  const [username, setUsername] = useState<string>("")

  // Get username from session storage
  useEffect(() => {
    const storedUsername = sessionStorage.getItem("username") || "User"
    setUsername(storedUsername)
  }, [])

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
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <header className="px-6 py-4 bg-black/40 backdrop-blur-sm border-b border-gray-800">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">
              <span className="text-gray-400">Room:</span> {roomId}
            </h1>
            {connectionStatus === 'Connected' && (
              <div className="hidden md:flex items-center">
                <span className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                <span className="text-sm text-gray-300">Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                connectionStatus === 'connected'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : connectionStatus === 'connecting'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : connectionStatus === 'disconnected'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
              }`}
            >
              {connectionStatus}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 flex flex-col">
        {errorMessage && (
          <Alert variant="destructive" className="mb-4 max-w-3xl mx-auto w-full">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {isAudioOnly && myStream && (
          <Alert className="mb-4 max-w-3xl mx-auto w-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Audio Only Mode</AlertTitle>
            <AlertDescription>Your call is in audio-only mode. Video could not be enabled.</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 flex-1 max-w-7xl mx-auto w-full">
          {/* My Stream */}
          <div className="relative rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent" />
            {myStream && !isAudioOnly ? (
              <div className="aspect-video w-full">
                <ReactPlayer playing muted width="100%" height="100%" url={myStream} className="rounded-lg" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full aspect-video">
                <div className=" shadow-teal-500/20">
                  <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-MkpOJg8WrwqDL7ipni67053iHQbPHh.png"
                    alt="Profile"
                    fill
                    className="object-cover"
                  />
                </div>
                {isAudioOnly && myStream && (
                  <p className="mt-4 text-gray-300">Audio Only Mode</p>
                )}
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-teal-500" />
              <span className="text-sm font-medium">{username || 'You'}</span>
            </div>
            {myStream && (
              <div className="absolute top-4 right-4 flex space-x-2">
                {!isMicEnabled && (
                  <div className="bg-red-500/80 p-1.5 rounded-full">
                    <MicOff className="h-3.5 w-3.5" />
                  </div>
                )}
                {!isCameraEnabled && !isAudioOnly && (
                  <div className="bg-red-500/80 p-1.5 rounded-full">
                    <CameraOff className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Remote Stream */}
          <div className="relative rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent" />
            {remoteStream ? (
              <div className="aspect-video w-full">
                <ReactPlayer playing width="100%" height="100%" url={remoteStream} className="rounded-lg" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full aspect-video">
                <div className="border-pink-500/70 shadow-lg shadow-pink-500/20">
                  <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-XGNGAY6vunhQVhQCU5C4gBUijdSQ3p.png"
                    alt="Remote Profile"
                    fill
                    className="object-cover"
                  />
                </div>
                <p className="mt-4 text-gray-300">
                  {remoteSocketId ? 'Waiting for video...' : 'Waiting for someone to join...'}
                </p>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-pink-500" />
              <span className="text-sm font-medium">{remoteSocketId ? 'Remote User' : 'Waiting for user...'}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-full p-2 shadow-xl">
            {!myStream && remoteSocketId ? (
              <Button
                onClick={handleCallUser}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 rounded-full font-medium shadow-lg shadow-green-900/30 transition-all duration-300"
              >
                <PhoneCall className="mr-2 h-5 w-5" />
                Start Call
              </Button>
            ) : myStream ? (
              <div className="flex items-center space-x-3 px-2">
                <Button
                  onClick={toggleMic}
                  variant={isMicEnabled ? 'outline' : 'destructive'}
                  className={`rounded-full h-12 w-12 flex items-center justify-center ${
                    isMicEnabled ? 'bg-gray-800 hover:bg-gray-700 border-gray-600' : 'bg-red-500/20 hover:bg-red-500/30'
                  }`}
                  title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>

                {!isAudioOnly && (
                  <Button
                    onClick={toggleCamera}
                    variant={isCameraEnabled ? 'outline' : 'destructive'}
                    className={`rounded-full h-12 w-12 flex items-center justify-center ${
                      isCameraEnabled
                        ? 'bg-gray-800 hover:bg-gray-700 border-gray-600'
                        : 'bg-red-500/20 hover:bg-red-500/30'
                    }`}
                    title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isCameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
                  </Button>
                )}

                <Button
                  onClick={handleEndCall}
                  className="bg-red-600 hover:bg-red-700 rounded-full h-12 w-12 flex items-center justify-center shadow-lg shadow-red-900/30"
                  title="End call"
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}
