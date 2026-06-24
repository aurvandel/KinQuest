import React from "react";
import { X } from "lucide-react";
import { CameraCapture } from "./CameraCapture";

interface CameraModalProps {
  isOpen: boolean;
  itemTitle: string;
  selectedImage: string | null;
  isSubmitting: boolean;
  uploadError: string | null;
  hasForceSubmitOption: boolean;
  onImageSelected: (base64: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onForceSubmit?: () => Promise<void>;
}

export function CameraModal({
  isOpen,
  itemTitle,
  selectedImage,
  isSubmitting,
  uploadError,
  hasForceSubmitOption,
  onImageSelected,
  onClose,
  onSubmit,
  onForceSubmit
}: CameraModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#d2d2c8]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#d2d2c8] p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-[#2d2d2d]">Submit Photo Proof</h2>
            <p className="text-sm text-[#8c8c82] mt-0.5">{itemTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f5f5f0] transition text-[#8c8c82]"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <CameraCapture onImageSelected={onImageSelected} selectedImage={selectedImage} />

          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              <p className="font-semibold mb-2">{uploadError}</p>
              {hasForceSubmitOption && onForceSubmit && (
                <button
                  onClick={onForceSubmit}
                  disabled={isSubmitting}
                  className="w-full px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition cursor-pointer mt-2"
                >
                  ⚠️ Force Submit Anyway
                </button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl border border-[#d2d2c8] bg-white text-[#5a5a40] font-bold text-sm hover:bg-[#f9f9f6] active:scale-95 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            {selectedImage && (
              <button
                onClick={() => onImageSelected("")}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#d2d2c8] bg-white text-[#8c8c82] font-bold text-sm hover:bg-[#f9f9f6] active:scale-95 transition disabled:opacity-50 cursor-pointer"
              >
                Clear
              </button>
            )}
            {selectedImage && (
              <button
                onClick={onSubmit}
                disabled={isSubmitting || !selectedImage}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#5a5a40] text-white font-bold text-sm hover:bg-[#4a4a32] active:scale-95 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Submitting..." : "Submit to AI Referee"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
