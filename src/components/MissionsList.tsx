import React, { useState } from "react";
import { ScavengerItem, Submission } from "../types";
import { DynamicIcon } from "./DynamicIcon";
import { CameraCapture } from "./CameraCapture";
import { EditMissionModal } from "./EditMissionModal";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  ArrowRight,
  MapPin,
  PlusCircle,
  Send,
  HelpCircle,
  Compass,
  Zap,
  Check,
  Trash2,
  AlertCircle,
  Edit2
} from "lucide-react";

interface MissionsListProps {
  items: ScavengerItem[];
  submissions: Submission[];
  currentUserId: string;
  currentUserRole: "user" | "admin";
  onUploadSubmission: (itemId: string, base64Image: string) => Promise<void>;
  isSubmittingMap: { [itemId: string]: boolean };
  submitErrorMap: { [itemId: string]: string | null };
  rejectedSubmissionMap?: { [itemId: string]: { explanation: string; base64: string } };
  onForceSubmit?: (itemId: string) => void;
  userLat: number | null;
  userLng: number | null;
  onAddChallenge?: (newChallenge: Omit<ScavengerItem, "id">) => Promise<void>;
  onDeleteMission?: (itemId: string) => Promise<void>;
  onEditMission?: (itemId: string, updates: Partial<ScavengerItem>) => Promise<void>;
  onShowCreateModal?: () => void;
}

