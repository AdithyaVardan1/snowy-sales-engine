"use client";

import { useState } from "react";
import {
  TrendingUp,
  Sparkles,
  Send,
  Copy,
  Check,
  RefreshCw,
  Edit3,
  Zap,
  AlertCircle,
  Twitter,
  Linkedin,
} from "lucide-react";

interface Topic {
  title: string;
  why: string;
  talkingPoints: string[];
}

interface Draft {
  topicTitle: string;
  platform: string;
  type: "value" | "promo";
  content: string;
}

const INTERNAL_SECRET = "snowy-internal-2026";

const DEFAULT_SNOWY_CONTEXT = `Snowy AI by Snowball Labs — cloud-hosted OpenClaw platform.
- Starter: $12.5/mo — BYOK, 1-click integrations, agent hosting
- Pro: $39.5/mo — priority support, advanced analytics
- Enterprise: $79.5/mo — dedicated infra, custom SLA
- Website: agent.snowballlabs.org
- Key value: Deploy AI agents without infrastructure headaches. Bring your own keys, connect tools in 1 click.`;

export default function TrendsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState<Record<number, boolean>>({});
  const [postingAll, setPostingAll] = useState(false);
  const [posted, setPosted] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [stats, setStats] = useState<{ communityPostCount: number; newsArticleCount: number } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [snowyContext, setShowContext] = useState(DEFAULT_SNOWY_CONTEXT);
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [platforms, setPlatforms] = useState<("twitter" | "linkedin")[]>(["twitter", "linkedin"]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");
    setTopics([]);
    setDrafts([]);
    setPosted(new Set());

    try {
      const res = await fetch("/api/social/trend-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({ mode: "analyze" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed");
      } else {
        setTopics(data.topics || []);
        setStats({
          communityPostCount: data.communityPostCount || 0,
          newsArticleCount: data.newsArticleCount || 0,
        });
      }
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    }
    setAnalyzing(false);
  }

  async function handleGenerate() {
    if (topics.length === 0) return;
    setGenerating(true);
    setError("");
    setDrafts([]);
    setPosted(new Set());

    try {
      const res = await fetch("/api/social/trend-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          mode: "generate",
          topics,
          platforms,
          snowyContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
      } else {
        setDrafts(data.drafts || []);
      }
    } catch (e: any) {
      setError(e.message || "Generation failed");
    }
    setGenerating(false);
  }

  async function handlePostOne(index: number) {
    const draft = drafts[index];
    if (!draft) return;
    setPosting((p) => ({ ...p, [index]: true }));

    try {
      const res = await fetch("/api/social/trend-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          mode: "post",
          posts: [draft],
          platforms,
        }),
      });
      const data = await res.json();
      if (res.ok && data.posted > 0) {
        setPosted((prev) => new Set(Array.from(prev).concat(index)));
      } else {
        const err = data.results?.[0]?.error || data.error || "Post failed";
        alert(`Failed: ${err}`);
      }
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    }
    setPosting((p) => ({ ...p, [index]: false }));
  }

  async function handlePostAll() {
    const unposted = drafts
      .map((d, i) => ({ ...d, _index: i }))
      .filter((_, i) => !posted.has(i));
    if (unposted.length === 0) return;
    setPostingAll(true);

    try {
      const res = await fetch("/api/social/trend-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          mode: "post",
          posts: unposted.map(({ _index, ...d }) => d),
          platforms,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const newPosted = new Set(posted);
        unposted.forEach((u, i) => {
          if (data.results?.[i]?.success) newPosted.add(u._index);
        });
        setPosted(newPosted);
      }
    } catch (e: any) {
      alert(`Post all failed: ${e.message}`);
    }
    setPostingAll(false);
  }

  function updateDraft(index: number, content: string) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, content } : d)));
  }

  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  }

  const PlatformIcon = ({ platform }: { platform: string }) =>
    platform === "twitter" ? (
      <Twitter className="w-3.5 h-3.5" />
    ) : (
      <Linkedin className="w-3.5 h-3.5" />
    );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Trend Content</h1>
        <p className="text-sm text-gray-500 mt-1">
          Analyze trending topics from community posts and news, generate 50/50 value + Snowy AI content, and post to Twitter &amp; LinkedIn.
        </p>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg"
        >
          {analyzing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <TrendingUp className="w-4 h-4" />
          )}
          {analyzing ? "Analyzing..." : "Analyze Trends"}
        </button>

        {topics.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-medium rounded-lg"
          >
            {generating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? "Generating..." : "Generate Content"}
          </button>
        )}

        {drafts.length > 0 && (
          <button
            onClick={handlePostAll}
            disabled={postingAll || posted.size === drafts.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg"
          >
            {postingAll ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {postingAll
              ? "Posting..."
              : posted.size === drafts.length
              ? "All Posted"
              : `Post All (${drafts.length - posted.size})`}
          </button>
        )}

        {/* Platform toggles */}
        <div className="flex items-center gap-3 ml-auto">
          {(["twitter", "linkedin"] as const).map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={platforms.includes(p)}
                onChange={(e) =>
                  setPlatforms((prev) =>
                    e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)
                  )
                }
                className="rounded border-gray-300"
              />
              {p === "twitter" ? "Twitter" : "LinkedIn"}
            </label>
          ))}
          <button
            onClick={() => setShowContextEditor(!showContextEditor)}
            className="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
          >
            <Edit3 className="w-3.5 h-3.5 inline mr-1" />
            Snowy AI Context
          </button>
        </div>
      </div>

      {/* Snowy AI context editor */}
      {showContextEditor && (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Snowy AI Product Context
          </h3>
          <p className="text-xs text-gray-500 mb-2">
            This context is used when generating promo posts. Edit to update pricing, features, or messaging.
          </p>
          <textarea
            value={snowyContext}
            onChange={(e) => setShowContext(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="flex gap-4 text-xs text-gray-500">
          <span>Analyzed {stats.communityPostCount} community posts</span>
          <span>+ {stats.newsArticleCount} news articles</span>
        </div>
      )}

      {/* Trending Topics */}
      {topics.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Trending Topics ({topics.length})
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {topics.map((topic, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-200 transition-colors"
              >
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {topic.title}
                </h3>
                <p className="text-xs text-gray-500 mb-2">{topic.why}</p>
                <ul className="space-y-1">
                  {topic.talkingPoints.map((point, j) => (
                    <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <Zap className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {(analyzing || generating) && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse h-24"
            />
          ))}
        </div>
      )}

      {/* Content Queue */}
      {drafts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Content Queue ({drafts.length} posts — {drafts.filter((d) => d.type === "value").length} value, {drafts.filter((d) => d.type === "promo").length} promo)
          </h2>
          <div className="space-y-3">
            {drafts.map((draft, i) => {
              const isPosted = posted.has(i);
              const isPosting = posting[i];
              return (
                <div
                  key={i}
                  className={`bg-white rounded-xl p-4 border transition-colors ${
                    isPosted
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {/* Type badge */}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        draft.type === "value"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {draft.type === "value" ? "Value" : "Promo"}
                    </span>

                    {/* Platform badge */}
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      <PlatformIcon platform={draft.platform} />
                      {draft.platform === "twitter" ? "Twitter" : "LinkedIn"}
                    </span>

                    {/* Topic */}
                    <span className="text-xs text-gray-400">{draft.topicTitle}</span>

                    {/* Posted badge */}
                    {isPosted && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 ml-auto">
                        <Check className="w-3.5 h-3.5" />
                        Posted
                      </span>
                    )}
                  </div>

                  <textarea
                    value={draft.content}
                    onChange={(e) => updateDraft(i, e.target.value)}
                    disabled={isPosted}
                    rows={draft.platform === "linkedin" ? 6 : 3}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 disabled:bg-gray-50 disabled:text-gray-500"
                  />

                  <div className="flex items-center justify-between mt-2">
                    <span
                      className={`text-xs ${
                        draft.platform === "twitter" && draft.content.length > 280
                          ? "text-red-500 font-medium"
                          : "text-gray-400"
                      }`}
                    >
                      {draft.content.length}
                      {draft.platform === "twitter" ? "/280" : ""} chars
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(draft.content, i)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                      >
                        {copied === i ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copied === i ? "Copied" : "Copy"}
                      </button>
                      {!isPosted && (
                        <button
                          onClick={() => handlePostOne(i)}
                          disabled={isPosting}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg font-medium"
                        >
                          {isPosting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          {isPosting ? "Posting..." : "Post Now"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analyzing && !generating && topics.length === 0 && drafts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No trends analyzed yet</p>
          <p className="text-xs mt-1">
            Click &quot;Analyze Trends&quot; to extract trending topics from your community posts and news
          </p>
        </div>
      )}
    </div>
  );
}
