import React, { useState, useEffect } from "react";
import { Submission, ScavengerItem } from "../types";
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles, Image as ImageIcon } from "lucide-react";

interface GalleryProps {
  submissions: Submission[];
  items: ScavengerItem[];
}

const SLIDESHOW_INTERVAL = 3000; // 3 seconds per slide

export function Gallery({ submissions, items }: GalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter for approved submissions only
  const approvedSubmissions = submissions.filter((sub) => sub.status === "approved");

  // Auto-advance slideshow
  useEffect(() => {
    if (!isAutoPlay || approvedSubmissions.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % approvedSubmissions.length);
    }, SLIDESHOW_INTERVAL);

    return () => clearInterval(timer);
  }, [isAutoPlay, approvedSubmissions.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + approvedSubmissions.length) % approvedSubmissions.length);
    setIsAutoPlay(false);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % approvedSubmissions.length);
    setIsAutoPlay(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toggleAutoPlay = () => {
    setIsAutoPlay(!isAutoPlay);
  };

  if (approvedSubmissions.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Photo Gallery</h2>
            <p className="text-xs text-gray-400">View all approved scavenger hunt submissions</p>
          </div>
          <span className="text-xs bg-blue-100 text-blue-600 font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />0 Photos
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 shadow-sm">
          <Sparkles className="h-8 w-8 mx-auto text-blue-300 opacity-70 mb-3 animate-bounce" />
          <p className="text-sm font-medium text-gray-700">No approved photos yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Approved submissions will appear here as a slideshow
          </p>
        </div>
      </div>
    );
  }

  const currentSubmission = approvedSubmissions[currentIndex];
  const associatedItem = items.find((it) => it.id === currentSubmission.itemId);

  return (
    <div className={`space-y-6 ${isFullscreen ? "fixed inset-0 bg-black z-[2000] flex items-center justify-center p-0" : "max-w-4xl mx-auto"}`}>
      {/* Header */}
      {!isFullscreen && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Photo Gallery</h2>
            <p className="text-xs text-gray-400">View all approved scavenger hunt submissions</p>
          </div>
          <span className="text-xs bg-blue-100 text-blue-600 font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            {currentIndex + 1} of {approvedSubmissions.length}
          </span>
        </div>
      )}

      {/* Main Slideshow Container */}
      <div className={`relative bg-black rounded-2xl overflow-hidden ${isFullscreen ? "w-screen h-screen rounded-none" : "aspect-video shadow-lg"}`}>
        {/* Current Image */}
        <img
          src={currentSubmission.imageUrl}
          alt={associatedItem?.title || "Scavenged item"}
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />

        {/* Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/50 to-transparent p-6">
          <h3 className="text-white font-bold text-lg">{associatedItem?.title || "Unknown Item"}</h3>
          <p className="text-gray-300 text-sm mt-1">{associatedItem?.description}</p>
          <p className="text-gray-400 text-xs mt-2">
            📸 Captured by <span className="font-semibold">{currentSubmission.username}</span>
          </p>
        </div>

        {/* Fullscreen Toggle (top-right) */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-lg transition z-10"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <span className="text-lg">⛶</span>
          ) : (
            <span className="text-lg">⛶</span>
          )}
        </button>

        {/* Navigation Arrows */}
        <button
          onClick={goToPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-3 rounded-lg transition z-10"
          title="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-3 rounded-lg transition z-10"
          title="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={toggleAutoPlay}
          className="absolute bottom-4 right-4 bg-white/20 hover:bg-white/40 text-white p-3 rounded-lg transition z-10"
          title={isAutoPlay ? "Pause" : "Play"}
        >
          {isAutoPlay ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Controls Bar */}
      {!isFullscreen && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <button
            onClick={goToPrevious}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          {/* Progress Bar */}
          <div className="flex-1 mx-4">
            <div className="bg-gray-200 rounded-full h-1">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all"
                style={{ width: `${((currentIndex + 1) / approvedSubmissions.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              {currentIndex + 1} of {approvedSubmissions.length} photos
            </p>
          </div>

          <button
            onClick={toggleAutoPlay}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium text-sm"
          >
            {isAutoPlay ? (
              <>
                <Pause className="h-4 w-4" />
                Playing
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Paused
              </>
            )}
          </button>

          <button
            onClick={goToNext}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium text-sm"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Thumbnail Strip */}
      {!isFullscreen && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-2">
            {approvedSubmissions.map((sub, idx) => (
              <button
                key={sub.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setIsAutoPlay(false);
                }}
                className={`relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
                  idx === currentIndex
                    ? "border-blue-500 shadow-lg"
                    : "border-gray-200 hover:border-gray-300 opacity-60 hover:opacity-100"
                }`}
              >
                <img
                  src={sub.imageUrl}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
