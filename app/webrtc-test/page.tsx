"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

export default function WebRTCTest() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [connectionState, setConnectionState] = useState<string>("Not connected")

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const pc1 = useRef<RTCPeerConnection | null>(null)
  const pc2 = useRef<RTCPeerConnection | null>(null)

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
    console.log(message)
  }

  useEffect(() => {
    // Clean up on unmount
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
      if (pc1.current) pc1.current.close()
      if (pc2.current) pc2.current.close()
    }
  }, [localStream])

  const startTest = async () => {
    try {
      addLog("Starting WebRTC test...")

      // Get local media
      addLog("Requesting user media...")
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setLocalStream(stream)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      addLog("Local stream acquired")

      // Create peer connections with improved configuration
      const configuration = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          // Twilio TURN server (requires TCP)
          {
            urls: "turn:global.turn.twilio.com:3478?transport=tcp",
            username: "f4b4035eaa76f77e3ffae6b9eb2ba4f563469b4a355a73eddebdc52531f9520f",
            credential: "uWMWvVNtLZZKgbwPswvlKi7+JgzZ3Hf9tHjh6lMbKrQ=",
          },
        ],
        iceTransportPolicy: "all",
      }

      pc1.current = new RTCPeerConnection(configuration)
      pc2.current = new RTCPeerConnection(configuration)

      addLog("Peer connections created")

      // Create a new remote stream
      const remoteStream = new MediaStream()
      setRemoteStream(remoteStream)
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream
      }

      // Set up event handlers for pc1
      pc1.current.onicecandidate = (e) => {
        if (e.candidate) {
          addLog("PC1 ICE candidate: " + e.candidate.candidate.substr(0, 20) + "...")
          pc2.current?.addIceCandidate(e.candidate).catch((err) => {
            addLog("Error adding ICE candidate to PC2: " + err)
          })
        }
      }

      pc1.current.oniceconnectionstatechange = () => {
        addLog("PC1 ICE state: " + pc1.current?.iceConnectionState)
        updateConnectionState()
      }

      // Set up event handlers for pc2
      pc2.current.onicecandidate = (e) => {
        if (e.candidate) {
          addLog("PC2 ICE candidate: " + e.candidate.candidate.substr(0, 20) + "...")
          pc1.current?.addIceCandidate(e.candidate).catch((err) => {
            addLog("Error adding ICE candidate to PC1: " + err)
          })
        }
      }

      pc2.current.oniceconnectionstatechange = () => {
        addLog("PC2 ICE state: " + pc2.current?.iceConnectionState)
        updateConnectionState()
      }

      pc2.current.ontrack = (e) => {
        addLog("Track received on PC2")
        e.streams[0].getTracks().forEach((track) => {
          addLog(`Adding ${track.kind} track to remote stream`)
          remoteStream.addTrack(track)
        })
      }

      // Add tracks to pc1
      stream.getTracks().forEach((track) => {
        addLog(`Adding ${track.kind} track to PC1`)
        pc1.current?.addTrack(track, stream)
      })

      // Create and set offer
      addLog("Creating offer...")
      const offer = await pc1.current.createOffer()
      addLog("Setting local description on PC1...")
      await pc1.current.setLocalDescription(offer)

      addLog("Setting remote description on PC2...")
      await pc2.current.setRemoteDescription(offer)

      // Create and set answer
      addLog("Creating answer...")
      const answer = await pc2.current.createAnswer()
      addLog("Setting local description on PC2...")
      await pc2.current.setLocalDescription(answer)

      addLog("Setting remote description on PC1...")
      await pc1.current.setRemoteDescription(answer)

      addLog("Connection setup complete")
    } catch (error) {
      console.error("Error in WebRTC test:", error)
      addLog("ERROR: " + (error as Error).message)
    }
  }

  const updateConnectionState = () => {
    if (!pc1.current || !pc2.current) return

    const pc1State = pc1.current.iceConnectionState
    const pc2State = pc2.current.iceConnectionState

    setConnectionState(`PC1: ${pc1State} | PC2: ${pc2State}`)
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">WebRTC Connection Test</h1>

      <div className="mb-4">
        <Button onClick={startTest} disabled={!!localStream}>
          Start Test
        </Button>
        <div className="mt-2 p-2 bg-gray-100 rounded">
          Connection State: <span className="font-mono">{connectionState}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Local Video</h2>
          <div className="bg-black rounded overflow-hidden aspect-video">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Remote Video</h2>
          <div className="bg-black rounded overflow-hidden aspect-video">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Connection Logs</h2>
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
