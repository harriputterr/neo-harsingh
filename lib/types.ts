export interface UserJoinedPayload {
    id: string
    username: string
  }
  
  export interface RoomJoinedPayload {
    roomId: string
    participants: Array<{
      id: string
      username: string
    }>
  }
  
  export interface UserLeftPayload {
    id: string
    username: string
  }
  
  export interface RoomErrorPayload {
    message: string
  }
  
  export interface RoomCreatedPayload {
    roomId: string
    username: string
  }
  
  export interface SignalingPayload {
    target: string
    sender: string
    offer?: RTCSessionDescriptionInit
    answer?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidateInit
  }
  