import React, { useState, useEffect } from "react";
import { Slideshow } from "../types";
import { Download, Copy, Check, Loader2, Sparkles, AlertCircle } from "lucide-react";

interface SlideshowViewerProps {
  userId: string | null;
}

export function SlideshowViewer({ userId }: SlideshowViewerProps) {
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
        setSlideshows(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message);
        setSlideshows([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSlideshows();
  }, []);

  const handleDownload = (slideshow: Slideshow) => {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(slideshow.script)
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
    navigator.clipboard.writeText(slideshow.script);
    setCopiedId(slideshow.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">AI Slideshow Scripts</h2>
            <p className="text-xs text-gray-400">Download professional slideshow production guides</p>
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
            <h2 className="text-lg font-bold text-gray-800">AI Slideshow Scripts</h2>
            <p className="text-xs text-gray-400">Download professional slideshow production guides</p>
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
            <h2 className="text-lg font-bold text-gray-800">AI Slideshow Scripts</h2>
            <p className="text-xs text-gray-400">Download professional slideshow production guides</p>
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
          <h2 className="text-lg font-bold text-gray-800">AI Slideshow Scripts</h2>
          <p className="text-xs text-gray-400">Download professional slideshow production guides</p>
        </div>
        <span className="text-xs bg-blue-100 text-blue-600 font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {slideshows.length} Available
        </span>
      </div>

      <div className="space-y-3">
        {slideshows.map((slideshow) => (
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
                  {slideshow.submissionIds.length} photos · {new Date(slideshow.createdAt).toLocaleDateString()}
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
                {/* Script Preview */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Production Guide
                  </label>
                  <div className="bg-white rounded-xl p-3 max-h-48 overflow-y-auto border border-gray-200">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                      {slideshow.script.substring(0, 500)}
                      {slideshow.script.length > 500 && "..."}
                    </pre>
                  </div>
                </div>

                {/* Action Buttons */}
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

                {/* Full Script Button */}
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
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
