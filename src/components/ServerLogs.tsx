import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, Copy, Check, Trash2, Download, Cpu, MemoryStick, Activity } from "lucide-react";
import { copyTextToClipboard } from "../utils/clipboard";

interface LogEntry {
  timestamp: string;
  level: "log" | "error" | "warn" | "info";
  message: string;
}

interface ResourceSnapshot {
  timestamp: string;
  cpu: {
    totalUsagePercent: number;
    perCoreUsagePercent: Array<{
      core: number;
      usagePercent: number;
    }>;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  topProcesses: Array<{
    pid: number;
    command: string;
    cpuPercent: number;
    memoryPercent: number;
    rssMb: number;
  }>;
}

export function ServerLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [resourceSnapshot, setResourceSnapshot] = useState<ResourceSnapshot | null>(null);
  const [coreGridCompact, setCoreGridCompact] = useState(false);
  const [processSortBy, setProcessSortBy] = useState<"cpu" | "mem">("cpu");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const [filterLevel, setFilterLevel] = useState<"all" | "log" | "error" | "warn" | "info">("all");
  const logsEndRef = useRef<HTMLDivElement>(null);

  const formatBytesToGb = (bytes: number) => `${(bytes / (1024 ** 3)).toFixed(2)} GB`;

  const getPressureState = (usagePercent: number): "healthy" | "warning" | "critical" => {
    if (usagePercent >= 85) return "critical";
    if (usagePercent >= 65) return "warning";
    return "healthy";
  };

  const getPressurePalette = (usagePercent: number) => {
    const state = getPressureState(usagePercent);
    if (state === "critical") {
      return {
        text: "text-red-700",
        chip: "bg-red-100 text-red-700 border-red-200",
        bar: "bg-red-500",
        label: "High",
      };
    }
    if (state === "warning") {
      return {
        text: "text-yellow-700",
        chip: "bg-yellow-100 text-yellow-700 border-yellow-200",
        bar: "bg-yellow-500",
        label: "Elevated",
      };
    }
    return {
      text: "text-emerald-700",
      chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
      bar: "bg-emerald-500",
      label: "Healthy",
    };
  };

