import React, { useEffect, useState } from "react";
import { Submission, ScavengerItem } from "../types";
import { X, Loader2, Sparkles, Download, Copy, Check } from "lucide-react";

interface SlideshowGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUserId: string | null;
  submissions: Submission[];
  items: ScavengerItem[];
  isLoading: boolean;
  error: string | null;
  generatedScript: string | null;
  onScriptGenerated?: (script: string) => void;
  onSlideshowCreated?: (slideshowId: string) => void;
}

const SLIDESHOW_FALLBACK_MODELS: string[] = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-3.5-flash"];

const SLIDESHOW_MODEL_COST_ESTIMATE: Record<string, { baseUsd: number; perPhotoUsd: number }> = {
  "gemini-2.5-flash": { baseUsd: 0.0030, perPhotoUsd: 0.00035 },
  "gemini-2.5-flash-lite": { baseUsd: 0.0022, perPhotoUsd: 0.00024 },
  "gemini-2.5-pro": { baseUsd: 0.0060, perPhotoUsd: 0.00075 },
  "gemini-3.5-flash": { baseUsd: 0.0030, perPhotoUsd: 0.00035 },
};

type SlideshowGenerationMode = "deterministic_local" | "gemini_cinematic" | "ai_ordered_budget";

const SLIDESHOW_GENERATION_MODE_OPTIONS: Array<{ value: SlideshowGenerationMode; label: string; detail: string }> = [
  {
    value: "deterministic_local",
    label: "Mode A - Deterministic Local",
    detail: "Uses your selected photos in strict mission order with local FFmpeg rendering.",
  },
  {
    value: "gemini_cinematic",
    label: "Mode B - Gemini Cinematic",
    detail: "Gemini generates a cinematic video directly; can fall back to Mode C if unavailable.",
  },
  {
    value: "ai_ordered_budget",
    label: "Mode C - Budget AI Ordered",
    detail: "Cheaper AI overlays/transitions while keeping your photos in order, rendered locally.",
  },
];

const DEFAULT_SLIDESHOW_PROMPT = `You are an expert multimedia producer specializing in creating family reunion slideshows.

I have a collection of photos from a family scavenger hunt. Here are the photos grouped by mission:
{{PHOTO_LIST}}

Please generate a detailed slideshow script that includes:

1. Mission Group Structure: Keep photos grouped by mission and suggest timing
2. Mission Transition Cards: Add a transition card between each mission segment with mission title and mission description. The title should appear centered in large, bold text, and the description in smaller text below. The text should not overflow the card and should be legible. Apply a custom background that fits the current mission description but doesn't distract from the text.
3. Transitions: Recommend transitions for each slide and between mission groups
4. Music Recommendations: Suggest background music tracks that fit the full story arc
5. Timing & Pacing: Provide total duration estimate and pacing guidance
6. Animation Effects: Suggest subtle text overlay animations (mission title, photographer name, etc.) Keep it very subtle and not distracting from the photos themselves.
7. Color Grading: Suggest filters or adjustments for visual consistency
8. Voiceover Suggestions: Optional short commentary between mission groups
9. Final Scoreboard Card: End with one single closing card that combines winners and full standings (all players and points), styled like the scores tab with a top 3 podium and the rest of the players listed below in descending order. Include a celebratory message for all participants.

Format your response as a professional production guide. Keep it uplifting and celebratory for a family reunion event.`;

