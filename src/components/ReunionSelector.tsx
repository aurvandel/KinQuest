import React, { useState, useEffect, useRef } from "react";
import { LogOut, Plus, Settings } from "lucide-react";
import { DynamicIcon } from "./DynamicIcon";
import { Reunion } from "../types";

interface ReunionSelectorProps {
  currentReunion: Reunion | null;
  reunions: Reunion[];
  adminId: string;
  onSelectReunion: (reunion: Reunion) => void;
  onCreateReunion: () => void;
  onEditReunion: (reunion: Reunion) => void;
  onLogout: () => void;
  isLoading: boolean;
}

export function ReunionSelector({
  currentReunion,
  reunions,
  adminId,
  onSelectReunion,
  onCreateReunion,
  onEditReunion,
  onLogout,
  isLoading
}: ReunionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [alignRight, setAlignRight] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const container = containerRef.current;
      const menu = menuRef.current;
      if (!container || !menu) return;
      const menuWidth = menu.getBoundingClientRect().width || 288;
      const rect = container.getBoundingClientRect();
      if (rect.left + menuWidth > window.innerWidth - 8) {
        setAlignRight(true);
      } else {
        setAlignRight(false);
      }
    };

    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    document.addEventListener("click", onDocClick);

    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("click", onDocClick);
    };
  }, [isOpen]);

  if (!currentReunion) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <p>No reunion selected</p>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:shadow-lg transition-shadow"
        style={{
          background: "linear-gradient(90deg, var(--color-brand-moss), var(--color-brand-terracotta))",
        }}
        disabled={isLoading}
      >
        <span className="text-lg inline-flex items-center justify-center w-6 h-6">
          {currentReunion.icon ? (
            // If icon looks like a URL or data URI, render an image. Otherwise render a DynamicIcon.
            (currentReunion.icon.startsWith("/") || currentReunion.icon.startsWith("http") || currentReunion.icon.startsWith("data:")) ? (
              <img src={currentReunion.icon} alt="reunion" className="w-5 h-5 rounded" />
            ) : (
              <DynamicIcon name={currentReunion.icon} className="h-5 w-5" />
            )
          ) : null}
        </span>
        <span className="font-semibold truncate max-w-xs">{currentReunion.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={`absolute top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-50 ${
            alignRight ? "right-0 left-auto" : "left-0"
          }`}
        >
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Current Reunion</h3>
            <div
              className="p-3 rounded-lg"
              style={{
                background: "var(--color-brand-terracotta-light)",
                border: "1px solid var(--color-brand-terracotta)",
              }}
            >
              <p className="font-medium" style={{ color: "var(--color-brand-moss-dark)" }}>
                {currentReunion.name}
              </p>
              <p className="text-sm" style={{ color: "var(--color-brand-moss)" }}>
                Code: {currentReunion.inviteCode}
              </p>
            </div>
          </div>

          {reunions.length > 1 && (
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">Other Reunions</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {reunions
                  .filter(r => r.id !== currentReunion.id)
                  .map(reunion => (
                    <div
                      key={reunion.id}
                      className="p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => {
                            onSelectReunion(reunion);
                            setIsOpen(false);
                          }}
                          className="flex-1 text-left"
                        >
                          <p className="font-medium text-gray-900">{reunion.name}</p>
                          <p className="text-sm text-gray-600">Code: {reunion.inviteCode}</p>
                        </button>
                        <button
                          onClick={() => {
                            onEditReunion(reunion);
                            setIsOpen(false);
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                          title="Edit reunion"
                        >
                          <Settings className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="p-4 space-y-2 border-t border-gray-200">
            <button
              onClick={() => {
                onEditReunion(currentReunion);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              Edit Reunion Settings
            </button>
            <button
              onClick={() => {
                onCreateReunion();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Reunion
            </button>
            <button
              onClick={() => {
                onLogout();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
