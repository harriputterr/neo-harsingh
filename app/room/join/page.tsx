"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Camera, CameraOff, Mic, MicOff, ArrowRight } from "lucide-react"
import Image from "next/image"
import { SocketService } from "@/lib/socket-service"

export default function JoinRoomSetup() {
  const [username, setUsername] = useState<string>("")
  const [roomId, setRoomId] = useState<string>("")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const socketService = useRef<SocketService>(new SocketService())
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Get username and roomId from session storage
    const storedUsername = sessionStorage.getItem("username")
    const storedRoomId = searchParams.get("id") || sessionStorage.getItem("roomId")

    if (!storedUsername || !storedRoomId) {
      router.push("/join-room")
      return
    }

    setUsername(storedUsername)
    setRoomId(storedRoomId)

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
        setError("Could not access camera or microphone. Please check permissions.")
      })

    // Connect to socket server
    const socket = socketService.current.connect()

    // Listen for room join confirmation
    socket.on("room-joined", ({ roomId }) => {
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

      socket.off("room-joined")
      socket.off("room-error")
    }
  }, [router, searchParams])

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled
      })
      setIsVideoEnabled(!isVideoEnabled)
    }
  }

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isAudioEnabled
      })
      setIsAudioEnabled(!isAudioEnabled)
    }
  }

  const joinRoom = () => {
    setIsLoading(true)
    setError(null)

    // Join a room via socket.io
    socketService.current.joinRoom(roomId, username)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center">
            <Image src="/neo-logo.png" alt="Neo Logo" width={64} height={64} className="h-12 w-auto" />
            <span className="ml-2 text-2xl font-semibold">x Harsingh</span>
          </div>
          <h1 className="text-center text-2xl font-bold">Join Room: {roomId}</h1>
          <p className="text-center text-gray-400">Make sure everything looks and sounds good</p>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg bg-black">
          <div className="relative aspect-video">
            {stream ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`h-full w-full object-cover ${!isVideoEnabled ? "hidden" : ""}`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-800">
                <p className="text-gray-400">Loading camera...</p>
              </div>
            )}

            {!isVideoEnabled && (
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
            className={`rounded-full h-12 w-12 ${!isVideoEnabled ? "bg-red-600 text-white border-0" : "bg-gray-800 border-0"}`}
          >
            {isVideoEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
          </Button>

          <Button
            onClick={toggleAudio}
            variant="outline"
            size="icon"
            className={`rounded-full h-12 w-12 ${!isAudioEnabled ? "bg-red-600 text-white border-0" : "bg-gray-800 border-0"}`}
          >
            {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </Button>
        </div>

        {error && <div className="mt-4 rounded-md bg-red-900/50 p-3 text-center text-sm text-red-200">{error}</div>}

        <Button
          onClick={joinRoom}
          disabled={isLoading || !stream}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isLoading ? (
            "Joining Room..."
          ) : (
            <>
              Join Meeting <ArrowRight size={16} />
            </>
          )}
        </Button>
      </div>
    </main>
  )
}
