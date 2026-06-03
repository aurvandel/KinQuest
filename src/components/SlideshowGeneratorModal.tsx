import React, { useState } from "react";
import { Submission, ScavengerItem } from "../types";
import { X, Loader2, Sparkles, Download, Copy, Check } from "lucide-react";

interface SlideshowGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: Submission[];
  items: ScavengerItem[];
  isLoading: boolean;
  error: string | null;
  generatedScript: string | null;
  onScriptGenerated?: (script: string) => void;
}

export function SlideshowGeneratorModal({
  isOpen,
  onClose,
  submissions,
  items,
  isLoading,
  error,
  generatedScript,
  onScriptGenerated
}: SlideshowGeneratorModalProps) {
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(new Set());
  const [generatingScript, setGeneratingScript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localScript, setLocalScript] = useState<string | null>(generatedScript);

  const approvedSubmissions = submissions.filter((sub) => sub.status === "approved");

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

  const handleGenerateSlideshow = async () => {
    if (selectedSubmissionIds.size === 0) return;

    setGeneratingScript(true);
    setLocalError(null);
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
            username: sub.username,
          })),
          createdBy: "admin", // Will be set by parent component if available
          title: `Family Slideshow - ${new Date().toLocaleDateString()}`,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || "Failed to generate slideshow");
      }

      const data = await response.json();
      setLocalScript(data.slideshow.script);
      if (onScriptGenerated) {
        onScriptGenerated(data.slideshow.script);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
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

                  {/* Submission List */}
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-100 rounded-lg p-3">
                    {approvedSubmissions.map((sub) => {
                      const item = items.find((it) => it.id === sub.itemId);
                      return (
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
                            alt={item?.title}
                            className="w-12 h-12 object-cover rounded-lg"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{item?.title || "Unknown"}</p>
                            <p className="text-xs text-gray-500">by {sub.username}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerateSlideshow}
                    disabled={selectedSubmissionIds.size === 0 || generatingScript}
                    className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    {generatingScript ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Slideshow...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Slideshow Script ({selectedSubmissionIds.size} photos)
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