export function SlideshowGeneratorModal({
  isOpen,
  onClose,
  adminUserId,
  submissions,
  items,
  isLoading,
  error,
  generatedScript,
  onScriptGenerated,
  onSlideshowCreated
}: SlideshowGeneratorModalProps) {
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(new Set());
  const [generatingScript, setGeneratingScript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localScript, setLocalScript] = useState<string | null>(generatedScript);
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_SLIDESHOW_PROMPT);
  const [includeMissionNarration, setIncludeMissionNarration] = useState(false);
  const [slideshowModels, setSlideshowModels] = useState<string[]>(SLIDESHOW_FALLBACK_MODELS);
  const [slideshowModelCostLookup, setSlideshowModelCostLookup] = useState<Record<string, { baseUsd: number; perPhotoUsd: number }>>(SLIDESHOW_MODEL_COST_ESTIMATE);
  const [slideshowModel, setSlideshowModel] = useState<string>(SLIDESHOW_FALLBACK_MODELS[0]);
  const [generationMode, setGenerationMode] = useState<SlideshowGenerationMode>("deterministic_local");
  const [generationSource, setGenerationSource] = useState<string | null>(null);
  const [preGenEstimateUsd, setPreGenEstimateUsd] = useState<number | null>(null);
  const [serverCostEstimate, setServerCostEstimate] = useState<{ baseUsd: number; perPhotoUsd: number; totalUsd: number; pictureCount: number } | null>(null);
  const [serverUsageCostEstimate, setServerUsageCostEstimate] = useState<{ totalUsd: number; promptTokens: number; completionTokens: number; totalTokens: number } | null>(null);

  const approvedSubmissions = submissions.filter((sub) => sub.status === "approved");
  const groupedApprovedSubmissions = approvedSubmissions.reduce((acc, sub) => {
    const item = items.find((it) => it.id === sub.itemId);
    const missionTitle = item?.title || "Unknown";
    if (!acc[missionTitle]) {
      acc[missionTitle] = [];
    }
    acc[missionTitle].push(sub);
    return acc;
  }, {} as Record<string, Submission[]>);

  const toggleSubmission = (subId: string) => {
    const updated = new Set(selectedSubmissionIds);
    if (updated.has(subId)) {
      updated.delete(subId);
    } else {
      updated.add(subId);
    }
    setSelectedSubmissionIds(updated);
  };

  const toggleAll = () => {
    if (selectedSubmissionIds.size === approvedSubmissions.length) {
      setSelectedSubmissionIds(new Set());
    } else {
      setSelectedSubmissionIds(new Set(approvedSubmissions.map((sub) => sub.id)));
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadModelCatalog = async () => {
      try {
        const response = await fetch("/api/ai-model-catalog");
        if (!response.ok) return;
        const payload = await response.json();
        const catalog = Array.isArray(payload?.slideshowModels) ? payload.slideshowModels : [];
        if (!catalog.length) return;

        const models = catalog
          .map((entry: any) => String(entry?.model || "").trim())
          .filter((name: string) => !!name);
        if (!models.length || cancelled) return;

        const lookup: Record<string, { baseUsd: number; perPhotoUsd: number }> = { ...SLIDESHOW_MODEL_COST_ESTIMATE };
        catalog.forEach((entry: any) => {
          const model = String(entry?.model || "").trim();
          const baseUsd = Number(entry?.baseUsd);
          const perPhotoUsd = Number(entry?.perPhotoUsd);
          if (model && Number.isFinite(baseUsd) && Number.isFinite(perPhotoUsd)) {
            lookup[model] = { baseUsd, perPhotoUsd };
          }
        });

        setSlideshowModels(models);
        setSlideshowModelCostLookup(lookup);
        setSlideshowModel((current) => (models.includes(current) ? current : models[0]));
      } catch (err) {
        // Keep fallback model list if catalog fetch fails.
      }
    };

    loadModelCatalog();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleGenerateSlideshow = async () => {
    if (selectedSubmissionIds.size === 0 || !adminUserId) return;

    setGeneratingScript(true);
    setLocalError(null);
    setGenerationSource(null);
    setServerCostEstimate(null);
    setServerUsageCostEstimate(null);
    const estimate = slideshowModelCostLookup[slideshowModel];
    if (estimate) {
      setPreGenEstimateUsd(
        Number((estimate.baseUsd + estimate.perPhotoUsd * selectedSubmissionIds.size).toFixed(4))
      );
    } else {
      setPreGenEstimateUsd(null);
    }
    try {
      const selectedSubs = approvedSubmissions.filter((sub) => selectedSubmissionIds.has(sub.id));
      const response = await fetch("/api/slideshow/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissions: selectedSubs.map((sub) => ({
            id: sub.id,
            imageUrl: sub.imageUrl,
            title: items.find((it) => it.id === sub.itemId)?.title || "Unknown",
            description: items.find((it) => it.id === sub.itemId)?.description || "",
            username: sub.username,
          })),
          createdBy: adminUserId,
          title: `Family Slideshow - ${new Date().toLocaleDateString()}`,
          promptTemplate,
          includeMissionNarration,
          slideshowModel,
          generationMode,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || "Failed to generate slideshow");
      }

      const data = await response.json();
      setLocalScript(data.slideshow.script);
      const videoInfo = data?.generation?.video;
      const requestedMode = data?.generation?.requestedMode;
      if (videoInfo?.created) {
        if (videoInfo?.mode === "basic_fallback") {
          setGenerationSource("Script generated and fallback MP4 slideshow created");
        } else if (videoInfo?.mode === "deterministic_local") {
          setGenerationSource("Script generated and deterministic local slideshow rendered");
        } else if (videoInfo?.mode === "ai_ordered_budget") {
          setGenerationSource(`Script generated and budget AI ordered slideshow rendered with ${videoInfo.aiModel || "AI"}`);
        } else if (videoInfo?.mode === "gemini_cinematic") {
          setGenerationSource(`Script generated and cinematic Gemini video rendered with ${videoInfo.aiModel || "Gemini"}`);
        } else if (videoInfo?.aiModel) {
          setGenerationSource(`Script generated and MP4 slideshow created with ${videoInfo.aiModel}`);
        } else {
          setGenerationSource("Script generated and MP4 slideshow created");
        }
        if (requestedMode === "gemini_cinematic" && videoInfo?.mode !== "gemini_cinematic") {
          setGenerationSource((prev) => `${prev || "Video generated"} (fell back from cinematic mode)`);
        }
      } else if (data?.generation?.usedFallbackScript) {
        setGenerationSource("Script generated using offline fallback (video render unavailable)");
      } else if (data?.generation?.aiModel) {
        setGenerationSource(`Script generated with ${data.generation.aiModel} (video render unavailable)`);
      } else {
        setGenerationSource("Script generated (video render unavailable)");
      }
      if (data?.generation?.costEstimate) {
        setServerCostEstimate(data.generation.costEstimate);
      }
      if (data?.generation?.geminiApiUsageCostEstimate) {
        setServerUsageCostEstimate(data.generation.geminiApiUsageCostEstimate);
      }
      if (onScriptGenerated) {
        onScriptGenerated(data.slideshow.script);
      }
      if (onSlideshowCreated && data?.slideshow?.id) {
        onSlideshowCreated(data.slideshow.id);
      }
    } catch (err: any) {
      console.error("Slideshow generation error:", err);
      setLocalError(err.message || "Failed to generate slideshow script");
    } finally {
      setGeneratingScript(false);
    }
  };

  const downloadScript = () => {
    const scriptToDownload = localScript || generatedScript;
    if (!scriptToDownload) return;

    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(scriptToDownload));
    element.setAttribute("download", `slideshow-script-${new Date().getTime()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyScript = () => {
    const scriptToCopy = localScript || generatedScript;
    if (!scriptToCopy) return;
    navigator.clipboard.writeText(scriptToCopy);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  if (!isOpen) return null;

  const currentScript = localScript || generatedScript;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-lg animate-fadeIn overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-6 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-800">AI Slideshow Generator</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Step 1: Select Images */}
          {!currentScript && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-800 mb-2">Step 1: Select Photos</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Choose approved submissions to include in your AI-generated slideshow with animations and music.
                </p>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Generation Mode</label>
                    <select
                      value={generationMode}
                      onChange={(e) => setGenerationMode(e.target.value as SlideshowGenerationMode)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      {SLIDESHOW_GENERATION_MODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500">
                      {SLIDESHOW_GENERATION_MODE_OPTIONS.find((opt) => opt.value === generationMode)?.detail}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Slideshow AI Model</label>
                    <select
                      value={slideshowModel}
                      onChange={(e) => setSlideshowModel(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      {slideshowModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Estimated Cost</label>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                      <div className="font-semibold">{selectedSubmissionIds.size} photo(s)</div>
                      {generationMode === "deterministic_local" ? (
                        <>
                          <div className="font-mono text-[11px] mt-0.5 text-emerald-700">Local render path</div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            Gemini is used for script guidance; slideshow assembly stays local and in-order.
                          </div>
                        </>
                      ) : slideshowModelCostLookup[slideshowModel] ? (
                        <>
                          <div className="font-mono text-[11px] mt-0.5">
                            ${(slideshowModelCostLookup[slideshowModel].baseUsd + (slideshowModelCostLookup[slideshowModel].perPhotoUsd * selectedSubmissionIds.size)).toFixed(4)} USD
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            Base ${slideshowModelCostLookup[slideshowModel].baseUsd.toFixed(4)} + ${slideshowModelCostLookup[slideshowModel].perPhotoUsd.toFixed(5)} per photo
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] mt-0.5 text-gray-500">
                          Estimate unavailable for this model
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Gemini Prompt Template</label>
                  <button
                    type="button"
                    onClick={() => setPromptTemplate(DEFAULT_SLIDESHOW_PROMPT)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Reset Default
                  </button>
                </div>
                <textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <p className="text-[11px] text-gray-500">Use <span className="font-mono">{"{{PHOTO_LIST}}"}</span> where you want mission-grouped photo details inserted.</p>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeMissionNarration}
                    onChange={(e) => setIncludeMissionNarration(e.target.checked)}
                    className="w-4 h-4 accent-purple-500"
                  />
                  Include mission narrator overlays (AI will create a short story line for each mission group)
                </label>
              </div>

              {approvedSubmissions.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500">
                  <p className="text-sm">No approved submissions available</p>
                </div>
              ) : (
                <>
                  {/* Select All Toggle */}
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSubmissionIds.size === approvedSubmissions.length && approvedSubmissions.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Select All ({approvedSubmissions.length} photos)
                    </span>
                  </label>

                  {/* Submission List Grouped by Mission */}
                  <div className="space-y-3 max-h-72 overflow-y-auto border border-gray-100 rounded-lg p-3">
                    {Object.entries(groupedApprovedSubmissions).map(([missionTitle, missionSubs]) => (
                      <div key={missionTitle} className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{missionTitle} ({missionSubs.length})</p>
                        {missionSubs.map((sub) => (
                          <label
                            key={sub.id}
                            className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSubmissionIds.has(sub.id)}
                              onChange={() => toggleSubmission(sub.id)}
                              className="w-4 h-4 accent-purple-500"
                            />
                            <img
                              src={sub.imageUrl}
                              alt={missionTitle}
                              className="w-12 h-12 object-cover rounded-lg"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{missionTitle}</p>
                              <p className="text-xs text-gray-500">by {sub.username}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerateSlideshow}
                    disabled={selectedSubmissionIds.size === 0 || generatingScript || !adminUserId}
                    className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    {generatingScript ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Script + Slideshow...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Script + Slideshow ({selectedSubmissionIds.size} photos)
                      </>
                    )}
                  </button>
                </>
              )}

              {(localError || error) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {localError || error}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Display Generated Script */}
          {currentScript && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-800 mb-2">Your AI Slideshow Script</h3>
                <p className="text-xs text-gray-500 mb-4">
                  This script includes animation suggestions, music recommendations, and timing guidance for your family reunion slideshow.
                </p>
                {generationSource && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 inline-block">
                    {generationSource}
                  </p>
                )}
              {(preGenEstimateUsd !== null || serverCostEstimate) && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700 space-y-1.5">
                  <p className="font-bold uppercase tracking-wider text-gray-500 text-[10px]">Cost Breakdown</p>
                  {preGenEstimateUsd !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Pre-generation estimate</span>
                      <span className="font-mono font-semibold">${preGenEstimateUsd.toFixed(4)} USD</span>
                    </div>
                  )}
                  {serverCostEstimate && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Server-returned estimate</span>
                      <span className="font-mono font-semibold text-purple-700">${serverCostEstimate.totalUsd.toFixed(4)} USD</span>
                    </div>
                  )}
                  {serverCostEstimate && (
                    <div className="text-[10px] text-gray-400 pt-0.5">
                      Base ${serverCostEstimate.baseUsd.toFixed(4)} + ${serverCostEstimate.perPhotoUsd.toFixed(5)}/photo &times; {serverCostEstimate.pictureCount} photos
                    </div>
                  )}
                  {serverUsageCostEstimate && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Gemini API usage estimate</span>
                        <span className="font-mono font-semibold text-emerald-700">${serverUsageCostEstimate.totalUsd.toFixed(6)} USD</span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {serverUsageCostEstimate.promptTokens} prompt + {serverUsageCostEstimate.completionTokens} completion = {serverUsageCostEstimate.totalTokens} total tokens
                      </div>
                    </>
                  )}
                </div>
              )}
              </div>

              {/* Script Display */}
              <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto border border-gray-200">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {currentScript}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={copyScript}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300 transition"
                >
                  {copiedScript ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Script
                    </>
                  )}
                </button>
                <button
                  onClick={downloadScript}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>

              {/* Back Button */}
              <button
                onClick={() => {
                  setLocalScript(null);
                  setSelectedSubmissionIds(new Set());
                  setPreGenEstimateUsd(null);
                  setServerCostEstimate(null);
                  setServerUsageCostEstimate(null);
                  setGenerationSource(null);
                }}
                className="w-full text-gray-700 font-medium py-2 hover:bg-gray-100 rounded-lg transition"
              >
                ← Generate Another Slideshow
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
