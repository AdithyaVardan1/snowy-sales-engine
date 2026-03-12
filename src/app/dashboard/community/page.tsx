"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ExternalLink,
  Sparkles,
  Check,
  X,
  Copy,
  ChevronDown,
  Plus,
  MessageSquare,
} from "lucide-react";
import SetupBanner from "@/components/SetupBanner";

interface Post {
  id: string;
  externalId: string;
  source: string;
  subreddit?: string;
  title: string;
  body: string;
  author: string;
  url: string;
  status: string;
  draftResponse?: string;
  finalResponse?: string;
  respondedBy?: string;
  respondedAt?: string;
  fetchedAt: string;
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  github_issue: { label: "GitHub Issue", color: "bg-green-100 text-green-700" },
  github_discussion: { label: "GitHub Discussion", color: "bg-green-100 text-green-700" },
  reddit: { label: "Reddit", color: "bg-orange-100 text-orange-700" },
  twitter: { label: "Twitter", color: "bg-blue-100 text-blue-700" },
  linkedin: { label: "LinkedIn", color: "bg-sky-100 text-sky-700" },
  manual: { label: "Manual", color: "bg-gray-100 text-gray-700" },
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700" },
  draft_ready: { label: "Draft Ready", color: "bg-yellow-100 text-yellow-700" },
  responded: { label: "Responded", color: "bg-emerald-100 text-emerald-700" },
  ignored: { label: "Ignored", color: "bg-gray-100 text-gray-500" },
};

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [respondedBy, setRespondedBy] = useState("");
  const [copied, setCopied] = useState(false);
  const [replyingToReddit, setReplyingToReddit] = useState(false);
  const [redditReplyResult, setRedditReplyResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [postingToTwitter, setPostingToTwitter] = useState(false);
  const [twitterPostResult, setTwitterPostResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sourceFilter) params.set("source", sourceFilter);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/community/posts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
        setTotal(data.total);
      }
    } catch (e) {
      console.error("Failed to load posts", e);
    }
    setLoading(false);
  }, [sourceFilter, statusFilter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function handleFetch(source: string) {
    setFetching(true);
    try {
      await fetch("/api/community/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      await loadPosts();
    } catch (e) {
      console.error("Fetch failed", e);
    }
    setFetching(false);
  }

  async function handleGenerateDraft(postId: string) {
    setDraftLoading(true);
    try {
      const res = await fetch("/api/community/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        const data = await res.json();
        setDraft(data.draft);
      }
    } catch (e) {
      console.error("Draft generation failed", e);
    }
    setDraftLoading(false);
  }

  async function handleRespond() {
    if (!selectedPost || !draft) return;
    try {
      await fetch("/api/community/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedPost.id,
          finalResponse: draft,
          respondedBy: respondedBy || "team",
        }),
      });
      setSelectedPost(null);
      setDraft("");
      await loadPosts();
    } catch (e) {
      console.error("Respond failed", e);
    }
  }

  async function handleIgnore(postId: string) {
    await fetch(`/api/community/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, status: "ignored" }),
    });
    await loadPosts();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleReplyOnReddit() {
    if (!selectedPost || !draft) return;
    // Extract the Reddit post "thing ID" from the URL
    // Reddit post URLs: reddit.com/r/sub/comments/POSTID/...
    const match = selectedPost.url.match(/\/comments\/([a-z0-9]+)\//i);
    if (!match) {
      setRedditReplyResult({ success: false, error: "Could not extract post ID from URL" });
      return;
    }
    const thingId = `t3_${match[1]}`;
    setReplyingToReddit(true);
    setRedditReplyResult(null);
    try {
      const res = await fetch("/api/community/reddit-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thingId, text: draft }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRedditReplyResult({ success: true });
        // Auto mark as responded
        await fetch("/api/community/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: selectedPost.id, finalResponse: draft, respondedBy: respondedBy || "team" }),
        });
        await loadPosts();
      } else {
        setRedditReplyResult({ success: false, error: data.error });
      }
    } catch (e) {
      setRedditReplyResult({ success: false, error: String(e) });
    }
    setReplyingToReddit(false);
  }

  async function handleReplyOnTwitter() {
    if (!selectedPost || !draft) return;
    // Extract tweet ID — try URL first (most reliable), then externalId
    let tweetId = "";
    const urlMatch = selectedPost.url.match(/\/status\/(\d+)/);
    if (urlMatch) {
      tweetId = urlMatch[1];
    } else if (selectedPost.externalId) {
      // externalId is stored as "twitter_1234567890" — strip the prefix
      tweetId = selectedPost.externalId.replace(/^twitter_/, "");
    }
    if (!tweetId) {
      setTwitterPostResult({ success: false, error: "Could not extract tweet ID from URL or post data" });
      return;
    }
    setPostingToTwitter(true);
    setTwitterPostResult(null);
    try {
      const res = await fetch("/api/community/twitter-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetId, text: draft }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTwitterPostResult({ success: true });
        await fetch("/api/community/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: selectedPost.id, finalResponse: draft, respondedBy: respondedBy || "team" }),
        });
        await loadPosts();
      } else {
        setTwitterPostResult({ success: false, error: data.error });
      }
    } catch (e) {
      setTwitterPostResult({ success: false, error: String(e) });
    }
    setPostingToTwitter(false);
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <SetupBanner
        platform="AI Provider"
        requiredKeys={[
          { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude) API key" },
          { key: "GEMINI_API_KEY", label: "Gemini API key" },
        ]}
      />
      <SetupBanner
        platform="GitHub"
        requiredKeys={[
          { key: "GITHUB_TOKEN", label: "GitHub personal access token" },
        ]}
      />

      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Community Monitor</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor posts from GitHub, Reddit, Twitter &amp; LinkedIn. Generate AI response drafts and engage directly.</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
      {/* Left: Post feed */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sources</option>
              <option value="github_issue">GitHub Issues</option>
              <option value="github_discussion">GitHub Discussions</option>
              <option value="reddit">Reddit</option>
              <option value="twitter">Twitter</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="draft_ready">Draft Ready</option>
              <option value="responded">Responded</option>
              <option value="ignored">Ignored</option>
            </select>
            <span className="flex items-center text-sm text-gray-500 px-2">
              {total} posts
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleFetch("all")}
              disabled={fetching}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Fetching..." : "Fetch All"}
            </button>
          </div>
        </div>

        {/* Post list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-lg p-4 animate-pulse h-24 border border-gray-100" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">No posts found</p>
              <p className="text-sm mt-1">Click &quot;Fetch All&quot; to pull posts from GitHub, Reddit, Twitter &amp; LinkedIn</p>
            </div>
          ) : (
            posts.map((post) => {
              const sourceBadge = SOURCE_BADGES[post.source] || SOURCE_BADGES.manual;
              const statusBadge = STATUS_BADGES[post.status] || STATUS_BADGES.new;
              const isSelected = selectedPost?.id === post.id;

              return (
                <div
                  key={post.id}
                  onClick={() => {
                    setSelectedPost(post);
                    setDraft(post.draftResponse || "");
                  }}
                  className={`bg-white rounded-lg p-4 border cursor-pointer transition-all hover:shadow-sm ${isSelected
                    ? "border-blue-500 ring-1 ring-blue-500"
                    : "border-gray-100 hover:border-gray-200"
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceBadge.color}`}>
                          {sourceBadge.label}
                        </span>
                        {post.subreddit && (
                          <span className="text-xs text-gray-400">{post.subreddit}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {post.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {post.body}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">
                      <div>{post.author}</div>
                      <div>{timeAgo(post.fetchedAt)}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Response panel */}
      <div className="w-[400px] shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        {selectedPost ? (
          <>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm truncate pr-4">
                  {selectedPost.title}
                </h3>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedPost.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setSelectedPost(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                by {selectedPost.author} &middot;{" "}
                {SOURCE_BADGES[selectedPost.source]?.label}
                {selectedPost.subreddit ? ` in ${selectedPost.subreddit}` : ""}
              </p>
            </div>

            {/* Post content */}
            <div className="p-4 border-b border-gray-100 max-h-48 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {selectedPost.body}
              </p>
            </div>

            {/* Draft section */}
            <div className="flex-1 p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Response Draft</h4>
                <button
                  onClick={() => handleGenerateDraft(selectedPost.id)}
                  disabled={draftLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Sparkles className={`w - 3.5 h - 3.5 ${draftLoading ? "animate-pulse" : ""}`} />
                  {draftLoading ? "Generating..." : "Generate with AI"}
                </button>
              </div>

              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="AI-generated draft will appear here, or write your own response..."
                className="flex-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              />

              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={respondedBy}
                  onChange={(e) => setRespondedBy(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(draft)}
                    disabled={!draft}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? "Copied!" : "Copy Draft"}
                  </button>
                  {/* Reddit direct reply — only shown for Reddit posts */}
                  {selectedPost.source === "reddit" && (
                    <button
                      onClick={handleReplyOnReddit}
                      disabled={!draft || replyingToReddit}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {replyingToReddit ? "Replying..." : "Reply on Reddit"}
                    </button>
                  )}
                  {/* Twitter direct reply — only shown for Twitter posts */}
                  {selectedPost.source === "twitter" && (
                    <button
                      onClick={handleReplyOnTwitter}
                      disabled={!draft || postingToTwitter}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {postingToTwitter ? "Replying..." : "Reply on Twitter"}
                    </button>
                  )}
                  <button
                    onClick={handleRespond}
                    disabled={!draft}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Mark Responded
                  </button>
                </div>
                {redditReplyResult && (
                  <div className={`p-2 rounded-lg text-xs ${redditReplyResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {redditReplyResult.success ? "Replied on Reddit successfully!" : `Failed: ${redditReplyResult.error}`}
                  </div>
                )}
                {twitterPostResult && (
                  <div className={`p-2 rounded-lg text-xs ${twitterPostResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {twitterPostResult.success ? "Replied on Twitter successfully!" : `Failed: ${twitterPostResult.error}`}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-sm">Select a post to respond</p>
              <p className="text-xs mt-1">Click on a post from the feed</p>
            </div>
          </div>
        )
        }
      </div>
      </div>
    </div>
  );
}
