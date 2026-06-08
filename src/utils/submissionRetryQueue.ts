/**
 * Submission Retry Queue Manager
 * 
 * Handles storing and retrying failed submissions when network conditions improve.
 * Uses localStorage to persist the queue across page reloads.
 */

export interface PendingSubmission {
  id: string;
  userId: string;
  itemId: string;
  reunionId?: string;
  imageBase64: string;
  userLat: number | null;
  userLng: number | null;
  forceSubmit?: boolean;
  submissionId?: string;
  
  // Retry tracking
  retryCount: number;
  lastAttemptAt: string; // ISO timestamp
  nextRetryAt: string; // ISO timestamp when to retry next
  reason: "rate_limit" | "timeout" | "error"; // Why it failed
  lastError: string; // Last error message
}

const RETRY_QUEUE_KEY = "kinquest_submission_retry_queue";
const RETRY_CONFIG = {
  initialDelayMs: 5000, // 5 seconds for first retry
  maxDelayMs: 300000, // 5 minutes max between retries
  backoffMultiplier: 2, // Exponential backoff
  maxRetries: 15, // Try up to 15 times
  autoRetryIntervalMs: 10000, // Check queue every 10 seconds
};

/**
 * Get all pending submissions from queue
 */
export function getPendingSubmissions(): PendingSubmission[] {
  try {
    const data = localStorage.getItem(RETRY_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Failed to read retry queue:", err);
    return [];
  }
}

/**
 * Get submissions ready to retry now
 */
export function getRetryableSubmissions(): PendingSubmission[] {
  const now = new Date();
  return getPendingSubmissions().filter((sub) => {
    const nextRetry = new Date(sub.nextRetryAt);
    return nextRetry <= now && sub.retryCount < RETRY_CONFIG.maxRetries;
  });
}

/**
 * Add a failed submission to the retry queue
 */
export function addToRetryQueue(
  userId: string,
  itemId: string,
  imageBase64: string,
  userLat: number | null,
  userLng: number | null,
  reason: "rate_limit" | "timeout" | "error",
  lastError: string,
  forceSubmit?: boolean,
  submissionId?: string,
  reunionId?: string
): PendingSubmission {
  const now = new Date();
  const submission: PendingSubmission = {
    id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    itemId,
    reunionId,
    imageBase64,
    userLat,
    userLng,
    forceSubmit,
    submissionId,
    retryCount: 0,
    lastAttemptAt: now.toISOString(),
    nextRetryAt: new Date(now.getTime() + RETRY_CONFIG.initialDelayMs).toISOString(),
    reason,
    lastError,
  };

  const queue = getPendingSubmissions();
  queue.push(submission);
  saveRetryQueue(queue);

  console.log(
    `[RetryQueue] Added submission to queue (${queue.length} total pending). Reason: ${reason}`
  );

  return submission;
}

/**
 * Update a submission in the retry queue (e.g., after a retry attempt)
 */
export function updateInRetryQueue(subId: string, updates: Partial<PendingSubmission>): void {
  const queue = getPendingSubmissions();
  const index = queue.findIndex((s) => s.id === subId);

  if (index !== -1) {
    queue[index] = { ...queue[index], ...updates };
    saveRetryQueue(queue);
  }
}

/**
 * Remove a submission from the retry queue (success or max retries)
 */
export function removeFromRetryQueue(subId: string): void {
  const queue = getPendingSubmissions().filter((s) => s.id !== subId);
  saveRetryQueue(queue);
  console.log(`[RetryQueue] Removed submission ${subId}. Queue size: ${queue.length}`);
}

/**
 * Clear the entire retry queue
 */
export function clearRetryQueue(): void {
  localStorage.removeItem(RETRY_QUEUE_KEY);
  console.log("[RetryQueue] Queue cleared");
}

/**
 * Calculate the next retry time with exponential backoff
 */
export function calculateNextRetryTime(retryCount: number): Date {
  const now = new Date();
  let delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
  delay = Math.min(delay, RETRY_CONFIG.maxDelayMs); // Cap at max delay
  return new Date(now.getTime() + delay);
}

/**
 * Mark a submission as being retried and update next retry time
 */
export function markAsRetrying(subId: string): void {
  const queue = getPendingSubmissions();
  const index = queue.findIndex((s) => s.id === subId);

  if (index !== -1) {
    const sub = queue[index];
    sub.retryCount += 1;
    sub.lastAttemptAt = new Date().toISOString();
    sub.nextRetryAt = calculateNextRetryTime(sub.retryCount).toISOString();
    saveRetryQueue(queue);

    console.log(
      `[RetryQueue] Retrying submission ${subId} (attempt ${sub.retryCount}). Next retry: ${new Date(sub.nextRetryAt).toLocaleTimeString()}`
    );
  }
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  total: number;
  retryable: number;
  oldestSubmissionAge: number | null; // ms
} {
  const queue = getPendingSubmissions();
  const retryable = getRetryableSubmissions();

  let oldestAge = null;
  if (queue.length > 0) {
    const oldest = new Date(
      Math.min(...queue.map((s) => new Date(s.lastAttemptAt).getTime()))
    );
    oldestAge = new Date().getTime() - oldest.getTime();
  }

  return {
    total: queue.length,
    retryable: retryable.length,
    oldestSubmissionAge: oldestAge,
  };
}

/**
 * Private: Save queue to localStorage
 */
function saveRetryQueue(queue: PendingSubmission[]): void {
  try {
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to save retry queue:", err);
  }
}

/**
 * Get human-readable status of the retry queue
 */
export function getQueueStatusText(): string {
  const stats = getQueueStats();
  if (stats.total === 0) {
    return "All submissions synced ✓";
  }

  const retryable = stats.retryable > 0 ? ` (${stats.retryable} ready to retry)` : "";
  const ageMinutes = stats.oldestSubmissionAge
    ? Math.floor(stats.oldestSubmissionAge / 1000 / 60)
    : 0;

  return `${stats.total} pending submission${stats.total !== 1 ? "s" : ""} - waiting ${ageMinutes}m${retryable}`;
}
