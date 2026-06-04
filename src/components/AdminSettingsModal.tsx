import React from "react";
import { Settings, Upload, Copy, Check, AlertCircle, Loader2, RotateCcw, QrCode, ExternalLink, HardDrive } from "lucide-react";
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
  nameInput: string;
  onNameChange: (value: string) => void;
  iconInput: string | null;
  onIconUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  latInput: number;
  onLatChange: (value: number) => void;
  lngInput: number;
  onLngChange: (value: number) => void;
  radiusInput: number;
  onRadiusChange: (value: number) => void;
  aiPromptInput: string;
  onAiPromptChange: (value: string) => void;
  aiVerificationEnabledInput: boolean;
  onAiVerificationEnabledChange: (value: boolean) => void;
  allowForceSubmitInput: boolean;
  onAllowForceSubmitChange: (value: boolean) => void;
  inviteCodeInput: string;
  onInviteCodeChange: (value: string) => void;
  inviteRequiredInput: boolean;
  onInviteRequiredChange: (value: boolean) => void;
  copiedInviteLink: boolean;
  onCopyInviteLink: () => void;
  imageCompressionMaxDimInput: number;
  onImageCompressionMaxDimChange: (value: number) => void;
  imageCompressionQualityInput: number;
  onImageCompressionQualityChange: (value: number) => void;
  storageInfo: StorageInfo | null;
  isLoading: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  onGenerateCode: () => void;
  onOpenSlideshowGenerator?: () => void;
}

