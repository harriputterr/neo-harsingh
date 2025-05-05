"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function NetworkTest() {
  const [publicIp, setPublicIp] = useState<string>("Testing...")
  const [socketUrl, setSocketUrl] = useState<string>("")
  const [socketConnected, setSocketConnected] = useState<boolean>(false)
  const [stunTest, setStunTest] = useState<string>("Not tested")
  const [turnTest, setTurnTest] = useState<string>("Not tested")
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
    console.log(message)
  }

  useEffect(() => {
    // Calculate Socket.IO URL
    let url = ""
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SOCKET_HOST) {
      const protocol = "https"
      const host = process.env.NEXT_PUBLIC_SOCKET_HOST
      const port = process.env.NEXT_PUBLIC_SOCKET_PORT || "443"
      url = port === "443" ? `${protocol}://${host}` : `${protocol}://${host}:${port}`
    } else if (typeof window !== "undefined" && window.location.hostname.includes("ngrok")) {
      const protocol = "https"
      const host = window.location.hostname
      const port = process.env.NEXT_PUBLIC_SOCKET_PORT || "3001"
      url = `${protocol}://${host}:${port}`
    } else {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http"
      const host = typeof window !== "undefined" ? window.location.hostname : "localhost"
      const port = process.env.NEXT_PUBLIC_SOCKET_PORT || "3001"
      url = `${protocol}://${host}:${port}`
    }

    setSocketUrl(url)
    addLog(`Socket.IO URL: ${url}`)

    // Get public IP
    fetch("https://api.ipify.org?format=json")
      .then((response) => response.json())
      .then((data) => {
        setPublicIp(data.ip)
        addLog(`Public IP: ${data.ip}`)
      })
      .catch((error) => {
        setPublicIp("Error fetching IP")
        addLog(`Error fetching IP: ${error.message}`)
      })
  }, [])

  const testStunServer = async () => {
    try {
      setStunTest("Testing...")
      addLog("Testing STUN server...")

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      })

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          // Look for the srflx candidate (reflexive address - your public IP)
          if (e.candidate.candidate.includes("srflx")) {
            addLog(`STUN success: ${e.candidate.candidate}`)
            setStunTest("Success ✅")
            pc.close()
          }
        }
      }

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
          addLog("ICE gathering complete")
          if (stunTest === "Testing...") {
            setStunTest("Failed ❌ - No srflx candidate")
          }
        }
      }

      // Create data channel to trigger ICE gathering
      pc.createDataChannel("test")
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Set timeout for STUN test
      setTimeout(() => {
        if (stunTest === "Testing...") {
          setStunTest("Timeout ⚠️")
          pc.close()
        }
      }, 5000)
    } catch (error) {
      addLog(`STUN test error: ${(error as Error).message}`)
      setStunTest("Error ❌")
    }
  }

  const testTurnServer = async () => {
    try {
      setTurnTest("Testing...")
      addLog("Testing TURN server...")

      const pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      })

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          // Look for the relay candidate (TURN server)
          if (e.candidate.candidate.includes("relay")) {
            addLog(`TURN success: ${e.candidate.candidate}`)
            setTurnTest("Success ✅")
            pc.close()
          }
        }
      }

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
          addLog("ICE gathering complete")
          if (turnTest === "Testing...") {
            setTurnTest("Failed ❌ - No relay candidate")
          }
        }
      }

      // Create data channel to trigger ICE gathering
      pc.createDataChannel("test")
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Set timeout for TURN test
      setTimeout(() => {
        if (turnTest === "Testing...") {
          setTurnTest("Timeout ⚠️")
          pc.close()
        }
      }, 5000)
    } catch (error) {
      addLog(`TURN test error: ${(error as Error).message}`)
      setTurnTest("Error ❌")
    }
  }

  const testSocketConnection = () => {
    try {
      addLog("Testing Socket.IO connection...")

      // Dynamically import socket.io-client
      import("socket.io-client").then(({ io }) => {
        const socket = io(socketUrl, {
          transports: ["websocket", "polling"],
          timeout: 10000,
        })

        socket.on("connect", () => {
          addLog(`Socket connected with ID: ${socket.id}`)
          setSocketConnected(true)

          // Disconnect after 2 seconds
          setTimeout(() => {
            socket.disconnect()
            addLog("Socket disconnected")
          }, 2000)
        })

        socket.on("connect_error", (error) => {
          addLog(`Socket connection error: ${error.message}`)
          setSocketConnected(false)
        })

        // Set timeout
        setTimeout(() => {
          if (!socket.connected) {
            addLog("Socket connection timeout")
            socket.disconnect()
          }
        }, 10000)
      })
    } catch (error) {
      addLog(`Socket test error: ${(error as Error).message}`)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Network Diagnostics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-2">Network Information</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Public IP:</span> {publicIp}
            </div>
            <div>
              <span className="font-medium">Socket.IO URL:</span> {socketUrl}
            </div>
            <div>
              <span className="font-medium">Socket Connected:</span> {socketConnected ? "Yes ✅" : "No ❌"}
            </div>
            <div>
              <Button onClick={testSocketConnection} size="sm">
                Test Socket Connection
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-2">WebRTC Server Tests</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">STUN Server:</span> {stunTest}
            </div>
            <div>
              <Button onClick={testStunServer} size="sm" className="mr-2">
                Test STUN
              </Button>
            </div>
            <div className="mt-4">
              <span className="font-medium">TURN Server:</span> {turnTest}
            </div>
            <div>
              <Button onClick={testTurnServer} size="sm">
                Test TURN
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Diagnostic Logs</h2>
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
