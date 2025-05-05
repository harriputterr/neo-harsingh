// PeerService.ts

class PeerService {
   public peer: RTCPeerConnection;
  
    constructor() {
      this.peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:global.stun.twilio.com:3478",
            ],
          },
        ],
      });
    }
  
    /**
     * Take an incoming offer, set it as the remote description,
     * create an answer, set that as your local description, and return it.
     */
    async getAnswer(
      offer: RTCSessionDescriptionInit
    ): Promise<RTCSessionDescriptionInit> {
      await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(new RTCSessionDescription(answer));
      return answer;
    }
  
    /**
     * Apply a remote answer (from the other peer) to your connection.
     */
    async setLocalDescription(
      answer: RTCSessionDescriptionInit
    ): Promise<void> {
      await this.peer.setRemoteDescription(new RTCSessionDescription(answer));
    }
  
    /**
     * Create an offer, set it as your local description, and return it.
     */
    async getOffer(): Promise<RTCSessionDescriptionInit> {
      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(new RTCSessionDescription(offer));
      return offer;
    }
  }
  
  export default new PeerService();
  