import React, { useEffect, useState, useRef } from "react";
import { Settings, Upload, Copy, Check, AlertCircle, Loader2, RotateCcw, QrCode, ExternalLink, HardDrive } from "lucide-react";
import QRCode from "react-qr-code";
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

interface AiServiceProbe {
  configured: boolean;
  reachable: boolean;
  endpoint: string | null;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
}

interface AiHealthResponse {
  overallOk: boolean;
  services: {
    ollama: AiServiceProbe;
    presenton: AiServiceProbe;
  };
  configured?: {
    ollamaModel?: string;
  };
  timestamp: string;
}

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  nameInput: string;
  onNameChange: (value: string) => void;
  iconInput: string | null;
  onIconUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  mapModeInput: "original" | "satellite_labels" | "missions_only" | "disabled";
  onMapModeChange: (value: "original" | "satellite_labels" | "missions_only" | "disabled") => void;
  latInput: number;
  onLatChange: (value: number) => void;
  lngInput: number;
  onLngChange: (value: number) => void;
  radiusInput: number;
  onRadiusChange: (value: number) => void;
  aiPromptInput: string;
  onAiPromptChange: (value: string) => void;
  aiJudgeModelInput: "gemini-3.5-flash" | "gemini-2.0-flash";
  onAiJudgeModelChange: (value: "gemini-3.5-flash" | "gemini-2.0-flash") => void;
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
  showTitleInput: boolean;
  onShowTitleChange: (value: boolean) => void;
  showLogoInput: boolean;
  onShowLogoChange: (value: boolean) => void;
  chatDisabledByAdminInput: boolean;
  onChatDisabledByAdminChange: (value: boolean) => void;
  storageInfo: StorageInfo | null;
  isLoading: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  onGenerateCode: () => void;
  currentPasswordInput?: string;
  onCurrentPasswordChange?: (value: string) => void;
  newPasswordInput?: string;
  onNewPasswordChange?: (value: string) => void;
  confirmPasswordInput?: string;
  onConfirmPasswordChange?: (value: string) => void;
  passwordChangeSuccess?: boolean;
  passwordChangeError?: string | null;
  onSubmitPasswordChange?: (e: React.FormEvent) => void;
  adminSessionId?: string | null;
  adminActiveSessions?: number;
  adminCurrentSessionActive?: boolean;
}

