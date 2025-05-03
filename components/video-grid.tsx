"use client"

import VideoParticipant, { type Participant } from "./video-participant"

interface VideoGridProps {
  participants: Participant[]
  selectedParticipantId?: string | null
  onParticipantClick: (participantId: string) => void
  isFullscreen?: boolean
  isThumbnail?: boolean
  isMobile?: boolean
}

export default function VideoGrid({
  participants,
  selectedParticipantId,
  onParticipantClick,
  isFullscreen = false,
  isThumbnail = false,
  isMobile = false,
}: VideoGridProps) {
  // If no participants, return empty
  if (participants.length === 0) return null

  // If only one participant or fullscreen mode, show them large
  if (participants.length === 1 || isFullscreen) {
    return (
      <div
        className={`w-full ${isThumbnail ? "" : "cursor-pointer"}`}
        onClick={() => !isThumbnail && onParticipantClick(participants[0].id)}
      >
        <VideoParticipant
          participant={participants[0]}
          isLarge={!isThumbnail}
          isSelected={participants[0].id === selectedParticipantId}
          isThumbnail={isThumbnail}
          isMobile={isMobile}
        />
      </div>
    )
  }

  // For 2 participants, show them side by side (or stacked on very small screens)
  if (participants.length === 2) {
    return (
      <div className={`grid ${isMobile ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"} gap-2`}>
        {participants.map((participant) => (
          <div key={participant.id} className="cursor-pointer" onClick={() => onParticipantClick(participant.id)}>
            <VideoParticipant
              participant={participant}
              isSelected={participant.id === selectedParticipantId}
              isMobile={isMobile}
            />
          </div>
        ))}
      </div>
    )
  }

  // For 3-4 participants, show in a 2x2 grid (or 1x4 on very small screens)
  if (participants.length <= 4) {
    return (
      <div className={`grid ${isMobile ? "grid-cols-1 xs:grid-cols-2" : "grid-cols-2"} gap-2`}>
        {participants.map((participant) => (
          <div key={participant.id} className="cursor-pointer" onClick={() => onParticipantClick(participant.id)}>
            <VideoParticipant
              participant={participant}
              isSelected={participant.id === selectedParticipantId}
              isMobile={isMobile}
            />
          </div>
        ))}
      </div>
    )
  }

  // For 5-6 participants, show in a 3x2 grid (or 2x3 on mobile)
  if (participants.length <= 6) {
    return (
      <div className={`grid ${isMobile ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3"} gap-2`}>
        {participants.map((participant) => (
          <div key={participant.id} className="cursor-pointer" onClick={() => onParticipantClick(participant.id)}>
            <VideoParticipant
              participant={participant}
              isSelected={participant.id === selectedParticipantId}
              isMobile={isMobile}
            />
          </div>
        ))}
      </div>
    )
  }

  // For more participants, show in a 3x3 grid or more (or 2x4+ on mobile)
  return (
    <div className={`grid ${isMobile ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3"} gap-2`}>
      {participants.map((participant) => (
        <div key={participant.id} className="cursor-pointer" onClick={() => onParticipantClick(participant.id)}>
          <VideoParticipant
            participant={participant}
            isSelected={participant.id === selectedParticipantId}
            isMobile={isMobile}
          />
        </div>
      ))}
    </div>
  )
}
