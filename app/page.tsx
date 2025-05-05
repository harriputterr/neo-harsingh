import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Neo Video Conference",
  description: "A WebRTC-based video conferencing application",
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center">
            <Image src="/neo-logo.png" alt="Neo Logo" width={64} height={64} className="h-12 w-auto" />
            <span className="ml-2 text-2xl font-semibold">x Harsingh</span>
          </div>
          <h1 className="text-center text-3xl font-bold">Video Conference</h1>
          <p className="text-center text-gray-400">
            Connect with anyone, anywhere with secure peer-to-peer video calls
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <Link
            href="/create-room"
            className="flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Create a Room
          </Link>
          <Link
            href="/join-room"
            className="flex w-full items-center justify-center rounded-md border border-gray-600 bg-transparent px-4 py-3 font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Join a Room
          </Link>
        </div>

        <div className="mt-6">
          <p className="text-center text-sm text-gray-400">Powered by WebRTC and Socket.IO</p>
        </div>
      </div>
    </main>
  )
}
