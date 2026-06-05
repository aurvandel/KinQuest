import React from "react";
import { User, Loader2, Check, AlertCircle, RotateCcw } from "lucide-react";
import { PlayerProfile } from "../types";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfile;
  displayNameInput: string;
  onDisplayNameChange: (value: string) => void;
  shareLocation: boolean;
  onShareLocationChange: (value: boolean) => void;
  allowNotifications: boolean;
  onAllowNotificationsChange: (value: boolean) => void;
  makePrivate: boolean;
  onMakePrivateChange: (value: boolean) => void;
  extendedAiJudge: boolean;
  onExtendedAiJudgeChange: (value: boolean) => void;
  isLoading: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  syncStatusText?: string;
  isSyncing?: boolean;
  onManualSync?: () => void;
}

export function UserSettingsModal({
  isOpen,
  onClose,
  profile,
  displayNameInput,
  onDisplayNameChange,
  shareLocation,
  onShareLocationChange,
  allowNotifications,
  onAllowNotificationsChange,
  makePrivate,
  onMakePrivateChange,
  extendedAiJudge,
  onExtendedAiJudgeChange,
  isLoading,
  saveSuccess,
  saveError,
  onSubmit,
  syncStatusText = "All submissions synced ✓",
  isSyncing = false,
  onManualSync
}: UserSettingsModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking on the backdrop, not the modal
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    await onSubmit(e);
    // Close modal after save completes
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-3xl max-w-md w-full shadow-lg animate-fadeIn overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5e5dd] p-6">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-[#5a5a40]" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a5a40]">Hunter Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-bold text-brand-muted hover:text-brand-dark cursor-pointer transition"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <form onSubmit={onSubmit} className="p-6 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
          {/* Display Name Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
              Public Display Name / Label
            </label>
            <input
              type="text"
              required
              maxLength={24}
              placeholder="e.g. Legendary Ranger"
              value={displayNameInput}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-[#5a5a40] font-medium"
            />
            <p className="text-[9px] text-[#8c8c82]">
              This is shown to other hunters in chats, feeds, and the live scoreboard.
            </p>
          </div>

          {/* Read-only Account Type Display */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
              Account Type
            </label>
            <div className="text-xs font-bold text-[#5a5a40] bg-[#f5f5f0]/80 px-3 py-2.5 rounded-xl border border-brand-border/60 inline-flex items-center gap-1.5 uppercase tracking-wide">
              {profile.role === "admin" ? (
                <span>👑 Host Admin</span>
              ) : (
                <span>🏹 Hunter User</span>
              )}
            </div>
            <p className="text-[9px] text-[#8c8c82]">
              {profile.role === "admin" 
                ? "As the game organizer you have complete administrative power."
                : "Hunters are dedicated to completing scavenger challenges & scoring points."}
            </p>
          </div>

          {/* Preferences & Permissions checkboxes */}
          <div className="space-y-3 pt-2 border-t border-[#e5e5dd]">
            <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
              Permissions & Privacy Settings
            </label>

            <div className="space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={shareLocation}
                  onChange={(e) => onShareLocationChange(e.target.checked)}
                  className="mt-0.5 rounded border-[#dcdcd4] text-[#5a5a40] focus:ring-[#5a5a40]"
                />
                <div className="leading-none">
                  <span className="text-xs font-semibold text-[#2d2d2d] block">Share GPS coordinates</span>
                  <span className="text-[9px] text-[#8c8c82]">Enables geofenced challenge verification.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowNotifications}
                  onChange={(e) => onAllowNotificationsChange(e.target.checked)}
                  className="mt-0.5 rounded border-[#dcdcd4] text-[#5a5a40] focus:ring-[#5a5a40]"
                />
                <div className="leading-none">
                  <span className="text-xs font-semibold text-[#2d2d2d] block">AIFeed Push Stream</span>
                  <span className="text-[9px] text-[#8c8c82]">Receive direct referee score & chat notifications.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={makePrivate}
                  onChange={(e) => onMakePrivateChange(e.target.checked)}
                  className="mt-0.5 rounded border-[#dcdcd4] text-[#5a5a40] focus:ring-[#5a5a40]"
                />
                <div className="leading-none">
                  <span className="text-xs font-semibold text-[#2d2d2d] block">Incognito Mode (Private profile)</span>
                  <span className="text-[9px] text-[#8c8c82]">Blur profile from public scoreboards.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={extendedAiJudge}
                  onChange={(e) => onExtendedAiJudgeChange(e.target.checked)}
                  className="mt-0.5 rounded border-[#dcdcd4] text-[#5a5a40] focus:ring-[#5a5a40]"
                />
                <div className="leading-none">
                  <span className="text-xs font-semibold text-[#2d2d2d] block">High Intensity AI Judge</span>
                  <span className="text-[9px] text-[#8c8c82]">Enable playful, stricter banter critiques from AI Judge.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Result Notifications */}
          {saveSuccess && (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-[11px] font-medium border border-emerald-100 flex items-center gap-1.5 animate-bounce">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Profile setting & preferences successfully synced!</span>
            </div>
          )}

          {saveError && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-[11px] font-medium border border-red-100 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{saveError}</span>
            </div>
          )}
        </form>

        {/* Footer with buttons */}
        <div className="p-6 border-t border-[#e5e5dd] bg-[#fafaf7] space-y-3">
          {/* Sync Status Display */}
          {onManualSync && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider">
                Submission Sync
              </div>
              <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-[11px] font-medium text-blue-800">{syncStatusText}</span>
              </div>
              <button
                type="button"
                onClick={onManualSync}
                disabled={isSyncing}
                className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Force Sync Now
              </button>
            </div>
          )}

          <button
            type="submit"
            onClick={handleSave}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#5a5a40] hover:bg-[#464632] active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save Profile Settings
          </button>
        </div>
      </div>
    </div>
  );
}
