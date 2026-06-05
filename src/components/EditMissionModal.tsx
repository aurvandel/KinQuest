import React, { useState } from "react";
import { X, Send, Compass, Check, AlertCircle, Loader2 } from "lucide-react";
import { ScavengerItem } from "../types";
import { DynamicIcon } from "./DynamicIcon";

const AVAILABLE_ICONS = [
  "Sparkles", "Leaf", "Footprints", "Briefcase", "Dress", "Globe", "Tree", "Gift", "Book", "Flashlight",
  "VolumeUp", "Pot", "Glass", "IceCream", "Candy", "Donut", "Popcorn", "Basketball", "Golf", "Playground",
  "Water", "Sign", "Apple", "Monster", "Map", "Flag", "Cards", "Tent", "WaterDrop", "Parachute",
  "Users", "Heart", "Camera", "Flame", "Laugh", "Music", "Key", "QrCode", "BookOpen", "Coffee",
  "Palette", "Tv", "Clock", "Flower2", "Coins"
];

interface EditMissionModalProps {
  isOpen: boolean;
  item: ScavengerItem | null;
  onClose: () => void;
  onSubmit: (updates: Partial<ScavengerItem>) => Promise<void>;
}

export function EditMissionModal({
  isOpen,
  item,
  onClose,
  onSubmit
}: EditMissionModalProps) {
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [points, setPoints] = useState(String(item?.points || "40"));
  const [category, setCategory] = useState(item?.category || "Exploration");
  const [icon, setIcon] = useState(item?.icon || "Sparkles");
  const [lat, setLat] = useState(item?.lat ? String(item.lat) : "");
  const [lng, setLng] = useState(item?.lng ? String(item.lng) : "");
  const [radius, setRadius] = useState(item?.radius ? String(item.radius) : "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!title || !description) {
      setError("Title and description are required.");
      return;
    }

    const itemLat = lat ? Number(lat) : null;
    const itemLng = lng ? Number(lng) : null;
    const itemRadius = radius ? Number(radius) : null;

    if ((lat && !lng) || (!lat && lng)) {
      setError("Must define BOTH Latitude & Longitude to geofence this challenge.");
      return;
    }

    try {
      setIsLoading(true);
      await onSubmit({
        title,
        description,
        points: Number(points) || 40,
        category,
        icon,
        lat: itemLat,
        lng: itemLng,
        radius: itemRadius
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError("Could not update mission. Server unresponsive.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-lg animate-fadeIn overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5e5dd] p-6 shrink-0">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a5a40]">Edit Hunt Mission</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f0f0e8] transition text-[#8c8c82] hover:text-[#5a5a40]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content with scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Title and Points */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#5a5a40] uppercase tracking-widest block">Challenge Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bronze Statue of Deer"
                className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#5a5a40]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#5a5a40] uppercase tracking-widest block">Points Awarded</label>
                <input
                  type="number"
                  required
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="40"
                  className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#5a5a40]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#5a5a40] uppercase tracking-widest block">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#5a5a40] appearance-none"
                >
                  <option value="Exploration">Exploration</option>
                  <option value="Nature">Nature</option>
                  <option value="Home">Home</option>
                  <option value="Tech">Tech</option>
                  <option value="Animal">Animal</option>
                  <option value="Creative">Creative</option>
                  <option value="Heirloom">Heirloom</option>
                  <option value="Treats">Treats</option>
                  <option value="Resort">Resort</option>
                  <option value="Legacy">Legacy</option>
                  <option value="Family">Family</option>
                  <option value="History">History</option>
                  <option value="Food">Food</option>
                  <option value="Genetic">Genetic</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Joy">Joy</option>
                </select>
              </div>
            </div>
          </div>

          {/* Icon Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#5a5a40] uppercase tracking-widest block">Mission Icon</label>
            <div className="grid grid-cols-6 md:grid-cols-10 gap-2">
              {AVAILABLE_ICONS.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className={`p-2.5 rounded-lg border-2 transition flex items-center justify-center ${
                    icon === iconName
                      ? "border-[#5a5a40] bg-[#5a5a40]/10"
                      : "border-[#dcdcd4] bg-white hover:border-[#5a5a40]/30"
                  }`}
                  title={iconName}
                >
                  <DynamicIcon name={iconName} className="h-5 w-5 text-[#5a5a40]" />
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#5a5a40] uppercase tracking-widest block">Description & Match Criteria (For AI Referee)</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize what players must look for and capture in their photo proof to win..."
              rows={3}
              className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#5a5a40] resize-none font-sans leading-relaxed"
            />
          </div>

          {/* Geofencing Section */}
          <div className="bg-[#f5f5f0]/80 border border-[#dcdcd4] rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#5a5a40] flex items-center gap-1">
              <Compass className="h-4 w-4" />
              <span>GPS Geofenced Constraint (Optional)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#8c8c82] uppercase block">Latitude</label>
                <input
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 40.7829"
                  className="w-full text-xs bg-white border border-[#dcdcd4] rounded-xl px-2.5 py-2 outline-none focus:ring-1 focus:ring-[#5a5a40]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#8c8c82] uppercase block">Longitude</label>
                <input
                  type="text"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="e.g. -73.9654"
                  className="w-full text-xs bg-white border border-[#dcdcd4] rounded-xl px-2.5 py-2 outline-none focus:ring-1 focus:ring-[#5a5a40]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#8c8c82] uppercase block">Radius (Meters)</label>
                <input
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  placeholder="e.g. 200"
                  className="w-full text-xs bg-white border border-[#dcdcd4] rounded-xl px-2.5 py-2 outline-none focus:ring-1 focus:ring-[#5a5a40]"
                />
              </div>
            </div>

            <p className="text-[10px] text-[#8c8c82] leading-relaxed">
              💡 If Latitude/Longitude is specified, players must be within the defined boundary radius (in meters) to submit successfully.
            </p>
          </div>

          {/* Notifications */}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-[11px] font-medium border border-red-100 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-[11px] font-medium border border-emerald-100 flex items-center gap-1.5 animate-bounce">
              <Check className="h-4 w-4 shrink-0" />
              <span>Mission updated successfully!</span>
            </div>
          )}
        </form>

        {/* Footer with buttons */}
        <div className="p-6 border-t border-[#e5e5dd] bg-[#fafaf7] flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold text-[#8c8c82] hover:text-[#5a5a40] hover:bg-white border border-[#dcdcd4] transition flex items-center justify-center cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#5a5a40] hover:bg-[#464632] active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