export function AdminSettingsModal({
  isOpen,
  onClose,
  settings,
  nameInput,
  onNameChange,
  iconInput,
  onIconUpload,
  mapModeInput,
  onMapModeChange,
  latInput,
  onLatChange,
  lngInput,
  onLngChange,
  radiusInput,
  onRadiusChange,
  aiPromptInput,
  onAiPromptChange,
  aiJudgeModelInput,
  onAiJudgeModelChange,
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
  showTitleInput,
  onShowTitleChange,
  showLogoInput,
  onShowLogoChange,
  chatDisabledByAdminInput,
  onChatDisabledByAdminChange,
  storageInfo,
  isLoading,
  saveSuccess,
  saveError,
  onSubmit,
  onReset,
  onGenerateCode,
  currentPasswordInput = "",
  onCurrentPasswordChange,
  newPasswordInput = "",
  onNewPasswordChange,
  confirmPasswordInput = "",
  onConfirmPasswordChange,
  passwordChangeSuccess = false,
  passwordChangeError = null,
  onSubmitPasswordChange,
  adminSessionId = null,
  adminActiveSessions = 0,
  adminCurrentSessionActive = false
}: AdminSettingsModalProps) {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const aiJudgeCostByModel: Record<"gemini-3.5-flash" | "gemini-2.0-flash", number> = {
    "gemini-3.5-flash": 0.0025,
    "gemini-2.0-flash": 0.0015,
  };
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const [aiHealth, setAiHealth] = useState<AiHealthResponse | null>(null);
  const [aiHealthLoading, setAiHealthLoading] = useState(false);
  const [aiHealthError, setAiHealthError] = useState<string | null>(null);

  const loadAiHealth = async () => {
    const userId = localStorage.getItem("scavenger_uid");
    if (!userId) {
      setAiHealthError("Not logged in");
      return;
    }

    setAiHealthLoading(true);
    setAiHealthError(null);
    try {
      const response = await fetch(`/api/admin/ai-health?userId=${encodeURIComponent(userId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.details || "Failed to fetch AI health");
      }
      setAiHealth(data as AiHealthResponse);
    } catch (err: any) {
      setAiHealthError(err?.message || "Failed to fetch AI health");
      setAiHealth(null);
    } finally {
      setAiHealthLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadAiHealth();
  }, [isOpen]);

  if (!isOpen) return null;

  const inviteUrl = inviteCodeInput.trim() 
    ? `${window.location.protocol}//${window.location.host}/?invite=${encodeURIComponent(inviteCodeInput.trim().toLowerCase())}`
    : "";

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

  const handleBackup = async () => {
    const userId = localStorage.getItem("scavenger_uid");
    if (!userId) {
      setBackupError("Not logged in");
      return;
    }
    setIsBackingUp(true);
    setBackupError(null);
    try {
      const response = await fetch(`/api/admin/backup?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Backup failed");
      }
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `kinquest-backup-${Date.now()}.json`;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setBackupError(err?.message || "Failed to download backup");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const userId = localStorage.getItem("scavenger_uid");
    if (!userId) {
      setRestoreError("Not logged in");
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(null);

    try {
      const fileText = await file.text();
      const backup = JSON.parse(fileText);

      const response = await fetch(`/api/admin/restore?userId=${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backup)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Restore failed");
      }

      const result = await response.json();
      const stats = result.restored;
      const message = `Successfully restored: ${stats.users} users, ${stats.items} missions, ${stats.submissions} submissions, ${stats.messages} messages, ${stats.slideshows} slideshows`;
      setRestoreSuccess(message);
      
      // Reset file input
      if (restoreFileInputRef.current) {
        restoreFileInputRef.current.value = "";
      }

      // Clear success message after 5 seconds
      setTimeout(() => setRestoreSuccess(null), 5000);
    } catch (err: any) {
      setRestoreError(err?.message || "Failed to restore backup");
    } finally {
      setIsRestoring(false);
    }
  };

  const getProbeTone = (probe: AiServiceProbe, optionalWhenMissing: boolean) => {
    if (!probe.configured && optionalWhenMissing) return "yellow" as const;
    if (probe.reachable) return "green" as const;
    return "red" as const;
  };

  const toneClasses: Record<"green" | "yellow" | "red", { badge: string; dot: string; text: string }> = {
    green: {
      badge: "border-emerald-200 bg-emerald-50",
      dot: "bg-emerald-500",
      text: "text-emerald-700",
    },
    yellow: {
      badge: "border-amber-200 bg-amber-50",
      dot: "bg-amber-500",
      text: "text-amber-700",
    },
    red: {
      badge: "border-red-200 bg-red-50",
      dot: "bg-red-500",
      text: "text-red-700",
    },
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1999] p-4" onClick={handleBackdropClick}>
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

            {/* Branding Visibility Toggles */}
            <div className="space-y-2 pt-2 border-t border-[#e5e5dd]">
              <p className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider">Header Branding Display</p>
              
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTitleInput}
                  onChange={(e) => onShowTitleChange(e.target.checked)}
                  className="mt-0.5 rounded border-[#dcdcd4] text-[#5a5a40] focus:ring-[#5a5a40]"
                />
                <div className="leading-none">
                  <span className="text-xs font-bold text-[#5a5a40] block">Show Game Title</span>
                  <span className="text-[9px] text-[#8c8c82]">Display the app name in the header. When both title and logo are shown, they'll merge together visually.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showLogoInput}
                  onChange={(e) => onShowLogoChange(e.target.checked)}
                  className="mt-0.5 rounded border-[#dcdcd4] text-[#5a5a40] focus:ring-[#5a5a40]"
                />
                <div className="leading-none">
                  <span className="text-xs font-bold text-[#5a5a40] block">Show Branding Logo</span>
                  <span className="text-[9px] text-[#8c8c82]">Display the custom logo icon in the header. When both title and logo are shown, they'll merge together visually.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Map & Location Section */}
          <div className="space-y-2 pt-2 border-t border-[#e5e5dd]">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">🗺️ Map Settings</h3>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                Map Style
              </label>
              <select
                value={mapModeInput}
                onChange={(e) => onMapModeChange(e.target.value as "original" | "satellite_labels" | "missions_only" | "disabled")}
                className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2 outline-none font-mono focus:ring-1 focus:ring-[#5a5a40]"
              >
                <option value="original">Original Map</option>
                <option value="satellite_labels">Satellite + Labels</option>
                <option value="missions_only">Missions + GPS Only (No Tiles)</option>
                <option value="disabled">Map Disabled</option>
              </select>
              <p className="text-[9px] text-[#8c8c82]">Controls how all player devices render the map background.</p>
            </div>
            
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

            <div className="space-y-2 p-3 rounded-2xl border border-[#dcdcd4] bg-[#f8f8f3]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider">AI Service Health</p>
                  <p className="text-[9px] text-[#8c8c82]">Connectivity from this server container to Ollama and Presenton.</p>
                </div>
                <button
                  type="button"
                  onClick={loadAiHealth}
                  disabled={aiHealthLoading}
                  className="px-2.5 py-1.5 rounded-lg border border-[#dcdcd4] bg-white text-[10px] font-bold text-[#5a5a40] hover:bg-[#f1f1ea] transition disabled:opacity-50"
                >
                  {aiHealthLoading ? "Checking..." : "Refresh"}
                </button>
              </div>

              {aiHealthError && (
                <div className="p-2 bg-red-50 text-red-700 rounded-lg text-[9px] font-medium border border-red-100 flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
                  <span>{aiHealthError}</span>
                </div>
              )}

              {aiHealth && (
                <>
                  <div className={`rounded-lg border px-2.5 py-2 text-[10px] font-semibold ${aiHealth.overallOk ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                    Overall Status: {aiHealth.overallOk ? "Healthy" : "Degraded"}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: "ollama", label: "Ollama", probe: aiHealth.services.ollama, optionalWhenMissing: false },
                      { key: "presenton", label: "Presenton", probe: aiHealth.services.presenton, optionalWhenMissing: true },
                    ].map((service) => {
                      const tone = getProbeTone(service.probe, service.optionalWhenMissing);
                      const classes = toneClasses[tone];

                      let statusText = service.probe.reachable ? "reachable" : "unreachable";
                      if (!service.probe.configured && service.optionalWhenMissing) {
                        statusText = "not configured (optional)";
                      }

                      return (
                        <div key={service.key} className={`rounded-lg border px-2.5 py-2 ${classes.badge}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${classes.text}`}>{service.label}</span>
                            <span className="flex items-center gap-1">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full ${classes.dot}`} />
                              <span className={`text-[9px] font-semibold ${classes.text}`}>{statusText}</span>
                            </span>
                          </div>
                          <div className="mt-1 text-[9px] text-[#5a5a40] space-y-0.5">
                            <div>Status Code: {service.probe.statusCode ?? "-"}</div>
                            <div>Latency: {service.probe.latencyMs !== null ? `${service.probe.latencyMs}ms` : "-"}</div>
                            <div className="truncate">Endpoint: {service.probe.endpoint || "-"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[9px] text-[#8c8c82]">
                    Checked at {new Date(aiHealth.timestamp).toLocaleTimeString()}
                    {aiHealth.configured?.ollamaModel ? ` • Ollama model: ${aiHealth.configured.ollamaModel}` : ""}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block">
                AI Judge Model
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-start">
                <select
                  value={aiJudgeModelInput}
                  onChange={(e) => onAiJudgeModelChange(e.target.value as "gemini-3.5-flash" | "gemini-2.0-flash")}
                  className="w-full text-xs bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-3 py-2.5 outline-none font-mono text-[#2d2d2d] focus:ring-1 focus:ring-[#5a5a40]"
                >
                  <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                </select>
                <div className="rounded-xl border border-[#dcdcd4] bg-[#f5f5f0]/60 px-3 py-2 text-[10px] text-[#5a5a40]">
                  <div className="font-bold uppercase tracking-wider">Est. Cost / Submission</div>
                  <div className="font-mono text-xs mt-0.5">${aiJudgeCostByModel[aiJudgeModelInput].toFixed(4)} USD</div>
                </div>
              </div>
              <p className="text-[9px] text-[#8c8c82]">
                Estimated cost assumes one image verification call with prompt + structured response.
              </p>
            </div>

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

            <label className="flex items-start gap-2.5 cursor-pointer select-none mt-3">
              <input
                type="checkbox"
                checked={chatDisabledByAdminInput}
                onChange={(e) => onChatDisabledByAdminChange(e.target.checked)}
                className="mt-0.5 rounded border-[#dcdcd4] text-[#5a5a40] focus:ring-[#5a5a40]"
              />
              <div className="leading-none">
                <span className="text-xs font-bold text-[#5a5a40] block">Disable Chat Feature</span>
                <span className="text-[9px] text-[#8c8c82]">When enabled, the chat feature is completely disabled for all players. Messages are not sent or received, and the chat button is hidden from the menu.</span>
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
            {inviteUrl && (
              <div className="space-y-2 p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center">
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest self-start">Event Portal QR Code</span>
                <div className="bg-white p-2.5 rounded-2xl border border-emerald-200 shadow-sm">
                  <QRCode
                    value={inviteUrl}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#064e3b"
                    level="M"
                  />
                </div>
                <p className="text-[8px] text-center text-emerald-700 font-sans">
                  Scan to unlock registration and join the game!
                </p>
              </div>
            )}
          </div>

          {/* Admin Password Change Section */}
          <div className="space-y-2 pt-4 border-t border-[#e5e5dd]">
            <h3 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">🔐 Security</h3>

            <div className="space-y-2 p-3 bg-amber-50 rounded-2xl border border-amber-100">
              <p className="text-[9px] text-amber-700 font-semibold">Admin Session Debug</p>
              <div className="text-[10px] font-mono text-amber-900 space-y-1">
                <div className="flex justify-between gap-3">
                  <span>Active Sessions:</span>
                  <span className="font-bold">{adminActiveSessions}/2</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Current Session:</span>
                  <span className={`font-bold ${adminCurrentSessionActive ? "text-emerald-700" : "text-red-700"}`}>
                    {adminCurrentSessionActive ? "active" : "inactive"}
                  </span>
                </div>
                <div className="pt-1 border-t border-amber-200/60">
                  <p className="text-[9px] text-amber-700 mb-1">Session ID</p>
                  <p className="break-all text-[9px] bg-white border border-amber-200 rounded px-2 py-1">
                    {adminSessionId || "none"}
                  </p>
                </div>
              </div>
            </div>
            
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

          {backupError && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-[11px] font-medium border border-red-100 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>Backup failed: {backupError}</span>
            </div>
          )}

          {restoreError && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-[11px] font-medium border border-red-100 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>Restore failed: {restoreError}</span>
            </div>
          )}

          {restoreSuccess && (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-[11px] font-medium border border-emerald-100 flex items-center gap-1.5 animate-bounce">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{restoreSuccess}</span>
            </div>
          )}
        </form>

        {/* Footer with buttons */}
        <div className="p-6 border-t border-[#e5e5dd] bg-[#fafaf7] flex gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleBackup}
            disabled={isBackingUp}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isBackingUp ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <HardDrive className="h-3.5 w-3.5" />
            )}
            {isBackingUp ? "Backing up..." : "Backup Game Data"}
          </button>

          <button
            type="button"
            onClick={() => restoreFileInputRef.current?.click()}
            disabled={isRestoring}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isRestoring ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            {isRestoring ? "Restoring..." : "Restore from Backup"}
          </button>

          <input
            ref={restoreFileInputRef}
            type="file"
            accept=".json"
            onChange={handleRestore}
            className="hidden"
          />

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
