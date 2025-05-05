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

export default function CreateRoom() {
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim()) return

    setIsLoading(true)

    // Store username in sessionStorage for use in the conference room
    sessionStorage.setItem("username", username)

    // Navigate to the conference room setup page
    router.push("/room/create")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center">
            <Image src="/neo-logo.png" alt="Neo Logo" width={64} height={64} className="h-12 w-auto" />
            <span className="ml-2 text-2xl font-semibold">x Harsingh</span>
          </div>
          <h1 className="text-center text-3xl font-bold">Create a Room</h1>
          <p className="text-center text-gray-400">Start a new video conference</p>
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

          <Button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Create Room"}
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
