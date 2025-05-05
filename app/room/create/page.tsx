"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Camera, CameraOff, Mic, MicOff, ArrowRight } from "lucide-react"
import Image from "next/image"
import { SocketService } from "@/lib/socket-service"

export default function RoomSetup() {
  const [username, setUsername] = useState<string>("")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isBrowserSupported, setIsBrowserSupported] = useState<boolean>(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const socketService = useRef<SocketService>(new SocketService())
  const router = useRouter()

  useEffect(() => {
    // Get username from session storage
    const storedUsername = sessionStorage.getItem("username")
    if (!storedUsername) {
      router.push("/create-room")
      return
    }

    setUsername(storedUsername)

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsBrowserSupported(false)
      setError("Your browser doesn't support camera/microphone access. You can still join with chat only.")
      return
    }

    // Initialize camera and microphone
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      })
      .catch((err) => {
        console.error("Error accessing media devices:", err)

        // Try audio only as fallback
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((audioStream) => {
            setStream(audioStream)
            setIsVideoEnabled(false)
            setError("Camera access denied. Proceeding with audio only.")
          })
          .catch((audioErr) => {
            console.error("Error accessing audio:", audioErr)
            setError("Could not access camera or microphone. You can still join with chat only.")
          })
      })

    // Connect to socket server
    const socket = socketService.current.connect()

    // Listen for room creation confirmation
    socket.on("room-created", ({ roomId }) => {
      // Store room ID and navigate to the conference
      sessionStorage.setItem("roomId", roomId)
      router.push(`/room?id=${roomId}`)
    })

    // Listen for errors
    socket.on("room-error", ({ message }) => {
      setError(message)
      setIsLoading(false)
    })

    return () => {
      // Clean up
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      socket.off("room-created")
      socket.off("room-error")
    }
  }, [router])

  const toggleVideo = () => {
    if (stream) {
      const videoTracks = stream.getVideoTracks()
      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => {
          track.enabled = !isVideoEnabled
        })
        setIsVideoEnabled(!isVideoEnabled)
      }
    }
  }

  const toggleAudio = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => {
          track.enabled = !isAudioEnabled
        })
        setIsAudioEnabled(!isAudioEnabled)
      }
    }
  }

  const createRoom = () => {
    setIsLoading(true)
    setError(null)

    // Create a room via socket.io
    socketService.current.createRoom(username)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center">
            <Image src="/neo-logo.png" alt="Neo Logo" width={64} height={64} className="h-12 w-auto" />
            <span className="ml-2 text-2xl font-semibold">x Harsingh</span>
          </div>
          <h1 className="text-center text-2xl font-bold">Setup Your Video and Audio</h1>
          <p className="text-center text-gray-400">Make sure everything looks and sounds good</p>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg bg-black">
          <div className="relative aspect-video">
            {isBrowserSupported ? (
              stream && stream.getVideoTracks().length > 0 ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`h-full w-full object-cover ${!isVideoEnabled ? "hidden" : ""}`}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-800">
                  <p className="text-gray-400">{error ? "Camera not available" : "Loading camera..."}</p>
                </div>
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-800">
                <p className="text-gray-400">Camera not supported on this browser</p>
              </div>
            )}

            {(!isVideoEnabled || !stream || stream.getVideoTracks().length === 0) && (
              <div className="flex h-full w-full items-center justify-center bg-gray-800">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-700 text-3xl font-semibold">
                  {username.charAt(0).toUpperCase()}
                </div>
              </div>
            )}

            <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-sm">{username}</div>
          </div>
        </div>

        <div className="mt-6 flex justify-center space-x-4">
          <Button
            onClick={toggleVideo}
            variant="outline"
            size="icon"
            disabled={!stream || stream.getVideoTracks().length === 0}
            className={`rounded-full h-12 w-12 ${
              !isVideoEnabled || !stream || stream.getVideoTracks().length === 0
                ? "bg-red-600 text-white border-0"
                : "bg-gray-800 border-0"
            }`}
          >
            {isVideoEnabled && stream && stream.getVideoTracks().length > 0 ? (
              <Camera size={20} />
            ) : (
              <CameraOff size={20} />
            )}
          </Button>

          <Button
            onClick={toggleAudio}
            variant="outline"
            size="icon"
            disabled={!stream || stream.getAudioTracks().length === 0}
            className={`rounded-full h-12 w-12 ${
              !isAudioEnabled || !stream || stream.getAudioTracks().length === 0
                ? "bg-red-600 text-white border-0"
                : "bg-gray-800 border-0"
            }`}
          >
            {isAudioEnabled && stream && stream.getAudioTracks().length > 0 ? <Mic size={20} /> : <MicOff size={20} />}
          </Button>
        </div>

        {error && <div className="mt-4 rounded-md bg-red-900/50 p-3 text-center text-sm text-red-200">{error}</div>}

        <Button
          onClick={createRoom}
          disabled={isLoading}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isLoading ? (
            "Creating Room..."
          ) : (
            <>
              Start Meeting <ArrowRight size={16} />
            </>
          )}
        </Button>
      </div>
    </main>
  )
}
