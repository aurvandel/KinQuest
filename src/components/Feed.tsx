import React, { useState, useEffect, useRef } from "react";
import { Submission, ScavengerItem } from "../types";
import { CheckCircle2, XCircle, Clock, Trash2, Sparkles, MessageCircle, RefreshCw, Loader2, AlertCircle } from "lucide-react";

interface FeedProps {
  submissions: Submission[];
  items: ScavengerItem[];
  currentUserId: string | null;
  onDeleteSubmission: (subId: string) => void;
  onRetryPending?: (subId: string) => Promise<void>;
  currentUserRole?: "user" | "admin";
}

const ITEMS_PER_PAGE = 10;

export function Feed({ submissions, items, currentUserId, onDeleteSubmission, onRetryPending, currentUserRole }: FeedProps) {
  const [displayLimit, setDisplayLimit] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [retryingMap, setRetryingMap] = useState<{ [key: string]: boolean }>({});
  const endRef = useRef<HTMLDivElement>(null);

  // Sort submissions by newest first
  const sortedSubmissions = [...submissions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Infinite scroll detection using Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayLimit < sortedSubmissions.length) {
          setIsLoadingMore(true);
          // Simulate a small delay for better UX
          setTimeout(() => {
            setDisplayLimit((prev) => Math.min(prev + ITEMS_PER_PAGE, sortedSubmissions.length));
            setIsLoadingMore(false);
          }, 300);
        }
      },
      { threshold: 0.1 }
    );

    if (endRef.current) {
      observer.observe(endRef.current);
    }

    return () => {
      if (endRef.current) {
        observer.unobserve(endRef.current);
      }
    };
  }, [displayLimit, sortedSubmissions.length]);

  // Get only the submissions to display
  const displayedSubmissions = sortedSubmissions.slice(0, displayLimit);

  const handleRetry = async (subId: string) => {
    if (!onRetryPending) return;
    setRetryingMap((prev) => ({ ...prev, [subId]: true }));
    try {
      await onRetryPending(subId);
    } finally {
      setRetryingMap((prev) => ({ ...prev, [subId]: false }));
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Scavenger Live Stream</h2>
          <p className="text-xs text-gray-400">See real-time snapshots approved by the AI Judge</p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin text-amber-500" />
          {submissions.length} Total Uploads {displayLimit < sortedSubmissions.length && `(Showing ${displayLimit})`}
        </span>
      </div>

      {sortedSubmissions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 shadow-sm">
          <Sparkles className="h-8 w-8 mx-auto text-amber-300 opacity-70 mb-3 animate-bounce" />
          <p className="text-sm font-medium text-gray-700">The game board is pristine!</p>
          <p className="text-xs text-gray-400 mt-1">Be the very first explorer to find a target and upload proof!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {displayedSubmissions.map((sub) => {
            const associatedItem = items.find((it) => it.id === sub.itemId);
            const isOwner = sub.userId === currentUserId;

            return (
              <div
                key={sub.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col md:flex-row transition hover:shadow-md"
              >
                {/* Image side */}
                <div className="relative w-full md:w-56 aspect-video md:aspect-square bg-gray-50 shrink-0 flex items-center justify-center">
                  <img
                    src={sub.imageUrl}
                    alt={associatedItem?.title || "Scavenged target"}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {/* Status Overlay Badge */}
                  <div className="absolute top-3 left-3 flex items-center shadow-md">
                    {sub.status === "approved" && sub.forcedApproval && (
                      <span className="bg-violet-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        ⚠️ Force Submitted (+{associatedItem?.points || 0} pts)
                      </span>
                    )}
                    {sub.status === "approved" && !sub.forcedApproval && (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Approved (+{associatedItem?.points || 0} pts)
                      </span>
                    )}
                    {sub.status === "rejected" && (
                      <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Invalid photo
                      </span>
                    )}
                    {sub.status === "pending" && (
                      <span className="bg-amber-400 text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="h-3 w-3 animate-pulse" />
                        Ref Checking...
                      </span>
                    )}
                  </div>
                </div>

                {/* Info side */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {associatedItem ? (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 uppercase px-2 py-0.5 rounded-md tracking-wider">
                            {associatedItem.category}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-50 uppercase px-2 py-0.5 rounded-md tracking-wider">
                            General
                          </span>
                        )}
                        <h3 className="text-sm font-bold text-gray-800 mt-1">
                          {associatedItem?.title || "Discontinued Mission"}
                        </h3>
                      </div>

                      {(isOwner || (currentUserRole === "admin")) && (
                        <button
                          onClick={() => onDeleteSubmission(sub.id)}
                          type="button"
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition"
                          title={isOwner ? "Delete submission" : "Delete submission (Admin)"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 italic">
                      Mission criteria: "{associatedItem?.description}"
                    </p>
                  </div>

                  {/* AI Ref Comment */}
                  <div className="bg-gray-50/70 border border-gray-100/50 rounded-xl p-3 space-y-1.5 shadow-inner">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>AI Referee Log</span>
                    </div>
                    <p className="text-[11.5px] text-gray-600 leading-relaxed font-medium">
                      {sub.status === "pending" ? (
                        <span className="text-gray-400 italic">
                          "I am currently reviewing this photo. Give me a brief second..."
                        </span>
                      ) : (
                        `"${sub.aiExplanation || "Valid proof received. Good job."}"`
                      )}
                    </p>
                    
                    {/* Show retry info for rate-limited submissions */}
                    {sub.status === "pending" && sub.retryReason && (
                      <div className="mt-2 pt-2 border-t border-gray-100/50">
                        <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50/50 p-2 rounded">
                          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold">
                              {sub.retryReason === "rate_limit" ? "Rate Limited" : "Timeout"} (Attempt {(sub.retryCount || 0) + 1})
                            </p>
                            <p className="text-gray-600 text-[10px] mt-0.5">
                              The AI referee is overloaded. Auto-retrying in the background.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Stats & Actions */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-50 pt-3 gap-2">
                    <span className="font-semibold text-gray-600 flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5 text-gray-400" />
                      Submitted by <strong className="text-gray-700 font-bold">{sub.username}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <span>
                        {new Date(sub.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                      
                      {/* Retry button for pending submissions */}
                      {sub.status === "pending" && isOwner && onRetryPending && (
                        <button
                          onClick={() => handleRetry(sub.id)}
                          disabled={retryingMap[sub.id]}
                          type="button"
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 py-1 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          title="Manually trigger retry verification"
                        >
                          {retryingMap[sub.id] ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span className="text-[10px] font-semibold">Retrying...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span className="text-[10px] font-semibold">Retry</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading more indicator */}
          {isLoadingMore && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {displayLimit < sortedSubmissions.length && (
            <div ref={endRef} className="h-4" />
          )}

          {/* End of feed indicator */}
          {displayLimit >= sortedSubmissions.length && sortedSubmissions.length > 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-xs">You've seen all {sortedSubmissions.length} submissions!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
