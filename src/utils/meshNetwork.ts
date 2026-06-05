/**
 * Mesh Network Module
 * Enables peer-to-peer communication between devices on the same local network
 * using WebRTC Data Channels. Handles chat messages and image uploads offline.
 */

export interface MeshPeer {
  peerId: string;
  username: string;
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  isConnected: boolean;
  lastHeartbeat: number;
}

export interface MeshMessage {
  id: string;
  type: "chat" | "submission" | "sync_request" | "sync_response";
  senderId: string;
  senderUsername: string;
  timestamp: number;
  payload: any;
  receiverId?: string; // For direct messages, null for broadcast
}

export interface MeshSubmission {
  id: string;
  userId: string;
  username: string;
  itemId: string;
  imageUrl: string; // base64 or local blob URL
  imageData?: string; // Large base64 string, chunked for transfer
  status: "pending" | "approved" | "rejected";
  userLat?: number;
  userLng?: number;
  createdAt: string;
  verified?: boolean; // Whether this was verified on a peer device
}

type MessageCallback = (message: MeshMessage) => void;
type PeerCallback = (peer: MeshPeer) => void;
type ErrorCallback = (error: Error) => void;

const CHUNK_SIZE = 16384; // 16KB chunks for large data transfers
const HEARTBEAT_INTERVAL = 5000; // 5 seconds
const HEARTBEAT_TIMEOUT = 15000; // 15 seconds
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

export class MeshNetwork {
  private peers: Map<string, MeshPeer> = new Map();
  private localPeerId: string;
  private username: string;
  private messageCallbacks: MessageCallback[] = [];
  private peerConnectedCallbacks: PeerCallback[] = [];
  private peerDisconnectedCallbacks: PeerCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private signalingServer: WebSocket | null = null;
  private signalingUrl: string;
  private isEnabled: boolean = false;

