import React, { useState } from "react";
import { Lock, AlertCircle, Loader2, Check } from "lucide-react";

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (password: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function AdminAuthModal({
  isOpen,
  onClose,
  onSuccess,
  isLoading = false,
  error = null
}: AdminAuthModalProps) {
  const [password, setPassword] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onSuccess(password);
      setPassword("");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg animate-fadeIn">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#5a5a40]/15 mx-auto mb-4">
          <Lock className="h-5 w-5 text-[#5a5a40]" />
        </div>

        <h2 className="text-lg font-bold text-[#5a5a40] text-center mb-2">
          Admin Access Required
        </h2>
        <p className="text-sm text-[#8c8c82] text-center mb-6">
          Enter your admin password to proceed
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoFocus
              className="w-full text-sm bg-[#f5f5f0]/70 border border-[#dcdcd4] rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-[#5a5a40] disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 border border-red-100">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-[#8c8c82] hover:text-[#5a5a40] hover:bg-[#f5f5f0] border border-[#dcdcd4] disabled:opacity-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-[#5a5a40] hover:bg-[#464632] disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Verify
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
