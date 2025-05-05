"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Camera,
  CameraOff,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  X,
  Users,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { SocketService } from "@/lib/socket-service";
import { WebRTCService } from "@/lib/webrtc-service";
import VideoGrid from "@/components/video-grid";
import type { Participant } from "@/components/video-participant";
import { useMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import type {
  UserJoinedPayload,
  RoomJoinedPayload,
  UserLeftPayload,
} from "@/lib/types";
import type { Socket } from "socket.io-client";

interface RemoteParticipant {
  id: string;
  username: string;
  stream?: MediaStream;
  connectionState?: RTCPeerConnectionState;
}

export default function Room() {
  const [username, setUsername] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteParticipants, setRemoteParticipants] = useState<
    RemoteParticipant[]
  >([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isBrowserSupported, setIsBrowserSupported] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Initializing...");

  const socketService = useRef<SocketService>(new SocketService());
  const webRTCService = useRef<WebRTCService | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMobile();

  // Add this near the top of your Room component
  useEffect(() => {
    console.log(
      "SOCKET DEBUG: Attempting to connect to:",
      process.env.NEXT_PUBLIC_SOCKET_HOST,
      process.env.NEXT_PUBLIC_SOCKET_PORT
    );
  }, []);

  
  useEffect(() => {
    // Get username and roomId from session storage
    const storedUsername = sessionStorage.getItem("username");
    const storedRoomId =
      searchParams.get("id") || sessionStorage.getItem("roomId");

    if (!storedUsername || !storedRoomId) {
      router.push("/");
      return;
    }

    setUsername(storedUsername);
    setRoomId(storedRoomId);
    setConnectionStatus("Connecting to room...");

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsBrowserSupported(false);
      console.log("MediaDevices API not supported in this browser");
      setConnectionStatus("Browser not fully supported");

      // Still connect to socket for chat functionality
      const socket = socketService.current.connect();
      setupSocketListeners(socket, storedUsername);

      return;
    }

    // Connect to socket server
    const socket = socketService.current.connect();
    setConnectionStatus("Connected to signaling server");

    // Setup socket listeners
    setupSocketListeners(socket, storedUsername);

    // Initialize WebRTC service
    webRTCService.current = new WebRTCService(
      socket,
      handleRemoteStream,
      handleRemoteStreamRemoved
    );

    // Initialize local stream
    setConnectionStatus("Accessing camera and microphone...");
    if (webRTCService.current) {
      webRTCService.current
        .initLocalStream()
        .then((stream) => {
          setLocalStream(stream);
          setIsVideoOn(
            stream.getVideoTracks().length > 0 &&
              stream.getVideoTracks()[0].enabled
          );
          setConnectionStatus("Media access granted");

          // Add local participant to the list
          setParticipants([
            {
              id: socket.id || "local", // Provide a fallback ID
              name: storedUsername,
              videoUrl: undefined, // We'll use the stream directly
              isMuted: false,
              isVideoOn: stream.getVideoTracks().length > 0,
              backgroundColor: "bg-gray-800",
              stream,
            },
          ]);
        })
        .catch((error) => {
          console.error("Error initializing local stream:", error);
          setConnectionStatus("Media access error");

          // Add local participant without stream
          setParticipants([
            {
              id: socket.id || "local",
              name: storedUsername,
              videoUrl: undefined,
              isMuted: true,
              isVideoOn: false,
              backgroundColor: "bg-gray-800",
            },
          ]);

          toast({
            title: "Camera/Microphone Error",
            description:
              "Could not access your camera or microphone. You can still participate via chat.",
            variant: "destructive",
          });
        });
    }

    return () => {
      // Clean up
      if (webRTCService.current) {
        webRTCService.current.closeAllConnections();
      }

      socket.off("user-joined");
      socket.off("user-left");
      socket.off("room-joined");
    };
  }, [router, searchParams]);

  const setupSocketListeners = (socket: Socket, username: string) => {
    // Listen for user joined events
    socket.on("user-joined", ({ id, username }: UserJoinedPayload) => {
      console.log(`User joined: ${username} (${id})`);
      setConnectionStatus(`${username} joined the room`);

      // Add to remote participants
      setRemoteParticipants((prev) => [...prev, { id, username }]);

      // Initiate WebRTC call to the new participant
      if (webRTCService.current && localStream) {
        setIsConnecting(true);
        webRTCService.current.initiateCall(id).finally(() => {
          setTimeout(() => setIsConnecting(false), 2000);
        });
      }
    });

    // Listen for user left events
    socket.on("user-left", ({ id, username }: UserLeftPayload) => {
      console.log(`User left: ${username} (${id})`);
      setConnectionStatus(`${username} left the room`);

      // Remove from remote participants
      setRemoteParticipants((prev) => prev.filter((p) => p.id !== id));

      // If this was the selected participant, clear selection
      if (selectedParticipantId === id) {
        setSelectedParticipantId(null);
      }
    });

    // Listen for room joined events (for users who join existing rooms)
    socket.on(
      "room-joined",
      ({ participants: existingParticipants }: RoomJoinedPayload) => {
        console.log(
          "Joined room with existing participants:",
          existingParticipants
        );

        if (existingParticipants.length > 0) {
          setConnectionStatus(
            `Joined room with ${existingParticipants.length} participants`
          );
        } else {
          setConnectionStatus("Joined empty room");
        }

        // Add existing participants
        setRemoteParticipants(existingParticipants);

        // Initiate calls to all existing participants
        if (webRTCService.current && localStream) {
          setIsConnecting(true);

          const initCalls = async () => {
            for (const participant of existingParticipants) {
              try {
                await webRTCService.current!.initiateCall(participant.id);
              } catch (err) {
                console.error(
                  `Error initiating call to ${participant.id}:`,
                  err
                );
              }
            }
          };

          initCalls().finally(() => {
            setTimeout(() => setIsConnecting(false), 2000);
          });
        }
      }
    );
  };

  // Update participants list when remote participants change
  useEffect(() => {
    if (!socketService.current) return;

    const socketId = socketService.current.getSocket().id || "local";

    // Create local participant
    const localParticipant: Participant = {
      id: socketId,
      name: username,
      videoUrl: undefined,
      isMuted,
      isVideoOn: localStream
        ? localStream.getVideoTracks().length > 0 && isVideoOn
        : false,
      backgroundColor: "bg-gray-800",
      stream: localStream,
    };

    // Create remote participants
    const remoteParticipantsList = remoteParticipants.map((p) => ({
      id: p.id,
      name: p.username,
      videoUrl: undefined,
      isMuted: false, // We don't know their mute status yet
      isVideoOn: !!p.stream && p.stream.getVideoTracks().length > 0, // Assume they have video if we have their stream
      backgroundColor: "bg-gray-700",
      stream: p.stream,
    }));

    // Combine local and remote participants
    const allParticipants = [localParticipant, ...remoteParticipantsList];

    setParticipants(allParticipants);
  }, [remoteParticipants, localStream, username, isMuted, isVideoOn]);

  // Handle incoming remote streams
  const handleRemoteStream = (stream: MediaStream, peerId: string) => {
    console.log(`Received stream from ${peerId}`);
    setConnectionStatus("Connected to peer");

    setRemoteParticipants((prev) =>
      prev.map((p) =>
        p.id === peerId
          ? {
              ...p,
              stream,
              connectionState: "connected",
            }
          : p
      )
    );
  };

  // Handle remote stream removal
  const handleRemoteStreamRemoved = (peerId: string) => {
    console.log(`Stream removed from ${peerId}`);

    setRemoteParticipants((prev) =>
      prev.map((p) =>
        p.id === peerId
          ? {
              ...p,
              stream: undefined,
              connectionState: "disconnected",
            }
          : p
      )
    );
  };

  const toggleMute = () => {
    if (webRTCService.current && localStream) {
      const newMuteState = !isMuted;
      webRTCService.current.toggleAudio(!newMuteState);
      setIsMuted(newMuteState);
    }
  };

  const toggleVideo = () => {
    if (webRTCService.current && localStream) {
      const newVideoState = !isVideoOn;
      webRTCService.current.toggleVideo(newVideoState);
      setIsVideoOn(newVideoState);
    }
  };

  const toggleFullscreen = () => {
    // If no participant is selected, select the first one when going fullscreen
    if (!selectedParticipantId && participants.length > 0) {
      setSelectedParticipantId(participants[0].id);
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleParticipantClick = (participantId: string) => {
    setSelectedParticipantId(participantId);
  };

  const leaveRoom = () => {
    // Clean up WebRTC connections
    if (webRTCService.current) {
      webRTCService.current.closeAllConnections();
    }

    // Disconnect socket
    socketService.current.disconnect();

    // Clear session storage
    sessionStorage.removeItem("roomId");

    // Navigate back to home
    router.push("/");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setIsCopied(true);

    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const restartConnections = () => {
    if (webRTCService.current) {
      setIsConnecting(true);
      setConnectionStatus("Restarting connections...");

      webRTCService.current.restartAllConnections();

      setTimeout(() => {
        setIsConnecting(false);
        setConnectionStatus("Connections restarted");
      }, 2000);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 sm:p-3 bg-black">
        <div className="flex items-center">
          <div className="h-10 sm:h-12 w-auto flex items-center">
            <Image
              src="/neo-logo.png"
              alt="Neo Logo"
              width={64}
              height={64}
              className="h-10 sm:h-12 w-auto"
            />
            <span className="ml-2 text-white text-lg sm:text-xl font-semibold">
              x Harsingh
            </span>
          </div>
        </div>

        <div className="flex items-center">
          <div className="hidden sm:flex items-center mr-4 bg-gray-800 rounded-md px-2 py-1">
            <span className="text-gray-300 text-sm mr-2">Room: {roomId}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              onClick={copyRoomId}
            >
              {isCopied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>

          <div className="flex items-center mr-2 bg-gray-800 rounded-md px-2 py-1">
            <Users size={16} className="text-gray-300 mr-1" />
            <span className="text-gray-300 text-sm">{participants.length}</span>
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
            <Button
              variant="ghost"
              size={isMobile ? "sm" : "icon"}
              className="text-gray-400 hover:text-white"
              onClick={leaveRoom}
            >
              <X size={isMobile ? 16 : 18} />
            </Button>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="bg-gray-900 text-center py-1">
        <div className="flex items-center justify-center">
          <span className="text-xs text-gray-400">{connectionStatus}</span>
          {isConnecting && (
            <div className="ml-2 animate-spin">
              <RefreshCw size={12} className="text-gray-400" />
            </div>
          )}
          {remoteParticipants.length > 0 && !isConnecting && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-5 text-xs text-gray-400 hover:text-white p-0"
              onClick={restartConnections}
            >
              <RefreshCw size={12} className="mr-1" /> Restart
            </Button>
          )}
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-grow flex items-center justify-center bg-black p-0">
        {isFullscreen && selectedParticipantId ? (
          <div className="relative w-full h-full flex flex-col">
            {/* Main fullscreen video */}
            <div className="flex-grow w-full">
              {participants.find((p) => p.id === selectedParticipantId) && (
                <div className="relative w-full h-full">
                  <VideoGrid
                    participants={[
                      participants.find((p) => p.id === selectedParticipantId)!,
                    ]}
                    isFullscreen={true}
                    onParticipantClick={() => {}}
                    isMobile={isMobile}
                    fillContainer={true}
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
          <div className="w-full h-full flex items-center">
            <VideoGrid
              participants={participants}
              selectedParticipantId={selectedParticipantId}
              onParticipantClick={handleParticipantClick}
              isMobile={isMobile}
              fillContainer={true}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 py-4 bg-black">
        <Button
          onClick={toggleVideo}
          variant="outline"
          size="icon"
          disabled={!localStream || localStream.getVideoTracks().length === 0}
          className={`
            rounded-full border-0
            ${isMobile ? "h-12 w-12" : "h-14 w-14"} 
            ${isVideoOn ? "bg-slate-700" : "bg-slate-800 text-red-500"}
          `}
        >
          {isVideoOn ? (
            <Camera size={isMobile ? 20 : 24} />
          ) : (
            <CameraOff size={isMobile ? 20 : 24} />
          )}
        </Button>

        <Button
          onClick={toggleMute}
          variant="outline"
          size="icon"
          disabled={!localStream || localStream.getAudioTracks().length === 0}
          className={`
            rounded-full border-0
            ${isMobile ? "h-12 w-12" : "h-14 w-14"} 
            ${isMuted ? "bg-slate-800 text-red-500" : "bg-slate-700"}
          `}
        >
          {isMuted ? (
            <MicOff size={isMobile ? 20 : 24} />
          ) : (
            <Mic size={isMobile ? 20 : 24} />
          )}
        </Button>

        <Button
          onClick={leaveRoom}
          variant="outline"
          size="icon"
          className={`
            rounded-full bg-red-600 hover:bg-red-700 text-white border-none
            ${isMobile ? "h-12 w-12" : "h-14 w-14"}
          `}
        >
          <PhoneOff size={isMobile ? 20 : 24} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className={`
            rounded-full bg-slate-700 border-0
            ${isMobile ? "h-12 w-12" : "h-14 w-14"}
          `}
        >
          <MessageCircle size={isMobile ? 20 : 24} />
        </Button>
      </div>
    </div>
  );
}
