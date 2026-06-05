/**
 * React Hook for Mesh Network
 * Provides easy integration of mesh networking into React components
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { MeshNetwork, MeshMessage, MeshPeer } from "./meshNetwork";
import { MeshSubmissionQueue, QueuedSubmission } from "./meshSubmissionQueue";
import { MeshSyncManager, SyncResult } from "./meshSyncManager";

export interface UseMeshNetworkOptions {
  username: string;
  enabled?: boolean;
  onMessage?: (message: MeshMessage) => void;
  onPeerConnected?: (peer: MeshPeer) => void;
  onPeerDisconnected?: (peer: MeshPeer) => void;
  onSyncProgress?: (progress: any) => void;
  onSyncComplete?: (results: SyncResult[]) => void;
  onSyncError?: (error: Error) => void;
}

export function useMeshNetwork(options: UseMeshNetworkOptions) {
  const meshNetworkRef = useRef<MeshNetwork | null>(null);
  const submissionQueueRef = useRef<MeshSubmissionQueue | null>(null);
  const syncManagerRef = useRef<MeshSyncManager | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<MeshPeer[]>([]);
  const [meshEnabled, setMeshEnabled] = useState(options.enabled !== false);
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    lastSyncTime: 0,
    pendingCount: 0,
    failedCount: 0
  });

  // Initialize mesh network on mount
  useEffect(() => {
    if (!meshEnabled) return;

    const initializeMesh = async () => {
      try {
        // Initialize mesh network
        const meshNetwork = new MeshNetwork(options.username);
        await meshNetwork.initialize();
        meshNetworkRef.current = meshNetwork;

        // Initialize submission queue
        const submissionQueue = new MeshSubmissionQueue();
        await submissionQueue.initialize();
        submissionQueueRef.current = submissionQueue;

        // Initialize sync manager
        const syncManager = new MeshSyncManager(submissionQueue, meshNetwork);
        await syncManager.initialize();
        syncManagerRef.current = syncManager;

        // Setup event listeners
        meshNetwork.onMessage((msg) => {
          options.onMessage?.(msg);
        });

        meshNetwork.onPeerConnected((peer) => {
          setConnectedPeers(prev => [...prev, peer]);
          options.onPeerConnected?.(peer);
        });

        meshNetwork.onPeerDisconnected((peer) => {
          setConnectedPeers(prev => prev.filter(p => p.peerId !== peer.peerId));
          options.onPeerDisconnected?.(peer);
        });

        syncManager.onSyncProgress((progress) => {
          setSyncStatus({
            isSyncing: true,
            lastSyncTime: progress.timestamp,
            pendingCount: progress.submissions.length - progress.completed,
            failedCount: progress.failed
          });
          options.onSyncProgress?.(progress);
        });

        syncManager.onSyncComplete((results) => {
          setSyncStatus({
            isSyncing: false,
            lastSyncTime: Date.now(),
            pendingCount: results.filter(r => !r.success).length,
            failedCount: 0
          });
          options.onSyncComplete?.(results);
        });

        syncManager.onSyncError((error) => {
          options.onSyncError?.(error);
        });

        setIsInitialized(true);
        console.log("[Mesh Hook] Initialized successfully");
      } catch (error) {
        console.error("[Mesh Hook] Initialization failed:", error);
        setMeshEnabled(false);
      }
    };

    initializeMesh();

    return () => {
      meshNetworkRef.current?.shutdown();
      syncManagerRef.current?.shutdown();
    };
  }, [meshEnabled, options]);

  // Update sync status periodically
  useEffect(() => {
    if (!isInitialized || !syncManagerRef.current) return;

    const interval = setInterval(() => {
      const status = syncManagerRef.current!.getSyncStatus();
      setSyncStatus(status);
    }, 5000);

    return () => clearInterval(interval);
  }, [isInitialized]);

  // Send mesh message
  const sendMessage = useCallback(
    async (
      type: "chat" | "submission" | "sync_request" | "sync_response",
      payload: any,
      receiverId?: string
    ) => {
      if (!meshNetworkRef.current) {
        throw new Error("Mesh network not initialized");
      }
      return meshNetworkRef.current.sendMessage(type, payload, receiverId);
    },
    []
  );

  // Queue a submission
  const queueSubmission = useCallback(
    async (
      userId: string,
      username: string,
      itemId: string,
      imageBase64: string,
      userLat?: number,
      userLng?: number
    ) => {
      if (!submissionQueueRef.current) {
        throw new Error("Submission queue not initialized");
      }
      return submissionQueueRef.current.addSubmission(
        userId,
        username,
        itemId,
        imageBase64,
        userLat,
        userLng
      );
    },
    []
  );

  // Get queued submissions
  const getQueuedSubmissions = useCallback(() => {
    return submissionQueueRef.current?.getQueuedSubmissions() || [];
  }, []);

  // Manually sync submissions
  const manualSync = useCallback(async () => {
    if (!syncManagerRef.current) {
      throw new Error("Sync manager not initialized");
    }
    return syncManagerRef.current.forceSync();
  }, []);

  // Get sync report
  const getSyncReport = useCallback(async () => {
    if (!syncManagerRef.current) {
      throw new Error("Sync manager not initialized");
    }
    return syncManagerRef.current.getSyncReport();
  }, []);

  // Connect to a peer
  const connectToPeer = useCallback(
    async (peerId: string, username: string) => {
      if (!meshNetworkRef.current) {
        throw new Error("Mesh network not initialized");
      }
      return meshNetworkRef.current.connectToPeer(peerId, username);
    },
    []
  );

  // Get connected peers
  const getPeers = useCallback(() => {
    return meshNetworkRef.current?.getConnectedPeers() || [];
  }, [connectedPeers]); // Include connectedPeers in dependency to trigger updates

  // Check if mesh is enabled
  const isNetworkEnabled = useCallback(() => {
    return meshNetworkRef.current?.isNetworkEnabled() || false;
  }, [connectedPeers]);

  return {
    isInitialized,
    meshEnabled,
    setMeshEnabled,
    connectedPeers,
    syncStatus,
    sendMessage,
    queueSubmission,
    getQueuedSubmissions,
    manualSync,
    getSyncReport,
    connectToPeer,
    getPeers,
    isNetworkEnabled
  };
}
