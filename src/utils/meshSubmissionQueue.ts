/**
 * Mesh Submission Queue
 * Manages offline image submissions and synchronizes with server/peers when available
 */

export interface QueuedSubmission {
  id: string;
  userId: string;
  username: string;
  itemId: string;
  imageBase64: string; // Full base64 data
  userLat?: number;
  userLng?: number;
  forceSubmit?: boolean;
  submissionId?: string;
  createdAt: string;
  status: "queued" | "syncing" | "synced" | "failed";
  attempts: number;
  retryReason?: "rate_limit" | "timeout" | "error";
  nextRetryAt?: string;
  lastAttempt?: string;
  errorMessage?: string;
}

interface LocalStorage {
  submissionQueue: Record<string, QueuedSubmission>;
  syncedSubmissionIds: string[]; // Track which submissions have been synced
}

const DB_NAME = "kinquest_mesh";
const STORE_NAME = "submissions";

export class MeshSubmissionQueue {
  private queue: Map<string, QueuedSubmission> = new Map();
  private db: IDBDatabase | null = null;
  private localStorageKey = "kinquest_submission_queue";
  private maxRetries = 5;
  private retryDelay = 5000; // 5 seconds
  private backoffMultiplier = 2;
  private maxRetryDelay = 300000; // 5 minutes

  /**
   * Initialize the submission queue using IndexedDB with localStorage fallback
   */
  async initialize(): Promise<void> {
    try {
      // Try IndexedDB first (better for large data)
      await this.initializeIndexedDB();
    } catch (error) {
      console.warn("[Queue] IndexedDB failed, using localStorage fallback:", error);
      this.initializeLocalStorage();
    }
  }