  const getAdminUserId = () => localStorage.getItem("scavenger_uid") || "";

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Fetch logs
  const fetchLogs = async () => {
    const userId = getAdminUserId();
    if (!userId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/server-logs?userId=${encodeURIComponent(userId)}`);
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

  const fetchResourceSnapshot = async () => {
    const userId = getAdminUserId();
    if (!userId) return;

    setResourceLoading(true);
    setResourceError(null);
    try {
      const res = await fetch(`/api/admin/resource-monitor?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch resource monitor (${res.status})`);
      }
      const data = await res.json();
      setResourceSnapshot(data);
    } catch (err: any) {
      setResourceError(err?.message || "Failed to fetch resource monitor");
    } finally {
      setResourceLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchLogs(), fetchResourceSnapshot()]);
  };

  // Initial fetch
  useEffect(() => {
    refreshAll();
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(refreshAll, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filteredLogs = filterLevel === "all" 
    ? logs 
    : logs.filter(log => log.level === filterLevel);

  const sortedProcesses = resourceSnapshot
    ? [...resourceSnapshot.topProcesses].sort((a, b) => {
        if (processSortBy === "mem") {
          return b.memoryPercent - a.memoryPercent;
        }
        return b.cpuPercent - a.cpuPercent;
      })
    : [];

  const handleCopy = async () => {
    const text = filteredLogs
      .map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join("\n");
    if (!(await copyTextToClipboard(text))) return;
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
      const userId = getAdminUserId();
      const res = await fetch(`/api/server-logs?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
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
      {/* Resource monitor */}
      <div className="bg-white border border-[#dcdcd4] rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#5a5a40]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a5a40]">Resource Monitor</h3>
          </div>
          <button
            onClick={fetchResourceSnapshot}
            disabled={resourceLoading}
            className="p-1.5 bg-white hover:bg-[#f5f5f0] border border-[#dcdcd4] rounded-lg text-[#5a5a40] transition disabled:opacity-50"
            title="Refresh resource monitor"
          >
            <RefreshCw className={`h-4 w-4 ${resourceLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {resourceError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {resourceError}
          </div>
        )}

        {resourceSnapshot && (
          <>
            {(() => {
              const cpuPalette = getPressurePalette(resourceSnapshot.cpu.totalUsagePercent);
              const memoryPalette = getPressurePalette(resourceSnapshot.memory.usagePercent);
              return (
                <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#e4e4db] bg-[#fafaf7] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#5a5a40] text-xs font-bold uppercase tracking-wider">
                  <Cpu className="h-3.5 w-3.5" />
                  CPU Total
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cpuPalette.chip}`}>
                    {cpuPalette.label}
                  </span>
                </div>
                <div className={`mt-2 text-xl font-black ${cpuPalette.text}`}>
                  {resourceSnapshot.cpu.totalUsagePercent.toFixed(1)}%
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-[#e1e1d9] overflow-hidden">
                  <div
                    className={`h-full transition-all ${cpuPalette.bar}`}
                    style={{ width: `${Math.min(100, resourceSnapshot.cpu.totalUsagePercent)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#e4e4db] bg-[#fafaf7] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#5a5a40] text-xs font-bold uppercase tracking-wider">
                  <MemoryStick className="h-3.5 w-3.5" />
                  Memory
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${memoryPalette.chip}`}>
                    {memoryPalette.label}
                  </span>
                </div>
                <div className={`mt-2 text-xl font-black ${memoryPalette.text}`}>
                  {resourceSnapshot.memory.usagePercent.toFixed(1)}%
                </div>
                <div className="text-[11px] text-[#6d6d5f] mt-1">
                  {formatBytesToGb(resourceSnapshot.memory.usedBytes)} used / {formatBytesToGb(resourceSnapshot.memory.totalBytes)} total
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-[#e1e1d9] overflow-hidden">
                  <div
                    className={`h-full transition-all ${memoryPalette.bar}`}
                    style={{ width: `${Math.min(100, resourceSnapshot.memory.usagePercent)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#e4e4db] bg-[#fafaf7] p-3">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="text-xs font-bold uppercase tracking-wider text-[#5a5a40]">CPU Per Core</div>
                <button
                  type="button"
                  onClick={() => setCoreGridCompact((prev) => !prev)}
                  className="px-2.5 py-1 rounded-md border border-[#d6d6cc] bg-white text-[10px] font-bold uppercase tracking-wider text-[#5a5a40] hover:bg-[#f5f5f0]"
                >
                  {coreGridCompact ? "Expanded View" : "Compact/Mobile View"}
                </button>
              </div>
              <div className={`grid gap-2 ${coreGridCompact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                {resourceSnapshot.cpu.perCoreUsagePercent.map((core) => (
                  <div key={core.core} className={`rounded-lg bg-white border border-[#e7e7df] ${coreGridCompact ? "px-2 py-1.5" : "px-2.5 py-2"}`}>
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#5a5a40]">
                      <span>{coreGridCompact ? `C${core.core}` : `Core ${core.core}`}</span>
                      <span>{core.usagePercent.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#ebebe4] overflow-hidden">
                      {(() => {
                        const corePalette = getPressurePalette(core.usagePercent);
                        return (
                      <div
                        className={`h-full transition-all ${corePalette.bar}`}
                        style={{ width: `${Math.min(100, core.usagePercent)}%` }}
                      />
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#e4e4db] bg-[#fafaf7] p-3">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="text-xs font-bold uppercase tracking-wider text-[#5a5a40]">Top 5 Processes</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setProcessSortBy("cpu")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${processSortBy === "cpu" ? "bg-[#5a5a40] text-white border-[#5a5a40]" : "bg-white text-[#5a5a40] border-[#d6d6cc] hover:bg-[#f5f5f0]"}`}
                  >
                    Sort: CPU
                  </button>
                  <button
                    type="button"
                    onClick={() => setProcessSortBy("mem")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${processSortBy === "mem" ? "bg-[#5a5a40] text-white border-[#5a5a40]" : "bg-white text-[#5a5a40] border-[#d6d6cc] hover:bg-[#f5f5f0]"}`}
                  >
                    Sort: MEM
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-[#6d6d5f] uppercase tracking-wider border-b border-[#e3e3db]">
                      <th className="py-1 pr-3">PID</th>
                      <th className="py-1 pr-3">Command</th>
                      <th className="py-1 pr-3">CPU %</th>
                      <th className="py-1 pr-3">MEM %</th>
                      <th className="py-1">RSS MB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resourceSnapshot.topProcesses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-center text-[#8c8c82]">No process data available</td>
                      </tr>
                    ) : (
                      sortedProcesses.map((proc) => (
                        <tr key={proc.pid} className="border-b border-[#efefe8] text-[#4a4a3a]">
                          <td className="py-1 pr-3 font-mono">{proc.pid}</td>
                          <td className="py-1 pr-3 font-mono">{proc.command}</td>
                          <td className="py-1 pr-3">{proc.cpuPercent.toFixed(1)}</td>
                          <td className="py-1 pr-3">{proc.memoryPercent.toFixed(1)}</td>
                          <td className="py-1">{proc.rssMb.toFixed(1)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-[10px] text-[#8c8c82]">
              Last updated: {new Date(resourceSnapshot.timestamp).toLocaleTimeString()}
            </div>
                </>
              );
            })()}
          </>
        )}

        {!resourceSnapshot && !resourceError && (
          <div className="text-xs text-[#8c8c82]">Loading resource monitor...</div>
        )}
      </div>

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
            onClick={refreshAll}
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
