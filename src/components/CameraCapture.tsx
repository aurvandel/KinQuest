import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload, AlertCircle, RefreshCw, Check, Image as ImageIcon } from "lucide-react";

interface CameraCaptureProps {
  onImageSelected: (base64Image: string) => void;
  selectedImage: string | null;
}

export function CameraCapture({ onImageSelected, selectedImage }: CameraCaptureProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata to load before playing
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.error("Video play failed:", err);
          });
        };
        // Fallback: try playing anyway (browser may auto-play before metadata)
        videoRef.current.play().catch(err => {
          console.error("Video play failed:", err);
        });
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setCameraError(
        "Camera device not available or blocked. Please select/drop an image file instead!"
      );
      setCameraActive(false);
    }
  };

  // Canvas optimization & compression (max 450px dimension, high performance, ~35KB payload size)
  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 450;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
          onImageSelected(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      
      // Ensure video has valid dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn("Video dimensions not loaded. Waiting for metadata...");
        // Wait a moment and try again
        setTimeout(capturePhoto, 100);
        return;
      }
      
      const canvas = document.createElement("canvas");
      // Align dimensions to video stream
      canvas.width = Math.min(video.videoWidth, 450);
      canvas.height = (video.videoHeight / video.videoWidth) * canvas.width;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.75);
        onImageSelected(base64);
        stopCamera();
        setCameraActive(false);
      }
    }
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        processImageFile(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full space-y-4">
      {selectedImage ? (
        <div className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50 aspect-video flex items-center justify-center">
          <img
            src={selectedImage}
            alt="Captured verification target"
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-3 right-3 bg-green-500 text-white rounded-full p-1.5 shadow-md">
            <Check className="h-5 w-5" />
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex justify-center gap-2">
            <button
              onClick={() => {
                onImageSelected("");
                startCamera();
              }}
              type="button"
              className="bg-gray-900/85 hover:bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition shadow-sm flex items-center gap-1 backdrop-blur-sm"
            >
              <RefreshCw className="h-3 w-3" />
              Retake Photo
            </button>
            <button
              onClick={() => {
                onImageSelected("");
                triggerFileInput();
              }}
              type="button"
              className="bg-gray-900/85 hover:bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition shadow-sm flex items-center gap-1 backdrop-blur-sm"
            >
              <Upload className="h-3 w-3" />
              Upload New
            </button>
          </div>
        </div>
      ) : cameraActive ? (
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-black aspect-video flex flex-col justify-between">
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1]"
            playsInline
            muted
          />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
            <button
              onClick={capturePhoto}
              type="button"
              className="bg-red-500 hover:bg-red-600 text-white font-bold h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition active:scale-95 border-2 border-white"
              title="Capture Frame"
            >
              <div className="w-4 h-4 bg-white rounded-full" />
            </button>
            <button
              onClick={() => {
                stopCamera();
                setCameraActive(false);
              }}
              type="button"
              className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium px-4 py-2 rounded-full transition shadow-md"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-6 transition-all duration-300 text-center flex flex-col items-center justify-center min-h-[220px] ${
            dragActive
              ? "border-amber-500 bg-amber-50/20"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <div className="p-3 bg-amber-50 rounded-full mb-3 text-amber-600">
            <Camera className="h-6 w-6" />
          </div>

          <p className="text-sm font-medium text-gray-800 mb-1">
            Capture image proof for your scavenger hunt
          </p>
          <p className="text-xs text-gray-400 mb-4 max-w-sm px-4">
            Use your device's camera sensor or drop any photo (JPEG, PNG) directly into this area to verify.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={startCamera}
              type="button"
              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold text-xs px-4 py-2.5 rounded-full transition flex items-center gap-1.5 shadow-sm"
            >
              <Camera className="h-3.5 w-3.5" />
              Use Camera
            </button>
            <button
              onClick={triggerFileInput}
              type="button"
              className="bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-semibold text-xs px-4 py-2.5 rounded-full transition flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Image File
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment" // Hint to open camera directly on mobile browsers
            onChange={handleFileChange}
            className="hidden"
          />

          {cameraError && (
            <div className="text-[11px] text-red-500 flex items-center gap-1 mt-4 max-w-md bg-red-50 px-2 py-1.5 rounded-lg">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
