import React, { useState, useEffect } from "react";
import { Slideshow, Submission, ScavengerItem } from "../types";
import { Download, Copy, Check, Loader2, Sparkles, AlertCircle, Play, Pause, ChevronLeft, ChevronRight, Trash2, Volume2 } from "lucide-react";

interface SlideshowViewerProps {
  userId: string | null;
  userRole?: "user" | "admin";
  submissions: Submission[];
  items: ScavengerItem[];
  refreshKey?: number;
}

interface ResolvedSlide {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  username: string;
}

const NARRATOR_START = "MISSION_NARRATOR_OVERLAYS_JSON_START";
const NARRATOR_END = "MISSION_NARRATOR_OVERLAYS_JSON_END";

function extractNarratorOverlayMap(script: string): Record<string, string> {
  const startIdx = script.indexOf(NARRATOR_START);
  const endIdx = script.indexOf(NARRATOR_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return {};
  }

  const jsonText = script
    .slice(startIdx + NARRATOR_START.length, endIdx)
    .trim();

  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const result: Record<string, string> = {};
    Object.entries(parsed).forEach(([missionTitle, narration]) => {
      if (typeof narration === "string" && narration.trim().length > 0) {
        result[missionTitle] = narration.trim();
      }
    });
    return result;
  } catch {
    return {};
  }
}

function getDisplayScript(script: string): string {
  const startIdx = script.indexOf(NARRATOR_START);
  const endIdx = script.indexOf(NARRATOR_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return script;
  }

  return `${script.slice(0, startIdx).trim()}\n`;
}

