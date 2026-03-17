"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Search,
  Send,
  MessageSquare,
  Plus,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  ChevronRight,
  User,
  Zap,
  Target,
  BookOpen,
  ArrowLeft,
  Instagram,
  Twitter,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  priority: number;
  isActive: boolean;
}

interface SalesProspect {
  id: string;
  platform: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  followers: number;
  source: string;
  status: string;
  score: number;
  tags: string | null;
  lastContactedAt: string | null;
  sessions: Array<{
    id: string;
    stage: string;
    sentiment: string | null;
    lastMessageAt: string | null;
    isActive: boolean;
  }>;
}

interface SalesSession {
  id: string;
  stage: string;
  summary: string | null;
  sentiment: string | null;
  nextAction: string | null;
  isActive: boolean;
  isPaused: boolean;
  lastMessageAt: string | null;
  prospect: {
    id: string;
    username: string;
    displayName: string | null;
    platform: string;
    status: string;
    score: number;
  };
  messages: Array<{
    role: string;
    content: string;
    createdAt: string;
  }>;
}

interface SalesMessage {
  id: string;
  role: string;
  content: string;
  status: string;
  externalId: string | null;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface FoundProspect {
  username: string;
  displayName: string;
  bio: string;
  followers: number;
  tweetText?: string;
  tweetUrl?: string;
  userId?: string;
  isPrivate?: boolean;
  alreadyExists: boolean;
  selected: boolean;
}

// ── Tabs ────────────────────────────────────────────────────────────────────

type Tab = "pipeline" | "knowledge" | "prospects" | "session";

const INTERNAL_SECRET = "snowy-internal-2026";

const STAGES = [
  { key: "cold_outreach", label: "Cold Outreach", color: "bg-gray-500" },
  { key: "engaged", label: "Engaged", color: "bg-blue-500" },
  { key: "interested", label: "Interested", color: "bg-yellow-500" },
  { key: "objection_handling", label: "Objections", color: "bg-orange-500" },
  { key: "closing", label: "Closing", color: "bg-purple-500" },
  { key: "converted", label: "Converted", color: "bg-green-500" },
  { key: "lost", label: "Lost", color: "bg-red-500" },
];

const CATEGORIES = [
  "product",
  "pricing",
  "faq",
  "objection",
  "competitor",
  "usecase",
];

// ── Main Component ──────────────────────────────────────────────────────────

export default function SalesPage() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [sessions, setSessions] = useState<SalesSession[]>([]);
  const [prospects, setProspects] = useState<SalesProspect[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<
    (SalesSession & { messages: SalesMessage[] }) | null
  >(null);

  // Prospect finder
  const [searchQuery, setSearchQuery] = useState("looking for AI tools");
  const [searchPlatform, setSearchPlatform] = useState<"twitter" | "instagram">("twitter");
  const [foundProspects, setFoundProspects] = useState<FoundProspect[]>([]);
  const [searching, setSearching] = useState(false);

  // Knowledge form
  const [kForm, setKForm] = useState({
    title: "",
    content: "",
    category: "product",
    priority: 0,
  });
  const [editingKnowledge, setEditingKnowledge] = useState<string | null>(null);

  // Engine status
  const [engineLog, setEngineLog] = useState<string[]>([]);
  const [cycling, setCycling] = useState(false);

  // Compose message in session
  const [composeText, setComposeText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  // ── Data Fetchers ─────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/sales/sessions");
    const data = await res.json();
    setSessions(data.sessions || []);
  }, []);

  const fetchProspects = useCallback(async () => {
    const res = await fetch("/api/sales/prospects");
    const data = await res.json();
    setProspects(data.prospects || []);
  }, []);

  const fetchKnowledge = useCallback(async () => {
    const res = await fetch("/api/sales/knowledge");
    const data = await res.json();
    setKnowledge(data.entries || []);
  }, []);

