"use client";

import { useState, useEffect } from "react";
import {
  Send,
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  X,
  Twitter,
  Linkedin,
  Trash2,
  MessageSquare,
} from "lucide-react";
import SetupBanner from "@/components/SetupBanner";

interface SocialAccount {
  id: string;
  platform: string;
  username?: string;
  status: string;
  updatedAt: string;
}

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  threadParts?: string;
  status: string;
  scheduledFor?: string;
  postedAt?: string;
  externalId?: string;
  error?: string;
  createdAt: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clock className="w-3.5 h-3.5 text-gray-400" />,
  scheduled: <Clock className="w-3.5 h-3.5 text-yellow-500" />,
  posted: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
  failed: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
};

// Reddit alien icon (simple SVG since lucide doesn't have one)
function RedditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

type Platform = "twitter" | "linkedin" | "reddit";

export default function SocialPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [content, setContent] = useState("");
  const [isThread, setIsThread] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showTopicInput, setShowTopicInput] = useState(false);

  // Auto-split long text into ≤280 char chunks at paragraph/sentence breaks
  function autoSplitToThread(text: string): string {
    const MAX = 275; // leave a little room
    const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    const chunks: string[] = [];
    let current = "";

    for (const para of paragraphs) {
      if (para.length > MAX) {
        // Para itself is too long — split by sentences
        const sentences = para.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g) || [para];
        for (const sentence of sentences) {
          const s = sentence.trim();
          if ((current + " " + s).trim().length <= MAX) {
            current = (current + " " + s).trim();
          } else {
            if (current) chunks.push(current);
            current = s.length <= MAX ? s : s.slice(0, MAX);
          }
        }
      } else if ((current + "\n" + para).trim().length <= MAX) {
        current = current ? current + "\n" + para : para;
      } else {
        if (current) chunks.push(current);
        current = para;
      }
    }
    if (current) chunks.push(current);
    return chunks.join("\n---\n");
  }

  // Reddit-specific
  const [redditSubreddit, setRedditSubreddit] = useState("");
  const [redditTitle, setRedditTitle] = useState("");
  const [redditResult, setRedditResult] = useState<{ url?: string; error?: string } | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [accRes, postRes] = await Promise.all([
        fetch("/api/social/accounts"),
        fetch("/api/social/posts"),
      ]);
      if (accRes.ok) setAccounts((await accRes.json()).accounts);
      if (postRes.ok) setPosts((await postRes.json()).posts);
    } catch (e) {
      console.error("Failed to load social data", e);
    }
    setLoading(false);
  }

  function getAccount(p: string) {
    return accounts.find((a) => a.platform === p);
  }

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    const genPlatform = platform === "reddit" ? "reddit" : platform;
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform: genPlatform }),
      });
      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
        if (platform === "twitter" && data.content.includes("---")) setIsThread(true);
      }
    } catch (e) {
      console.error("Generation failed", e);
    }
    setGenerating(false);
    setShowTopicInput(false);
  }

  async function handlePublishNow() {
    if (!content.trim()) return;

    // Reddit posts via dedicated endpoint
    if (platform === "reddit") {
      if (!redditSubreddit.trim() || !redditTitle.trim()) {
        alert("Please fill in the subreddit and post title for Reddit.");
        return;
      }
      setPublishing(true);
      setRedditResult(null);
      try {
        const res = await fetch("/api/social/reddit-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subreddit: redditSubreddit.trim(),
            title: redditTitle.trim(),
            text: content.trim(),
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setRedditResult({ url: data.postUrl });
          setContent("");
          setRedditTitle("");
        } else {
          setRedditResult({ error: data.error });
        }
      } catch (e) {
        setRedditResult({ error: String(e) });
      }
      setPublishing(false);
      return;
    }

    setPublishing(true);
    let threadParts: string[] | undefined;
    if (platform === "twitter" && isThread) {
      threadParts = content.split("---").map((t) => t.trim()).filter((t) => t.length > 0);
    }

    const createRes = await fetch("/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        content: threadParts ? threadParts[0] : content,
        threadParts,
        status: "draft",
      }),
    });

    if (createRes.ok) {
      const post = await createRes.json();
      const pubRes = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      if (pubRes.ok) {
        setContent("");
        setIsThread(false);
      } else {
        const err = await pubRes.json();
        alert(`Publishing failed: ${err.error}`);
      }
    }

    setPublishing(false);
    await loadAll();
  }

  async function handleSchedule() {
    if (!content.trim() || !scheduledFor || platform === "reddit") return;
    let threadParts: string[] | undefined;
    if (platform === "twitter" && isThread) {
      threadParts = content.split("---").map((t) => t.trim()).filter((t) => t.length > 0);
    }
    await fetch("/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        content: threadParts ? threadParts[0] : content,
        threadParts,
        status: "scheduled",
        scheduledFor,
      }),
    });
    setContent("");
    setIsThread(false);
    setScheduledFor("");
    await loadAll();
  }

  async function handleDeletePost(id: string) {
    await fetch(`/api/social/posts/${id}`, { method: "DELETE" });
    await loadAll();
  }

  const twitterAccount = getAccount("twitter");
  const linkedinAccount = getAccount("linkedin");
  const charLimit = platform === "twitter" ? 25_000 : platform === "linkedin" ? 3000 : 40000;
  const currentContent = isThread
    ? content.split("---").map((t) => t.trim()).filter(Boolean)
    : [content];

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
        platform="LinkedIn"
        requiredKeys={[
          { key: "LINKEDIN_ACCESS_TOKEN", label: "LinkedIn OAuth access token" },
          { key: "LINKEDIN_PERSON_URN", label: "LinkedIn person URN" },
        ]}
      />
      <SetupBanner
        platform="Reddit"
        requiredKeys={[
          { key: "REDDIT_SESSION_COOKIE", label: "Reddit session cookie" },
        ]}
      />

      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Social Media</h1>
        <p className="text-sm text-gray-500 mt-1">Compose, schedule, and publish posts to Twitter/X, LinkedIn, and Reddit. Use AI to generate content.</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
      {/* Left: Composer */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Platform tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setPlatform("twitter")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${platform === "twitter"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
          >
            <Twitter className="w-4 h-4" />
            Twitter/X
            {twitterAccount && (
              <span
                className={`w-2 h-2 rounded-full ${twitterAccount.status === "active" ? "bg-emerald-400" : "bg-red-400"
                  }`}
              />
            )}
          </button>
          <button
            onClick={() => setPlatform("linkedin")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${platform === "linkedin"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
          >
            <Linkedin className="w-4 h-4" />
            LinkedIn
            {linkedinAccount && (
              <span
                className={`w-2 h-2 rounded-full ${linkedinAccount.status === "active" ? "bg-emerald-400" : "bg-red-400"
                  }`}
              />
            )}
          </button>
          <button
            onClick={() => setPlatform("reddit")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${platform === "reddit"
              ? "bg-orange-500 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
          >
            <RedditIcon className="w-4 h-4" />
            Reddit
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Account status banners */}
        {platform === "twitter" && !twitterAccount && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-700">
            Twitter not connected. Click the settings icon to add your cookies.
          </div>
        )}
        {platform === "linkedin" && !linkedinAccount && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-700">
            LinkedIn not connected. Click the settings icon to connect.
          </div>
        )}
        {platform === "reddit" && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm text-orange-700">
            Reddit uses your session cookie. Add <code className="font-mono text-xs bg-orange-100 px-1 rounded">REDDIT_SESSION_COOKIE</code> in Settings → Reddit.
          </div>
        )}

        {/* Composer */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1 flex flex-col">
          {/* Thread mode + auto-split controls */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {platform === "twitter" && (
                <>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={isThread}
                      onChange={(e) => setIsThread(e.target.checked)}
                      className="rounded"
                    />
                    Thread mode (separate tweets with ---)
                  </label>
                  {/* Show auto-split button when content is too long for a single tweet */}
                  {!isThread && content.length > 280 && (
                    <button
                      onClick={() => {
                        setContent(autoSplitToThread(content));
                        setIsThread(true);
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium rounded-lg border border-blue-200 transition-colors"
                      title="Automatically split content into ≤280 char tweets"
                    >
                      ✂ Auto-split as thread
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTopicInput(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-medium rounded-lg transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Generate
              </button>
            </div>
          </div>

          {/* Reddit-specific fields */}
          {platform === "reddit" && (
            <div className="flex gap-2 mb-3">
              <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1.5 text-sm text-gray-500">
                r/
              </div>
              <input
                value={redditSubreddit}
                onChange={(e) => setRedditSubreddit(e.target.value)}
                placeholder="subreddit"
                className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <input
                value={redditTitle}
                onChange={(e) => setRedditTitle(e.target.value)}
                placeholder="Post title..."
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              platform === "twitter"
                ? isThread
                  ? "Write your thread... separate tweets with ---"
                  : "What's happening?"
                : platform === "reddit"
                  ? "Write your post body... Be genuinely helpful."
                  : "Share an update with your LinkedIn network..."
            }
            className="flex-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Reddit result */}
          {platform === "reddit" && redditResult && (
            <div className={`mt-2 p-2 rounded-lg text-xs ${redditResult.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {redditResult.error
                ? `Error: ${redditResult.error}`
                : <>Posted! <a href={redditResult.url} target="_blank" rel="noreferrer" className="underline">{redditResult.url}</a></>}
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-400">
              {isThread
                ? `${currentContent.length} tweets`
                : `${content.length}${platform !== "reddit" ? `/${charLimit}` : " chars"}`}
            </div>
            <div className="flex items-center gap-2">
              {platform !== "reddit" && (
                <>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
                  />
                  <button
                    onClick={handleSchedule}
                    disabled={!content.trim() || !scheduledFor}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Schedule
                  </button>
                </>
              )}
              <button
                onClick={handlePublishNow}
                disabled={!content.trim() || publishing}
                className={`flex items-center gap-1.5 px-4 py-1.5 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors ${platform === "reddit"
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-blue-600 hover:bg-blue-700"
                  }`}
              >
                <Send className="w-3.5 h-3.5" />
                {publishing ? "Posting..." : platform === "reddit" ? "Post to Reddit" : "Post Now"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Post history */}
      <div className="w-[340px] bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Post History</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {posts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No posts yet</p>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {post.platform === "twitter" ? (
                      <Twitter className="w-3 h-3 text-blue-400" />
                    ) : post.platform === "reddit" ? (
                      <RedditIcon className="w-3 h-3 text-orange-500" />
                    ) : (
                      <Linkedin className="w-3 h-3 text-blue-700" />
                    )}
                    {STATUS_ICONS[post.status]}
                    <span className="text-[10px] text-gray-500">{post.status}</span>
                  </div>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-gray-300 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-gray-700 line-clamp-3">{post.content}</p>
                {post.error && (
                  <p className="text-[10px] text-red-500 mt-1">{post.error}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  {post.postedAt
                    ? `Posted ${new Date(post.postedAt).toLocaleString()}`
                    : post.scheduledFor
                      ? `Scheduled ${new Date(post.scheduledFor).toLocaleString()}`
                      : new Date(post.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Topic modal */}
      {showTopicInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Generate {platform === "twitter" ? "Tweet/Thread" : platform === "reddit" ? "Reddit Post" : "LinkedIn Post"}
              </h3>
              <button onClick={() => setShowTopicInput(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic or idea..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || generating}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-medium rounded-lg"
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <CookieSettingsModal
          accounts={accounts}
          onClose={() => setShowSettings(false)}
          onSaved={loadAll}
        />
      )}
      </div>
    </div>
  );
}

function CookieSettingsModal({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: SocialAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [twitterCt0, setTwitterCt0] = useState("");
  const [twitterAuth, setTwitterAuth] = useState("");
  const [redditSession, setRedditSession] = useState("");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [redditStatus, setRedditStatus] = useState<{ valid?: boolean; username?: string; error?: string } | null>(null);

  const twitter = accounts.find((a) => a.platform === "twitter");
  const linkedin = accounts.find((a) => a.platform === "linkedin");

  async function saveTwitter() {
    setSaving("twitter");
    setError("");
    setSuccessMsg("");

    const res = await fetch("/api/social/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "twitter",
        cookies: { ct0: twitterCt0.trim(), auth_token: twitterAuth.trim() },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
    } else {
      setTwitterCt0("");
      setTwitterAuth("");
      setSuccessMsg(
        data.username
          ? `Connected as @${data.username}`
          : "Cookies saved — username could not be verified"
      );
      onSaved();
    }
    setSaving("");
  }

  async function verifyReddit() {
    setSaving("reddit");
    setRedditStatus(null);
    // Save cookie to .env is manual — just verify the current env value
    const res = await fetch("/api/social/reddit-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify" }),
    });
    const data = await res.json();
    setRedditStatus(data);
    setSaving("");
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-900">Social Account Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Twitter */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Twitter className="w-4 h-4 text-blue-400" />
              <h4 className="text-sm font-semibold text-gray-900">Twitter/X</h4>
              {twitter && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${twitter.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {twitter.status} {twitter.username ? `(@${twitter.username})` : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Open x.com → DevTools (F12) → Application → Cookies → x.com → copy <strong>ct0</strong> and <strong>auth_token</strong> values.
            </p>
            <div className="space-y-2">
              <input value={twitterCt0} onChange={(e) => setTwitterCt0(e.target.value)} placeholder="ct0 cookie" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={twitterAuth} onChange={(e) => setTwitterAuth(e.target.value)} placeholder="auth_token cookie" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={saveTwitter} disabled={!twitterCt0 || !twitterAuth || saving === "twitter"} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg">
                {saving === "twitter" ? "Verifying..." : twitter ? "Update Cookies" : "Connect Twitter"}
              </button>
              {successMsg && (
                <div className="p-2 rounded-lg text-xs bg-green-50 text-green-700">
                  {successMsg}
                </div>
              )}
            </div>
          </div>

          {/* LinkedIn */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Linkedin className="w-4 h-4 text-blue-700" />
              <h4 className="text-sm font-semibold text-gray-900">LinkedIn</h4>
              {linkedin && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${linkedin.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {linkedin.status} {linkedin.username ? `(${linkedin.username})` : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-2">
              LinkedIn now uses OAuth. Click below to open the authorization page, then paste your <code className="font-mono bg-gray-100 px-1 rounded">LINKEDIN_ACCESS_TOKEN</code> and <code className="font-mono bg-gray-100 px-1 rounded">LINKEDIN_PERSON_URN</code> in <strong>.env.local</strong>.
            </p>
            <a
              href="/api/social/linkedin-auth"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg"
              onClick={async (e) => {
                e.preventDefault();
                const res = await fetch("/api/social/linkedin-auth");
                const data = await res.json();
                if (data.url) window.open(data.url, "_blank");
              }}
            >
              <Linkedin className="w-3.5 h-3.5" />
              Connect LinkedIn (OAuth)
            </a>
            {linkedin && (
              <p className="text-xs text-emerald-600 mt-2">
                ✓ Connected{linkedin.username ? ` as ${linkedin.username}` : ""}
              </p>
            )}
          </div>

          {/* Reddit */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RedditIcon className="w-4 h-4 text-orange-500" />
              <h4 className="text-sm font-semibold text-gray-900">Reddit</h4>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Log into reddit.com → DevTools (F12) → Application → Cookies → copy <strong>reddit_session</strong> value → paste into <code className="font-mono bg-gray-100 px-1 rounded">.env.local</code> as <code className="font-mono bg-gray-100 px-1 rounded">REDDIT_SESSION_COOKIE=...</code>, then restart the dev server.
            </p>
            <button
              onClick={verifyReddit}
              disabled={saving === "reddit"}
              className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
            >
              {saving === "reddit" ? "Checking..." : "Verify Reddit Session"}
            </button>
            {redditStatus && (
              <div className={`mt-2 p-2 rounded-lg text-xs ${redditStatus.valid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {redditStatus.valid
                  ? `✓ Connected as u/${redditStatus.username}`
                  : `✗ ${redditStatus.error}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
