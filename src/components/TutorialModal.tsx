import React, { useState } from "react";
import { ChevronRight, CheckCircle2, X } from "lucide-react";

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => Promise<void>;
  gameName: string;
}

export function TutorialModal({ isOpen, onClose, onComplete, gameName }: TutorialModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
    }
  }, [isOpen]);

  const slides = [
    {
      title: "🎮 Welcome to " + gameName,
      description:
        "You've joined a collaborative scavenger hunt! Your family works together to complete photo-based challenges and earn points on the leaderboard.",
      icon: "🎯"
    },
    {
      title: "📸 Hunt: Capture Proof",
      description:
        "Navigate to 'Missions' and select a challenge. Use your camera to photograph the item or scene specified. The AI referee reviews your photo and awards points if it matches!",
      icon: "📷"
    },
    {
      title: "🗺️ Map: Navigate Challenges",
      description:
        "The interactive map shows challenge locations with geofence boundaries. Click or tap a mission to jump to its details. Some challenges are location-based; others can be done anywhere.",
      icon: "📍"
    },
    {
      title: "📊 Leaderboard: Climb the Ranks",
      description:
        "See live standings of all hunters. You earn points for each approved photo. Complete more challenges to climb higher and lead your family to victory!",
      icon: "🏆"
    },
    {
      title: "💬 Chat: Connect Anytime",
      description:
        "Use the chat to shout out milestones, cheer teammates, or coordinate hunts. Share your excitement in real time with other family members.",
      icon: "💭"
    },
    {
      title: "🎬 Gallery & Slideshows",
      description:
        "View all approved submissions in the gallery. Admins can auto-generate slideshows highlighting the best moments. Relive the hunt together!",
      icon: "🎞️"
    },
    {
      title: "✨ You're All Set!",
      description:
        "Start hunting now by tapping 'Missions' below. Have fun, capture creative photos, and may the best hunter win. Let's go! 🚀",
      icon: "🎊"
    }
  ];

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      handleComplete();
    } else {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete();
    } catch (err) {
      console.error("Failed to complete tutorial:", err);
    } finally {
      setIsCompleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-[#f5f5f0] to-[#ede9e0] rounded-3xl shadow-2xl w-full max-w-md p-8 border border-[#d2d2c8] space-y-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/50 transition text-[#8c8c82]"
          title="Skip tutorial"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon and title */}
        <div className="space-y-2 text-center pt-2">
          <div className="text-5xl">{slide.icon}</div>
          <h2 className="text-xl font-bold text-[#2d2d2d]">{slide.title}</h2>
        </div>

        {/* Description */}
        <p className="text-sm text-[#5a5a40] leading-relaxed text-center">{slide.description}</p>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-2 rounded-full transition ${
                idx === currentSlide
                  ? "w-6 bg-[#5a5a40]"
                  : "w-2 bg-[#d2d2c8] hover:bg-[#c2c2b8]"
              }`}
              title={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[#d2d2c8] bg-white text-[#5a5a40] text-sm font-bold hover:bg-[#f9f9f6] active:scale-95 transition-all cursor-pointer"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            disabled={isCompleting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#5a5a40] text-white text-sm font-bold hover:bg-[#4a4a32] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isLastSlide ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {isCompleting ? "Saving..." : "Let's Hunt!"}
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {/* Slide counter */}
        <div className="text-center text-xs text-[#8c8c82] font-medium">
          {currentSlide + 1} of {slides.length}
        </div>
      </div>
    </div>
  );
}