  constructor(username: string, signalingUrl: string = "ws://localhost:3001") {
    this.localPeerId = `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.username = username;
    this.signalingUrl = signalingUrl;
  }

  /**
   * Initialize the mesh network
   * Uses signaling server to coordinate peer discovery
   */
  async initialize(): Promise<void> {
    try {
      // Try to connect to signaling server for peer discovery
      this.connectToSignalingServer();
      this.isEnabled = true;
      this.startHeartbeat();
    } catch (error) {
      console.warn("[Mesh] Signaling server unavailable, mesh will use local peer discovery only");
      this.isEnabled = true;
      this.startHeartbeat();
    }
  }

  /**
   * Connect to signaling server for peer discovery
   */
  private connectToSignalingServer(): void {
    try {
      // For local development, signaling happens through server WebSocket
      // In production, would need dedicated signaling server
      console.log("[Mesh] Signaling server connection skipped (using server WebSocket for now)");
    } catch (error) {
      console.warn("[Mesh] Failed to connect to signaling server:", error);
    }
  }

  /**
   * Start heartbeat to detect disconnected peers
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const deadPeers: string[] = [];

      this.peers.forEach((peer, peerId) => {
        // Check for dead peers (no activity for HEARTBEAT_TIMEOUT ms)
        if (now - peer.lastHeartbeat > HEARTBEAT_TIMEOUT) {
          deadPeers.push(peerId);
        }
      });

      // Remove dead peers
      deadPeers.forEach(peerId => {
        const peer = this.peers.get(peerId);
        if (peer) {
          this.disconnectPeer(peerId);
          this.peerDisconnectedCallbacks.forEach(cb => cb(peer));
        }
      });
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Create and connect to a peer
   */
  async connectToPeer(remotePeerId: string, remoteUsername: string): Promise<void> {
    if (this.peers.has(remotePeerId)) {
      return; // Already connected
    }

    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: STUN_SERVERS
      });

      const dataChannel = peerConnection.createDataChannel("kinquest-mesh", {
        ordered: true
      });

      const peer: MeshPeer = {
        peerId: remotePeerId,
        username: remoteUsername,
        peerConnection,
        dataChannel,
        isConnected: false,
        lastHeartbeat: Date.now()
      };

      this.setupDataChannel(dataChannel, peer);
      this.setupPeerConnection(peerConnection, peer);

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer to remote peer through signaling (via main WebSocket)
      window.dispatchEvent(new CustomEvent("mesh:offer", {
        detail: {
          to: remotePeerId,
          offer: offer,
          from: this.localPeerId,
          username: this.username
        }
      }));

      this.peers.set(remotePeerId, peer);
    } catch (error) {
      this.errorCallbacks.forEach(cb => cb(
        new Error(`Failed to connect to peer ${remotePeerId}: ${error}`)
      ));
    }
  }

  /**
   * Handle incoming WebRTC offer from remote peer
   */
  async handleOffer(offer: RTCSessionDescriptionInit, remotePeerId: string, remoteUsername: string): Promise<void> {
    try {
      let peer = this.peers.get(remotePeerId);

      if (!peer) {
        const peerConnection = new RTCPeerConnection({
          iceServers: STUN_SERVERS
        });

        peer = {
          peerId: remotePeerId,
          username: remoteUsername,
          peerConnection,
          dataChannel: null,
          isConnected: false,
          lastHeartbeat: Date.now()
        };

        // Listen for data channel from remote
        peerConnection.ondatachannel = (event) => {
          const dataChannel = event.channel;
          peer!.dataChannel = dataChannel;
          this.setupDataChannel(dataChannel, peer!);
        };

        this.setupPeerConnection(peerConnection, peer);
        this.peers.set(remotePeerId, peer);
      }

      // Set remote description
      await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Create answer
      const answer = await peer.peerConnection.createAnswer();
      await peer.peerConnection.setLocalDescription(answer);

      // Send answer back
      window.dispatchEvent(new CustomEvent("mesh:answer", {
        detail: {
          to: remotePeerId,
          answer: answer,
          from: this.localPeerId,
          username: this.username
        }
      }));
    } catch (error) {
      this.errorCallbacks.forEach(cb => cb(
        new Error(`Failed to handle offer from ${remotePeerId}: ${error}`)
      ));
    }
  }

  /**
   * Handle incoming WebRTC answer from remote peer
   */
  async handleAnswer(answer: RTCSessionDescriptionInit, remotePeerId: string): Promise<void> {
    const peer = this.peers.get(remotePeerId);
    if (!peer) {
      console.warn(`[Mesh] Received answer from unknown peer ${remotePeerId}`);
      return;
    }

    try {
      await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      this.errorCallbacks.forEach(cb => cb(
        new Error(`Failed to handle answer from ${remotePeerId}: ${error}`)
      ));
    }
  }

  /**
   * Setup data channel listeners
   */
  private setupDataChannel(dataChannel: RTCDataChannel, peer: MeshPeer): void {
    dataChannel.onopen = () => {
      peer.isConnected = true;
      peer.lastHeartbeat = Date.now();
      console.log(`[Mesh] Data channel opened with peer ${peer.peerId}`);
      this.peerConnectedCallbacks.forEach(cb => cb(peer));
    };

    dataChannel.onclose = () => {
      this.disconnectPeer(peer.peerId);
      this.peerDisconnectedCallbacks.forEach(cb => cb(peer));
    };

    dataChannel.onerror = (event) => {
      console.error(`[Mesh] Data channel error with ${peer.peerId}:`, event);
      this.errorCallbacks.forEach(cb => cb(new Error(`Data channel error: ${event}`)));
    };

    dataChannel.onmessage = (event) => {
      try {
        const message: MeshMessage = JSON.parse(event.data);
        peer.lastHeartbeat = Date.now();

        // Forward message to callbacks
        this.messageCallbacks.forEach(cb => cb(message));
      } catch (error) {
        console.error(`[Mesh] Failed to parse message from ${peer.peerId}:`, error);
      }
    };
  }

  /**
   * Setup peer connection listeners
   */
  private setupPeerConnection(peerConnection: RTCPeerConnection, peer: MeshPeer): void {
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        window.dispatchEvent(new CustomEvent("mesh:ice", {
          detail: {
            to: peer.peerId,
            candidate: event.candidate,
            from: this.localPeerId
          }
        }));
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`[Mesh] Connection state with ${peer.peerId}: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === "failed") {
        this.disconnectPeer(peer.peerId);
      }
    };
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleICECandidate(candidate: RTCIceCandidate, remotePeerId: string): Promise<void> {
    const peer = this.peers.get(remotePeerId);
    if (!peer) {
      console.warn(`[Mesh] Received ICE candidate from unknown peer ${remotePeerId}`);
      return;
    }

    try {
      await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.warn(`[Mesh] Failed to add ICE candidate from ${remotePeerId}:`, error);
    }
  }

  /**
   * Send a mesh message to a specific peer or broadcast to all
   */
  async sendMessage(
    type: "chat" | "submission" | "sync_request" | "sync_response",
    payload: any,
    receiverId?: string
  ): Promise<void> {
    if (!this.isEnabled) {
      throw new Error("Mesh network not initialized");
    }

    const message: MeshMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      senderId: this.localPeerId,
      senderUsername: this.username,
      timestamp: Date.now(),
      payload,
      receiverId
    };

    if (receiverId) {
      // Send to specific peer
      const peer = this.peers.get(receiverId);
      if (peer && peer.dataChannel && peer.dataChannel.readyState === "open") {
        this.sendToDataChannel(peer.dataChannel, message);
      } else {
        throw new Error(`Peer ${receiverId} not connected`);
      }
    } else {
      // Broadcast to all connected peers
      this.peers.forEach(peer => {
        if (peer.dataChannel && peer.dataChannel.readyState === "open") {
          this.sendToDataChannel(peer.dataChannel, message);
        }
      });
    }
  }

  /**
   * Send data through data channel with chunking support for large data
   */
  private sendToDataChannel(dataChannel: RTCDataChannel, message: any): void {
    const payload = JSON.stringify(message);

    // If payload is small, send directly
    if (payload.length <= CHUNK_SIZE) {
      dataChannel.send(payload);
      return;
    }

    // For large payloads, chunk them
    const chunkId = `chunk_${Date.now()}`;
    const totalChunks = Math.ceil(payload.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = payload.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkMessage = {
        type: "chunk",
        chunkId,
        chunkIndex: i,
        totalChunks,
        data: chunk
      };
      dataChannel.send(JSON.stringify(chunkMessage));
    }
  }

  /**
   * Disconnect from a peer
   */
  private disconnectPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (peer.dataChannel) {
        peer.dataChannel.close();
      }
      peer.peerConnection.close();
      this.peers.delete(peerId);
      peer.isConnected = false;
    }
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers(): MeshPeer[] {
    return Array.from(this.peers.values()).filter(p => p.isConnected);
  }

  /**
   * Get peer by ID
   */
  getPeer(peerId: string): MeshPeer | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Get local peer ID
   */
  getLocalPeerId(): string {
    return this.localPeerId;
  }

  /**
   * Register callback for incoming messages
   */
  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Register callback for peer connected
   */
  onPeerConnected(callback: PeerCallback): void {
    this.peerConnectedCallbacks.push(callback);
  }

  /**
   * Register callback for peer disconnected
   */
  onPeerDisconnected(callback: PeerCallback): void {
    this.peerDisconnectedCallbacks.push(callback);
  }

  /**
   * Register callback for errors
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Check if network is enabled
   */
  isNetworkEnabled(): boolean {
    return this.isEnabled && this.getConnectedPeers().length > 0;
  }

  /**
   * Shutdown the mesh network
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.peers.forEach((peer) => {
      this.disconnectPeer(peer.peerId);
    });

    this.peers.clear();
    this.isEnabled = false;

    if (this.signalingServer) {
      this.signalingServer.close();
    }
  }
}
