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
  const [generatingMissionSlides, setGeneratingMissionSlides] = useState(false);
  const [generatingLeaderboardSlide, setGeneratingLeaderboardSlide] = useState(false);
  const [composingSlideshow, setComposingSlideshow] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localScript, setLocalScript] = useState<string | null>(generatedScript);
  const [missionSlidesScript, setMissionSlidesScript] = useState<string | null>(null);
  const [leaderboardSlideScript, setLeaderboardSlideScript] = useState<string | null>(null);
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_SLIDESHOW_PROMPT);
  const [includeMissionNarration, setIncludeMissionNarration] = useState(false);
  const [slideshowModel, setSlideshowModel] = useState<string>("llama3.1");
  const [generationSource, setGenerationSource] = useState<string | null>(null);
  const [songQueriesInput, setSongQueriesInput] = useState("");
  const [songPreviewLoading, setSongPreviewLoading] = useState(false);
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
        const catalog = Array.isArray(payload?.slideshowModels) ? payload.slideshowModels : [];
        const firstModel = String(catalog?.[0]?.model || "").trim();
        if (cancelled) return;
        if (firstModel) {
          setSlideshowModel(firstModel);
        }
      } catch (err) {
        // Keep local default if catalog fetch fails.
      }
    };

    loadModelCatalog();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || "Failed to generate mission slides");
      }

      const data = await response.json();
      setMissionSlidesScript(String(data?.missionSlidesScript || "").trim() || null);
    } catch (err: any) {
      console.error("Mission slide generation error:", err);
      setLocalError(err.message || "Failed to generate mission slide script");
    } finally {
      setGeneratingMissionSlides(false);
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
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || "Failed to generate leaderboard slide");
      }

      const data = await response.json();
      setLeaderboardSlideScript(String(data?.leaderboardSlideScript || "").trim() || null);
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
          songQueries: parseSongQueries(songQueriesInput),
          missionSlidesScript,
          leaderboardSlideScript,
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
        if (videoInfo?.mode === "presenton_remote") {
          setGenerationSource(`Composed with Presenton (${videoInfo.aiModel || "AI"})`);
        } else if (videoInfo?.mode === "presenton_plan_local_render") {
          setGenerationSource(`Composed with Presenton plan and rendered locally (${videoInfo.aiModel || "AI"})`);
        } else if (videoInfo?.mode === "local_ffmpeg") {
          setGenerationSource(`Composed and rendered locally (${videoInfo.aiModel || "AI"})`);
        } else {
          setGenerationSource("Composed slideshow and generated MP4");
        }
      } else {
        setGenerationSource("Composed slideshow, but video render is unavailable");
      }

      if (onScriptGenerated) {
        onScriptGenerated(data.slideshow.script);
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

  const copyScript = () => {
    const scriptToCopy = localScript || generatedScript;
    if (!scriptToCopy) return;
    navigator.clipboard.writeText(scriptToCopy);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  if (!isOpen) return null;

  const currentScript = localScript || generatedScript;
  const step1Done = !!missionSlidesScript;
  const step2Done = !!leaderboardSlideScript;
  const step3Done = !!currentScript;

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className={`rounded-lg border px-3 py-2 text-xs ${step1Done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600"}`}>
                <div className="font-semibold">Step 1</div>
                <div>Mission slides {step1Done ? "complete" : "pending"}</div>
              </div>
              <div className={`rounded-lg border px-3 py-2 text-xs ${step2Done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600"}`}>
                <div className="font-semibold">Step 2</div>
                <div>Leaderboard slide {step2Done ? "complete" : "pending"}</div>
              </div>
              <div className={`rounded-lg border px-3 py-2 text-xs ${step3Done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600"}`}>
                <div className="font-semibold">Step 3</div>
                <div>Final compose {step3Done ? "complete" : "pending"}</div>
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
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Slideshow AI Model (Ollama)</label>
                    <input
                      value={slideshowModel}
                      onChange={(e) => setSlideshowModel(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
                      placeholder="llama3.1"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Pipeline</label>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                      <div className="font-semibold">{selectedSubmissionIds.size} photo(s)</div>
                      <div className="font-mono text-[11px] mt-0.5 text-emerald-700">Mission slides + leaderboard + compose</div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        Presenton is attempted first. If unavailable, local FFmpeg MP4 rendering is used.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Ollama Prompt Template</label>
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
                          Generating Mission Slides...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate Mission Slides
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleGenerateLeaderboardSlide}
                      disabled={generatingLeaderboardSlide || !adminUserId}
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
                        !leaderboardSlideScript
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
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Mission Slides</div>
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
                        <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-28 overflow-y-auto">
                          {leaderboardSlideScript}
                        </pre>
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
                  setLeaderboardSlideScript(null);
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
