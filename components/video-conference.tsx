"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Camera, CameraOff, Maximize2, MessageCircle, Mic, MicOff, PhoneOff, X } from "lucide-react"
import VideoGrid from "./video-grid"
import type { Participant } from "./video-participant"
import { useMobile } from "@/hooks/use-mobile"

export default function VideoConference() {
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null)
  const isMobile = useMobile()

  // Sample participants data
  const participants: Participant[] = [
    {
      id: "1",
      name: "John Doe",
      videoUrl: "/placeholder.svg?height=720&width=1280",
      isMuted: false,
      isVideoOn: true,
      backgroundColor: "bg-purple-500",
    },
    {
      id: "2",
      name: "Jane Smith",
      videoUrl: "/placeholder.svg?height=720&width=1280",
      isMuted: true,
      isVideoOn: false,
      backgroundColor: "bg-pink-500",
    },
  ]

  const handleParticipantClick = (participantId: string) => {
    setSelectedParticipantId(participantId)
  }

  const toggleFullscreen = () => {
    // If no participant is selected, select the first one when going fullscreen
    if (!selectedParticipantId && participants.length > 0) {
      setSelectedParticipantId(participants[0].id)
    }
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div className="w-full max-w-7xl rounded-xl bg-black shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-2 sm:p-4">
        <div className="flex justify-between items-center">
          <Image src="/neo-logo.png" alt="Neo Logo" width={100} height={100} className="" /> 
          <p className="text-white text-3xl font-semibold pb-2 ">x Harsingh</p>
        </div>
        <div className="flex gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size={isMobile ? "sm" : "icon"}
            className="text-gray-400 hover:text-white"
            onClick={toggleFullscreen}
          >
            <Maximize2 size={isMobile ? 16 : 18} />
          </Button>
          <Button variant="ghost" size={isMobile ? "sm" : "icon"} className="text-gray-400 hover:text-white">
            <X size={isMobile ? 16 : 18} />
          </Button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="mx-2 sm:mx-4 mb-2 sm:mb-4">
        {isFullscreen && selectedParticipantId ? (
          <div className="relative">
            {/* Main fullscreen video */}
            <div className="w-full mb-2">
              {participants.find((p) => p.id === selectedParticipantId) && (
                <div className="relative aspect-video rounded-lg overflow-hidden">
                  <VideoGrid
                    participants={[participants.find((p) => p.id === selectedParticipantId)!]}
                    isFullscreen={true}
                    onParticipantClick={() => {}}
                    isMobile={isMobile}
                  />
                </div>
              )}
            </div>

            {/* Thumbnails at bottom */}
            <div
              className={`
              absolute bottom-2 right-2 sm:bottom-4 sm:right-4 flex gap-1 sm:gap-2
              ${isMobile ? "max-w-[30%]" : ""}
            `}
            >
              {participants
                .filter((p) => p.id !== selectedParticipantId)
                .map((participant) => (
                  <div
                    key={participant.id}
                    className={`
                      rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-white
                      ${isMobile ? "w-16 h-12" : "w-24 h-16"}
                    `}
                    onClick={() => setSelectedParticipantId(participant.id)}
                  >
                    <VideoGrid
                      participants={[participant]}
                      isThumbnail={true}
                      onParticipantClick={() => {}}
                      isMobile={isMobile}
                    />
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <VideoGrid
            participants={participants}
            selectedParticipantId={selectedParticipantId}
            onParticipantClick={handleParticipantClick}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-2 sm:gap-4 my-3 sm:my-6">
        <Button
          onClick={() => setIsVideoOn(!isVideoOn)}
          variant="outline"
          size="icon"
          className={`
            rounded-full border-0
            ${isMobile ? "h-10 w-10" : "h-14 w-14"} 
            ${isVideoOn ? "bg-slate-700" : "bg-slate-800 text-red-500"}
          `}
        >
          {isVideoOn ? <Camera size={isMobile ? 18 : 24} /> : <CameraOff size={isMobile ? 18 : 24} />}
        </Button>

        <Button
          onClick={() => setIsMuted(!isMuted)}
          variant="outline"
          size="icon"
          className={`
            rounded-full border-0
            ${isMobile ? "h-10 w-10" : "h-14 w-14"} 
            ${isMuted ? "bg-slate-800 text-red-500" : "bg-slate-700"}
          `}
        >
          {isMuted ? <MicOff size={isMobile ? 18 : 24} /> : <Mic size={isMobile ? 18 : 24} />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          className={`
            rounded-full bg-red-600 hover:bg-red-700 text-white border-none
            ${isMobile ? "h-10 w-10" : "h-14 w-14"}
          `}
        >
          <PhoneOff size={isMobile ? 18 : 24} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className={`
            rounded-full bg-slate-700 border-0
            ${isMobile ? "h-10 w-10" : "h-14 w-14"}
          `}
        >
          <MessageCircle size={isMobile ? 18 : 24} />
        </Button>
      </div>
    </div>
  )
}
