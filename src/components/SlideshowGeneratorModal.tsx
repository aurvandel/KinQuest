import React, { useEffect, useState } from "react";
import { Submission, ScavengerItem } from "../types";
import { X, Loader2, Sparkles, Download, Copy, Check } from "lucide-react";
import { DEFAULT_LEADERBOARD_IMAGE_PROMPT, DEFAULT_SLIDESHOW_PROMPT } from "../../slideshow-prompt.ts";
import { copyTextToClipboard } from "../utils/clipboard";

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
  slideshowProvider: "ollama" | "gemini" | "openai";
  onSlideshowProviderChange: (provider: "ollama" | "gemini" | "openai") => void;
  providerAvailability?: Record<"ollama" | "gemini" | "openai", boolean> | null;
}

interface SlideshowModelOption {
  model: string;
  costTier: "low" | "medium" | "high";
}

interface MissionCardPlan {
  missionTitle: string;
  missionDescription: string;
  photoCount: number;
  cardImagePrompt: string;
}

interface MissionCardImage {
  missionTitle: string;
  imageUrl: string | null;
  error: string | null;
}

interface SlideshowRenderPlan {
  title: string;
  overview: string;
  colorGrading: { brightness: number; contrast: number; saturation: number; gamma: number };
  transitionSeconds: number;
  defaultTransition: string;
  missions: Array<{
    missionTitle: string;
    cardDurationSeconds: number;
    photoDurationSeconds: number;
    transition: string;
    narration: string;
    cardImagePrompt: string;
  }>;
  finalCard: { durationSeconds: number; transition: string };
  musicSuggestions: string[];
  similarMusicSuggestions: string[];
  parsedFromAi: boolean;
}

interface SavedMissionSlideshowPlan {
  id: string;
  title: string;
  missionSlidesScript: string;
  renderPlan: SlideshowRenderPlan | null;
  missionCardPlans: MissionCardPlan[];
  missionCardImages: MissionCardImage[];
  createdAt: string;
}

