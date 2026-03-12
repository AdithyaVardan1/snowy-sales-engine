"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  Loader2,
  Clock,
  AlertCircle,
  FileText,
  Eye,
  Database,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

interface AgentDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  schedule: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  lastError: string | null;
  runCount: number;
  _count: { observations: number; reports: number; memory: number };
  reports: Array<{
    id: string;
    type: string;
    title: string;
    createdAt: string;
  }>;
}

interface Observation {
  id: string;
  category: string;
  subject: string;
  data: string;
  summary: string | null;
  importance: string;
  createdAt: string;
}

interface Report {
  id: string;
  type: string;
  title: string;
  content: string;
  data: string | null;
  createdAt: string;
}

const IMPORTANCE_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-500",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const CATEGORY_COLORS: Record<string, string> = {
  twitter_activity: "bg-sky-100 text-sky-700",
  token_data: "bg-purple-100 text-purple-700",
  tvl_fees: "bg-green-100 text-green-700",
  onchain_data: "bg-orange-100 text-orange-700",
  website: "bg-pink-100 text-pink-700",
  content_viral: "bg-yellow-100 text-yellow-700",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reports" | "observations" | "memory">("reports");
  const [running, setRunning] = useState(false);

  // Observations state
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsTotal, setObsTotal] = useState(0);
  const [obsCategory, setObsCategory] = useState("");
  const [obsSubject, setObsSubject] = useState("");
  const [obsLoading, setObsLoading] = useState(false);

  // Reports state
  const [reports, setReports] = useState<Array<{ id: string; type: string; title: string; createdAt: string; data: string | null }>>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchAgent = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${slug}`);
      if (!res.ok) {
        router.push("/dashboard/agents");
        return;
      }
      const data = await res.json();
      setAgent(data);
    } catch {
      router.push("/dashboard/agents");
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  const fetchObservations = useCallback(async () => {
    setObsLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (obsCategory) searchParams.set("category", obsCategory);
      if (obsSubject) searchParams.set("subject", obsSubject);
      searchParams.set("limit", "50");
      const res = await fetch(`/api/agents/${slug}/observations?${searchParams}`);
      if (res.ok) {
        const data = await res.json();
        setObservations(data.observations);
        setObsTotal(data.total);
      }
    } catch (e) {
      console.error("Failed to fetch observations:", e);
    } finally {
      setObsLoading(false);
    }
  }, [slug, obsCategory, obsSubject]);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${slug}/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports);
      }
    } catch (e) {
      console.error("Failed to fetch reports:", e);
    }
  }, [slug]);

  const fetchReport = async (id: string) => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/agents/${slug}/reports/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedReport(data);
      }
    } catch (e) {
      console.error("Failed to fetch report:", e);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  useEffect(() => {
    if (tab === "observations") fetchObservations();
    if (tab === "reports") fetchReports();
  }, [tab, fetchObservations, fetchReports]);

  const runAgent = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/agents/${slug}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Agent run failed");
      await fetchAgent();
      if (tab === "observations") await fetchObservations();
      if (tab === "reports") await fetchReports();
    } catch (e) {
      console.error("Failed to run agent:", e);
    } finally {
      setRunning(false);
    }
  };

  const toggleEnabled = async () => {
    if (!agent) return;
    try {
      await fetch(`/api/agents/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !agent.enabled }),
      });
      await fetchAgent();
    } catch (e) {
      console.error("Failed to toggle agent:", e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="max-w-5xl">
      {/* Back link */}
      <Link
        href="/dashboard/agents"
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Agents
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
          <p className="text-gray-500 mt-1">{agent.description}</p>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              agent.status === "idle" ? "bg-green-100 text-green-700" :
              agent.status === "running" ? "bg-blue-100 text-blue-700" :
              agent.status === "error" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-500"
            }`}>
              {agent.status}
            </span>
            {agent.lastRunAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Last run: {timeAgo(agent.lastRunAt)}
              </span>
            )}
            <span>{agent.runCount} total runs</span>
            <span>{agent._count.observations} observations</span>
            <span>{agent._count.reports} reports</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runAgent}
            disabled={running}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Running..." : "Run Now"}
          </button>
          <button
            onClick={toggleEnabled}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border ${
              agent.enabled
                ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                : "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
            }`}
          >
            {agent.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {agent.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {agent.lastError && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Last run error:</p>
            <p className="text-red-600 mt-0.5">{agent.lastError}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(["reports", "observations", "memory"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 ${
              tab === t
                ? "text-blue-600 border-blue-600"
                : "text-gray-400 border-transparent hover:text-gray-700"
            }`}
          >
            {t === "reports" && <FileText className="w-4 h-4 inline mr-1.5" />}
            {t === "observations" && <Eye className="w-4 h-4 inline mr-1.5" />}
            {t === "memory" && <Database className="w-4 h-4 inline mr-1.5" />}
            {t}
            {t === "reports" && <span className="ml-1.5 text-xs text-gray-400">({agent._count.reports})</span>}
            {t === "observations" && <span className="ml-1.5 text-xs text-gray-400">({agent._count.observations})</span>}
          </button>
        ))}
      </div>

      {/* Reports Tab */}
      {tab === "reports" && (
        <div className="space-y-3">
          {selectedReport ? (
            <div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to reports
              </button>
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">{selectedReport.title}</h2>
                  <span className="text-xs text-gray-400">
                    {new Date(selectedReport.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: selectedReport.content
                        .replace(/^### (.+)$/gm, '<h3 class="text-gray-900 text-base font-semibold mt-4 mb-2">$1</h3>')
                        .replace(/^## (.+)$/gm, '<h2 class="text-gray-900 text-lg font-bold mt-5 mb-2">$1</h2>')
                        .replace(/^# (.+)$/gm, '<h1 class="text-gray-900 text-xl font-bold mt-6 mb-3">$1</h1>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
                        .replace(/^- (.+)$/gm, '<li class="text-gray-600 ml-4">$1</li>')
                        .replace(/\n/g, "<br />"),
                    }}
                  />
                </div>
              </div>
            </div>
          ) : reportLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No reports yet. Run the agent to generate the first report.</p>
            </div>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                onClick={() => fetchReport(r.id)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{r.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 mt-1 inline-block">
                      {r.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Observations Tab */}
      {tab === "observations" && (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={obsCategory}
              onChange={(e) => setObsCategory(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700"
            >
              <option value="">All categories</option>
              <option value="twitter_activity">Twitter Activity</option>
              <option value="token_data">Token Data</option>
              <option value="tvl_fees">TVL / Fees</option>
              <option value="onchain_data">On-chain Data</option>
            </select>
            <select
              value={obsSubject}
              onChange={(e) => setObsSubject(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700"
            >
              <option value="">All competitors</option>
              {Array.from(new Set(observations.map((o) => o.subject))).sort().map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={fetchObservations}
              disabled={obsLoading}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${obsLoading ? "animate-spin" : ""}`} />
            </button>
            <span className="text-xs text-gray-400 ml-auto">{obsTotal} total</span>
          </div>

          {obsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : observations.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Eye className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No observations yet. Run the agent to collect data.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {observations.map((obs) => {
                let parsed: Record<string, unknown> = {};
                try { parsed = JSON.parse(obs.data); } catch {}

                return (
                  <ObservationRow key={obs.id} obs={obs} parsed={parsed} />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Memory Tab */}
      {tab === "memory" && (
        <MemoryTab agentSlug={slug} />
      )}
    </div>
  );
}

function ObservationRow({ obs, parsed }: { obs: Observation; parsed: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 flex items-center gap-3"
      >
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${IMPORTANCE_COLORS[obs.importance] || IMPORTANCE_COLORS.normal}`}>
          {obs.importance}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[obs.category] || "bg-gray-100 text-gray-500"}`}>
          {obs.category.replace(/_/g, " ")}
        </span>
        <span className="text-sm font-medium text-gray-900">{obs.subject}</span>
        <span className="text-xs text-gray-400 ml-auto shrink-0">{timeAgo(obs.createdAt)}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2">
          <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto">
            {JSON.stringify(parsed, null, 2)}
          </pre>
          {obs.summary && (
            <p className="text-sm text-gray-500 mt-2">{obs.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}

function MemoryTab({ agentSlug }: { agentSlug: string }) {
  const [entries, setEntries] = useState<Array<{ id: string; key: string; value: string; updatedAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMemory() {
      try {
        const res = await fetch(`/api/agents/${agentSlug}/memory`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries);
        }
      } catch (e) {
        console.error("Failed to fetch memory:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchMemory();
  }, [agentSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <Database className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">
          No memory entries yet. Run the agent to start building persistent state.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-3">{entries.length} memory entries</p>
      {entries.map((entry) => {
        let parsed: unknown;
        try { parsed = JSON.parse(entry.value); } catch { parsed = entry.value; }

        return (
          <div key={entry.id} className="bg-white border border-gray-200 rounded-lg">
            <button
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              className="w-full text-left p-3 flex items-center gap-3"
            >
              <code className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{entry.key}</code>
              <span className="text-xs text-gray-400 ml-auto">{timeAgo(entry.updatedAt)}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === entry.id ? "rotate-180" : ""}`} />
            </button>
            {expandedId === entry.id && (
              <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto">
                  {typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : String(parsed)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
