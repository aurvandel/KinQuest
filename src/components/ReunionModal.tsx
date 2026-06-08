import React, { useState, useEffect } from "react";
import { X, Loader2, AlertCircle, Copy, Check } from "lucide-react";
import { DynamicIcon } from "./DynamicIcon";
import { Reunion } from "../types";

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

interface ReunionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Reunion>) => Promise<void>;
  reunion?: Reunion | null;
  isLoading: boolean;
  error: string | null;
  storageInfo?: StorageInfo | null;
}

export function ReunionModal({
  isOpen,
  onClose,
  onSave,
  reunion,
  isLoading,
  error,
  storageInfo
}: ReunionModalProps) {
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [icon, setIcon] = useState("Users");
  const [aiPromptCriteria, setAiPromptCriteria] = useState("");
  const [aiVerificationEnabled, setAiVerificationEnabled] = useState(true);
  const [allowForceSubmit, setAllowForceSubmit] = useState(false);
  const [imageCompressionMaxDim, setImageCompressionMaxDim] = useState(800);
  const [imageCompressionQuality, setImageCompressionQuality] = useState(0.7);
  const [showTitle, setShowTitle] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [iconFileName, setIconFileName] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (reunion) {
      setName(reunion.name);
      setInviteCode(reunion.inviteCode);
      setIcon(reunion.icon || "Users");
      setAiPromptCriteria(reunion.aiPromptCriteria || "");
      setAiVerificationEnabled(reunion.aiVerificationEnabled ?? true);
      setAllowForceSubmit(reunion.allowForceSubmit ?? false);
      setImageCompressionMaxDim(reunion.imageCompressionMaxDim ?? 800);
      setImageCompressionQuality(reunion.imageCompressionQuality ?? 0.7);
      setShowTitle(reunion.showTitle ?? true);
      setShowLogo(reunion.showLogo ?? true);
    } else {
      setName("");
      setInviteCode("");
      setIcon("Users");
      setAiPromptCriteria("");
      setAiVerificationEnabled(true);
      setAllowForceSubmit(false);
      setImageCompressionMaxDim(800);
      setImageCompressionQuality(0.7);
      setShowTitle(true);
      setShowLogo(true);
    }
  }, [reunion, isOpen]);

  const handleIconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setIconFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) setIcon(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  // Generate shareable URL with invite code
  const getShareUrl = () => {
    if (!inviteCode) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/?invite=${encodeURIComponent(inviteCode.trim().toLowerCase())}`;
  };

  // Copy URL to clipboard
  const copyUrlToClipboard = async () => {
    const url = getShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !inviteCode.trim()) {
      return;
    }

    try {
      await onSave({
        name: name.trim(),
        inviteCode: inviteCode.trim().toLowerCase(),
        inviteRequired: true,
        icon,
        aiPromptCriteria,
        aiVerificationEnabled,
        allowForceSubmit,
        imageCompressionMaxDim: Number(imageCompressionMaxDim),
        imageCompressionQuality: Number(imageCompressionQuality),
        showTitle,
        showLogo
      });
      onClose();
    } catch (err) {
      // Error is handled by parent component
      console.error("Failed to save reunion:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto pointer-events-auto border border-[#e5e5dd]">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#e5e5dd] p-6 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a5a40]">
              {reunion ? "Edit Reunion" : "Create New Reunion"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-bold text-brand-muted hover:text-brand-dark cursor-pointer transition"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Storage Info */}
          {storageInfo && (
            <div className="space-y-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">📦 Storage</h3>
              <p className="text-[11px] text-[#5a5a40]">Free: {storageInfo.freeGb} GB • Used: {storageInfo.usedGb} GB • Total: {storageInfo.totalGb} GB</p>
              <p className="text-[11px] text-[#5a5a40]">Estimated Image Size: {storageInfo.estimatedImageSizeKb} KB</p>
              <p className="text-[11px] text-[#5a5a40]">Images Remaining Capacity: {storageInfo.imagesRemainingCapacity}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">📋 Reunion Information</h3>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Reunion Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Stewart Family Reunion 2026"
                className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl pl-4 pr-4 py-3 outline-none focus:ring-1 focus:ring-[#5a5a40] font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g., family2026"
                className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl pl-4 pr-4 py-3 outline-none focus:ring-1 focus:ring-[#5a5a40] font-mono"
                required
              />
              <p className="text-[11px] text-[#5a5a40]/60 mt-1">Players must use this code to join. Invite codes are always required.</p>
            </div>

            {/* Shareable URL & QR Code Section */}
            {inviteCode && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                  📤 Share Invitation
                </label>
                <div className="bg-[#f5f5f0]/50 border border-[#dcdcd4] rounded-xl p-3 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider mb-1">Share Link</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={getShareUrl()}
                        readOnly
                        className="flex-1 text-[10px] bg-white border border-[#dcdcd4] rounded-lg pl-3 pr-3 py-2 outline-none font-mono text-[#5a5a40]"
                      />
                      <button
                        type="button"
                        onClick={copyUrlToClipboard}
                        className="px-3 py-2 bg-[#5a5a40] text-white rounded-lg text-[10px] font-bold hover:bg-[#464632] transition flex items-center gap-1"
                      >
                        {copiedUrl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedUrl ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider mb-1">QR Code</p>
                    <div className="flex justify-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getShareUrl())}`}
                        alt="Reunion QR Code"
                        className="border border-[#dcdcd4] rounded-lg bg-white p-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">Reunion Icon</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-white border border-[#dcdcd4] rounded-lg">
                  {icon && (icon.startsWith("data:") || icon.startsWith("/")) ? (
                    <img src={icon} alt="icon" className="w-8 h-8 object-cover rounded" />
                  ) : (
                    <DynamicIcon name={icon || "Users"} className="h-6 w-6 text-[#5a5a40]" />
                  )}
                </div>
                <div className="flex flex-col">
                  <input type="file" accept="image/*" onChange={handleIconFile} />
                  {iconFileName && <span className="text-[11px] text-[#5a5a40]/70 mt-1">{iconFileName}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* AI & Verification Settings */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">🤖 AI & Verification</h3>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                AI Judgment Prompt
              </label>
              <textarea
                value={aiPromptCriteria}
                onChange={(e) => setAiPromptCriteria(e.target.value)}
                placeholder="Describe what the AI should look for when verifying photos..."
                rows={3}
                className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl pl-4 pr-4 py-3 outline-none focus:ring-1 focus:ring-[#5a5a40] font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="aiVerification"
                checked={aiVerificationEnabled}
                onChange={(e) => setAiVerificationEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-[#dcdcd4] text-[#5a5a40]"
              />
              <label htmlFor="aiVerification" className="text-[11px] font-bold text-[#5a5a40]">
                Enable AI verification of submissions
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="forceSubmit"
                checked={allowForceSubmit}
                onChange={(e) => setAllowForceSubmit(e.target.checked)}
                className="w-4 h-4 rounded border-[#dcdcd4] text-[#5a5a40]"
              />
              <label htmlFor="forceSubmit" className="text-[11px] font-bold text-[#5a5a40]">
                Allow admins to force-approve submissions
              </label>
            </div>
          </div>

          {/* Image Compression */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">📸 Image Settings</h3>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Max Image Dimension (px): {imageCompressionMaxDim}
              </label>
              <input
                type="range"
                min="400"
                max="2000"
                step="100"
                value={imageCompressionMaxDim}
                onChange={(e) => setImageCompressionMaxDim(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Compression Quality: {Math.round(imageCompressionQuality * 100)}%
              </label>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.1"
                value={imageCompressionQuality}
                onChange={(e) => setImageCompressionQuality(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Display Settings */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">👁️ Display Options</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showTitle"
                checked={showTitle}
                onChange={(e) => setShowTitle(e.target.checked)}
                className="w-4 h-4 rounded border-[#dcdcd4] text-[#5a5a40]"
              />
              <label htmlFor="showTitle" className="text-[11px] font-bold text-[#5a5a40]">
                Show reunion name in header
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showLogo"
                checked={showLogo}
                onChange={(e) => setShowLogo(e.target.checked)}
                className="w-4 h-4 rounded border-[#dcdcd4] text-[#5a5a40]"
              />
              <label htmlFor="showLogo" className="text-[11px] font-bold text-[#5a5a40]">
                Show reunion icon in header
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-[#e5e5dd]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-[11px] font-bold text-[#5a5a40] bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl hover:bg-[#f5f5f0] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim() || !inviteCode.trim()}
              className="flex-1 px-4 py-2 text-[11px] font-bold text-white bg-[#5a5a40] rounded-xl hover:bg-[#3a3a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                reunion ? "Update Reunion" : "Create Reunion"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
