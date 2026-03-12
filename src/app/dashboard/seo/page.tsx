"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Globe,
  FileText,
  Zap,
  Link2,
  Layout,
  Bot,
} from "lucide-react";
import SetupBanner from "@/components/SetupBanner";

interface SeoRec {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: string;
  status: string;
  pageUrl: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface SeoScanEntry {
  id: string;
  url: string;
  pagesScraped: number;
  recommendations: number;
  summary: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  suggested: number;
  inProgress: number;
  done: number;
  dismissed: number;
  critical: number;
  high: number;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  meta: { label: "Meta Tags", icon: FileText, color: "text-blue-600 bg-blue-50" },
  content: { label: "Content", icon: FileText, color: "text-green-600 bg-green-50" },
  technical: { label: "Technical", icon: Zap, color: "text-purple-600 bg-purple-50" },
  performance: { label: "Performance", icon: Clock, color: "text-orange-600 bg-orange-50" },
  backlinks: { label: "Backlinks", icon: Link2, color: "text-cyan-600 bg-cyan-50" },
  structure: { label: "Structure", icon: Layout, color: "text-indigo-600 bg-indigo-50" },
  ai_seo: { label: "AI SEO", icon: Bot, color: "text-pink-600 bg-pink-50" },
};

const IMPACT_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_OPTIONS = [
  { value: "suggested", label: "Suggested", icon: Sparkles, color: "text-blue-600" },
  { value: "in_progress", label: "In Progress", icon: Clock, color: "text-yellow-600" },
  { value: "done", label: "Done", icon: CheckCircle2, color: "text-green-600" },
  { value: "dismissed", label: "Dismissed", icon: XCircle, color: "text-gray-400" },
];

export default function SeoPage() {
  const [recommendations, setRecommendations] = useState<SeoRec[]>([]);
  const [scans, setScans] = useState<SeoScanEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/seo/recommendations");
      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setScans(data.scans || []);
      setStats(data.stats || null);
    } catch {
      console.error("Failed to load SEO data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function runScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/seo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 20 }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        setScanResult("Error: Server returned invalid response. Check console for details.");
        console.error("[SEO] Non-JSON response:", text.slice(0, 500));
        return;
      }
      if (data.error) {
        setScanResult(`Error: ${data.error}`);
      } else {
        setScanResult(
          `Scanned ${data.pagesScraped} pages. Score: ${data.score}/100. ${data.newRecommendations} new recommendations found.`
        );
        loadData();
      }
    } catch (e) {
      setScanResult("Scan failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setScanning(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/api/seo/recommendations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadData();
  }

  async function deleteRec(id: string) {
    await fetch("/api/seo/recommendations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadData();
  }

  // Filtered recommendations
  const filtered = recommendations.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    return true;
  });

  // Sort: critical/high first, then by status (suggested > in_progress > done > dismissed)
  const impactOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const statusOrder: Record<string, number> = { suggested: 0, in_progress: 1, done: 2, dismissed: 3 };
  const sorted = [...filtered].sort((a, b) => {
    const sd = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (sd !== 0) return sd;
    return (impactOrder[a.impact] ?? 9) - (impactOrder[b.impact] ?? 9);
  });

