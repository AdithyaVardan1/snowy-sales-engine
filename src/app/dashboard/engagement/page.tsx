"use client";

import { useState } from "react";
import {
  Search,
  Sparkles,
  Send,
  ExternalLink,
  Copy,
  Check,
  MessageCircle,
  Heart,
  Repeat2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import SetupBanner from "@/components/SetupBanner";

interface Tweet {
  id: string;
  text: string;
  author: string;
  authorHandle: string;
  createdAt: string;
  replyCount: number;
  retweetCount: number;
  likeCount: number;
  url: string;
}

const SEARCH_PRESETS = [
  { label: "Snowy AI mentions", query: "\"snowy ai\" OR \"snowball labs\" -filter:retweets" },
  { label: "AI sales agents", query: "AI sales agent OR AI SDR OR AI outreach -filter:retweets" },
  { label: "GTM automation", query: "GTM automation OR go-to-market AI -filter:retweets" },
  { label: "AI dev tools", query: "AI developer tools OR AI coding assistant -filter:retweets" },
  { label: "Sales automation", query: "sales automation OR outreach automation -filter:retweets" },
  { label: "AI agents", query: "AI agent OR autonomous agent OR agentic AI -filter:retweets" },
];

export default function EngagementPage() {
  const [query, setQuery] = useState("");
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedTweet, setSelectedTweet] = useState<Tweet | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSearch(searchQuery?: string) {
    const q = searchQuery || query;
    if (!q.trim()) return;
    setSearching(true);
    setSearchError("");
    setSelectedTweet(null);
    setReplyDraft("");

    try {
      const res = await fetch(`/api/twitter/search?q=${encodeURIComponent(q)}&count=25`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || "Search failed");
        setTweets([]);
      } else {
        setTweets(data.tweets || []);
        if ((data.tweets || []).length === 0) {
          setSearchError("No tweets found. Try different search terms.");
        }
      }
    } catch (e: any) {
      setSearchError(e.message || "Search failed");
      setTweets([]);
    }
    setSearching(false);
  }

  async function handleGenerateDraft() {
    if (!selectedTweet) return;
    setDraftLoading(true);
    try {
      const res = await fetch("/api/twitter/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generateDraft: true,
          tweetText: selectedTweet.text,
          tweetAuthor: selectedTweet.authorHandle,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplyDraft(data.draft || "");
      } else {
        setReplyDraft(`[Error: ${data.error}]`);
      }
    } catch (e: any) {
      setReplyDraft(`[Error: ${e.message}]`);
    }
    setDraftLoading(false);
  }

  async function handlePostReply() {
    if (!selectedTweet || !replyDraft.trim()) return;
    setPosting(true);
    setPostSuccess(false);
    try {
      const res = await fetch("/api/twitter/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweetId: selectedTweet.id,
          replyText: replyDraft,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPostSuccess(true);
        setTimeout(() => setPostSuccess(false), 3000);
      } else {
        alert(`Reply failed: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Reply failed: ${e.message}`);
    }
    setPosting(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const now = Date.now();
      const diff = now - d.getTime();
      const hours = Math.floor(diff / 3600000);
      if (hours < 1) return "just now";
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <SetupBanner
        platform="Twitter / X"
        requiredKeys={[
          { key: "TWITTER_CT0", label: "Twitter ct0 cookie" },
          { key: "TWITTER_AUTH_TOKEN", label: "Twitter auth_token cookie" },
        ]}
      />
      <SetupBanner
        platform="AI Provider"
        requiredKeys={[
          { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude) API key" },
          { key: "GEMINI_API_KEY", label: "Gemini API key" },
        ]}
      />

      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Twitter Engagement</h1>
        <p className="text-sm text-gray-500 mt-1">Search for relevant tweets, generate AI reply drafts, and post replies directly to engage with the community.</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
      {/* Left: Search & Results */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search bar */}
        <div className="mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search tweets... e.g. openclaw setup issues"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={searching || !query.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg"
            >
              {searching ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>

          {/* Preset searches */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SEARCH_PRESETS.map((preset) => (
              <button
                key={preset.query}
                onClick={() => {
                  setQuery(preset.query);
                  handleSearch(preset.query);
                }}
                className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {searchError && (
          <div className="mb-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {searchError}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {searching ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-lg p-4 animate-pulse h-24 border border-gray-100" />
              ))}
            </div>
          ) : tweets.length === 0 && !searchError ? (
            <div className="text-center py-16 text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">Search for tweets to engage with</p>
              <p className="text-xs mt-1">
                Find users discussing AI agents, sales automation, or dev tools and engage
              </p>
            </div>
          ) : (
            tweets.map((tweet) => {
              const isSelected = selectedTweet?.id === tweet.id;
              return (
                <div
                  key={tweet.id}
                  onClick={() => {
                    setSelectedTweet(tweet);
                    setReplyDraft("");
                    setPostSuccess(false);
                  }}
                  className={`bg-white rounded-lg p-4 border cursor-pointer transition-all hover:shadow-sm ${
                    isSelected
                      ? "border-blue-500 ring-1 ring-blue-500"
                      : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {tweet.author}
                        </span>
                        <span className="text-xs text-gray-400">
                          @{tweet.authorHandle}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(tweet.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                        {tweet.text}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {tweet.replyCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Repeat2 className="w-3.5 h-3.5" />
                          {tweet.retweetCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5" />
                          {tweet.likeCount}
                        </span>
                      </div>
                    </div>
                    <a
                      href={tweet.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Reply panel */}
      <div className="w-[400px] shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        {selectedTweet ? (
          <>
            {/* Tweet preview */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {selectedTweet.author}
                  </span>
                  <span className="text-xs text-gray-400">
                    @{selectedTweet.authorHandle}
                  </span>
                </div>
                <a
                  href={selectedTweet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                {selectedTweet.text}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" /> {selectedTweet.replyCount}
                </span>
                <span className="flex items-center gap-1">
                  <Repeat2 className="w-3.5 h-3.5" /> {selectedTweet.retweetCount}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" /> {selectedTweet.likeCount}
                </span>
                <span>{formatDate(selectedTweet.createdAt)}</span>
              </div>
            </div>

            {/* Reply composer */}
            <div className="flex-1 p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">
                  Reply to @{selectedTweet.authorHandle}
                </h4>
                <button
                  onClick={handleGenerateDraft}
                  disabled={draftLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${draftLoading ? "animate-pulse" : ""}`} />
                  {draftLoading ? "Generating..." : "AI Draft"}
                </button>
              </div>

              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="Write your reply or generate an AI draft..."
                className="flex-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              />

              {/* Character count */}
              <div className="flex items-center justify-between mt-2">
                <span
                  className={`text-xs ${
                    replyDraft.length > 280 ? "text-red-500 font-medium" : "text-gray-400"
                  }`}
                >
                  {replyDraft.length}/280
                </span>
                {replyDraft.length > 280 && (
                  <span className="text-xs text-amber-500">
                    Will be posted as a long tweet
                  </span>
                )}
              </div>

              {/* Success banner */}
              {postSuccess && (
                <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <Check className="w-4 h-4" />
                  Reply posted successfully!
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => copyToClipboard(replyDraft)}
                  disabled={!replyDraft}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={handlePostReply}
                  disabled={posting || !replyDraft.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {posting ? "Posting..." : "Post Reply"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">Select a tweet to reply</p>
              <p className="text-xs mt-1">
                Search for Snowy AI and sales automation tweets and engage with the community
              </p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
