"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";

interface CronJob {
  id: string;
  name: string;
  type: string;
  schedule: string;
  enabled: boolean;
  config?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastResult?: string;
  lastError?: string;
  createdAt: string;
}

const JOB_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  fetch_community: {
    label: "Fetch Community Posts",
    description: "Pull new posts from GitHub Issues, Discussions, and Reddit",
  },
  post_social: {
    label: "Publish Scheduled Posts",
    description: "Auto-publish social posts that have reached their scheduled time",
  },
  generate_blog: {
    label: "Publish Scheduled Blogs",
    description: "Auto-publish blog posts that have reached their scheduled time",
  },
  auto_post_tech: {
    label: "Auto-Post Tech News",
    description: "Search latest tech news via Tavily and auto-post to Twitter/LinkedIn",
  },
  trend_post: {
    label: "Trend Content (50/50)",
    description: "Analyze community trends, generate 50% value + 50% Snowy AI promo content, post to Twitter/LinkedIn",
  },
  reddit_auto_reply: {
    label: "Reddit Auto-Reply",
    description: "Auto-generate and post AI replies to unreplied Reddit posts (default 10/day, spread across ~6 hours)",
  },
  poll_instagram_followers: {
    label: "Poll Instagram Followers",
    description: "Check for new Instagram followers and track them",
  },
  instagram_auto_dm: {
    label: "Instagram Auto-DM",
    description: "Send automated welcome DMs to new Instagram followers",
  },
  agent_run: {
    label: "Run Agent",
    description: "Run a specific AI agent on schedule",
  },
};

