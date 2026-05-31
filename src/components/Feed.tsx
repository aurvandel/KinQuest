import { Submission, ScavengerItem } from "../types";
import { CheckCircle2, XCircle, Clock, Trash2, Sparkles, MessageCircle, RefreshCw } from "lucide-react";

interface FeedProps {
  submissions: Submission[];
  items: ScavengerItem[];
  currentUserId: string | null;
  onDeleteSubmission: (subId: string) => void;
}

export function Feed({ submissions, items, currentUserId, onDeleteSubmission }: FeedProps) {
  // Sort submissions by newest first
  const sortedSubmissions = [...submissions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Scavenger Live Stream</h2>
          <p className="text-xs text-gray-400">See real-time snapshots approved by the AI Judge</p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin text-amber-500" />
          {submissions.length} Total Uploads
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
          {sortedSubmissions.map((sub) => {
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
                    {sub.status === "approved" && (
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

                      {isOwner && (
                        <button
                          onClick={() => onDeleteSubmission(sub.id)}
                          type="button"
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition"
                          title="Delete submission"
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
                  </div>

                  {/* Footer Stats */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-50 pt-3">
                    <span className="font-semibold text-gray-600 flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5 text-gray-400" />
                      Submitted by <strong className="text-gray-700 font-bold">{sub.username}</strong>
                    </span>
                    <span>
                      {new Date(sub.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
