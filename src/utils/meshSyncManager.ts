/**
 * Mesh Sync Manager
 * Handles synchronization of offline data (submissions, messages) with server
 * when internet connection is restored
 */

import { MeshSubmissionQueue, QueuedSubmission } from "./meshSubmissionQueue";
import { MeshNetwork } from "./meshNetwork";

export interface SyncResult {
  submissionId: string;
  success: boolean;
  serverId?: string; // Server-assigned ID
  error?: string;
  pointsAwarded?: number;
}

interface SyncQueue {
  submissions: QueuedSubmission[];
  timestamp: number;
  completed: number;
  failed: number;
}

type SyncProgressCallback = (progress: SyncQueue) => void;
type SyncCompleteCallback = (results: SyncResult[]) => void;
type SyncErrorCallback = (error: Error) => void;

export class MeshSyncManager {
  private submissionQueue: MeshSubmissionQueue;
  private meshNetwork: MeshNetwork | null;
  private syncProgressCallbacks: SyncProgressCallback[] = [];
  private syncCompleteCallbacks: SyncCompleteCallback[] = [];
  private syncErrorCallbacks: SyncErrorCallback[] = [];
  private isSyncing = false;
  private syncCheckInterval: NodeJS.Timeout | null = null;
  private lastSyncTime = 0;
  private minSyncInterval = 10000; // Don't sync more than every 10 seconds

  constructor(submissionQueue: MeshSubmissionQueue, meshNetwork?: MeshNetwork) {
    this.submissionQueue = submissionQueue;
    this.meshNetwork = meshNetwork || null;
  }