const SCHEDULE_PRESETS = [
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every day at 6pm", value: "0 18 * * *" },
  { label: "Every Monday 9am", value: "0 9 * * 1" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
];

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function loadJobs() {
    setLoading(true);
    try {
      const res = await fetch("/api/scheduler");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
      }
    } catch (e) {
      console.error("Failed to load jobs", e);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function toggleJob(id: string, enabled: boolean) {
    await fetch(`/api/scheduler/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    await loadJobs();
  }

  const [running, setRunning] = useState<Record<string, boolean>>({});

  async function runJobNow(id: string) {
    setRunning((r) => ({ ...r, [id]: true }));
    try {
      await fetch(`/api/scheduler/${id}/run`, { method: "POST" });
    } finally {
      setRunning((r) => ({ ...r, [id]: false }));
      await loadJobs(); // refresh to show new lastRunAt + result
    }
  }

  async function deleteJob(id: string) {
    if (!confirm("Delete this scheduled job?")) return;
    await fetch(`/api/scheduler/${id}`, { method: "DELETE" });
    await loadJobs();
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Scheduler</h1>
        <p className="text-sm text-gray-500 mt-1">Automate recurring tasks — community fetching, scheduled publishing, and auto-posting tech news.</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {jobs.filter((j) => j.enabled).length} active jobs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadJobs}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Job
          </button>
        </div>
      </div>

      {/* Default jobs hint */}
      {jobs.length === 0 && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <p className="font-medium mb-2">Recommended jobs to set up:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>Fetch Community Posts</strong> every 6 hours — keeps your community monitor fresh</li>
            <li><strong>Publish Scheduled Posts</strong> every 30 minutes — auto-publishes tweets and LinkedIn posts at their scheduled time</li>
            <li><strong>Publish Scheduled Blogs</strong> daily — auto-publishes blog drafts at their scheduled time</li>
            <li><strong>Auto-Post Tech News</strong> every 12 hours — searches trending tech news and posts to Twitter/LinkedIn</li>
          </ul>
        </div>
      )}

      {/* Jobs list */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse h-20" />
            ))}
          </div>
        ) : (
          jobs.map((job) => {
            const typeInfo = JOB_TYPE_LABELS[job.type] || {
              label: job.type,
              description: "",
            };

            return (
              <div
                key={job.id}
                className={`bg-white rounded-xl p-4 border ${job.enabled ? "border-gray-200" : "border-gray-100 opacity-60"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{job.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                        {job.schedule}
                      </span>
                      {job.enabled ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{typeInfo.description}</p>
                    {job.lastRunAt && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last run: {new Date(job.lastRunAt).toLocaleString()}
                        </span>
                        {job.lastResult === "success" ? (
                          <span className="flex items-center gap-1 text-emerald-500">
                            <CheckCircle className="w-3 h-3" /> Success
                          </span>
                        ) : job.lastResult === "error" ? (
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertCircle className="w-3 h-3" /> Error: {job.lastError}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runJobNow(job.id)}
                      disabled={running[job.id]}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 disabled:opacity-50"
                      title="Run this job now"
                    >
                      {running[job.id] ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      {running[job.id] ? "Running..." : "Run now"}
                    </button>
                    <button
                      onClick={() => toggleJob(job.id, !job.enabled)}
                      className={`p-2 rounded-lg transition-colors ${job.enabled
                          ? "text-yellow-600 hover:bg-yellow-50"
                          : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                      title={job.enabled ? "Pause" : "Resume"}
                    >
                      {job.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <JobFormModal
          onClose={() => setShowForm(false)}
          onSaved={loadJobs}
        />
      )}
    </div>
  );
}

const PLATFORM_OPTIONS = [
  { value: "twitter", label: "Twitter / X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "reddit", label: "Reddit" },
  { value: "instagram", label: "Instagram" },
];

// Job types that support a platform selection
const PLATFORM_JOBS = ["auto_post_tech", "trend_post", "fetch_community"];

const AGENT_SLUGS = [
  { value: "competitive_intel", label: "Competitive Intelligence" },
  { value: "community", label: "Community Monitor" },
  { value: "social_media", label: "Social Media" },
  { value: "business_dev", label: "Business Dev" },
  { value: "devrel", label: "DevRel" },
  { value: "analytics", label: "Analytics & Briefing" },
  { value: "brand", label: "Brand Guardian" },
  { value: "enterprise", label: "Enterprise Outreach" },
  { value: "newsletter", label: "Newsletter Compiler" },
];

function JobFormModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("fetch_community");
  const [schedule, setSchedule] = useState("0 */6 * * *");
  const [saving, setSaving] = useState(false);

  // Platform selection
  const [platforms, setPlatforms] = useState<string[]>(["twitter", "linkedin"]);

  // Auto-post tech config
  const [topics, setTopics] = useState(
    "AI agents LLMs latest news\ndeveloper tools open source trending\nself-hosting Docker deployment news"
  );
  const [maxArticles, setMaxArticles] = useState(3);

  // Reddit auto-reply config
  const [maxReplies, setMaxReplies] = useState(10);

  // Agent run config
  const [agentSlug, setAgentSlug] = useState("competitive_intel");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let config: Record<string, unknown> | undefined;

    if (type === "auto_post_tech") {
      config = {
        platforms,
        topics: topics.split("\n").map((t) => t.trim()).filter(Boolean),
        maxArticlesPerRun: maxArticles,
      };
    } else if (type === "trend_post") {
      config = { platforms };
    } else if (type === "fetch_community") {
      config = { platforms };
    } else if (type === "reddit_auto_reply") {
      config = { maxReplies };
    } else if (type === "agent_run") {
      config = { agentSlug };
    }

    await fetch("/api/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, schedule, config }),
    });

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Add Scheduled Job</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Auto-fetch community posts"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(JOB_TYPE_LABELS).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
            {JOB_TYPE_LABELS[type] && (
              <p className="text-xs text-gray-400 mt-1">{JOB_TYPE_LABELS[type].description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
            <input
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Cron expression"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSchedule(preset.value)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${schedule === preset.value
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Platform selector — shown for applicable job types */}
          {PLATFORM_JOBS.includes(type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platforms</label>
              <div className="flex flex-wrap gap-3">
                {PLATFORM_OPTIONS.map((p) => (
                  <label key={p.value} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={platforms.includes(p.value)}
                      onChange={(e) =>
                        setPlatforms((prev) =>
                          e.target.checked
                            ? [...prev, p.value]
                            : prev.filter((x) => x !== p.value)
                        )
                      }
                      className="rounded border-gray-300"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Auto-post tech specific config */}
          {type === "auto_post_tech" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topics <span className="font-normal text-gray-400">(one per line)</span>
                </label>
                <textarea
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="AI agents LLMs latest news"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max articles per run
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxArticles}
                  onChange={(e) => setMaxArticles(Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Reddit auto-reply config */}
          {type === "reddit_auto_reply" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max replies per day
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxReplies}
                onChange={(e) => setMaxReplies(Number(e.target.value))}
                className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Replies are spaced 20-40 minutes apart (~6 hours for 10 replies) to mimic natural browsing. Daily limit resets at midnight.
              </p>
            </div>
          )}

          {/* Agent run config */}
          {type === "agent_run" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
              <select
                value={agentSlug}
                onChange={(e) => setAgentSlug(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AGENT_SLUGS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg"
            >
              {saving ? "Creating..." : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