  /**
   * Initialize IndexedDB
   */
  private initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    });
  }

  /**
   * Initialize localStorage as fallback
   */
  private initializeLocalStorage(): void {
    const stored = localStorage.getItem(this.localStorageKey);
    if (stored) {
      try {
        const parsed: LocalStorage = JSON.parse(stored);
        Object.values(parsed.submissionQueue).forEach(sub => {
          this.queue.set(sub.id, sub);
        });
      } catch (error) {
        console.warn("[Queue] Failed to parse localStorage:", error);
      }
    }
  }

  /**
   * Add a submission to the queue
   */
  async addSubmission(
    userId: string,
    username: string,
    itemId: string,
    imageBase64: string,
    userLat?: number,
    userLng?: number,
    forceSubmit?: boolean,
    submissionId?: string,
    retryReason?: "rate_limit" | "timeout" | "error",
    errorMessage?: string
  ): Promise<QueuedSubmission> {
    const now = new Date();
    const submission: QueuedSubmission = {
      id: `sub_queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      username,
      itemId,
      imageBase64,
      userLat,
      userLng,
      forceSubmit,
      submissionId,
      createdAt: now.toISOString(),
      status: "queued",
      attempts: 0,
      retryReason,
      nextRetryAt: now.toISOString(),
      errorMessage
    };

    this.queue.set(submission.id, submission);

    // Persist to storage
    if (this.db) {
      await this.saveToIndexedDB(submission);
    } else {
      this.saveToLocalStorage();
    }

    console.log(`[Queue] Added submission ${submission.id} to queue`);
    return submission;
  }

  /**
   * Get all queued submissions
   */
  getQueuedSubmissions(): QueuedSubmission[] {
    return Array.from(this.queue.values()).filter(s => s.status === "queued" || s.status === "failed");
  }

  /**
   * Get submissions that are eligible for retry now
   */
  getRetryableSubmissions(): QueuedSubmission[] {
    const now = new Date();
    return Array.from(this.queue.values()).filter((submission) => {
      if (submission.status !== "queued" && submission.status !== "failed") {
        return false;
      }

      if (submission.attempts >= this.maxRetries) {
        return false;
      }

      if (!submission.nextRetryAt) {
        return true;
      }

      return new Date(submission.nextRetryAt) <= now;
    });
  }

  /**
   * Get submission by ID
   */
  getSubmission(submissionId: string): QueuedSubmission | undefined {
    return this.queue.get(submissionId);
  }

  /**
   * Update submission status
   */
  async updateSubmissionStatus(
    submissionId: string,
    status: "queued" | "syncing" | "synced" | "failed",
    errorMessage?: string
  ): Promise<void> {
    const submission = this.queue.get(submissionId);
    if (!submission) return;

    submission.status = status;
    submission.lastAttempt = new Date().toISOString();
    if (errorMessage) {
      submission.errorMessage = errorMessage;
    }

    if (this.db) {
      await this.saveToIndexedDB(submission);
    } else {
      this.saveToLocalStorage();
    }
  }

  /**
   * Increment retry count for a submission
   */
  async incrementRetryCount(submissionId: string): Promise<boolean> {
    const submission = this.queue.get(submissionId);
    if (!submission) return false;

    submission.attempts++;
    submission.lastAttempt = new Date().toISOString();

    if (submission.attempts >= this.maxRetries) {
      submission.status = "failed";
      submission.errorMessage = `Failed after ${this.maxRetries} retry attempts`;
    } else {
      submission.status = "queued";
      const delay = Math.min(
        this.retryDelay * Math.pow(this.backoffMultiplier, submission.attempts),
        this.maxRetryDelay
      );
      submission.nextRetryAt = new Date(Date.now() + delay).toISOString();
    }

    if (this.db) {
      await this.saveToIndexedDB(submission);
    } else {
      this.saveToLocalStorage();
    }

    return submission.attempts < this.maxRetries;
  }

  /**
   * Mark submission as being retried now
   */
  async markAsRetrying(submissionId: string): Promise<void> {
    const submission = this.queue.get(submissionId);
    if (!submission) return;

    submission.status = "syncing";
    submission.lastAttempt = new Date().toISOString();

    if (this.db) {
      await this.saveToIndexedDB(submission);
    } else {
      this.saveToLocalStorage();
    }
  }

  /**
   * Mark submission as synced with server
   */
  async markAsSynced(submissionId: string): Promise<void> {
    const submission = this.queue.get(submissionId);
    if (!submission) return;

    submission.status = "synced";

    if (this.db) {
      await this.saveToIndexedDB(submission);
    } else {
      this.saveToLocalStorage();
    }
  }

  /**
   * Remove a submission from the queue
   */
  async removeSubmission(submissionId: string): Promise<void> {
    this.queue.delete(submissionId);

    if (this.db) {
      await this.deleteFromIndexedDB(submissionId);
    } else {
      this.saveToLocalStorage();
    }
  }

  /**
   * Get submission sync progress
   */
  getSyncProgress(): {
    total: number;
    synced: number;
    pending: number;
    failed: number;
  } {
    const submissions = Array.from(this.queue.values());
    return {
      total: submissions.length,
      synced: submissions.filter(s => s.status === "synced").length,
      pending: submissions.filter(s => s.status === "queued" || s.status === "syncing").length,
      failed: submissions.filter(s => s.status === "failed").length
    };
  }

  /**
   * Save submission to IndexedDB
   */
  private saveToIndexedDB(submission: QueuedSubmission): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("IndexedDB not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(submission);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Delete submission from IndexedDB
   */
  private deleteFromIndexedDB(submissionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("IndexedDB not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(submissionId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Save to localStorage as backup
   */
  private saveToLocalStorage(): void {
    const data: LocalStorage = {
      submissionQueue: Object.fromEntries(this.queue),
      syncedSubmissionIds: Array.from(this.queue.values())
        .filter(s => s.status === "synced")
        .map(s => s.id)
    };

    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify(data));
    } catch (error) {
      console.error("[Queue] Failed to save to localStorage:", error);
    }
  }

  /**
   * Load all submissions from storage
   */
  async loadAll(): Promise<QueuedSubmission[]> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const submissions = request.result as QueuedSubmission[];
          submissions.forEach(sub => this.queue.set(sub.id, sub));
          resolve(submissions);
        };
      });
    } else {
      return Array.from(this.queue.values());
    }
  }

  /**
   * Clear all submissions from queue
   */
  async clear(): Promise<void> {
    this.queue.clear();

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } else {
      localStorage.removeItem(this.localStorageKey);
    }
  }

  /**
   * Get size of stored data (for monitoring)
   */
  getQueueSizeEstimate(): {
    itemCount: number;
    estimatedBytes: number;
  } {
    let estimatedBytes = 0;
    let itemCount = 0;

    this.queue.forEach(submission => {
      itemCount++;
      // Rough estimate: JSON overhead + base64 data
      estimatedBytes += JSON.stringify(submission).length;
    });

    return { itemCount, estimatedBytes };
  }
}
