"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import { Avatar } from "@/components/ui/avatar"
import { MicOff } from "lucide-react"

export interface Participant {
  id: string
  name: string
  avatarUrl?: string
  videoUrl?: string
  isMuted: boolean
  isVideoOn: boolean
  backgroundColor?: string
  stream?: MediaStream | null
}

export interface VideoParticipantProps {
  participant: Participant
  isLarge?: boolean
  isSelected?: boolean
  isThumbnail?: boolean
  isMobile?: boolean
  fillContainer?: boolean
}

export default function VideoParticipant({
  participant,
  isLarge = false,
  isSelected = false,
  isThumbnail = false,
  isMobile = false,
  fillContainer = false,
}: VideoParticipantProps) {
  const { id, name, avatarUrl, videoUrl, isMuted, isVideoOn, backgroundColor = "bg-gray-700", stream } = participant
  const videoRef = useRef<HTMLVideoElement>(null)

  // Get initials from name
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)

  // Handle stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div
      className={`
        relative rounded-lg overflow-hidden ${backgroundColor} flex items-center justify-center
        ${isSelected ? "ring-2 sm:ring-4 ring-white" : ""}
        transition-all duration-200
        ${fillContainer ? "h-full" : ""}
      `}
      style={fillContainer ? {} : { aspectRatio: "16/9" }}
    >
      {isVideoOn && (stream || videoUrl) ? (
        stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={id === "local" || isThumbnail}
            className="h-full w-full object-cover"
          />
        ) : (
          <Image src={videoUrl || "/placeholder.svg"} alt={`${name}'s video`} fill className="object-cover" priority />
        )
      ) : (
        <Avatar
          className={`
            ${
              isLarge
                ? isMobile
                  ? "h-24 w-24 sm:h-36 sm:w-36"
                  : "h-36 w-36"
                : isThumbnail
                  ? isMobile
                    ? "h-8 w-8 sm:h-10 sm:w-10"
                    : "h-10 w-10"
                  : isMobile
                    ? "h-16 w-16 sm:h-24 sm:w-24"
                    : "h-24 w-24"
            } 
            bg-slate-600 text-white
          `}
        >
          <span
            className={`
            ${
              isLarge
                ? isMobile
                  ? "text-2xl sm:text-4xl"
                  : "text-4xl"
                : isThumbnail
                  ? isMobile
                    ? "text-[10px] sm:text-xs"
                    : "text-xs"
                  : isMobile
                    ? "text-lg sm:text-2xl"
                    : "text-2xl"
            }
          `}
          >
            {initials}
          </span>
        </Avatar>
      )}

      {/* Participant name and mute indicator */}
      {!isThumbnail && (
        <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 right-1 sm:right-2 flex items-center justify-between">
          <span className="text-white text-xs sm:text-sm bg-black/50 px-1 sm:px-2 py-0.5 rounded-md truncate max-w-[70%]">
            {name}
          </span>
          {isMuted && (
            <span className="bg-black/50 p-0.5 sm:p-1 rounded-full">
              <MicOff size={isMobile ? 12 : 16} className="text-white" />
            </span>
          )}
        </div>
      )}
    </div>
  )
}
