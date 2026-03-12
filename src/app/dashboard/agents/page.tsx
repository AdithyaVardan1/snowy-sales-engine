"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Eye,
  Zap,
  TrendingUp,
  Users,
  Code,
  BarChart3,
  Shield,
  Building2,
  Newspaper,
} from "lucide-react";

interface AgentData {
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
  createdAt: string;
  _count: { observations: number; reports: number };
}

const AGENT_ICONS: Record<string, React.ElementType> = {
  competitive_intel: TrendingUp,
  social_media: Zap,
  business_dev: Building2,
  community: Users,
  devrel: Code,
  analytics: BarChart3,
  brand: Shield,
  enterprise: Building2,
  newsletter: Newspaper,
};

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-green-100 text-green-700",
  running: "bg-blue-100 text-blue-700",
  error: "bg-red-100 text-red-700",
  disabled: "bg-gray-100 text-gray-500",
};

const IMPLEMENTED_AGENTS = ["competitive_intel", "community", "social_media", "business_dev", "devrel", "analytics", "brand", "enterprise", "newsletter"];

function formatSchedule(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [min, hour, , , weekday] = parts;
  if (min === "*/30" && hour === "*") return "Every 30 min";
  if (min === "0" && hour.startsWith("*/")) return `Every ${hour.replace("*/", "")}h`;
  if (min === "0" && weekday !== "*") return `Weekly (${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseInt(weekday)] || weekday})`;
  if (min === "0" && hour !== "*") return `Daily at ${hour}:00`;
  return cron;
}

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

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [runningSlug, setRunningSlug] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (e) {
      console.error("Failed to fetch agents:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const seedAgents = async () => {
    setSeeding(true);
    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      await fetchAgents();
    } catch (e) {
      console.error("Failed to seed agents:", e);
    } finally {
      setSeeding(false);
    }
  };

  const toggleAgent = async (slug: string, enabled: boolean) => {
    try {
      await fetch(`/api/agents/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await fetchAgents();
    } catch (e) {
      console.error("Failed to toggle agent:", e);
    }
  };

  const runAgent = async (slug: string) => {
    setRunningSlug(slug);
    try {
      const res = await fetch(`/api/agents/${slug}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Agent run failed");
      }
      await fetchAgents();
    } catch (e) {
      console.error("Failed to run agent:", e);
    } finally {
      setRunningSlug(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="w-7 h-7 text-blue-600" />
              AI Agents
            </h1>
            <p className="text-gray-500 mt-1">
              Autonomous agents that handle competitive intel, social media, BD, and more
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No agents configured</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Initialize all 9 AI agents. They&apos;ll start disabled — enable and configure each one as needed.
          </p>
          <button
            onClick={seedAgents}
            disabled={seeding}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Initialize Agents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-7 h-7 text-blue-600" />
            AI Agents
          </h1>
          <p className="text-gray-500 mt-1">
            {agents.filter((a) => a.enabled).length} active / {agents.length} total agents
          </p>
        </div>
        <button
          onClick={fetchAgents}
          className="px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const IconComp = AGENT_ICONS[agent.type] || Bot;
          const isImplemented = IMPLEMENTED_AGENTS.includes(agent.type);
          const isRunning = agent.status === "running" || runningSlug === agent.slug;

          return (
            <div
              key={agent.id}
              className={`bg-white border rounded-xl p-5 transition-all ${
                isImplemented
                  ? "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  : "border-gray-100 opacity-60"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${agent.enabled ? "bg-blue-50" : "bg-gray-100"}`}>
                    <IconComp className={`w-5 h-5 ${agent.enabled ? "text-blue-600" : "text-gray-400"}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{agent.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[agent.status] || STATUS_COLORS.disabled}`}>
                      {isRunning ? "running" : agent.status}
                    </span>
                  </div>
                </div>
                {!isImplemented && (
                  <span className="text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-200">
                    Coming Soon
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-gray-500 text-xs mb-3 line-clamp-2">
                {agent.description}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-gray-400">Schedule</p>
                  <p className="text-gray-700 font-medium">{formatSchedule(agent.schedule)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-gray-400">Observations</p>
                  <p className="text-gray-700 font-medium">{agent._count.observations}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-gray-400">Reports</p>
                  <p className="text-gray-700 font-medium">{agent._count.reports}</p>
                </div>
              </div>

              {/* Last run info */}
              {agent.lastRunAt && (
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                  <Clock className="w-3 h-3" />
                  Last run: {timeAgo(agent.lastRunAt)}
                  {agent.lastRunDurationMs && (
                    <span className="text-gray-400">({(agent.lastRunDurationMs / 1000).toFixed(1)}s)</span>
                  )}
                  {agent.runCount > 0 && (
                    <span className="ml-auto text-gray-400">{agent.runCount} runs</span>
                  )}
                </div>
              )}

              {/* Error */}
              {agent.lastError && (
                <div className="flex items-start gap-1.5 text-xs text-red-600 mb-3 bg-red-50 rounded-lg p-2 border border-red-100">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{agent.lastError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                {isImplemented ? (
                  <>
                    <button
                      onClick={() => runAgent(agent.slug)}
                      disabled={isRunning}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isRunning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      {isRunning ? "Running..." : "Run Now"}
                    </button>
                    <button
                      onClick={() => toggleAgent(agent.slug, !agent.enabled)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                        agent.enabled
                          ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                          : "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                      }`}
                    >
                      {agent.enabled ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <Link
                      href={`/dashboard/agents/${agent.slug}`}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </>
                ) : (
                  <div className="flex-1 text-center py-1.5 text-xs text-gray-400">
                    Agent not yet implemented
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