  const fetchSessionDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/sales/sessions?id=${id}`);
    const data = await res.json();
    setActiveSession(data.session || null);
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchProspects();
    fetchKnowledge();
  }, [fetchSessions, fetchProspects, fetchKnowledge]);

  useEffect(() => {
    if (activeSessionId) {
      fetchSessionDetail(activeSessionId);
      setTab("session");
    }
  }, [activeSessionId, fetchSessionDetail]);

  // ── Actions ───────────────────────────────────────────────────────────

  async function findProspects() {
    setSearching(true);
    try {
      const mode = searchPlatform === "instagram" ? "ig_find_prospects" : "find_prospects";
      const res = await fetch("/api/sales/engine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({ mode, query: searchQuery }),
      });
      const data = await res.json();
      if (data.error) {
        setEngineLog([`Search failed: ${data.error}`]);
      } else if (data.prospects) {
        setFoundProspects(
          data.prospects.map((p: FoundProspect) => ({ ...p, selected: !p.alreadyExists && !p.isPrivate }))
        );
      }
    } catch (err) {
      console.error("Find prospects failed:", err);
    }
    setSearching(false);
  }

  async function startOutreach() {
    const selected = foundProspects.filter((p) => p.selected);
    if (selected.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/sales/engine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          mode: "outreach",
          platform: searchPlatform,
          targets: selected.map((p) => ({
            username: p.username,
            displayName: p.displayName,
            bio: p.bio,
            followers: p.followers,
            source: "search",
          })),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFoundProspects([]);
        fetchSessions();
        fetchProspects();
      }
    } catch (err) {
      console.error("Outreach failed:", err);
    }
    setLoading(false);
  }

  async function runAutoCycle() {
    setCycling(true);
    setEngineLog(["Starting auto-cycle..."]);
    try {
      const res = await fetch("/api/sales/engine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({ mode: "auto_cycle" }),
      });
      const data = await res.json();
      setEngineLog(data.log || ["Cycle complete"]);
      fetchSessions();
      fetchProspects();
    } catch (err) {
      setEngineLog(["Auto-cycle failed: " + String(err)]);
    }
    setCycling(false);
  }

  async function sendPending() {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/engine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({ mode: "send_pending" }),
      });
      const data = await res.json();
      setEngineLog([`Sent ${data.sent}/${data.total} messages`]);
      fetchSessions();
    } catch (err) {
      console.error("Send pending failed:", err);
    }
    setLoading(false);
  }

  async function toggleSessionPause(sessionId: string, isPaused: boolean) {
    await fetch("/api/sales/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sessionId, isPaused: !isPaused }),
    });
    fetchSessions();
    if (activeSessionId === sessionId) fetchSessionDetail(sessionId);
  }

  // Message interactions
  async function generateAIReply() {
    if (!activeSessionId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/sales/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId, action: "generate" }),
      });
      const data = await res.json();
      if (data.message) {
        fetchSessionDetail(activeSessionId);
      }
    } catch (err) {
      console.error("Generate reply failed:", err);
    }
    setGenerating(false);
  }

  async function sendManualMessage() {
    if (!activeSessionId || !composeText.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/sales/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          content: composeText.trim(),
          status: "pending",
        }),
      });
      setComposeText("");
      fetchSessionDetail(activeSessionId);
    } catch (err) {
      console.error("Send message failed:", err);
    }
    setLoading(false);
  }

  async function sendMessageNow(messageId: string) {
    if (!activeSessionId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sales/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          action: "send",
          messageId,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setEngineLog([`Send failed: ${data.error}`]);
      }
      fetchSessionDetail(activeSessionId);
    } catch (err) {
      console.error("Send now failed:", err);
    }
    setLoading(false);
  }

  async function updateDraftMessage(messageId: string, content: string) {
    try {
      await fetch("/api/sales/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: messageId, content }),
      });
      setEditingMessageId(null);
      setEditingContent("");
      if (activeSessionId) fetchSessionDetail(activeSessionId);
    } catch (err) {
      console.error("Update message failed:", err);
    }
  }

  async function deleteMessage(messageId: string) {
    try {
      await fetch(`/api/sales/messages?id=${messageId}`, { method: "DELETE" });
      if (activeSessionId) fetchSessionDetail(activeSessionId);
    } catch (err) {
      console.error("Delete message failed:", err);
    }
  }

  // Knowledge CRUD
  async function saveKnowledge() {
    if (!kForm.title || !kForm.content) return;
    setLoading(true);

    if (editingKnowledge) {
      await fetch("/api/sales/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingKnowledge, ...kForm }),
      });
      setEditingKnowledge(null);
    } else {
      await fetch("/api/sales/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kForm),
      });
    }

    setKForm({ title: "", content: "", category: "product", priority: 0 });
    fetchKnowledge();
    setLoading(false);
  }

  async function deleteKnowledge(id: string) {
    await fetch(`/api/sales/knowledge?id=${id}`, { method: "DELETE" });
    fetchKnowledge();
  }

  // ── Render ────────────────────────────────────────────────────────────

  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: sessions.filter((sess) => sess.stage === s.key).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Sales AI Pipeline
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Autonomous AI-powered sales conversations
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={sendPending}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            <Send className="w-4 h-4" />
            Send Pending
          </button>
          <button
            onClick={runAutoCycle}
            disabled={cycling}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${cycling ? "animate-spin" : ""}`} />
            {cycling ? "Running..." : "Auto-Cycle"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: "pipeline" as Tab, label: "Pipeline", icon: Target },
          { key: "prospects" as Tab, label: "Find Prospects", icon: Search },
          { key: "knowledge" as Tab, label: "Knowledge Base", icon: BookOpen },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setActiveSessionId(null);
              setActiveSession(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Engine Log */}
      {engineLog.length > 0 && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono">
          {engineLog.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* ── Pipeline Tab ─────────────────────────────────────────────────── */}
      {tab === "pipeline" && (
        <div className="space-y-6">
          {/* Stage overview cards */}
          <div className="grid grid-cols-7 gap-2">
            {stageCounts.map((s) => (
              <div
                key={s.key}
                className="bg-white rounded-lg p-3 border border-gray-200 text-center"
              >
                <div className={`w-3 h-3 rounded-full ${s.color} mx-auto mb-1`} />
                <div className="text-lg font-bold">{s.count}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Active sessions list */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Active Sessions</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {sessions.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  No sessions yet. Find prospects and start outreach!
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setActiveSessionId(session.id)}
                  >
                    <div className="flex-shrink-0">
                      <User className="w-8 h-8 text-gray-400 bg-gray-100 rounded-full p-1.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {session.prospect.platform === "instagram" ? (
                          <Instagram className="w-3.5 h-3.5 text-pink-500" />
                        ) : (
                          <Twitter className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        <span className="font-medium text-gray-900">
                          @{session.prospect.username}
                        </span>
                        {session.prospect.displayName && (
                          <span className="text-gray-400 text-sm">
                            ({session.prospect.displayName})
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {session.messages[0]?.content || "No messages yet"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium text-white ${
                          STAGES.find((s) => s.key === session.stage)?.color || "bg-gray-500"
                        }`}
                      >
                        {STAGES.find((s) => s.key === session.stage)?.label || session.stage}
                      </span>
                      {session.sentiment && (
                        <span
                          className={`text-xs ${
                            session.sentiment === "positive"
                              ? "text-green-600"
                              : session.sentiment === "negative"
                              ? "text-red-600"
                              : "text-gray-400"
                          }`}
                        >
                          {session.sentiment}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSessionPause(session.id, session.isPaused);
                        }}
                        className={`p-1.5 rounded ${
                          session.isPaused
                            ? "text-green-600 hover:bg-green-50"
                            : "text-yellow-600 hover:bg-yellow-50"
                        }`}
                        title={session.isPaused ? "Resume" : "Pause"}
                      >
                        {session.isPaused ? (
                          <Play className="w-4 h-4" />
                        ) : (
                          <Pause className="w-4 h-4" />
                        )}
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Session Detail Tab ───────────────────────────────────────────── */}
      {tab === "session" && activeSession && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setTab("pipeline");
              setActiveSessionId(null);
              setActiveSession(null);
            }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to pipeline
          </button>

          {/* Session header */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {activeSession.prospect.platform === "instagram" ? (
                    <Instagram className="w-5 h-5 text-pink-500" />
                  ) : (
                    <Twitter className="w-5 h-5 text-blue-400" />
                  )}
                  @{activeSession.prospect.username}
                  {activeSession.prospect.displayName && (
                    <span className="text-gray-400 font-normal">
                      — {activeSession.prospect.displayName}
                    </span>
                  )}
                </h2>
                {activeSession.summary && (
                  <p className="text-sm text-gray-500 mt-1">{activeSession.summary}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium text-white ${
                    STAGES.find((s) => s.key === activeSession.stage)?.color ||
                    "bg-gray-500"
                  }`}
                >
                  {STAGES.find((s) => s.key === activeSession.stage)?.label ||
                    activeSession.stage}
                </span>
                {activeSession.nextAction && (
                  <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    Next: {activeSession.nextAction}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">Conversation</h3>
              <button
                onClick={generateAIReply}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-xs font-medium"
              >
                <Brain className="w-3.5 h-3.5" />
                {generating ? "Generating..." : "AI Reply"}
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {activeSession.messages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No messages yet</div>
              ) : (
                activeSession.messages.map((msg: SalesMessage) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "outbound" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className={`max-w-[70%] ${msg.role === "outbound" ? "text-right" : ""}`}>
                      {/* Editing mode */}
                      {editingMessageId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            rows={3}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => { setEditingMessageId(null); setEditingContent(""); }}
                              className="px-3 py-1 text-xs bg-gray-200 rounded-lg"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => updateDraftMessage(msg.id, editingContent)}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm inline-block text-left ${
                            msg.role === "outbound"
                              ? msg.status === "draft"
                                ? "bg-blue-100 text-blue-900 border border-blue-300 border-dashed rounded-br-md"
                                : msg.status === "failed"
                                ? "bg-red-100 text-red-900 border border-red-300 rounded-br-md"
                                : "bg-blue-600 text-white rounded-br-md"
                              : msg.role === "inbound"
                              ? "bg-gray-100 text-gray-900 rounded-bl-md"
                              : "bg-yellow-50 text-yellow-800 rounded-md text-xs italic"
                          }`}
                        >
                          <div>{msg.content}</div>
                          <div
                            className={`text-xs mt-1 flex items-center gap-2 ${
                              msg.role === "outbound" && msg.status !== "draft" && msg.status !== "failed"
                                ? "text-blue-200"
                                : "text-gray-400"
                            }`}
                          >
                            <span>
                              {new Date(msg.createdAt).toLocaleString()}
                              {msg.status === "pending" && " — pending"}
                              {msg.status === "draft" && " — draft"}
                              {msg.status === "failed" && ` — failed${msg.error ? `: ${msg.error}` : ""}`}
                              {msg.status === "sent" && " — sent"}
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Action buttons for draft/pending messages */}
                      {msg.role === "outbound" && (msg.status === "draft" || msg.status === "pending") && editingMessageId !== msg.id && (
                        <div className="flex gap-1 justify-end mt-1">
                          <button
                            onClick={() => { setEditingMessageId(msg.id); setEditingContent(msg.content); }}
                            className="px-2 py-0.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => sendMessageNow(msg.id)}
                            disabled={loading}
                            className="px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium"
                          >
                            Send Now
                          </button>
                          {msg.status === "draft" && (
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              className="px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 rounded"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Compose bar */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  placeholder="Type a manual message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendManualMessage()}
                />
                <button
                  onClick={sendManualMessage}
                  disabled={loading || !composeText.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  Queue
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Messages are queued as pending. Click &quot;Send Now&quot; on a message or use &quot;Send Pending&quot; to dispatch all.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Find Prospects Tab ───────────────────────────────────────────── */}
      {tab === "prospects" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Search className="w-5 h-5" /> Find Prospects
            </h2>
            {/* Platform toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => { setSearchPlatform("twitter"); setFoundProspects([]); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  searchPlatform === "twitter"
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                <Twitter className="w-4 h-4" /> Twitter
              </button>
              <button
                onClick={() => { setSearchPlatform("instagram"); setFoundProspects([]); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  searchPlatform === "instagram"
                    ? "bg-pink-100 text-pink-700 border border-pink-300"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                <Instagram className="w-4 h-4" /> Instagram
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  searchPlatform === "instagram"
                    ? "Search Instagram users (e.g. 'startup founder', 'saas')"
                    : "Search tweets (e.g. 'looking for AI tools', 'need automation')"
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                onKeyDown={(e) => e.key === "Enter" && findProspects()}
              />
              <button
                onClick={findProspects}
                disabled={searching}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2"
              >
                {searching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </button>
            </div>
          </div>

          {/* Results */}
          {foundProspects.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">
                  Found {foundProspects.length} prospects
                </h3>
                <button
                  onClick={startOutreach}
                  disabled={loading || foundProspects.filter((p) => p.selected).length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Start Outreach ({foundProspects.filter((p) => p.selected).length})
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {foundProspects.map((p, i) => (
                  <div key={i} className="p-4 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={p.selected}
                      onChange={() => {
                        const updated = [...foundProspects];
                        updated[i].selected = !updated[i].selected;
                        setFoundProspects(updated);
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {searchPlatform === "instagram" ? (
                          <Instagram className="w-3.5 h-3.5 text-pink-500" />
                        ) : (
                          <Twitter className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        <span className="font-medium">@{p.username}</span>
                        {p.displayName && (
                          <span className="text-gray-400 text-sm">{p.displayName}</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {p.followers.toLocaleString()} followers
                        </span>
                        {p.isPrivate && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                            Private
                          </span>
                        )}
                        {p.alreadyExists && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                            Already in pipeline
                          </span>
                        )}
                      </div>
                      {p.bio && (
                        <div className="text-sm text-gray-500 mt-0.5">{p.bio}</div>
                      )}
                      {p.tweetText && (
                        <div className="text-sm text-gray-400 mt-1 italic">
                          &ldquo;{p.tweetText.slice(0, 150)}
                          {p.tweetText.length > 150 ? "..." : ""}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing prospects */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-700">
                All Prospects ({prospects.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {prospects.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  No prospects yet. Use the search above to find them!
                </div>
              ) : (
                prospects.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      if (p.sessions[0]?.id) {
                        setActiveSessionId(p.sessions[0].id);
                      }
                    }}
                  >
                    <User className="w-8 h-8 text-gray-400 bg-gray-100 rounded-full p-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {p.platform === "instagram" ? (
                          <Instagram className="w-3.5 h-3.5 text-pink-500" />
                        ) : (
                          <Twitter className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        <span className="font-medium">@{p.username}</span>
                        {p.displayName && (
                          <span className="text-gray-400 text-sm">{p.displayName}</span>
                        )}
                      </div>
                      {p.bio && (
                        <div className="text-sm text-gray-500 truncate">{p.bio}</div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        p.status === "converted"
                          ? "bg-green-100 text-green-700"
                          : p.status === "lost"
                          ? "bg-red-100 text-red-700"
                          : p.status === "in_conversation"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Knowledge Base Tab ────────────────────────────────────────────── */}
      {tab === "knowledge" && (
        <div className="space-y-4">
          {/* Add/Edit form */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              {editingKnowledge ? "Edit Entry" : "Add Knowledge"}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={kForm.title}
                onChange={(e) => setKForm({ ...kForm, title: e.target.value })}
                placeholder="Title (e.g. 'Pricing Plans')"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="flex gap-2">
                <select
                  value={kForm.category}
                  onChange={(e) =>
                    setKForm({ ...kForm, category: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={kForm.priority}
                  onChange={(e) =>
                    setKForm({ ...kForm, priority: parseInt(e.target.value) || 0 })
                  }
                  placeholder="Priority"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <textarea
              value={kForm.content}
              onChange={(e) => setKForm({ ...kForm, content: e.target.value })}
              placeholder="Knowledge content — this is what the AI will reference when talking to prospects..."
              rows={4}
              className="w-full mt-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={saveKnowledge}
                disabled={loading || !kForm.title || !kForm.content}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {editingKnowledge ? "Update" : "Add"}
              </button>
              {editingKnowledge && (
                <button
                  onClick={() => {
                    setEditingKnowledge(null);
                    setKForm({ title: "", content: "", category: "product", priority: 0 });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Knowledge entries list */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-700">
                Knowledge Entries ({knowledge.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {knowledge.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Brain className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No knowledge entries yet.</p>
                  <p className="text-sm mt-1">
                    Add product info, pricing, FAQs, and objection handlers above.
                  </p>
                </div>
              ) : (
                knowledge.map((entry) => (
                  <div key={entry.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {entry.title}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {entry.category}
                          </span>
                          {entry.priority > 0 && (
                            <span className="text-xs text-yellow-600">
                              P{entry.priority}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">
                          {entry.content}
                        </p>
                      </div>
                      <div className="flex gap-1 ml-3">
                        <button
                          onClick={() => {
                            setEditingKnowledge(entry.id);
                            setKForm({
                              title: entry.title,
                              content: entry.content,
                              category: entry.category,
                              priority: entry.priority,
                            });
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteKnowledge(entry.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