export function AdminSettingsModal({
  isOpen,
  onClose,
  settings,
  nameInput,
  onNameChange,
  iconInput,
  onIconUpload,
  latInput,
  onLatChange,
  lngInput,
  onLngChange,
  radiusInput,
  onRadiusChange,
  aiPromptInput,
  onAiPromptChange,
  aiVerificationEnabledInput,
  onAiVerificationEnabledChange,
  allowForceSubmitInput,
  onAllowForceSubmitChange,
  inviteCodeInput,
  onInviteCodeChange,
  inviteRequiredInput,
  onInviteRequiredChange,
  copiedInviteLink,
  onCopyInviteLink,
  imageCompressionMaxDimInput,
  onImageCompressionMaxDimChange,
  imageCompressionQualityInput,
  onImageCompressionQualityChange,
  storageInfo,
  isLoading,
  saveSuccess,
  saveError,
  onSubmit,
  onReset,
  onGenerateCode,
  onOpenSlideshowGenerator
}: AdminSettingsModalProps) {
  if (!isOpen) return null;

  const inviteUrl = inviteCodeInput.trim() 
    ? `${window.location.protocol}//${window.location.host}/?invite=${encodeURIComponent(inviteCodeInput.trim().toLowerCase())}`
    : "";

  const qrCodeUrl = inviteCodeInput.trim()
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteUrl)}`
    : "";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1999] p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-lg animate-fadeIn overflow-hidden flex flex-col max-h-[90vh]">
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
          {/* Game Title Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">🎮 Game Identity</h3>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Scavenger Game Title
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={32}
                  placeholder="e.g. Stewart Quest"
                  value={nameInput}
                  onChange={(e) => onNameChange(e.target.value)}
                  className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl pl-4 pr-32 py-3 outline-none focus:ring-1 focus:ring-[#5a5a40] font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={() => onNameChange("Stewart Quest")}
                  className="absolute right-2 top-2 px-2 py-1 bg-[#5a5a40]/10 hover:bg-[#5a5a40]/20 text-[#5a5a40] rounded-lg text-[9px] font-bold transition cursor-pointer select-none"
                >
                  Use: Stewart Quest
                </button>
              </div>
            </div>

            {/* Icon Uploader */}
            <div className="space-y-2 pt-2">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Custom Branding Logo Icon
              </label>
              
              <div className="flex items-center gap-3 bg-[#f5f5f0]/40 p-3 rounded-2xl border border-dashed border-[#dcdcd4]">
                <div className="w-12 h-12 rounded-xl bg-[#5a5a40] flex items-center justify-center text-white text-xs overflow-hidden shrink-0 shadow-sm border border-[#5a5a40]/20">
                  {iconInput ? (
                    <img src={iconInput} alt="Logo Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-white rounded-sm rotate-45 animate-spin-slow" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    id="branding-logo-file"
                    accept="image/*"
                    onChange={onIconUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="branding-logo-file"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-[#d2d2c8] hover:border-[#5a5a40] text-[10px] font-bold rounded-lg text-[#5a5a40] cursor-pointer transition select-none"
                  >
                    <Upload className="h-3 w-3" />
                    Choose Image...
                  </label>
                  <p className="text-[9px] text-[#8c8c82]">PNG, JPG (under 2MB)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Map & Location Section */}
          <div className="space-y-2 pt-2 border-t border-[#e5e5dd]">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">🗺️ Map Settings</h3>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Default Map Center GPS
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-[#8c8c82]">Latitude</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={latInput}
                    onChange={(e) => onLatChange(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2 outline-none font-mono focus:ring-1 focus:ring-[#5a5a40]"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-[#8c8c82]">Longitude</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lngInput}
                    onChange={(e) => onLngChange(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2 outline-none font-mono focus:ring-1 focus:ring-[#5a5a40]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Geofencing Radius (meters)
              </label>
              <input
                type="number"
                required
                min={1}
                value={radiusInput}
                onChange={(e) => onRadiusChange(parseInt(e.target.value) || 100)}
                className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2 outline-none font-mono focus:ring-1 focus:ring-[#5a5a40]"
              />
            </div>
          </div>

          {/* Image Compression Settings Section */}
          <div className="space-y-2 pt-2 border-t border-[#e5e5dd]">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">📸 Image Compression Settings</h3>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Max Image Dimension (pixels)
              </label>
              <input
                type="number"
                required
                min={200}
                max={2000}
                step={50}
                value={imageCompressionMaxDimInput}
                onChange={(e) => onImageCompressionMaxDimChange(parseInt(e.target.value) || 800)}
                className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2 outline-none font-mono focus:ring-1 focus:ring-[#5a5a40]"
              />
              <p className="text-[9px] text-[#8c8c82]">Larger values = better quality but bigger file size (200-2000px recommended)</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                JPEG Quality (0.0 - 1.0)
              </label>
              <input
                type="number"
                required
                min={0.1}
                max={1}
                step={0.05}
                value={imageCompressionQualityInput}
                onChange={(e) => onImageCompressionQualityChange(parseFloat(e.target.value) || 0.7)}
                className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2 outline-none font-mono focus:ring-1 focus:ring-[#5a5a40]"
              />
              <p className="text-[9px] text-[#8c8c82]">Higher values = better quality but larger files (0.5-0.9 recommended)</p>
            </div>

            {storageInfo && (
              <div className="space-y-2 mt-3 p-3 bg-sky-50 rounded-2xl border border-sky-100">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="h-4 w-4 text-sky-600" />
                  <span className="text-xs font-bold text-sky-700 uppercase tracking-widest">Storage & Capacity Info</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-white p-2 rounded-lg border border-sky-100">
                    <span className="text-[9px] font-bold text-sky-600 block mb-0.5">Used</span>
                    <span className="text-sky-900 font-bold">{storageInfo.usedGb} GB</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-sky-100">
                    <span className="text-[9px] font-bold text-sky-600 block mb-0.5">Free</span>
                    <span className="text-emerald-600 font-bold">{storageInfo.freeGb} GB</span>
                  </div>
                </div>

                <div className="bg-white p-2 rounded-lg border border-sky-100 text-[9px]">
                  <span className="text-sky-600 font-bold block mb-1">Current Settings Impact:</span>
                  <div className="space-y-0.5 text-sky-900">
                    <div className="flex justify-between">
                      <span>Est. per image:</span>
                      <span className="font-bold">{storageInfo.estimatedImageSizeKb} KB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Images before full:</span>
                      <span className="font-bold text-emerald-600">{storageInfo.imagesRemainingCapacity.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Judge Section */}
          <div className="space-y-2 pt-2 border-t border-[#e5e5dd]">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">🤖 AI Judge Configuration</h3>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                AI Judge Prompt Criteria
              </label>
              <textarea
                required
                rows={3}
                value={aiPromptInput}
                onChange={(e) => onAiPromptChange(e.target.value)}
                className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2.5 outline-none font-sans leading-relaxed text-[#2d2d2d] focus:ring-1 focus:ring-[#5a5a40]"
                placeholder="Set AI behavior rules..."
              />
              <p className="text-[9px] text-[#8c8c82]">
                Defines AI personality, verification rules, and scoring criteria for submission reviews.
              </p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none mt-3">
              <input
                type="checkbox"
                checked={aiVerificationEnabledInput}
                onChange={(e) => onAiVerificationEnabledChange(e.target.checked)}
                className="mt-0.5 rounded border-[#dcdcd4] text-[#5a5a40] focus:ring-[#5a5a40]"
              />
              <div className="leading-none">
                <span className="text-xs font-bold text-[#5a5a40] block">Enable AI Photo Verification</span>
                <span className="text-[9px] text-[#8c8c82]">When enabled, Gemini AI reviews each submitted photo. When disabled, all submissions auto-approve instantly.</span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none mt-3">
              <input
                type="checkbox"
                checked={allowForceSubmitInput}
                onChange={(e) => onAllowForceSubmitChange(e.target.checked)}
                className="mt-0.5 rounded border-[#dcdcd4] text-[#5a5a40] focus:ring-[#5a5a40]"
              />
              <div className="leading-none">
                <span className="text-xs font-bold text-[#5a5a40] block">Allow Force Submissions</span>
                <span className="text-[9px] text-[#8c8c82]">When enabled, users can submit even if the AI Judge rejects their photo. Shows the judge's feedback with a badge.</span>
              </div>
            </label>
          </div>

          {/* Invite & QR Code Section */}
          <div className="space-y-3 pt-2 border-t border-[#e5e5dd]">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">🛡️ Invite & Access Control</h3>
            
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inviteRequiredInput}
                onChange={(e) => onInviteRequiredChange(e.target.checked)}
                className="mt-0.5 rounded border-[#dcdcd4] text-[#5a5a40] focus:ring-[#5a5a40]"
              />
              <div className="leading-none">
                <span className="text-xs font-bold text-[#5a5a40] block">Require Invite Link to Participate</span>
                <span className="text-[9px] text-[#8c8c82]">Hunters must scan QR code or use invite URL to register.</span>
              </div>
            </label>

            <div className="space-y-1 bg-[#f5f5f0]/50 p-3 rounded-2xl border border-[#dcdcd4]">
              <span className="text-[9px] font-bold text-[#8c8c82] uppercase tracking-widest block font-sans">Active Invite Code</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. secret-hunt-2026"
                  value={inviteCodeInput}
                  onChange={(e) => onInviteCodeChange(e.target.value.toLowerCase().trim().replace(/[^a-z0-9_-]/g, ''))}
                  className="flex-1 text-xs bg-white border border-[#dcdcd4] rounded-xl px-3 py-1.5 outline-none font-mono focus:ring-1 focus:ring-[#5a5a40]"
                />
                <button
                  type="button"
                  onClick={onGenerateCode}
                  className="px-2.5 py-1 bg-[#5a5a40]/10 hover:bg-[#5a5a40]/20 text-[#5a5a40] rounded-xl text-[10px] font-bold transition cursor-pointer select-none"
                >
                  Generate
                </button>
              </div>
            </div>

            {/* Invite URL */}
            {inviteUrl && (
              <div className="space-y-1.5 p-3 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-blue-700 uppercase tracking-widest">Invite Link</span>
                  <button
                    type="button"
                    onClick={onCopyInviteLink}
                    className="text-[10px] font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedInviteLink ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-white p-2 rounded-xl text-[10px] font-mono text-blue-900 border border-blue-200 truncate select-all">
                  {inviteUrl}
                </div>
              </div>
            )}

            {/* QR Code */}
            {qrCodeUrl && (
              <div className="space-y-2 p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center">
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest self-start">Event Portal QR Code</span>
                <div className="bg-white p-2.5 rounded-2xl border border-emerald-200 shadow-sm">
                  <img
                    src={qrCodeUrl}
                    alt="Invite QR Code"
                    className="w-40 h-40 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <p className="text-[8px] text-center text-emerald-700 font-sans">
                  Scan to unlock registration and join the game!
                </p>
              </div>
            )}
          </div>

          {/* Notifications */}
          {saveSuccess && (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-[11px] font-medium border border-emerald-100 flex items-center gap-1.5 animate-bounce">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Game settings saved and synced!</span>
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
            onClick={onSubmit}
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

          <button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold text-[#8c8c82] hover:text-[#5a5a40] hover:bg-white border border-[#dcdcd4] transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