type SlideshowImageProvider = "gemini" | "openai";

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
  onSlideshowCreated,
  slideshowProvider,
  onSlideshowProviderChange,
  providerAvailability = null
}: SlideshowGeneratorModalProps) {
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(new Set());
  const [generatingMissionSlides, setGeneratingMissionSlides] = useState(false);
  const [generatingMissionCardImages, setGeneratingMissionCardImages] = useState(false);
  const [generatingLeaderboardSlide, setGeneratingLeaderboardSlide] = useState(false);
  const [composingSlideshow, setComposingSlideshow] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localScript, setLocalScript] = useState<string | null>(generatedScript);
  const [missionSlidesScript, setMissionSlidesScript] = useState<string | null>(null);
  const [renderPlan, setRenderPlan] = useState<SlideshowRenderPlan | null>(null);
  const [missionCardPlans, setMissionCardPlans] = useState<MissionCardPlan[]>([]);
  const [missionCardImages, setMissionCardImages] = useState<MissionCardImage[]>([]);
  const [leaderboardSlideScript, setLeaderboardSlideScript] = useState<string | null>(null);
  const [leaderboardImageUrl, setLeaderboardImageUrl] = useState<string | null>(null);
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_SLIDESHOW_PROMPT);
  const [leaderboardImagePromptTemplate, setLeaderboardImagePromptTemplate] = useState(DEFAULT_LEADERBOARD_IMAGE_PROMPT);
  const [includeMissionNarration, setIncludeMissionNarration] = useState(false);
  const [slideshowModel, setSlideshowModel] = useState<string>("");
  const [leaderboardImageProvider, setLeaderboardImageProvider] = useState<SlideshowImageProvider>("gemini");
  const [leaderboardImageModel, setLeaderboardImageModel] = useState("");
  const [slideshowModels, setSlideshowModels] = useState<Record<"ollama" | "gemini" | "openai", SlideshowModelOption[]>>({
    ollama: [],
    gemini: [],
    openai: [],
  });
  const [leaderboardImageModels, setLeaderboardImageModels] = useState<Record<SlideshowImageProvider, SlideshowModelOption[]>>({
    gemini: [],
    openai: [],
  });
  const [generationSource, setGenerationSource] = useState<string | null>(null);
  const [songQueriesInput, setSongQueriesInput] = useState("");
  const [songPreviewLoading, setSongPreviewLoading] = useState(false);
  const [savedMissionPlans, setSavedMissionPlans] = useState<SavedMissionSlideshowPlan[]>([]);
  const [selectedSavedMissionPlanId, setSelectedSavedMissionPlanId] = useState("");
  const [songPreview, setSongPreview] = useState<{
    requested: string[];
    matches: Array<{ query: string; found: boolean; title?: string; artist?: string; durationSeconds?: number; durationLabel?: string }>;
    foundCount: number;
    matchedDurationSeconds: number;
    matchedDurationLabel: string;
    estimatedSlideshowDurationSeconds: number;
    estimatedSlideshowDurationLabel: string;
    fallbackSource: "file" | "silence";
  } | null>(null);

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
        const selectedCatalog = Array.isArray(payload?.slideshowProviders)
          ? payload.slideshowProviders.find((entry: any) => entry?.provider === slideshowProvider)
          : null;
        const models: SlideshowModelOption[] = Array.isArray(selectedCatalog?.models)
          ? selectedCatalog.models
              .map((entry: any) => ({
                model: typeof entry === "string" ? entry.trim() : String(entry?.model || "").trim(),
                costTier: entry?.costTier === "high" || entry?.costTier === "medium" ? entry.costTier : "low",
              }))
              .filter((entry: SlideshowModelOption) => entry.model.length > 0)
          : [];
        if (cancelled) return;
        setSlideshowModels((current) => ({ ...current, [slideshowProvider]: models }));
        const firstModel = models[0]?.model || "";
        if (firstModel) {
          setSlideshowModel(firstModel);
        }

        const imageModelsByProvider = (["gemini", "openai"] as SlideshowImageProvider[]).reduce((result, provider) => {
          const catalog = Array.isArray(payload?.slideshowImageProviders)
            ? payload.slideshowImageProviders.find((entry: any) => entry?.provider === provider)
            : null;
          result[provider] = Array.isArray(catalog?.models)
            ? catalog.models
                .map((entry: any) => ({
                  model: typeof entry === "string" ? entry.trim() : String(entry?.model || "").trim(),
                  costTier: entry?.costTier === "high" || entry?.costTier === "medium" ? entry.costTier : "low",
                }))
                .filter((entry: SlideshowModelOption) => entry.model.length > 0)
            : [];
          return result;
        }, {} as Record<SlideshowImageProvider, SlideshowModelOption[]>);
        setLeaderboardImageModels(imageModelsByProvider);
        const firstImageModel = imageModelsByProvider[leaderboardImageProvider][0]?.model || "";
        if (firstImageModel) setLeaderboardImageModel(firstImageModel);
      } catch (err) {
        // Keep local default if catalog fetch fails.
      }
    };

    loadModelCatalog();

    return () => {
      cancelled = true;
    };
  }, [isOpen, slideshowProvider, leaderboardImageProvider]);

  useEffect(() => {
    if (!isOpen || !adminUserId) return;

    let cancelled = false;
    const loadSavedMissionPlans = async () => {
      try {
        const response = await fetch(`/api/slideshow/mission-plans?createdBy=${encodeURIComponent(adminUserId)}`);
        if (!response.ok) return;
        const plans = await response.json();
        if (!cancelled) setSavedMissionPlans(Array.isArray(plans) ? plans : []);
      } catch {
        if (!cancelled) setSavedMissionPlans([]);
      }
    };

    loadSavedMissionPlans();
    return () => {
      cancelled = true;
    };
  }, [isOpen, adminUserId]);

  const selectedSlideshowModels = slideshowModels[slideshowProvider];
  const slideshowModelOptions = selectedSlideshowModels.some((entry) => entry.model === slideshowModel)
    ? selectedSlideshowModels
    : slideshowModel
      ? [{ model: slideshowModel, costTier: "medium" as const }, ...selectedSlideshowModels]
      : selectedSlideshowModels;
  const selectedLeaderboardImageModels = leaderboardImageModels[leaderboardImageProvider];

  const applySavedMissionPlan = () => {
    const selectedPlan = savedMissionPlans.find((plan) => plan.id === selectedSavedMissionPlanId);
    if (!selectedPlan) return;

    setMissionSlidesScript(selectedPlan.missionSlidesScript || null);
    setRenderPlan(selectedPlan.renderPlan);
    setMissionCardPlans(Array.isArray(selectedPlan.missionCardPlans) ? selectedPlan.missionCardPlans : []);
    setMissionCardImages(Array.isArray(selectedPlan.missionCardImages) ? selectedPlan.missionCardImages : []);
    setLocalScript(null);
    setLocalError(null);
  };

  const getSelectedSubmissionPayload = () => {
    const selectedSubs = approvedSubmissions.filter((sub) => selectedSubmissionIds.has(sub.id));
    return selectedSubs.map((sub) => ({
      id: sub.id,
      imageUrl: sub.imageUrl,
      title: items.find((it) => it.id === sub.itemId)?.title || "Unknown",
      description: items.find((it) => it.id === sub.itemId)?.description || "",
      username: sub.username,
    }));
  };

  const parseSongQueries = (value: string): string[] => {
    return String(value || "")
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 8);
  };

  const handleTestSongMatches = async () => {
    if (!adminUserId || selectedSubmissionIds.size === 0) return;

    setSongPreviewLoading(true);
    setLocalError(null);
    try {
      const requestedSongs = parseSongQueries(songQueriesInput);
      const response = await fetch("/api/slideshow/song-match-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: adminUserId,
          songQueries: requestedSongs,
          submissions: getSelectedSubmissionPayload(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to preview songs");
      }

      setSongPreview({
        requested: Array.isArray(data?.requested) ? data.requested : [],
        matches: Array.isArray(data?.matches) ? data.matches : [],
        foundCount: Number(data?.foundCount) || 0,
        matchedDurationSeconds: Number(data?.matchedDurationSeconds) || 0,
        matchedDurationLabel: String(data?.matchedDurationLabel || "0:00"),
        estimatedSlideshowDurationSeconds: Number(data?.estimatedSlideshowDurationSeconds) || 0,
        estimatedSlideshowDurationLabel: String(data?.estimatedSlideshowDurationLabel || "0:00"),
        fallbackSource: data?.fallbackSource === "silence" ? "silence" : "file",
      });
    } catch (err: any) {
      setLocalError(err?.message || "Failed to preview songs");
      setSongPreview(null);
    } finally {
      setSongPreviewLoading(false);
    }
  };

  const handleGenerateMissionSlides = async () => {
    if (selectedSubmissionIds.size === 0 || !adminUserId) return;

    setGeneratingMissionSlides(true);
    setLocalError(null);
    try {
      const response = await fetch("/api/slideshow/generate-mission-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissions: getSelectedSubmissionPayload(),
          createdBy: adminUserId,
          promptTemplate,
          slideshowProvider,
          slideshowModel,
          songQueries: parseSongQueries(songQueriesInput),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || "Failed to generate mission slides");
      }

      const data = await response.json();
      setMissionSlidesScript(String(data?.missionSlidesScript || "").trim() || null);

      const plan: SlideshowRenderPlan | null = data?.renderPlan || null;
      setRenderPlan(plan);
      setMissionCardImages([]);
      if (data?.savedPlan?.id) {
        setSavedMissionPlans((current) => [data.savedPlan as SavedMissionSlideshowPlan, ...current.filter((entry) => entry.id !== data.savedPlan.id)]);
        setSelectedSavedMissionPlanId(String(data.savedPlan.id));
      }
      const suggestedSongs = [
        ...(Array.isArray(plan?.musicSuggestions) ? plan.musicSuggestions : []),
        ...(Array.isArray(plan?.similarMusicSuggestions) ? plan.similarMusicSuggestions : []),
      ];
      if (suggestedSongs.length > 0 && !songQueriesInput.trim()) {
        setSongQueriesInput(suggestedSongs.join("\n"));
      }

      const cards = Array.isArray(data?.missionCards) ? data.missionCards : [];
      setMissionCardPlans(
        cards.map((card: any) => ({
          missionTitle: String(card?.missionTitle || ""),
          missionDescription: String(card?.missionDescription || ""),
          photoCount: Number(card?.photoCount) || 0,
          cardImagePrompt:
            plan?.missions?.find((mission) => mission.missionTitle === card?.missionTitle)?.cardImagePrompt || "",
        }))
      );
    } catch (err: any) {
      console.error("Mission slide generation error:", err);
      setLocalError(err.message || "Failed to generate mission slide script");
    } finally {
      setGeneratingMissionSlides(false);
    }
  };

  const handleGenerateMissionCardImages = async (missions = missionCardPlans) => {
    if (!adminUserId || missions.length === 0) return;

    setGeneratingMissionCardImages(true);
    setLocalError(null);
    try {
      const response = await fetch("/api/slideshow/generate-mission-card-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createdBy: adminUserId,
          imageProvider: leaderboardImageProvider,
          imageModel: leaderboardImageModel,
          planId: selectedSavedMissionPlanId || undefined,
          missions,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to generate mission card images");
      }

      const generatedCards: MissionCardImage[] = (Array.isArray(data?.cards) ? data.cards : []).map((card: any) => ({
          missionTitle: String(card?.missionTitle || ""),
          imageUrl: card?.imageUrl ? String(card.imageUrl) : null,
          error: card?.error ? String(card.error) : null,
        }));
      setMissionCardImages((current) => {
        const updated = new Map(current.map((card) => [card.missionTitle, card]));
        generatedCards.forEach((card) => {
          const existing = updated.get(card.missionTitle);
          updated.set(card.missionTitle, card.imageUrl || !existing ? card : { ...existing, error: card.error });
        });
        return [...updated.values()];
      });
      if (selectedSavedMissionPlanId) {
        setSavedMissionPlans((current) => current.map((plan) => plan.id === selectedSavedMissionPlanId
          ? { ...plan, missionCardImages: [...new Map([...plan.missionCardImages, ...generatedCards].map((card) => [card.missionTitle, card])).values()] }
          : plan));
      }
    } catch (err: any) {
      console.error("Mission card image generation error:", err);
      setLocalError(err.message || "Failed to generate mission card images");
    } finally {
      setGeneratingMissionCardImages(false);
    }
  };

  const handleGenerateLeaderboardSlide = async () => {
    if (!adminUserId) return;

    setGeneratingLeaderboardSlide(true);
    setLocalError(null);
    try {
      const response = await fetch("/api/slideshow/generate-leaderboard-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createdBy: adminUserId,
          imageProvider: leaderboardImageProvider,
          imageModel: leaderboardImageModel,
          imagePromptTemplate: leaderboardImagePromptTemplate,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || "Failed to generate leaderboard slide");
      }

      const data = await response.json();
      setLeaderboardSlideScript(String(data?.leaderboardSlideScript || "").trim() || null);
      setLeaderboardImageUrl(String(data?.imageUrl || "").trim() || null);
    } catch (err: any) {
      console.error("Leaderboard generation error:", err);
      setLocalError(err.message || "Failed to generate leaderboard slide script");
    } finally {
      setGeneratingLeaderboardSlide(false);
    }
  };

  const handleComposeSlideshow = async () => {
    if (selectedSubmissionIds.size === 0 || !adminUserId) return;

    setComposingSlideshow(true);
    setLocalError(null);
    setGenerationSource(null);
    try {
      const response = await fetch("/api/slideshow/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissions: getSelectedSubmissionPayload(),
          createdBy: adminUserId,
          title: `Family Slideshow - ${new Date().toLocaleDateString()}`,
          promptTemplate,
          includeMissionNarration,
          slideshowModel,
          slideshowProvider,
          songQueries: parseSongQueries(songQueriesInput),
          missionSlidesScript,
          leaderboardSlideScript,
          leaderboardImageUrl,
          missionCardImages: missionCardImages
            .filter((card) => !!card.imageUrl)
            .map((card) => ({ missionTitle: card.missionTitle, imageUrl: card.imageUrl })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || "Failed to compose slideshow");
      }

      const data = await response.json();
      setLocalScript(data.slideshow.script);
      const videoInfo = data?.generation?.video;
      if (data?.generation?.cacheHit) {
        setGenerationSource("Reused cached slideshow and video output");
      } else if (videoInfo?.created) {
        setGenerationSource(`Composed and rendered locally (${videoInfo.aiModel || "AI"})`);
      } else {
        setGenerationSource("Composed slideshow, but video render is unavailable");
      }

      if (onScriptGenerated) {
        onScriptGenerated(data.slideshow.script);
      }

      if (!videoInfo?.created) {
        setLocalError(videoInfo?.error || "Slideshow was composed, but MP4 output is unavailable. Please try again.");
        return;
      }

      if (onSlideshowCreated && data?.slideshow?.id) {
        onSlideshowCreated(data.slideshow.id);
      }
    } catch (err: any) {
      console.error("Slideshow composition error:", err);
      setLocalError(err.message || "Failed to compose slideshow");
    } finally {
      setComposingSlideshow(false);
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

  const copyScript = async () => {
    const scriptToCopy = localScript || generatedScript;
    if (!scriptToCopy) return;
    if (!(await copyTextToClipboard(scriptToCopy))) return;
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  if (!isOpen) return null;

  const currentScript = localScript || generatedScript;
  const step1Done = !!missionSlidesScript;
  const step2Done = missionCardPlans.length > 0 && missionCardImages.some((card) => !!card.imageUrl);
  const step3Done = !!leaderboardSlideScript && !!leaderboardImageUrl;
  const step4Done = !!currentScript;

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
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-2">Workflow Progress</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className={`rounded-lg border px-3 py-2 text-xs ${step1Done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600"}`}>
                <div className="font-semibold">Step 1</div>
                <div>Production plan {step1Done ? "complete" : "pending"}</div>
              </div>
              <div className={`rounded-lg border px-3 py-2 text-xs ${step2Done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600"}`}>
                <div className="font-semibold">Step 2</div>
                <div>Mission card art {step2Done ? "complete" : "pending"}</div>
              </div>
              <div className={`rounded-lg border px-3 py-2 text-xs ${step3Done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600"}`}>
                <div className="font-semibold">Step 3</div>
                <div>Leaderboard slide {step3Done ? "complete" : "pending"}</div>
              </div>
              <div className={`rounded-lg border px-3 py-2 text-xs ${step4Done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600"}`}>
                <div className="font-semibold">Step 4</div>
                <div>Final compose {step4Done ? "complete" : "pending"}</div>
              </div>
            </div>
          </div>

          {/* Step 1: Select Images */}
          {!currentScript && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-800 mb-2">Step 1: Select Photos</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Choose approved submissions, generate mission and leaderboard slide content separately, then compose the final MP4 slideshow.
                </p>
              </div>

              <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">AI Provider</label>
                    <select
                      value={slideshowProvider}
                      onChange={(e) => {
                        const provider = e.target.value === "gemini" || e.target.value === "openai" ? e.target.value : "ollama";
                        onSlideshowProviderChange(provider);
                        const firstModel = slideshowModels[provider][0]?.model;
                        if (firstModel) setSlideshowModel(firstModel);
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      <option value="ollama" disabled={providerAvailability ? !providerAvailability.ollama : false}>Ollama{providerAvailability && !providerAvailability.ollama ? " (not ready)" : ""}</option>
                      <option value="gemini" disabled={providerAvailability ? !providerAvailability.gemini : false}>Gemini{providerAvailability && !providerAvailability.gemini ? " (not ready)" : ""}</option>
                      <option value="openai" disabled={providerAvailability ? !providerAvailability.openai : false}>OpenAI{providerAvailability && !providerAvailability.openai ? " (not ready)" : ""}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Slideshow AI Model</label>
                    <select
                      value={slideshowModel}
                      onChange={(e) => setSlideshowModel(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      {slideshowModelOptions.length > 0
                        ? slideshowModelOptions.map((entry) => (
                            <option key={entry.model} value={entry.model}>
                              {entry.model} ({entry.costTier} cost)
                            </option>
                          ))
                        : <option value={slideshowModel}>{slideshowModel || "Loading models..."}</option>}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Pipeline</label>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                      <div className="font-semibold">{selectedSubmissionIds.size} photo(s)</div>
                      <div className="font-mono text-[11px] mt-0.5 text-emerald-700">Mission slides + leaderboard + compose</div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        Local FFmpeg MP4 rendering is used.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">AI Prompt Template</label>
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
                <p className="text-[11px] text-gray-500">
                  Photos are not sent to the AI. Use <span className="font-mono">{"{{MISSION_SUMMARY}}"}</span> for the mission list with per-mission photo counts, plus <span className="font-mono">{"{{TOTAL_PHOTOS}}"}</span> and <span className="font-mono">{"{{MISSION_COUNT}}"}</span>.
                </p>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeMissionNarration}
                    onChange={(e) => setIncludeMissionNarration(e.target.checked)}
                    className="w-4 h-4 accent-purple-500"
                  />
                  Include mission narrator overlays (AI will create a short story line for each mission group)
                </label>

                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-amber-900">Leaderboard Image Generation</label>
                    <button
                      type="button"
                      onClick={() => setLeaderboardImagePromptTemplate(DEFAULT_LEADERBOARD_IMAGE_PROMPT)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Reset Default
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Image Provider</label>
                      <select
                        value={leaderboardImageProvider}
                        onChange={(e) => {
                          const provider: SlideshowImageProvider = e.target.value === "openai" ? "openai" : "gemini";
                          setLeaderboardImageProvider(provider);
                          setLeaderboardImageModel(leaderboardImageModels[provider][0]?.model || "");
                        }}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      >
                        <option value="gemini" disabled={providerAvailability ? !providerAvailability.gemini : false}>Gemini{providerAvailability && !providerAvailability.gemini ? " (not ready)" : ""}</option>
                        <option value="openai" disabled={providerAvailability ? !providerAvailability.openai : false}>OpenAI{providerAvailability && !providerAvailability.openai ? " (not ready)" : ""}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Image Model</label>
                      <select
                        value={leaderboardImageModel}
                        onChange={(e) => setLeaderboardImageModel(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
                      >
                        {selectedLeaderboardImageModels.length > 0
                          ? selectedLeaderboardImageModels.map((entry) => <option key={entry.model} value={entry.model}>{entry.model} ({entry.costTier} cost)</option>)
                          : <option value="">No image models available</option>}
                      </select>
                    </div>
                  </div>
                  <textarea
                    value={leaderboardImagePromptTemplate}
                    onChange={(e) => setLeaderboardImagePromptTemplate(e.target.value)}
                    rows={5}
                    className="w-full rounded-lg border border-amber-200 px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <p className="text-[11px] text-amber-900/80">Use <span className="font-mono">{"{{LEADERBOARD}}"}</span> to place the live standings into the image prompt.</p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-emerald-800">Navidrome Songs (Optional)</label>
                  <textarea
                    value={songQueriesInput}
                    onChange={(e) => setSongQueriesInput(e.target.value)}
                    rows={4}
                    placeholder={`Artist - Song Title (one per line or comma separated)\nExamples:\nMichael Jackson - Thriller\nSweet Caroline by Neil Diamond\nCelebration`}
                    className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-xs text-gray-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-300 font-mono"
                  />
                  <p className="text-[11px] text-emerald-900/80">
                    Supports <span className="font-semibold">Artist - Song Title</span> or <span className="font-semibold">Song Title by Artist</span> format. Artist name improves match accuracy. Coverage should be ≥ 110% for safe runtime alignment.
                  </p>
                  {renderPlan && (renderPlan.musicSuggestions.length > 0 || renderPlan.similarMusicSuggestions.length > 0) && (
                    <div className="rounded-lg border border-emerald-200 bg-white p-3 text-xs text-emerald-900 space-y-2">
                      {renderPlan.musicSuggestions.length > 0 && (
                        <div>
                          <div className="font-semibold">Suggested songs</div>
                          <div className="mt-1 space-y-0.5">
                            {renderPlan.musicSuggestions.map((song, idx) => <div key={`suggested_${idx}`}>{song}</div>)}
                          </div>
                        </div>
                      )}
                      {renderPlan.similarMusicSuggestions.length > 0 && (
                        <div>
                          <div className="font-semibold">Similar to your selections</div>
                          <div className="mt-1 space-y-0.5">
                            {renderPlan.similarMusicSuggestions.map((song, idx) => <div key={`similar_${idx}`}>{song}</div>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleTestSongMatches}
                    disabled={songPreviewLoading || selectedSubmissionIds.size === 0 || !adminUserId}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white font-semibold px-3 py-2 text-xs hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    {songPreviewLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Testing Matches...
                      </>
                    ) : (
                      "Test Song Matches"
                    )}
                  </button>

                  {songPreview && (
                    <div className="rounded-lg border border-emerald-200 bg-white p-3 text-xs text-emerald-900 space-y-2">
                      <p className="font-semibold">
                        Matched {songPreview.foundCount} of {songPreview.requested.length} requested song(s)
                      </p>
                      <p>Estimated matched music length: {songPreview.matchedDurationLabel}</p>
                      <p>Estimated slideshow length: {songPreview.estimatedSlideshowDurationLabel}</p>
                      <p className={songPreview.estimatedSlideshowDurationSeconds > 0 && (songPreview.matchedDurationSeconds / songPreview.estimatedSlideshowDurationSeconds) >= 1.1 ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                        Coverage: {Math.round(songPreview.estimatedSlideshowDurationSeconds > 0 ? (songPreview.matchedDurationSeconds / songPreview.estimatedSlideshowDurationSeconds) * 100 : 0)}% ({songPreview.matchedDurationLabel} / {songPreview.estimatedSlideshowDurationLabel})
                        {songPreview.estimatedSlideshowDurationSeconds > 0 && (songPreview.matchedDurationSeconds / songPreview.estimatedSlideshowDurationSeconds) >= 1.1
                          ? " - likely enough music"
                          : " - likely too short"}
                      </p>
                      {songPreview.matches.length > 0 ? (
                        <ul className="space-y-1">
                          {songPreview.matches.map((match, idx) => (
                            <li key={`${match.query}_${idx}`}>
                              {match.found
                                ? `Found: ${match.query} -> ${match.title || "Unknown Title"} - ${match.artist || "Unknown Artist"} (${match.durationLabel || "0:00"})`
                                : `Missing: ${match.query}`}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No song queries provided yet.</p>
                      )}
                      <p>
                        Fallback if needed: {songPreview.fallbackSource === "file" ? "local fallback music" : "silence"}
                      </p>
                    </div>
                  )}
                </div>
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

                  <div className="space-y-3">
                    <button
                      onClick={handleGenerateMissionSlides}
                      disabled={selectedSubmissionIds.size === 0 || generatingMissionSlides || !adminUserId}
                      className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                      {generatingMissionSlides ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating Production Plan...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate Production Plan
                        </>
                      )}
                    </button>

                    {savedMissionPlans.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Reuse Saved Mission Plan</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={selectedSavedMissionPlanId}
                            onChange={(e) => setSelectedSavedMissionPlanId(e.target.value)}
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            <option value="">Select a saved plan...</option>
                            {savedMissionPlans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.title} ({new Date(plan.createdAt).toLocaleDateString()})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={applySavedMissionPlan}
                            disabled={!selectedSavedMissionPlanId}
                            className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            Use Saved Plan
                          </button>
                        </div>
                      </div>
                    )}

                    {missionCardPlans.length > 0 && (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                          Mission Transition Card Prompts
                        </div>
                        <p className="text-[11px] text-indigo-900/80">
                          Edit the AI-suggested prompts, then send them to the same image model used for the leaderboard.
                        </p>
                        {missionCardPlans.map((card, idx) => {
                          const generated = missionCardImages.find((entry) => entry.missionTitle === card.missionTitle);
                          return (
                            <div key={`${card.missionTitle}_${idx}`} className="space-y-1">
                              <label className="text-[11px] font-semibold text-gray-700">
                                {card.missionTitle} ({card.photoCount} photos)
                              </label>
                              <textarea
                                value={card.cardImagePrompt}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setMissionCardPlans((current) =>
                                    current.map((entry, entryIdx) => (entryIdx === idx ? { ...entry, cardImagePrompt: value } : entry))
                                  );
                                }}
                                rows={3}
                                className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              />
                              {generated?.imageUrl && (
                                <img
                                  src={generated.imageUrl}
                                  alt={`${card.missionTitle} card art`}
                                  className="w-full max-h-32 object-contain rounded-md border border-indigo-200 bg-white"
                                />
                              )}
                              {generated?.error && <p className="text-[11px] text-red-600">{generated.error}</p>}
                              <button
                                type="button"
                                onClick={() => handleGenerateMissionCardImages([card])}
                                disabled={generatingMissionCardImages || !adminUserId || !leaderboardImageModel}
                                className="rounded-lg bg-indigo-100 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {generated?.imageUrl ? "Generate New Image" : "Generate This Image"}
                              </button>
                            </div>
                          );
                        })}
                        <button
                          onClick={() => handleGenerateMissionCardImages()}
                          disabled={generatingMissionCardImages || !adminUserId || !leaderboardImageModel}
                          className="w-full bg-indigo-500 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 text-sm"
                        >
                          {generatingMissionCardImages ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating Mission Card Images...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate Mission Card Images ({missionCardPlans.length})
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleGenerateLeaderboardSlide}
                      disabled={generatingLeaderboardSlide || !adminUserId || !leaderboardImageModel}
                      className="w-full bg-amber-600 text-white font-bold py-3 rounded-xl hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                      {generatingLeaderboardSlide ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating Leaderboard Slide...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate Leaderboard Slide
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleComposeSlideshow}
                      disabled={
                        selectedSubmissionIds.size === 0 ||
                        composingSlideshow ||
                        !adminUserId ||
                        !missionSlidesScript ||
                        !leaderboardSlideScript ||
                        !leaderboardImageUrl
                      }
                      className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                      {composingSlideshow ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Composing Final Slideshow...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Compose Final Slideshow ({selectedSubmissionIds.size} photos)
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Production Plan</div>
                      {renderPlan && (
                        <div className="text-[11px] text-gray-600 mb-2 space-y-0.5">
                          <div>Source: {renderPlan.parsedFromAi ? "AI plan" : "local defaults"}</div>
                          <div>Transition: {renderPlan.defaultTransition} ({renderPlan.transitionSeconds}s)</div>
                          <div>
                            Color grading: brightness {renderPlan.colorGrading.brightness}, contrast {renderPlan.colorGrading.contrast}, saturation {renderPlan.colorGrading.saturation}, gamma {renderPlan.colorGrading.gamma}
                          </div>
                          <div>Final card: {renderPlan.finalCard.durationSeconds}s</div>
                        </div>
                      )}
                      {missionSlidesScript ? (
                        <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-28 overflow-y-auto">
                          {missionSlidesScript}
                        </pre>
                      ) : (
                        <p className="text-xs text-gray-500">Not generated yet.</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Leaderboard Slide</div>
                      {leaderboardSlideScript ? (
                        <div className="space-y-2">
                          {leaderboardImageUrl && <img src={leaderboardImageUrl} alt="Generated leaderboard artwork" className="w-full max-h-48 object-contain rounded-md border border-amber-200 bg-white" />}
                          <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-28 overflow-y-auto">{leaderboardSlideScript}</pre>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Not generated yet.</p>
                      )}
                    </div>
                  </div>
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
                  This script includes pacing and transition guidance for your MP4 family reunion slideshow.
                </p>
                {generationSource && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 inline-block">
                    {generationSource}
                  </p>
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
                  setMissionSlidesScript(null);
                  setRenderPlan(null);
                  setMissionCardPlans([]);
                  setMissionCardImages([]);
                  setLeaderboardSlideScript(null);
                  setLeaderboardImageUrl(null);
                  setSelectedSubmissionIds(new Set());
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
