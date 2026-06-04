import React, { useState } from "react";
import { Submission, ScavengerItem, PlayerProfile } from "../types";
import { CheckCircle, XCircle, AlertCircle, MapPin, User, Zap, Filter } from "lucide-react";

interface PhotoApprovalPanelProps {
  submissions: Submission[];
  items: ScavengerItem[];
  players: PlayerProfile[];
  onApprove: (subId: string, points?: number) => Promise<void>;
  onReject: (subId: string) => Promise<void>;
}

export const PhotoApprovalPanel: React.FC<PhotoApprovalPanelProps> = ({
  submissions,
  items,
  players,
  onApprove,
  onReject,
}) => {
  const [filter, setFilter] = useState<"all" | "pending" | "forced">("all");
  const [approving, setApproving] = useState<{ [key: string]: boolean }>({});
  const [rejecting, setRejecting] = useState<{ [key: string]: boolean }>({});
  const [pointsModal, setPointsModal] = useState<{ visible: boolean; subId: string; points: number } | null>(null);

  // Filter submissions - exclude approved ones from the panel
  const filteredSubmissions = submissions.filter((sub) => {
    if (sub.status === "approved") return false; // Remove approved submissions from panel
    if (filter === "pending") return sub.status === "pending";
    if (filter === "forced") return sub.forcedApproval === true;
    return true;
  });

  const getItemTitle = (itemId: string) => {
    return items.find((item) => item.id === itemId)?.title || "Unknown Mission";
  };

  const getPlayerName = (userId: string) => {
    return players.find((p) => p.id === userId)?.displayName || players.find((p) => p.id === userId)?.username || "Unknown Player";
  };

  const handleApprove = (subId: string) => {
    const submission = submissions.find((s) => s.id === subId);
    if (!submission) return;
    
    const item = items.find((i) => i.id === submission.itemId);
    const maxPoints = item?.points || 0;
    const defaultPoints = submission.pointsAwarded || maxPoints;
    
    setPointsModal({ visible: true, subId, points: defaultPoints });
  };

  const handleConfirmApprove = async () => {
    if (!pointsModal) return;
    
    setApproving((prev) => ({ ...prev, [pointsModal.subId]: true }));
    try {
      await onApprove(pointsModal.subId, pointsModal.points);
      setPointsModal(null);
    } finally {
      setApproving((prev) => ({ ...prev, [pointsModal.subId]: false }));
    }
  };

  const handleReject = async (subId: string) => {
    setRejecting((prev) => ({ ...prev, [subId]: true }));
    try {
      await onReject(subId);
    } finally {
      setRejecting((prev) => ({ ...prev, [subId]: false }));
    }
  };

  if (filteredSubmissions.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-brand-border shadow-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-[#5a5a40] mb-2">All Caught Up!</h3>
        <p className="text-sm text-[#8c8c82]">
          {filter === "pending"
            ? "No pending submissions to review."
            : filter === "forced"
              ? "No force-approved submissions."
              : "No submissions to review."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            filter === "all"
              ? "bg-[#5a5a40] text-white"
              : "bg-white text-[#5a5a40] border border-brand-border hover:bg-[#f5f5f0]"
          }`}
        >
          All ({submissions.length})
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
            filter === "pending"
              ? "bg-[#5a5a40] text-white"
              : "bg-white text-[#5a5a40] border border-brand-border hover:bg-[#f5f5f0]"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Pending ({submissions.filter((s) => s.status === "pending").length})
        </button>
        <button
          onClick={() => setFilter("forced")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
            filter === "forced"
              ? "bg-[#5a5a40] text-white"
              : "bg-white text-[#5a5a40] border border-brand-border hover:bg-[#f5f5f0]"
          }`}
        >
          <Zap className="h-4 w-4" />
          Force-Approved ({submissions.filter((s) => s.forcedApproval).length})
        </button>
      </div>

      {/* Submission Cards */}
      <div className="grid gap-4">
        {filteredSubmissions.map((submission) => (
          <div
            key={submission.id}
            className="bg-white border border-brand-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
          >
            <div className="flex flex-col md:flex-row gap-4 p-4">
              {/* Image */}
              <div className="md:w-48 h-40 md:h-40 flex-shrink-0">
                <img
                  src={submission.imageUrl}
                  alt={`Submission ${submission.id}`}
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23ddd' viewBox='0 0 100 100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3C/svg%3E";
                  }}
                />
              </div>

              {/* Details */}
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  {/* Mission Title */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Mission</p>
                    <p className="text-base font-bold text-[#5a5a40]">{getItemTitle(submission.itemId)}</p>
                  </div>

                  {/* Player Info */}
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-brand-muted" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Submitted by</p>
                      <p className="text-sm font-semibold text-[#5a5a40]">{getPlayerName(submission.userId)}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {submission.status === "pending" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                        <AlertCircle className="h-3 w-3" />
                        Pending Review
                      </span>
                    )}
                    {submission.status === "approved" && submission.forcedApproval && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                        <Zap className="h-3 w-3" />
                        Admin Approved
                      </span>
                    )}
                    {submission.status === "approved" && !submission.forcedApproval && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                        <CheckCircle className="h-3 w-3" />
                        AI Approved
                      </span>
                    )}
                    {submission.status === "rejected" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                        <XCircle className="h-3 w-3" />
                        Rejected
                      </span>
                    )}
                  </div>

                  {/* AI Explanation */}
                  {submission.aiExplanation && (
                    <div className="p-3 bg-[#f5f5f0] rounded-xl border border-brand-border/50">
                      <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider mb-1">AI Feedback</p>
                      <p className="text-xs text-[#5a5a40] leading-relaxed">{submission.aiExplanation}</p>
                    </div>
                  )}

                  {/* Location */}
                  {submission.userLat && submission.userLng && (
                    <div className="flex items-start gap-2 text-xs">
                      <MapPin className="h-4 w-4 text-brand-muted mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Location</p>
                        <p className="text-[#5a5a40] font-mono">
                          {submission.userLat.toFixed(4)}, {submission.userLng.toFixed(4)}
                        </p>
                        {submission.distanceMeters !== null && submission.distanceMeters !== undefined && (
                          <p className="text-brand-muted text-[10px]">{submission.distanceMeters.toFixed(0)}m away</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons - always show for admin review */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleApprove(submission.id)}
                    disabled={approving[submission.id]}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {approving[submission.id] ? "Approving..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleReject(submission.id)}
                    disabled={rejecting[submission.id]}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    {rejecting[submission.id] ? "Rejecting..." : "Reject"}
                  </button>
                </div>

                {/* Status timestamp */}
                {submission.status !== "pending" && (
                  <div className="mt-2 text-xs text-[#8c8c82]">
                    <p>
                      {submission.status === "approved" ? "✓ Approved" : "✗ Rejected"} on{" "}
                      {new Date(submission.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Points Adjustment Modal */}
      {pointsModal?.visible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl">
            <h2 className="text-xl font-bold text-[#5a5a40] mb-2">Adjust Points</h2>
            <p className="text-sm text-[#8c8c82] mb-6">
              Set the points to award for this submission. This will be recorded as a manual admin approval.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#5a5a40] mb-2">Points to Award</label>
              <input
                type="number"
                min="0"
                value={pointsModal.points}
                onChange={(e) =>
                  setPointsModal({ ...pointsModal, points: Math.max(0, Number(e.target.value)) })
                }
                className="w-full px-4 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5a5a40]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPointsModal(null)}
                className="flex-1 px-4 py-2 border border-brand-border rounded-lg text-[#5a5a40] font-bold hover:bg-[#f5f5f0] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                disabled={approving[pointsModal.subId]}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition disabled:opacity-50"
              >
                {approving[pointsModal.subId] ? "Approving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
