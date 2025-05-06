"use client";

import type React from "react";
import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart } from "lucide-react";
import { useSocket } from "@/providers/SocketProvider";

export default function RoomPage() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const socket = useSocket();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!username.trim() || !roomId.trim()) return;

      setIsLoading(true);

      socket?.emit("room:join", { username, roomId });

    },
    [username, roomId, socket]
  );

  const handleJoinRoom = useCallback(
    (data:any) => {
      const { username, roomId } = data;

      router.push(`/room/${roomId}`);
    },
    [router]
  );

  useEffect(() => {
    socket?.on("room:join", handleJoinRoom);

    return () => {
      socket?.off('room:join', handleJoinRoom)
    }
  }, [socket, handleJoinRoom]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black p-4 text-white overflow-hidden">
      {/* Background Image - Adjusted position */}
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-30">
        <div
          className="relative w-[150%] max-w-[1500px] aspect-square"
          style={{ marginTop: "-5%" }}
        >
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-6K4NT1wpscXD9mgVir13PFoWt2pPUJ.png"
            alt="Background illustration"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1
            className="text-6xl font-serif text-white pb-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            nevio
          </h1>
          <div className="h-0.5 w-32 mx-auto bg-white/30"></div>
          <p className="mt-3 text-gray-400">Video Conference Platform</p>
        </div>

        <div className="backdrop-blur-sm bg-black/40 border border-gray-800 rounded-xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="username"
                  className="text-sm font-medium text-gray-300"
                >
                  Your Name
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-700 bg-gray-900/50 px-4 py-2 text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="roomId"
                  className="text-sm font-medium text-gray-300"
                >
                  Room ID
                </Label>
                <Input
                  id="roomId"
                  type="text"
                  placeholder="Enter room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-700 bg-gray-900/50 px-4 py-2 text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !username.trim() || !roomId.trim()}
              className="w-full rounded-md bg-white text-black hover:bg-gray-200 px-4 py-6 font-medium focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 disabled:opacity-50 transition-all duration-300"
            >
              {isLoading ? "Processing..." : "Create or Join Room"}
            </Button>
          </form>
        </div>

        <div className="mt-10 text-center text-base text-gray-300 flex items-center justify-center">
          Made with <Heart className="h-5 w-5 mx-2 text-red-500 fill-red-500" />{" "}
          for
          <div className="mx-2 relative w-14 h-14 flex items-center justify-center overflow-hidden">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/neo-logo.png-3FeLfk2tzLQ4cpfqgMPjqzdk5P9Ir5.jpeg"
              alt="Neo Logo"
              width={56}
              height={56}
              className="rounded-full object-cover"
            />
          </div>
          by Harsingh
        </div>
      </div>
    </main>
  );
}