  // Categories present
  const categories = Array.from(new Set(recommendations.map((r) => r.category)));

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      <SetupBanner
        platform="AI Provider"
        requiredKeys={[
          { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude) API key" },
          { key: "GEMINI_API_KEY", label: "Gemini API key" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SEO Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            SEO &amp; AI SEO analysis for{" "}
            <a
              href="https://agent.snowballlabs.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              agent.snowballlabs.org
            </a>
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {scanning ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {scanning ? "Scanning..." : "Run SEO Scan"}
        </button>
      </div>

      {/* Scan result banner */}
      {scanResult && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            scanResult.startsWith("Error")
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}
        >
          {scanResult}
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} color="text-gray-900" />
          <StatCard label="Suggested" value={stats.suggested} color="text-blue-600" />
          <StatCard label="In Progress" value={stats.inProgress} color="text-yellow-600" />
          <StatCard label="Done" value={stats.done} color="text-green-600" />
          <StatCard label="Critical" value={stats.critical} color="text-red-600" />
          <StatCard label="High Impact" value={stats.high} color="text-orange-600" />
        </div>
      )}

      {/* Latest scan summary */}
      {scans.length > 0 && scans[0].summary && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Latest Scan Summary</h3>
              <p className="text-sm text-blue-800">{scans[0].summary}</p>
              <p className="text-xs text-blue-500 mt-2">
                {new Date(scans[0].createdAt).toLocaleString()} — {scans[0].pagesScraped} pages scanned
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c]?.label || c}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <Clock className="w-3.5 h-3.5" />
            Scan History
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Scan history */}
      {showHistory && scans.length > 0 && (
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Date</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Pages</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">New Recs</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-700">
                    {new Date(scan.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{scan.pagesScraped}</td>
                  <td className="px-3 py-2 text-gray-700">{scan.recommendations}</td>
                  <td className="px-3 py-2 text-gray-500 truncate max-w-xs">
                    {scan.summary || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recommendations list */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No recommendations yet</p>
          <p className="text-sm mt-1">Run an SEO scan to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((rec) => {
            const catMeta = CATEGORY_META[rec.category] || {
              label: rec.category,
              icon: Globe,
              color: "text-gray-600 bg-gray-50",
            };
            const CatIcon = catMeta.icon;
            const isExpanded = expandedId === rec.id;
            const statusOpt = STATUS_OPTIONS.find((s) => s.value === rec.status);
            const StatusIcon = statusOpt?.icon || Sparkles;

            return (
              <div
                key={rec.id}
                className={`border rounded-xl transition-all ${
                  rec.status === "done"
                    ? "border-green-200 bg-green-50/30"
                    : rec.status === "dismissed"
                    ? "border-gray-200 bg-gray-50/50 opacity-60"
                    : "border-gray-200 bg-white"
                }`}
              >
                {/* Main row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                >
                  {/* Category icon */}
                  <div className={`p-1.5 rounded-lg ${catMeta.color}`}>
                    <CatIcon className="w-4 h-4" />
                  </div>

                  {/* Title + impact */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          rec.status === "done" ? "line-through text-gray-500" : "text-gray-900"
                        }`}
                      >
                        {rec.title}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                          IMPACT_COLORS[rec.impact] || IMPACT_COLORS.medium
                        }`}
                      >
                        {rec.impact}
                      </span>
                    </div>
                    {rec.pageUrl && (
                      <span className="text-xs text-gray-400 truncate block mt-0.5">
                        {rec.pageUrl}
                      </span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className={`flex items-center gap-1 text-xs font-medium ${statusOpt?.color || "text-gray-500"}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusOpt?.label || rec.status}
                  </div>

                  {/* Category label */}
                  <span className="text-xs text-gray-400 hidden sm:block w-16 text-right">
                    {catMeta.label}
                  </span>

                  {/* Expand arrow */}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <p className="text-sm text-gray-700 mt-3 leading-relaxed whitespace-pre-wrap">
                      {rec.description}
                    </p>

                    {rec.pageUrl && (
                      <a
                        href={rec.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {rec.pageUrl}
                      </a>
                    )}

                    <div className="flex items-center gap-2 mt-4">
                      <span className="text-xs text-gray-400 mr-1">Set status:</span>
                      {STATUS_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(rec.id, opt.value);
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              rec.status === opt.value
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            {opt.label}
                          </button>
                        );
                      })}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this recommendation?")) {
                            deleteRec(rec.id);
                          }
                        }}
                        className="ml-auto text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>

                    {rec.completedAt && (
                      <p className="text-xs text-green-600 mt-2">
                        Completed {new Date(rec.completedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
