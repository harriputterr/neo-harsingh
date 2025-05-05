"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function JoinRoom() {
  const [username, setUsername] = useState("")
  const [roomId, setRoomId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim() || !roomId.trim()) return

    setIsLoading(true)

    // Store data in sessionStorage for use in the conference room
    sessionStorage.setItem("username", username)
    sessionStorage.setItem("roomId", roomId.toUpperCase())

    // Navigate to the conference room
    router.push(`/room/join?id=${roomId.toUpperCase()}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center">
            <Image src="/neo-logo.png" alt="Neo Logo" width={64} height={64} className="h-12 w-auto" />
            <span className="ml-2 text-2xl font-semibold">x Harsingh</span>
          </div>
          <h1 className="text-center text-3xl font-bold">Join a Room</h1>
          <p className="text-center text-gray-400">Enter a room code to join an existing conference</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium text-gray-300">
              Your Name
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomId" className="text-sm font-medium text-gray-300">
              Room Code
            </Label>
            <Input
              id="roomId"
              type="text"
              placeholder="Enter room code (e.g., ABC12)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              required
              maxLength={5}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || !username.trim() || !roomId.trim()}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? "Joining..." : "Join Room"}
          </Button>
        </form>

        <div className="mt-4 flex justify-center">
          <Link href="/" className="flex items-center text-sm text-gray-400 hover:text-white">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
