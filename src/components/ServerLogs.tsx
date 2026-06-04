import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, Copy, Check, Trash2, Download } from "lucide-react";

interface LogEntry {
  timestamp: string;
  level: "log" | "error" | "warn" | "info";
  message: string;
}

export function ServerLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const [filterLevel, setFilterLevel] = useState<"all" | "log" | "error" | "warn" | "info">("all");
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Fetch logs
  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/server-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filteredLogs = filterLevel === "all" 
    ? logs 
    : logs.filter(log => log.level === filterLevel);

  const handleCopy = () => {
    const text = filteredLogs
      .map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = filteredLogs
      .map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `server-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear server logs?")) return;
    try {
      const res = await fetch("/api/server-logs", { method: "DELETE" });
      if (res.ok) {
        setLogs([]);
      }
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  const getLogStyle = (level: string) => {
    switch (level) {
      case "error":
        return {
          bg: "bg-red-950",
          text: "text-red-300",
          badge: "text-red-400 font-bold"
        };
      case "warn":
        return {
          bg: "bg-yellow-900",
          text: "text-yellow-200",
          badge: "text-yellow-300 font-bold"
        };
      case "info":
        return {
          bg: "bg-blue-900",
          text: "text-blue-200",
          badge: "text-blue-300 font-bold"
        };
      default:
        return {
          bg: "bg-gray-700",
          text: "text-gray-100",
          badge: "text-gray-300 font-bold"
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-[#5a5a40]">🔍 Server Logs</h2>
          <span className="text-xs text-[#8c8c82]">({filteredLogs.length} entries)</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-[#dcdcd4] text-[#5a5a40]"
            />
            <span className="text-xs font-bold text-[#5a5a40]">Auto-refresh</span>
          </label>

          {/* Refresh button */}
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="p-1.5 bg-white hover:bg-[#f5f5f0] border border-[#dcdcd4] rounded-lg text-[#5a5a40] transition disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "log", "error", "warn", "info"] as const).map((level) => (
          <button
            key={level}
            onClick={() => setFilterLevel(level)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterLevel === level
                ? "bg-[#5a5a40] text-white"
                : "bg-white border border-[#dcdcd4] text-[#5a5a40] hover:bg-[#f5f5f0]"
            }`}
          >
            {level === "all" ? "All" : level.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>

        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download</span>
        </button>

        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear</span>
        </button>
      </div>

      {/* Logs container */}
      <div className="bg-white border border-[#dcdcd4] rounded-2xl overflow-hidden flex flex-col" style={{ height: "400px" }}>
        <div className="flex-1 overflow-y-auto p-0 font-mono text-xs bg-[#0f0f0f]">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No logs to display</p>
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const style = getLogStyle(log.level);
              return (
                <div
                  key={idx}
                  className={`py-2 px-3 border-b border-gray-800 flex items-start gap-2 ${style.bg} hover:opacity-80 transition`}
                >
                  <span className="text-gray-500 flex-shrink-0 whitespace-nowrap">[{log.timestamp}]</span>
                  <span className={`${style.badge} flex-shrink-0 whitespace-nowrap`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className={`break-words flex-1 ${style.text}`}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