  /**
   * Initialize sync manager and setup auto-sync on connectivity changes
   */
  async initialize(): Promise<void> {
    // Monitor online/offline status
    window.addEventListener("online", () => this.handleOnline());
    window.addEventListener("offline", () => this.handleOffline());

    // Periodic sync check
    this.syncCheckInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncOfflineData();
      }
    }, 30000); // Check every 30 seconds

    console.log("[SyncManager] Initialized");
  }

  /**
   * Handle when device comes online
   */
  private async handleOnline(): Promise<void> {
    console.log("[SyncManager] Device is online, starting sync...");
    await this.syncOfflineData();
  }

  /**
   * Handle when device goes offline
   */
  private handleOffline(): void {
    console.log("[SyncManager] Device is offline, pausing sync");
  }

  /**
   * Sync all offline submissions with server
   */
  async syncOfflineData(): Promise<void> {
    // Don't sync too frequently
    if (Date.now() - this.lastSyncTime < this.minSyncInterval) {
      return;
    }

    if (this.isSyncing) {
      return;
    }

    if (!navigator.onLine) {
      console.log("[SyncManager] No internet connection, cannot sync");
      return;
    }

    this.isSyncing = true;
    this.lastSyncTime = Date.now();

    try {
      const pendingSubmissions = this.submissionQueue.getRetryableSubmissions();

      if (pendingSubmissions.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncManager] Syncing ${pendingSubmissions.length} submissions...`);

      const results: SyncResult[] = [];
      let completed = 0;
      let failed = 0;

      for (const submission of pendingSubmissions) {
        try {
          await this.submissionQueue.markAsRetrying(submission.id);

          const result = await this.syncSubmissionToServer(submission);

          if (result.success) {
            await this.submissionQueue.markAsSynced(submission.id);
            completed++;
          } else {
            const canRetry = await this.submissionQueue.incrementRetryCount(submission.id);
            if (!canRetry) {
              failed++;
            }
          }

          results.push(result);

          // Notify progress
          this.notifyProgress({
            submissions: pendingSubmissions,
            timestamp: Date.now(),
            completed,
            failed
          });

          // Small delay between submissions to avoid overloading server
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`[SyncManager] Error syncing submission ${submission.id}:`, error);
          await this.submissionQueue.updateSubmissionStatus(
            submission.id,
            "queued",
            error instanceof Error ? error.message : "Unknown error"
          );
          await this.submissionQueue.incrementRetryCount(submission.id);
          failed++;
          results.push({
            submissionId: submission.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      // Notify completion
      this.notifyComplete(results);

      console.log(`[SyncManager] Sync complete: ${completed} succeeded, ${failed} failed`);
    } catch (error) {
      console.error("[SyncManager] Sync failed:", error);
      this.notifyError(
        error instanceof Error ? error : new Error("Unknown sync error")
      );
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single submission to server
   */
  private async syncSubmissionToServer(submission: QueuedSubmission): Promise<SyncResult> {
    try {
      const response = await fetch("/api/verify-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: submission.userId,
          itemId: submission.itemId,
          imageBase64: submission.imageBase64,
          userLat: submission.userLat,
          userLng: submission.userLng,
          forceSubmit: submission.forceSubmit,
          submissionId: submission.submissionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server rejected submission");
      }

      const data = await response.json();

      return {
        submissionId: submission.id,
        success: true,
        serverId: data.submission?.id,
        pointsAwarded: data.submission?.pointsAwarded
      };
    } catch (error) {
      return {
        submissionId: submission.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Sync a submission through mesh network to another peer
   * (for peer-to-peer approval/verification)
   */
  async syncSubmissionToPeer(submission: QueuedSubmission, peerId: string): Promise<SyncResult> {
    if (!this.meshNetwork) {
      return {
        submissionId: submission.id,
        success: false,
        error: "Mesh network not available"
      };
    }

    try {
      await this.meshNetwork.sendMessage("submission", submission, peerId);

      return {
        submissionId: submission.id,
        success: true
      };
    } catch (error) {
      return {
        submissionId: submission.id,
        success: false,
        error: error instanceof Error ? error.message : "Mesh send failed"
      };
    }
  }

  /**
   * Request sync from connected peers
   * (useful when device comes online after being offline)
   */
  async requestPeerSync(): Promise<void> {
    if (!this.meshNetwork) return;

    try {
      const peers = this.meshNetwork.getConnectedPeers();

      for (const peer of peers) {
        await this.meshNetwork.sendMessage("sync_request", {
          requestedAt: new Date().toISOString()
        }, peer.peerId);
      }
    } catch (error) {
      console.warn("[SyncManager] Failed to request peer sync:", error);
    }
  }

  /**
   * Handle incoming submission from mesh peer
   */
  async handlePeerSubmission(submission: QueuedSubmission): Promise<void> {
    // Merge or de-duplicate with existing submissions
    const existing = this.submissionQueue.getSubmission(submission.id);

    if (!existing) {
      // New submission from peer, add to queue
      await this.submissionQueue.addSubmission(
        submission.userId,
        submission.username,
        submission.itemId,
        submission.imageBase64,
        submission.userLat,
        submission.userLng
      );

      console.log(`[SyncManager] Received submission ${submission.id} from peer`);

      // Attempt immediate sync if online
      if (navigator.onLine) {
        await this.syncOfflineData();
      }
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): {
    isSyncing: boolean;
    lastSyncTime: number;
    pendingCount: number;
    failedCount: number;
  } {
    const progress = this.submissionQueue.getSyncProgress();

    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingCount: progress.pending,
      failedCount: progress.failed
    };
  }

  /**
   * Register callback for sync progress
   */
  onSyncProgress(callback: SyncProgressCallback): void {
    this.syncProgressCallbacks.push(callback);
  }

  /**
   * Register callback for sync complete
   */
  onSyncComplete(callback: SyncCompleteCallback): void {
    this.syncCompleteCallbacks.push(callback);
  }

  /**
   * Register callback for sync errors
   */
  onSyncError(callback: SyncErrorCallback): void {
    this.syncErrorCallbacks.push(callback);
  }

  /**
   * Notify progress listeners
   */
  private notifyProgress(progress: SyncQueue): void {
    this.syncProgressCallbacks.forEach(cb => {
      try {
        cb(progress);
      } catch (error) {
        console.error("[SyncManager] Progress callback error:", error);
      }
    });
  }

  /**
   * Notify complete listeners
   */
  private notifyComplete(results: SyncResult[]): void {
    this.syncCompleteCallbacks.forEach(cb => {
      try {
        cb(results);
      } catch (error) {
        console.error("[SyncManager] Complete callback error:", error);
      }
    });
  }

  /**
   * Notify error listeners
   */
  private notifyError(error: Error): void {
    this.syncErrorCallbacks.forEach(cb => {
      try {
        cb(error);
      } catch (err) {
        console.error("[SyncManager] Error callback error:", err);
      }
    });
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.syncCheckInterval) {
      clearInterval(this.syncCheckInterval);
    }

    this.syncProgressCallbacks = [];
    this.syncCompleteCallbacks = [];
    this.syncErrorCallbacks = [];
  }

  /**
   * Force sync immediately
   */
  async forceSync(): Promise<void> {
    this.lastSyncTime = 0; // Reset the throttle
    await this.syncOfflineData();
  }

  /**
   * Get detailed sync report
   */
  async getSyncReport(): Promise<{
    queueSize: { itemCount: number; estimatedBytes: number };
    syncProgress: { total: number; synced: number; pending: number; failed: number };
    status: {
      isSyncing: boolean;
      lastSyncTime: number;
      pendingCount: number;
      failedCount: number;
    };
    submissions: QueuedSubmission[];
  }> {
    return {
      queueSize: this.submissionQueue.getQueueSizeEstimate(),
      syncProgress: this.submissionQueue.getSyncProgress(),
      status: this.getSyncStatus(),
      submissions: this.submissionQueue.getQueuedSubmissions()
    };
  }
}
