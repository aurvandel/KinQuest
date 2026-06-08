import React from "react";
import { Settings, Check, AlertCircle, Loader2 } from "lucide-react";
import { AppSettings } from "../types";

interface StorageInfo {
  freeBytes: number;
  totalBytes: number;
  usedBytes: number;
  freeGb: string;
  usedGb: string;
  totalGb: string;
  estimatedImageSizeKb: number;
  imageCompressionMaxDim: number;
  imageCompressionQuality: number;
  imagesRemainingCapacity: number;
}

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  storageInfo?: StorageInfo | null;
  onOpenSlideshowGenerator?: () => void;
  currentPasswordInput?: string;
  onCurrentPasswordChange?: (value: string) => void;
  newPasswordInput?: string;
  onNewPasswordChange?: (value: string) => void;
  confirmPasswordInput?: string;
  onConfirmPasswordChange?: (value: string) => void;
  passwordChangeSuccess?: boolean;
  passwordChangeError?: string | null;
  onSubmitPasswordChange?: (e: React.FormEvent) => void;
  slideshowPromptInput?: string;
  onSlideshowPromptChange?: (value: string) => void;
}

export function AdminSettingsModal({
  isOpen,
  onClose,
  settings,
  isLoading,
  onSubmit,
  onOpenSlideshowGenerator,
  storageInfo,
  currentPasswordInput = "",
  onCurrentPasswordChange,
  newPasswordInput = "",
  onNewPasswordChange,
  confirmPasswordInput = "",
  onConfirmPasswordChange,
  passwordChangeSuccess = false,
  passwordChangeError = null,
  onSubmitPasswordChange,
  slideshowPromptInput = "",
  onSlideshowPromptChange
}: AdminSettingsModalProps) {
  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    await onSubmit(e);
    // Close modal after save completes
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[1999] p-4 pointer-events-none">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-lg animate-fadeIn overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto border border-[#e5e5dd]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5e5dd] p-6 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#5a5a40]" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a5a40]">Game Identity Manager</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-bold text-brand-muted hover:text-brand-dark cursor-pointer transition"
          >
            Close
          </button>
        </div>

        {/* Content with scroll */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Admin Password Change Section */}
          <div className="space-y-2 pt-2 border-t border-[#e5e5dd]">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">🔐 Security</h3>
            
            <div className="space-y-2 p-3 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-[9px] text-blue-700 font-semibold">Change Admin Password</p>
              
              <input
                type="password"
                placeholder="Current Password"
                value={currentPasswordInput}
                onChange={(e) => onCurrentPasswordChange?.(e.target.value)}
                className="w-full text-xs bg-white border border-blue-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
              />
              
              <input
                type="password"
                placeholder="New Password"
                value={newPasswordInput}
                onChange={(e) => onNewPasswordChange?.(e.target.value)}
                className="w-full text-xs bg-white border border-blue-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
              />
              
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPasswordInput}
                onChange={(e) => onConfirmPasswordChange?.(e.target.value)}
                className="w-full text-xs bg-white border border-blue-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
              />
              
              <button
                type="button"
                onClick={onSubmitPasswordChange}
                disabled={!currentPasswordInput || !newPasswordInput || !confirmPasswordInput || newPasswordInput !== confirmPasswordInput}
                className="w-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg px-3 py-2 transition cursor-pointer"
              >
                Update Password
              </button>
              
              {passwordChangeError && (
                <div className="p-2 bg-red-50 text-red-700 rounded-lg text-[9px] font-medium border border-red-100 flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
                  <span>{passwordChangeError}</span>
                </div>
              )}
              
              {passwordChangeSuccess && (
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-medium border border-emerald-100 flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                  <span>Admin password updated successfully!</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Slideshow Prompt Section */}
          <div className="space-y-2 pt-2 border-t border-[#e5e5dd]">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">🎬 AI Slideshow Script Prompt</h3>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Narration Guide
              </label>
              <textarea
                value={slideshowPromptInput}
                onChange={(e) => onSlideshowPromptChange?.(e.target.value)}
                placeholder="Enter prompt for AI slideshow generation..."
                rows={4}
                className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl pl-4 pr-4 py-3 outline-none focus:ring-1 focus:ring-[#5a5a40] font-mono"
              />
              <p className="text-[9px] text-[#8c8c82]">
                This prompt guides how the AI generates narration scripts for family reunion slideshows.
              </p>
            </div>
          </div>
        </form>

        {/* Footer with buttons */}
        <div className="p-6 border-t border-[#e5e5dd] bg-[#fafaf7] flex gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (onOpenSlideshowGenerator) {
                onOpenSlideshowGenerator();
              }
            }}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 6h2v7H9V6zm0 9h2v2H9v-2z" />
            </svg>
            Generate Slideshow
          </button>

          <button
            type="submit"
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#5a5a40] hover:bg-[#464632] active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