export function MissionsList({
  items,
  submissions,
  currentUserId,
  currentUserRole,
  onUploadSubmission,
  isSubmittingMap,
  submitErrorMap,
  rejectedSubmissionMap,
  onForceSubmit,
  userLat,
  userLng,
  onAddChallenge,
  onDeleteMission,
  onEditMission,
  onShowCreateModal
}: MissionsListProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [tempImageMap, setTempImageMap] = useState<{ [itemId: string]: string }>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ScavengerItem | null>(null);

  const categories = ["All", ...Array.from(new Set(items.map((item) => item.category)))];

  const filteredItems =
    selectedCategory === "All"
      ? items
      : items.filter((item) => item.category === selectedCategory);

  const getMissionStatus = (itemId: string) => {
    const itemSubmissions = submissions.filter((sub) => sub.itemId === itemId && sub.userId === currentUserId);
    if (itemSubmissions.some((sub) => sub.status === "approved")) {
      return { status: "approved", score: itemSubmissions.find((s) => s.status === "approved") };
    }
    if (itemSubmissions.some((sub) => sub.status === "pending")) {
      return { status: "pending", score: itemSubmissions.find((s) => s.status === "pending") };
    }
    if (itemSubmissions.some((sub) => sub.status === "rejected")) {
      return { status: "rejected", score: itemSubmissions.find((s) => s.status === "rejected") };
    }
    return { status: "open", score: null };
  };

  const handleToggleExpand = (itemId: string) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  const handleImageSelected = (itemId: string, base64: string) => {
    setTempImageMap((prev) => ({ ...prev, [itemId]: base64 }));
  };

  const handleTriggerUpload = async (itemId: string) => {
    const base64 = tempImageMap[itemId];
    if (!base64) return;
    await onUploadSubmission(itemId, base64);
    setTempImageMap((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  // Helper distance solver
  const getProximityText = (item: ScavengerItem) => {
    if (item.lat === null || item.lng === null || item.lat === undefined || item.lng === undefined) {
      return { text: "Anywhere Challenge (No Geofence)", inRange: true, distance: null };
    }
    if (userLat === null || userLng === null) {
      return { text: "Calibrating Geolocation sensors...", inRange: false, distance: null };
    }

    const R = 6371e3; // metres
    const phi1 = (userLat * Math.PI) / 180;
    const phi2 = (item.lat * Math.PI) / 180;
    const deltaPhi = ((item.lat - userLat) * Math.PI) / 180;
    const deltaLambda = ((item.lng - userLng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;

    const radius = item.radius || 100;
    const inRange = distanceMeters <= radius;

    if (inRange) {
      return {
        text: `In Range! (${distanceMeters.toFixed(0)}m away, target ≤ ${radius}m)`,
        inRange: true,
        distance: distanceMeters
      };
    }
    return {
      text: `Too far (${distanceMeters.toFixed(0)}m away. Move within ${radius}m)`,
      inRange: false,
      distance: distanceMeters
    };
  };

  const handleDeleteMission = async (itemId: string) => {
    if (!onDeleteMission) return;
    try {
      setDeletingId(itemId);
      await onDeleteMission(itemId);
    } catch (err) {
      console.error("Failed to delete mission:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const canDeleteMission = (item: ScavengerItem) => {
    return currentUserRole === "admin" || item.createdBy === currentUserId;
  };

  const canEditMission = (item: ScavengerItem) => {
    return currentUserRole === "admin" || item.createdBy === currentUserId;
  };

  const handleEditMission = (item: ScavengerItem) => {
    setEditingItem(item);
    setEditingId(item.id);
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !onEditMission) return;
    try {
      setEditingId(editingItem.id);
      await onEditMission(editingItem.id, {
        title: editingItem.title,
        description: editingItem.description,
        points: editingItem.points,
        category: editingItem.category,
        icon: editingItem.icon,
        lat: editingItem.lat,
        lng: editingItem.lng,
        radius: editingItem.radius
      });
      setEditingItem(null);
      setEditingId(null);
    } catch (err) {
      console.error("Failed to edit mission:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Mission Button */}
      {onAddChallenge && onShowCreateModal && (
        <button
          onClick={onShowCreateModal}
          className="w-full bg-white border border-brand-border rounded-[28px] px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-brand-beige-light/30 transition select-none group"
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-brand-moss group-hover:text-brand-moss-dark transition" />
            <div className="text-left">
              <h3 className="text-sm font-serif font-bold italic text-brand-moss group-hover:text-brand-moss-dark transition">Create a Custom Hunt Mission</h3>
              <p className="text-[10px] text-brand-muted">Publish a new photo or GPS geotagged challenge</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-brand-moss group-hover:translate-x-1 transition" />
        </button>
      )}

      {/* Category Slider */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            type="button"
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === cat
                ? "bg-brand-moss text-white shadow-sm"
                : "bg-white border border-brand-border text-brand-moss hover:bg-brand-beige-light"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of Missions */}
      <div className="grid grid-cols-1 gap-4">
        {filteredItems.map((item) => {
          const { status, score: associatedSub } = getMissionStatus(item.id);
          const isExpanded = expandedItemId === item.id;
          const isSubmitting = isSubmittingMap[item.id] || false;
          const userSelectedImage = tempImageMap[item.id] || null;
          const uploadError = submitErrorMap[item.id] || null;

          // GPS info Solve
          const prox = getProximityText(item);

          return (
            <div
              key={item.id}
              id={`challenge-card-${item.id}`}
              className={`bg-white rounded-[24px] border transition-all duration-300 ${
                isExpanded
                  ? "border-brand-moss shadow-md ring-2 ring-brand-beige"
                  : status === "approved"
                  ? "border-green-100 bg-green-50/20"
                  : "border-brand-border hover:border-brand-moss/40 shadow-sm"
              }`}
            >
              {/* Header Selector bar */}
              <div
                onClick={() => handleToggleExpand(item.id)}
                className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-center gap-4">
                  {/* Category Icon Ball */}
                  <div
                    className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 border transition ${
                      status === "approved"
                        ? "bg-green-100 text-green-600 border-green-200"
                        : status === "pending"
                        ? "bg-amber-100 text-amber-600 border-amber-200"
                        : "bg-brand-beige-light text-brand-moss border-brand-border"
                    }`}
                  >
                    <DynamicIcon name={item.icon || "Sparkles"} className="h-5 w-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-brand-muted capitalize bg-brand-beige-light px-2 py-0.5 rounded-md border border-brand-border/40">
                        {item.category}
                      </span>
                      <span className="text-[11px] font-bold text-brand-terracotta bg-brand-terracotta-light px-2 py-0.5 rounded-full font-mono">
                        +{item.points} PTS
                      </span>
                      {item.lat !== null && (
                        <span className="text-[9px] bg-brand-beige text-brand-moss font-semibold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5 text-brand-moss" />
                          GPS Geofenced
                        </span>
                      )}
                    </div>
                    <h3
                      className={`text-sm font-bold mt-1 ${
                        status === "approved" ? "text-brand-muted line-through" : "text-brand-dark"
                      }`}
                    >
                      {item.title}
                    </h3>
                  </div>
                </div>

                {/* Right Status / Expand Actions */}
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex shrink-0">
                    {status === "approved" && (
                      <span className="bg-green-100 text-green-700 font-bold text-[10.5px] px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Completed
                      </span>
                    )}
                    {status === "pending" && (
                      <span className="bg-amber-100 text-amber-700 font-bold text-[10.5px] px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <Clock className="h-3.5 w-3.5 animate-pulse" />
                        Ref Reviewing
                      </span>
                    )}
                    {status === "rejected" && (
                      <span className="bg-red-100 text-red-700 font-bold text-[10.5px] px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <XCircle className="h-3.5 w-3.5" />
                        Rejected (Retry)
                      </span>
                    )}
                    {status === "open" && (
                      <span className="bg-brand-beige-light border border-brand-border text-brand-moss font-bold text-[10.5px] px-2.5 py-1 rounded-full flex items-center gap-1 hover:bg-[#e6e2d3]/50">
                        <ArrowRight className="h-3 w-3 text-brand-terracotta" />
                        Let's Hunt!
                      </span>
                    )}
                  </div>

                  {/* Edit/Delete buttons and Expand */}
                  <div className="flex items-center gap-2">
                    {canEditMission(item) && onEditMission && (
                      <button
                        onClick={() => handleEditMission(item)}
                        disabled={editingId === item.id}
                        className="p-2 text-brand-moss hover:bg-brand-beige-light rounded-lg transition disabled:opacity-50"
                        title={currentUserRole === "admin" ? "Edit mission (Admin)" : "Edit mission (Created by you)"}
                      >
                        {editingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Edit2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {canDeleteMission(item) && onDeleteMission && (
                      <button
                        onClick={() => handleDeleteMission(item.id)}
                        disabled={deletingId === item.id}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title={currentUserRole === "admin" ? "Delete mission (Admin)" : "Delete mission (Created by you)"}
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <div>{isExpanded ? <ChevronUp className="h-5 w-5 text-brand-muted" /> : <ChevronDown className="h-5 w-5 text-brand-muted" />}</div>
                  </div>
                </div>
              </div>

              {/* Expandable Camera drawer */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-1 border-t border-brand-border/45 space-y-4">
                  <div className="text-xs text-brand-dark leading-relaxed max-w-xl space-y-1.5">
                    <p className="font-bold text-brand-moss uppercase tracking-wider text-[10px]">
                      Checklist Objective:
                    </p>
                    <p className="text-brand-muted font-medium bg-brand-beige-light/40 border border-brand-border/20 p-2.5 rounded-xl">
                      {item.description}
                    </p>

                    {/* Proximity / GPS banner */}
                    <div className="pt-1.5 flex items-center gap-1.5 text-[11px]">
                      <Compass className="h-3.5 w-3.5 text-brand-moss shrink-0" />
                      <span className={`font-semibold ${prox.inRange ? 'text-green-600' : 'text-amber-700'}`}>
                        {prox.text}
                      </span>
                    </div>
                  </div>

                  {status === "approved" && associatedSub && (
                    <div className="bg-green-50/70 border border-green-200 rounded-xl p-3.5 space-y-2">
                      <p className="text-xs font-bold text-green-800 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        This hunt is successfully completed!
                      </p>
                      <p className="text-[11px] text-green-700/90 leading-relaxed font-medium pl-5">
                        <strong>AI Judge says:</strong> "{associatedSub.aiExplanation || "Correct match found!"}"
                      </p>
                      {associatedSub.imageUrl && (
                        <div className="pt-2">
                          <img
                            src={associatedSub.imageUrl}
                            alt="Approved submission"
                            className="w-full h-auto max-h-64 object-cover rounded-lg border border-green-200"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recent submissions gallery */}
                  {status !== "open" && status !== "approved" && (() => {
                    const itemSubmissions = submissions.filter((sub) => sub.itemId === item.id && sub.userId === currentUserId);
                    const recentSubmissions = itemSubmissions.slice(0, 3);
                    return recentSubmissions.length > 0 ? (
                      <div className="bg-brand-beige-light/30 border border-brand-border rounded-xl p-3 space-y-2">
                        <p className="text-xs font-bold text-brand-moss uppercase tracking-wider">
                          Submission{recentSubmissions.length !== 1 ? 's' : ''} ({recentSubmissions.length})
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {recentSubmissions.map((sub) => (
                            <div key={sub.id} className="relative group">
                              <img
                                src={sub.imageUrl}
                                alt="Submission preview"
                                className="w-full aspect-square object-cover rounded-lg border border-brand-border/50 group-hover:border-brand-moss/50 transition"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition rounded-lg flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition">
                                  {sub.status === "approved" && (
                                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                                  )}
                                  {sub.status === "rejected" && (
                                    <XCircle className="h-6 w-6 text-red-400" />
                                  )}
                                  {sub.status === "pending" && (
                                    <Clock className="h-6 w-6 text-amber-400 animate-pulse" />
                                  )}
                                </div>
                              </div>
                              <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-brand-moss/80 text-white px-1.5 py-0.5 rounded opacity-75">
                                {sub.username}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Camera control area */}
                  {status !== "approved" && (
                    <div className="space-y-4 pt-1">
                      {isSubmitting ? (
                        <div className="bg-brand-beige-light/30 rounded-2xl border border-brand-border p-8 flex flex-col items-center justify-center text-center space-y-4">
                          <Loader2 className="h-8 w-8 text-brand-moss animate-spin" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-brand-moss flex items-center justify-center gap-1.5">
                              <Sparkles className="h-4 w-4 text-brand-terracotta animate-bounce" />
                              Waking up the AI Referee...
                            </p>
                            <p className="text-xs text-brand-muted max-w-sm px-6">
                              Gemini is scanning your picture proof to verify it matches "{item.title}". This takes just a moment...
                            </p>
                          </div>
                        </div>
                      ) : !prox.inRange ? (
                        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 text-center space-y-2 max-w-md mx-auto">
                          <MapPin className="h-6 w-6 text-amber-600 mx-auto animate-bounce" />
                          <h4 className="text-xs font-bold text-amber-900">GPS Proximity Constraint Active</h4>
                          <p className="text-[11px] text-amber-700/80 leading-normal">
                            You must move within the challenge's specified geofence boundary (allowed radius of <strong>{item.radius}m</strong>) to submit photograph proof or open the camera device scanner.
                          </p>
                          <p className="text-[10px] text-gray-500 italic">
                            💡 Use the <strong>Interactive Geolocation Map</strong> page tab above to drag/simulate your position right next to the challenge coordinates!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <CameraCapture
                            onImageSelected={(base64) => handleImageSelected(item.id, base64)}
                            selectedImage={userSelectedImage}
                          />

                          {uploadError && (
                            <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-xs space-y-2">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 shrink-0" />
                                <p className="font-semibold">{uploadError}</p>
                              </div>
                              {rejectedSubmissionMap?.[item.id] && onForceSubmit && (
                                <button
                                  onClick={() => onForceSubmit(item.id)}
                                  type="button"
                                  className="w-full px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  ⚠️ Force Submit Anyway
                                </button>
                              )}
                            </div>
                          )}

                          {userSelectedImage && (
                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                onClick={() => handleImageSelected(item.id, "")}
                                type="button"
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-xs text-gray-700 transition"
                              >
                                Clear Selection
                              </button>
                              <button
                                onClick={() => handleTriggerUpload(item.id)}
                                type="button"
                                className="px-5 py-2.5 bg-brand-moss hover:bg-brand-moss-dark active:scale-95 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                Submit to AI Referee
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Mission Modal */}
      {editingItem && (
        <EditMissionModal
          isOpen={!!editingItem}
          item={editingItem}
          onClose={() => {
            setEditingItem(null);
            setEditingId(null);
          }}
          onSubmit={async (updates) => {
            if (editingItem && onEditMission) {
              const updated = { ...editingItem, ...updates };
              setEditingItem(updated);
              await handleSaveEdit();
            }
          }}
        />
      )}
    </div>
  );
}