export function SlideshowViewer({ userId, userRole, submissions, items, refreshKey }: SlideshowViewerProps) {
  const isAdmin = userRole === "admin";
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [slideIndexMap, setSlideIndexMap] = useState<{ [slideshowId: string]: number }>({});
  const [renderingId, setRenderingId] = useState<string | null>(null);
  const [videoUrlMap, setVideoUrlMap] = useState<{ [slideshowId: string]: string }>({});
  const [renderErrorMap, setRenderErrorMap] = useState<{ [slideshowId: string]: string | null }>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [voiceEnabledMap, setVoiceEnabledMap] = useState<{ [slideshowId: string]: boolean }>({});
  const [scriptDraftMap, setScriptDraftMap] = useState<{ [slideshowId: string]: string }>({});
  const [savingScriptId, setSavingScriptId] = useState<string | null>(null);
  const [creatingGeminiId, setCreatingGeminiId] = useState<string | null>(null);
  const [geminiStatusMap, setGeminiStatusMap] = useState<{ [slideshowId: string]: string | null }>({});
  const [geminiVideoEstimateConfig, setGeminiVideoEstimateConfig] = useState<{ baseUsd: number; perPhotoUsd: number } | null>(null);

  useEffect(() => {
    const fetchSlideshows = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/slideshows");
        if (!response.ok) {
          throw new Error("Failed to fetch slideshows");
        }
        const data = await response.json();
        const slideshowList = Array.isArray(data) ? data : [];
        setSlideshows(slideshowList);

        const statusResponses = await Promise.all(
          slideshowList.map(async (slideshow: Slideshow) => {
            try {
              const statusRes = await fetch(`/api/slideshows/${slideshow.id}/video-status`);
              if (!statusRes.ok) return null;
              const statusData = await statusRes.json();
              if (statusData?.exists && statusData?.videoUrl) {
                return { id: slideshow.id, videoUrl: statusData.videoUrl as string };
              }
            } catch {
              return null;
            }
            return null;
          })
        );

        const availableVideos: { [slideshowId: string]: string } = {};
        statusResponses.forEach((status) => {
          if (status?.id && status.videoUrl) {
            availableVideos[status.id] = status.videoUrl;
          }
        });
        setVideoUrlMap(availableVideos);
      } catch (err: any) {
        setError(err.message);
        setSlideshows([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSlideshows();
  }, [refreshKey]);

  useEffect(() => {
    const loadModelCatalog = async () => {
      try {
        const response = await fetch("/api/ai-model-catalog");
        if (!response.ok) return;
        const payload = await response.json();
        const slideshowModels = Array.isArray(payload?.slideshowModels) ? payload.slideshowModels : [];
        const geminiVideoModel = slideshowModels.find((entry: any) => String(entry?.model || "") === "gemini-3.5-flash");
        if (!geminiVideoModel) return;

        const baseUsd = Number(geminiVideoModel.baseUsd);
        const perPhotoUsd = Number(geminiVideoModel.perPhotoUsd);
        if (!Number.isFinite(baseUsd) || !Number.isFinite(perPhotoUsd)) return;

        setGeminiVideoEstimateConfig({ baseUsd, perPhotoUsd });
      } catch {
        // Keep cost estimate hidden when catalog is unavailable.
      }
    };

    loadModelCatalog();
  }, []);

  useEffect(() => {
    if (!playingId) return;

    const slideshow = slideshows.find((s) => s.id === playingId);
    if (!slideshow) return;

    const resolvedSlides = resolveSlides(slideshow);
    if (resolvedSlides.length <= 1) return;

    const timer = window.setInterval(() => {
      setSlideIndexMap((prev) => {
        const current = prev[playingId] || 0;
        const next = current + 1;
        if (next >= resolvedSlides.length) {
          return { ...prev, [playingId]: 0 };
        }
        return { ...prev, [playingId]: next };
      });
    }, 3000);

    return () => window.clearInterval(timer);
  }, [playingId, slideshows, submissions, items]);

  const resolveSlides = (slideshow: Slideshow): ResolvedSlide[] => {
    return slideshow.submissionIds
      .map((submissionId) => {
        const sub = submissions.find((s) => s.id === submissionId);
        if (!sub) return null;
        const item = items.find((it) => it.id === sub.itemId);
        return {
          id: sub.id,
          imageUrl: sub.imageUrl,
          title: item?.title || "Unknown Mission",
          description: item?.description || item?.title || "",
          username: sub.username,
        };
      })
      .filter((slide): slide is ResolvedSlide => Boolean(slide));
  };

  useEffect(() => {
    if (!playingId) return;
    const slideshow = slideshows.find((s) => s.id === playingId);
    if (!slideshow) return;
    if (!voiceEnabledMap[playingId]) return;
    if (!("speechSynthesis" in window)) return;

    const resolvedSlides = resolveSlides(slideshow);
    if (!resolvedSlides.length) return;
    const current = resolvedSlides[slideIndexMap[playingId] || 0];
    if (!current?.description) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(current.description);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [playingId, slideIndexMap, slideshows, submissions, items, voiceEnabledMap]);

  const goToPrevSlide = (slideshowId: string, total: number) => {
    setSlideIndexMap((prev) => {
      const current = prev[slideshowId] || 0;
      return {
        ...prev,
        [slideshowId]: current <= 0 ? total - 1 : current - 1,
      };
    });
  };

  const goToNextSlide = (slideshowId: string, total: number) => {
    setSlideIndexMap((prev) => {
      const current = prev[slideshowId] || 0;
      return {
        ...prev,
        [slideshowId]: current >= total - 1 ? 0 : current + 1,
      };
    });
  };

  const handleDownload = (slideshow: Slideshow) => {
    const displayScript = getDisplayScript(slideshow.script || "");
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(displayScript)
    );
    element.setAttribute(
      "download",
      `${slideshow.title.replace(/\s+/g, "-").toLowerCase()}-${slideshow.id}.txt`
    );
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCopy = (slideshow: Slideshow) => {
    navigator.clipboard.writeText(getDisplayScript(slideshow.script || ""));
    setCopiedId(slideshow.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRenderMp4 = async (slideshowId: string) => {
    if (!userId) return;

    setRenderingId(slideshowId);
    setRenderErrorMap((prev) => ({ ...prev, [slideshowId]: null }));
    try {
      const response = await fetch(`/api/slideshows/${slideshowId}/render-mp4`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to render MP4");
      }

      if (data?.videoUrl) {
        setVideoUrlMap((prev) => ({ ...prev, [slideshowId]: data.videoUrl }));
      }
    } catch (err: any) {
      setRenderErrorMap((prev) => ({ ...prev, [slideshowId]: err?.message || "Failed to render MP4" }));
    } finally {
      setRenderingId(null);
    }
  };

  const handleSaveScript = async (slideshow: Slideshow) => {
    if (!userId || userRole !== "admin") return;

    const nextScript = scriptDraftMap[slideshow.id] ?? slideshow.script;
    setSavingScriptId(slideshow.id);
    setRenderErrorMap((prev) => ({ ...prev, [slideshow.id]: null }));
    try {
      const response = await fetch(`/api/slideshows/${slideshow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, script: nextScript }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to save script");
      }

      if (data?.slideshow) {
        setSlideshows((prev) => prev.map((s) => (s.id === slideshow.id ? data.slideshow : s)));
      }
    } catch (err: any) {
      setRenderErrorMap((prev) => ({ ...prev, [slideshow.id]: err?.message || "Failed to save script" }));
    } finally {
      setSavingScriptId(null);
    }
  };

  const handleCreateGeminiVideo = async (slideshow: Slideshow) => {
    if (!userId || userRole !== "admin") return;

    const script = scriptDraftMap[slideshow.id] ?? slideshow.script;
    setCreatingGeminiId(slideshow.id);
    setRenderErrorMap((prev) => ({ ...prev, [slideshow.id]: null }));
    setGeminiStatusMap((prev) => ({ ...prev, [slideshow.id]: null }));

    try {
      const response = await fetch(`/api/slideshows/${slideshow.id}/gemini-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, script }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to create Gemini slideshow video");
      }

      if (data?.videoUrl) {
        setVideoUrlMap((prev) => ({ ...prev, [slideshow.id]: data.videoUrl }));
      }

      const aiModel = data?.generation?.aiModel || "unknown-model";
      const fallbackSuffix = data?.generation?.usedFallbackPlan ? " (fallback plan)" : "";
      setGeminiStatusMap((prev) => ({ ...prev, [slideshow.id]: `Video generated with ${aiModel}${fallbackSuffix}` }));

      setSlideshows((prev) => prev.map((s) => (s.id === slideshow.id ? { ...s, script } : s)));
    } catch (err: any) {
      setRenderErrorMap((prev) => ({ ...prev, [slideshow.id]: err?.message || "Failed to create Gemini slideshow video" }));
    } finally {
      setCreatingGeminiId(null);
    }
  };

  const handleDeleteSlideshow = async (slideshowId: string) => {
    if (!userId || userRole !== "admin") return;
    const confirmed = window.confirm("Delete this slideshow and its generated MP4 file? This will not delete any mission or submission data.");
    if (!confirmed) return;

    setDeletingId(slideshowId);
    setRenderErrorMap((prev) => ({ ...prev, [slideshowId]: null }));
    try {
      const response = await fetch(`/api/slideshows/${slideshowId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to delete slideshow");
      }

      setSlideshows((prev) => prev.filter((s) => s.id !== slideshowId));
      setVideoUrlMap((prev) => {
        const next = { ...prev };
        delete next[slideshowId];
        return next;
      });
      if (expandedId === slideshowId) setExpandedId(null);
      if (playingId === slideshowId) setPlayingId(null);
    } catch (err: any) {
      setRenderErrorMap((prev) => ({ ...prev, [slideshowId]: err?.message || "Failed to delete slideshow" }));
    } finally {
      setDeletingId(null);
    }
  };

  const estimateGeminiVideoCost = (slideshow: Slideshow): number | null => {
    if (!geminiVideoEstimateConfig) return null;
    const photoCount = slideshow.submissionIds.length;
    const total = geminiVideoEstimateConfig.baseUsd + (geminiVideoEstimateConfig.perPhotoUsd * photoCount);
    return Number(total.toFixed(4));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Slide Shows</h2>
            <p className="text-xs text-gray-400">
              {isAdmin
                ? "Play family photo slideshows, export scripts, and download rendered MP4 videos"
                : "Play family photo slideshows and download rendered MP4 videos"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="ml-3 text-gray-600 font-medium">Loading slideshows...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Slide Shows</h2>
            <p className="text-xs text-gray-400">
              {isAdmin
                ? "Play family photo slideshows, export scripts, and download rendered MP4 videos"
                : "Play family photo slideshows and download rendered MP4 videos"}
            </p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Unable to load slideshows</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (slideshows.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Slide Shows</h2>
            <p className="text-xs text-gray-400">
              {isAdmin
                ? "Play family photo slideshows, export scripts, and download rendered MP4 videos"
                : "Play family photo slideshows and download rendered MP4 videos"}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 shadow-sm">
          <Sparkles className="h-8 w-8 mx-auto text-blue-300 opacity-70 mb-3 animate-bounce" />
          <p className="text-sm font-medium text-gray-700">No slideshows available yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Admins can generate slideshows from approved photos in the admin settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Slide Shows</h2>
          <p className="text-xs text-gray-400">
            {isAdmin
              ? "Play family photo slideshows, export scripts, and download rendered MP4 videos"
              : "Play family photo slideshows and download rendered MP4 videos"}
          </p>
        </div>
        <span className="text-xs bg-blue-100 text-blue-600 font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {slideshows.length} Available
        </span>
      </div>

      <div className="space-y-3">
        {slideshows.map((slideshow) => (
          (() => {
            const resolvedSlides = resolveSlides(slideshow);
            const currentIndex = Math.min(slideIndexMap[slideshow.id] || 0, Math.max(resolvedSlides.length - 1, 0));
            const currentSlide = resolvedSlides[currentIndex];
            const narratorMap = extractNarratorOverlayMap(slideshow.script || "");
            const currentNarration = currentSlide ? narratorMap[currentSlide.title] : null;
            const geminiVideoEstimate = estimateGeminiVideoCost(slideshow);
            const hasVideo = Boolean(videoUrlMap[slideshow.id]);

            return (
          <div
            key={slideshow.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(expandedId === slideshow.id ? null : slideshow.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition text-left"
            >
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">{slideshow.title}</h3>
                {slideshow.description && (
                  <p className="text-xs text-gray-500 mt-1">{slideshow.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {isAdmin
                    ? `${slideshow.submissionIds.length} photos · ${new Date(slideshow.createdAt).toLocaleDateString()}`
                    : new Date(slideshow.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-gray-400 ml-4 shrink-0">
                <svg
                  className={`h-5 w-5 transition transform ${expandedId === slideshow.id ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </button>

            {/* Expanded Content */}
            {expandedId === slideshow.id && (
              <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                {isAdmin ? (
                  resolvedSlides.length > 0 ? (
                    <div className="space-y-3">
                      <div className="relative bg-black rounded-xl overflow-hidden">
                        <img
                          src={currentSlide.imageUrl}
                          alt={currentSlide.title}
                          className="w-full h-64 object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
                          <p className="text-sm font-semibold">{currentSlide.description || currentSlide.title}</p>
                          <p className="text-xs opacity-90">Photo by {currentSlide.username}</p>
                        </div>
                        {currentNarration && (
                          <div className="absolute top-3 left-3 right-3 rounded-lg bg-black/60 border border-white/20 p-3 text-white">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-200 mb-1">Mission Narrator</p>
                            <p className="text-xs leading-relaxed">{currentNarration}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => goToPrevSlide(slideshow.id, resolvedSlides.length)}
                          className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-medium flex items-center gap-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Prev
                        </button>

                        <button
                          onClick={() => setPlayingId((prev) => prev === slideshow.id ? null : slideshow.id)}
                          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1"
                        >
                          {playingId === slideshow.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          {playingId === slideshow.id ? "Pause" : "Play"}
                        </button>

                        <button
                          onClick={() => setVoiceEnabledMap((prev) => ({ ...prev, [slideshow.id]: !prev[slideshow.id] }))}
                          className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 ${voiceEnabledMap[slideshow.id] ? "bg-violet-600 text-white hover:bg-violet-700" : "bg-violet-100 text-violet-700 hover:bg-violet-200"}`}
                        >
                          <Volume2 className="h-4 w-4" />
                          {voiceEnabledMap[slideshow.id] ? "Voice On" : "Voice Off"}
                        </button>

                        <button
                          onClick={() => goToNextSlide(slideshow.id, resolvedSlides.length)}
                          className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-medium flex items-center gap-1"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      <p className="text-xs text-gray-500">
                        Slide {currentIndex + 1} of {resolvedSlides.length}
                        {resolvedSlides.length !== slideshow.submissionIds.length && ` · ${slideshow.submissionIds.length - resolvedSlides.length} photo(s) missing from current submission dataset`}
                      </p>

                      <div className="grid grid-cols-5 gap-2">
                        {resolvedSlides.map((slide, idx) => (
                          <button
                            key={slide.id}
                            onClick={() => setSlideIndexMap((prev) => ({ ...prev, [slideshow.id]: idx }))}
                            className={`rounded-lg overflow-hidden border ${idx === currentIndex ? "border-blue-500" : "border-transparent"}`}
                          >
                            <img src={slide.imageUrl} alt={slide.title} className="w-full h-14 object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                      No slideshow photos are currently available for this record.
                    </div>
                  )
                ) : hasVideo ? (
                  <>
                    <div className="bg-black rounded-xl overflow-hidden border border-gray-800">
                      <video
                        src={videoUrlMap[slideshow.id]}
                        controls
                        preload="metadata"
                        className="w-full h-auto max-h-[420px] bg-black"
                      />
                    </div>
                    <a
                      href={videoUrlMap[slideshow.id]}
                      download
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-2.5 px-3 rounded-lg hover:bg-indigo-700 transition text-xs"
                    >
                      <Download className="h-4 w-4" />
                      Download MP4
                    </a>
                  </>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                    Video is not available yet. Please check back soon.
                  </div>
                )}

                {isAdmin && (
                  <>
                    {/* Script Preview */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Production Guide Script
                      </label>
                      <div className="bg-white rounded-xl p-3 max-h-48 overflow-y-auto border border-gray-200">
                        <textarea
                          value={scriptDraftMap[slideshow.id] ?? slideshow.script ?? ""}
                          onChange={(e) => setScriptDraftMap((prev) => ({ ...prev, [slideshow.id]: e.target.value }))}
                          rows={10}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveScript(slideshow)}
                        disabled={savingScriptId === slideshow.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-sky-700 disabled:bg-sky-300 disabled:cursor-not-allowed transition text-xs"
                      >
                        {savingScriptId === slideshow.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving Script...
                          </>
                        ) : (
                          "Save Script"
                        )}
                      </button>
                      {!hasVideo && (
                        <button
                          onClick={() => handleCreateGeminiVideo(slideshow)}
                          disabled={creatingGeminiId === slideshow.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed transition text-xs"
                        >
                          {creatingGeminiId === slideshow.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Gemini Creating Video...
                            </>
                          ) : (
                            `Create Gemini Video${geminiVideoEstimate !== null ? ` (~$${geminiVideoEstimate.toFixed(4)})` : ""}`
                          )}
                        </button>
                      )}
                    </div>
                  </>
                )}

                {isAdmin && geminiStatusMap[slideshow.id] && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
                    {geminiStatusMap[slideshow.id]}
                  </div>
                )}

                {/* Action Buttons */}
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(slideshow)}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-800 font-bold py-2 px-3 rounded-lg hover:bg-gray-300 transition text-xs"
                    >
                      {copiedId === slideshow.id ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDownload(slideshow)}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-blue-700 transition text-xs"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                )}

                {isAdmin && (
                  <>
                    <div className="flex gap-2">
                      {userRole === "admin" && !hasVideo && (
                        <button
                          onClick={() => handleRenderMp4(slideshow.id)}
                          disabled={renderingId === slideshow.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed transition text-xs"
                        >
                          {renderingId === slideshow.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Rendering MP4...
                            </>
                          ) : (
                            "Create Basic MP4"
                          )}
                        </button>
                      )}

                      {videoUrlMap[slideshow.id] && (
                        <a
                          href={videoUrlMap[slideshow.id]}
                          download
                          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-indigo-700 transition text-xs"
                        >
                          <Download className="h-4 w-4" />
                          Download MP4
                        </a>
                      )}

                      {userRole === "admin" && (
                        <button
                          onClick={() => handleDeleteSlideshow(slideshow.id)}
                          disabled={deletingId === slideshow.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-rose-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed transition text-xs"
                        >
                          {deletingId === slideshow.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4" />
                              Delete Slideshow
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {renderErrorMap[slideshow.id] && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                        {renderErrorMap[slideshow.id]}
                      </div>
                    )}

                    {videoUrlMap[slideshow.id] && (
                      <div className="bg-black rounded-xl overflow-hidden border border-gray-800">
                        <video
                          src={videoUrlMap[slideshow.id]}
                          controls
                          preload="metadata"
                          className="w-full h-auto max-h-[420px] bg-black"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Full Script Button */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      const element = document.createElement("pre");
                      element.textContent = slideshow.script;
                      element.className = "bg-white rounded-xl p-4 max-h-96 overflow-y-auto border border-gray-200 text-xs font-mono";
                      // Create a modal to display full script
                    }}
                    className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium py-1 hover:bg-white rounded transition"
                  >
                    View Full Script
                  </button>
                )}
              </div>
            )}
          </div>
            );
          })()
        ))}
      </div>
    </div>
  );
}
