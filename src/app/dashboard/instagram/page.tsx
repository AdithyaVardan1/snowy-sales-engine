"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Camera,
  Users,
  MessageCircle,
  Settings,
  Plus,
  Trash2,
  Edit,
  Play,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Eye,
  Send,
  Star,
  X,
  Power,
  Zap,
  Link,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import SetupBanner from "@/components/SetupBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Follower {
  id: string;
  igUserId: string;
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  isPrivate: boolean;
  isNew: boolean;
  dmSent: boolean;
  dmSentAt?: string;
  firstSeenAt: string;
}

interface DM {
  id: string;
  igUserId: string;
  username: string;
  templateId?: string;
  content: string;
  status: string;
  threadId?: string;
  error?: string;
  sentAt: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

interface IGSettings {
  id: string;
  autoDmEnabled: boolean;
  maxDmsPerDay: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  pollIntervalMin: number;
  igUserId?: string;
  officialApi?: {
    connected: boolean;
    pageId?: string;
    igUserId?: string;
    appId?: string;
    tokenExpiresAt?: string;
    webhookVerifyToken?: string;
    tokenStatus?: string;
  };
}

interface CommentTrigger {
  id: string;
  keyword: string;
  matchType: string;
  postFilter?: string;
  messageType: string;
  messagePayload: string;
  replyToComment: boolean;
  commentReplyText?: string;
  isActive: boolean;
  dmsSent: number;
  createdAt: string;
  _count?: { logs: number };
}

interface CommentLog {
  id: string;
  triggerId?: string;
  igCommentId: string;
  igUserId: string;
  username: string;
  commentText: string;
  postId?: string;
  matched: boolean;
  dmSent: boolean;
  dmStatus?: string;
  dmError?: string;
  createdAt: string;
}

type Tab = "followers" | "templates" | "history" | "triggers" | "settings";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InstagramPage() {
  const [tab, setTab] = useState<Tab>("followers");
  const [loading, setLoading] = useState(true);

  // Account state
  const [connected, setConnected] = useState(false);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Followers state
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [followerTotal, setFollowerTotal] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [dmSentToday, setDmSentToday] = useState(0);
  const [followerFilter, setFollowerFilter] = useState("all");
  const [polling, setPolling] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [templateIsDefault, setTemplateIsDefault] = useState(false);

  // DM History state
  const [dms, setDms] = useState<DM[]>([]);
  const [dmFilter, setDmFilter] = useState("");
  const [dmTotal, setDmTotal] = useState(0);

  // Settings state
  const [settings, setSettings] = useState<IGSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Manual DM modal
  const [showDmModal, setShowDmModal] = useState(false);
  const [dmTarget, setDmTarget] = useState<Follower | null>(null);
  const [dmContent, setDmContent] = useState("");
  const [sendingDm, setSendingDm] = useState(false);

  // Running auto-DM
  const [runningAutoDm, setRunningAutoDm] = useState(false);
  const [autoDmResult, setAutoDmResult] = useState("");

  // Triggers state
  const [triggers, setTriggers] = useState<CommentTrigger[]>([]);
  const [triggerCommentsToday, setTriggerCommentsToday] = useState(0);
  const [triggerDmsSentToday, setTriggerDmsSentToday] = useState(0);
  const [showTriggerForm, setShowTriggerForm] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<CommentTrigger | null>(null);
  const [triggerKeyword, setTriggerKeyword] = useState("");
  const [triggerMatchType, setTriggerMatchType] = useState("contains");
  const [triggerPostFilter, setTriggerPostFilter] = useState("");
  const [triggerMessageType, setTriggerMessageType] = useState("text");
  const [triggerMessageText, setTriggerMessageText] = useState("");
  const [triggerButtons, setTriggerButtons] = useState<{ title: string; url: string }[]>([]);
  const [triggerQuickReplies, setTriggerQuickReplies] = useState<{ title: string; payload: string }[]>([]);
  const [triggerLogs, setTriggerLogs] = useState<CommentLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Official API state
  const [apiAppId, setApiAppId] = useState("");
  const [apiAppSecret, setApiAppSecret] = useState("");
  const [apiAccessToken, setApiAccessToken] = useState("");
  const [apiPageId, setApiPageId] = useState("");
  const [apiIgUserId, setApiIgUserId] = useState("");
  const [savingApi, setSavingApi] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/account");
      const data = await res.json();
      setConnected(data.connected || false);
      setAccountUsername(data.username || "");
      setAccountStatus(data.status || "");
    } catch {
      setConnected(false);
    }
  }, []);

  const loadFollowers = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/instagram/followers?filter=${followerFilter}&limit=100`
      );
      const data = await res.json();
      setFollowers(data.followers || []);
      setFollowerTotal(data.total || 0);
      setNewCount(data.newCount || 0);
      setDmSentToday(data.dmSentToday || 0);
    } catch {}
  }, [followerFilter]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {}
  }, []);

  const loadDms = useCallback(async () => {
    try {
      const url = dmFilter
        ? `/api/instagram/dms?status=${dmFilter}&limit=100`
        : "/api/instagram/dms?limit=100";
      const res = await fetch(url);
      const data = await res.json();
      setDms(data.dms || []);
      setDmTotal(data.total || 0);
    } catch {}
  }, [dmFilter]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/settings");
      const data = await res.json();
      setSettings(data);
    } catch {}
  }, []);

  const loadTriggers = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/triggers");
      const data = await res.json();
      setTriggers(data.triggers || []);
      setTriggerCommentsToday(data.commentsToday || 0);
      setTriggerDmsSentToday(data.dmsSentToday || 0);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      loadAccount(),
      loadFollowers(),
      loadTemplates(),
      loadDms(),
      loadSettings(),
      loadTriggers(),
    ]).finally(() => setLoading(false));
  }, [loadAccount, loadFollowers, loadTemplates, loadDms, loadSettings, loadTriggers]);

  // Reload specific tab data when tab changes
  useEffect(() => {
    if (tab === "followers") loadFollowers();
    if (tab === "templates") loadTemplates();
    if (tab === "history") loadDms();
    if (tab === "triggers") loadTriggers();
    if (tab === "settings") loadSettings();
  }, [tab, loadFollowers, loadTemplates, loadDms, loadTriggers, loadSettings]);

  // ── Actions ───────────────────────────────────────────────────────────

  async function handleLogin() {
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/instagram/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Login failed");
        return;
      }
      setConnected(true);
      setAccountUsername(data.username);
      setAccountStatus("active");
      setLoginUsername("");
      setLoginPassword("");
    } catch (e: any) {
      setLoginError(e.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleDisconnect() {
    await fetch("/api/instagram/account", { method: "DELETE" });
    setConnected(false);
    setAccountUsername("");
    setAccountStatus("");
  }

  async function handlePollFollowers() {
    setPolling(true);
    try {
      const res = await fetch("/api/instagram/followers", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(
          `Poll complete: ${data.newFollowers} new followers found (${data.totalFollowers} total)`
        );
      }
      await loadFollowers();
    } catch (e: any) {
      alert(e.message || "Poll failed");
    } finally {
      setPolling(false);
    }
  }

  async function handleMarkAllSeen() {
    try {
      const newFollowers = followers.filter((f) => f.isNew);
      for (const f of newFollowers) {
        await fetch(`/api/instagram/followers/${f.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isNew: false }),
        });
      }
      await loadFollowers();
    } catch {}
  }

  async function handleSaveTemplate() {
    const body = {
      name: templateName,
      content: templateContent,
      isDefault: templateIsDefault,
    };

    if (editingTemplate) {
      await fetch(`/api/instagram/templates/${editingTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/instagram/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    setShowTemplateForm(false);
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateContent("");
    setTemplateIsDefault(false);
    await loadTemplates();
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/instagram/templates/${id}`, { method: "DELETE" });
    await loadTemplates();
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/instagram/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await loadTemplates();
  }

  async function handleSendManualDm() {
    if (!dmTarget || !dmContent) return;
    setSendingDm(true);
    try {
      const res = await fetch("/api/instagram/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          igUserId: dmTarget.igUserId,
          username: dmTarget.username,
          content: dmContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to send DM");
      } else {
        alert(`DM sent to @${dmTarget.username}`);
        setShowDmModal(false);
        setDmTarget(null);
        setDmContent("");
        await loadFollowers();
        await loadDms();
      }
    } catch (e: any) {
      alert(e.message || "Failed to send DM");
    } finally {
      setSendingDm(false);
    }
  }

  async function handleSaveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await fetch("/api/instagram/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoDmEnabled: settings.autoDmEnabled,
          maxDmsPerDay: settings.maxDmsPerDay,
          minDelaySeconds: settings.minDelaySeconds,
          maxDelaySeconds: settings.maxDelaySeconds,
          pollIntervalMin: settings.pollIntervalMin,
        }),
      });
    } catch {}
    setSavingSettings(false);
  }

  async function handleRunAutoDm() {
    setRunningAutoDm(true);
    setAutoDmResult("");
    try {
      const res = await fetch("/api/instagram/auto-dm", { method: "POST" });
      const data = await res.json();
      if (data.skipped) {
        setAutoDmResult(`Skipped: ${data.reason}`);
      } else if (data.error) {
        setAutoDmResult(`Error: ${data.error}`);
      } else {
        setAutoDmResult(
          `Sent ${data.dmsSent} DMs. ${data.errors?.length || 0} errors. Remaining quota: ${data.remainingQuota}`
        );
      }
      await loadFollowers();
      await loadDms();
    } catch (e: any) {
      setAutoDmResult(`Error: ${e.message}`);
    } finally {
      setRunningAutoDm(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "followers", label: "Followers", icon: Users },
    { key: "templates", label: "Templates", icon: Edit },
    { key: "history", label: "DM History", icon: MessageCircle },
    { key: "triggers", label: "Triggers", icon: Zap },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <SetupBanner
        platform="Instagram"
        requiredKeys={[
          { key: "INSTAGRAM_SESSION_ID", label: "Instagram session ID" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera className="w-7 h-7 text-pink-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Instagram Automation</h1>
            <p className="text-sm text-gray-500">
              Track new followers, send auto-DMs, manage templates, and set up comment-trigger automations.
            </p>
          </div>
        </div>
        {connected && (
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                accountStatus === "active" ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-gray-600">@{accountUsername}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.key === "followers" && newCount > 0 && (
                <span className="bg-pink-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {newCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {tab === "followers" && renderFollowers()}
      {tab === "templates" && renderTemplates()}
      {tab === "history" && renderHistory()}
      {tab === "triggers" && renderTriggers()}
      {tab === "settings" && renderSettings()}

      {/* Manual DM Modal */}
      {showDmModal && dmTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Send DM to @{dmTarget.username}
              </h3>
              <button
                onClick={() => setShowDmModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={dmContent}
              onChange={(e) => setDmContent(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Type your message... Use {{username}} for their name"
            />
            <p className="text-xs text-gray-400">
              Tip: Use {"{{username}}"} to insert their username
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDmModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSendManualDm}
                disabled={sendingDm || !dmContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingDm ? "Sending..." : "Send DM"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Tab Renderers ─────────────────────────────────────────────────────

  function renderFollowers() {
    return (
      <div className="space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Followers", value: followerTotal, color: "blue" },
            { label: "New", value: newCount, color: "pink" },
            { label: "DMs Sent Today", value: dmSentToday, color: "emerald" },
            {
              label: "Pending DMs",
              value: followers.filter((f) => f.isNew && !f.dmSent).length,
              color: "amber",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className={`text-2xl font-bold text-${stat.color}-600`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <select
            value={followerFilter}
            onChange={(e) => setFollowerFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Followers</option>
            <option value="new">New Only</option>
            <option value="dm_sent">DM Sent</option>
          </select>
          <button
            onClick={handlePollFollowers}
            disabled={polling || !connected}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${polling ? "animate-spin" : ""}`} />
            {polling ? "Polling..." : "Poll Now"}
          </button>
          {newCount > 0 && (
            <button
              onClick={handleMarkAllSeen}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
            >
              <Eye className="w-4 h-4" />
              Mark All Seen
            </button>
          )}
        </div>

        {/* Follower list */}
        {!connected ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            Connect your Instagram account in Settings to start tracking
            followers.
          </div>
        ) : followers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            No followers found. Click &ldquo;Poll Now&rdquo; to fetch your
            followers.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">
                    User
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">
                    First Seen
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {followers.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {f.profilePicUrl ? (
                          <img
                            src={f.profilePicUrl}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                            {f.username[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            @{f.username}
                          </p>
                          {f.fullName && (
                            <p className="text-xs text-gray-500">
                              {f.fullName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {f.isNew && (
                          <span className="bg-pink-100 text-pink-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            NEW
                          </span>
                        )}
                        {f.dmSent && (
                          <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            DM SENT
                          </span>
                        )}
                        {f.isPrivate && (
                          <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
                            Private
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(f.firstSeenAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!f.dmSent && (
                        <button
                          onClick={() => {
                            setDmTarget(f);
                            setDmContent("");
                            setShowDmModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          <Send className="w-4 h-4 inline mr-1" />
                          Send DM
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderTemplates() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Message templates for auto-DM. Use {"{{username}}"} as a
            placeholder.
          </p>
          <button
            onClick={() => {
              setEditingTemplate(null);
              setTemplateName("");
              setTemplateContent("");
              setTemplateIsDefault(false);
              setShowTemplateForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Template
          </button>
        </div>

        {/* Template form */}
        {showTemplateForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingTemplate ? "Edit Template" : "New Template"}
            </h3>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name (e.g. Welcome Message)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <textarea
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              rows={4}
              placeholder="Hey {{username}}! Thanks for following us..."
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={templateIsDefault}
                  onChange={(e) => setTemplateIsDefault(e.target.checked)}
                  className="rounded"
                />
                Set as default (used by auto-DM)
              </label>
            </div>
            {templateContent && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Preview:</p>
                <p className="text-sm text-gray-700">
                  {templateContent.replace(/\{\{username\}\}/g, "johndoe")}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTemplateForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || !templateContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editingTemplate ? "Update" : "Create"}
              </button>
            </div>
          </div>
        )}

        {/* Template list */}
        {templates.length === 0 && !showTemplateForm ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            No templates yet. Create one to start sending auto-DMs.
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`bg-white rounded-xl border p-4 ${
                  t.isDefault
                    ? "border-blue-300 bg-blue-50/50"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {t.name}
                      </h4>
                      {t.isDefault && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <Star className="w-3 h-3" /> Default
                        </span>
                      )}
                      {!t.isActive && (
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {t.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!t.isDefault && (
                      <button
                        onClick={() => handleSetDefault(t.id)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Set as default"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingTemplate(t);
                        setTemplateName(t.name);
                        setTemplateContent(t.content);
                        setTemplateIsDefault(t.isDefault);
                        setShowTemplateForm(true);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderHistory() {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <select
            value={dmFilter}
            onChange={(e) => setDmFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All DMs</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
          <span className="text-sm text-gray-500">{dmTotal} total</span>
        </div>

        {dms.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            No DMs sent yet.
          </div>
        ) : (
          <div className="space-y-2">
            {dms.map((dm) => (
              <div
                key={dm.id}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        @{dm.username}
                      </span>
                      {dm.status === "sent" ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          dm.status === "sent"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {dm.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {dm.content}
                    </p>
                    {dm.error && (
                      <p className="text-xs text-red-500 mt-1">{dm.error}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                    {new Date(dm.sentAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Trigger Actions ────────────────────────────────────────────────

  function buildMessagePayload(): string {
    if (triggerMessageType === "text") {
      return JSON.stringify({ text: triggerMessageText });
    }
    if (triggerMessageType === "quick_reply") {
      return JSON.stringify({
        text: triggerMessageText,
        quick_replies: triggerQuickReplies.map((qr) => ({
          type: "text",
          title: qr.title,
          payload: qr.payload,
        })),
      });
    }
    if (triggerMessageType === "generic_template") {
      return JSON.stringify({
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [
              {
                title: triggerMessageText,
                buttons: triggerButtons.map((b) => ({
                  type: "web_url",
                  title: b.title,
                  url: b.url,
                })),
              },
            ],
          },
        },
      });
    }
    return JSON.stringify({ text: triggerMessageText });
  }

  function resetTriggerForm() {
    setShowTriggerForm(false);
    setEditingTrigger(null);
    setTriggerKeyword("");
    setTriggerMatchType("contains");
    setTriggerPostFilter("");
    setTriggerMessageType("text");
    setTriggerMessageText("");
    setTriggerButtons([]);
    setTriggerQuickReplies([]);
  }

  async function handleSaveTrigger() {
    const payload = buildMessagePayload();
    const body = {
      keyword: triggerKeyword,
      matchType: triggerMatchType,
      postFilter: triggerPostFilter || null,
      messageType: triggerMessageType,
      messagePayload: payload,
    };

    if (editingTrigger) {
      await fetch(`/api/instagram/triggers/${editingTrigger.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/instagram/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    resetTriggerForm();
    await loadTriggers();
  }

  async function handleDeleteTrigger(id: string) {
    if (!confirm("Delete this trigger?")) return;
    await fetch(`/api/instagram/triggers/${id}`, { method: "DELETE" });
    await loadTriggers();
  }

  async function handleToggleTrigger(id: string, isActive: boolean) {
    await fetch(`/api/instagram/triggers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await loadTriggers();
  }

  async function handleViewTriggerLogs(triggerId: string) {
    try {
      const res = await fetch(`/api/instagram/triggers/${triggerId}`);
      const data = await res.json();
      setTriggerLogs(data.logs || []);
      setShowLogs(true);
    } catch {}
  }

  function editTriggerFromList(t: CommentTrigger) {
    setEditingTrigger(t);
    setTriggerKeyword(t.keyword);
    setTriggerMatchType(t.matchType);
    setTriggerPostFilter(t.postFilter || "");
    setTriggerMessageType(t.messageType);

    try {
      const parsed = JSON.parse(t.messagePayload);
      if (parsed.text) setTriggerMessageText(parsed.text);
      if (parsed.quick_replies) {
        setTriggerQuickReplies(
          parsed.quick_replies.map((qr: any) => ({
            title: qr.title,
            payload: qr.payload,
          }))
        );
      }
      if (parsed.attachment?.payload?.elements?.[0]) {
        const el = parsed.attachment.payload.elements[0];
        setTriggerMessageText(el.title || "");
        setTriggerButtons(
          (el.buttons || []).map((b: any) => ({
            title: b.title,
            url: b.url || "",
          }))
        );
      }
    } catch {
      setTriggerMessageText("");
    }

    setShowTriggerForm(true);
  }

  async function handleConnectOfficialApi() {
    // OAuth flow: just need App ID and App Secret
    if (!apiAppId || !apiAppSecret) {
      alert("App ID and App Secret are required");
      return;
    }
    setSavingApi(true);
    try {
      // If user provided a manual token, save directly
      if (apiAccessToken) {
        await fetch("/api/instagram/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appId: apiAppId,
            appSecret: apiAppSecret,
            accessToken: apiAccessToken,
            pageId: apiPageId || "manual",
            igUserId: apiIgUserId,
          }),
        });
        setApiAppId("");
        setApiAppSecret("");
        setApiAccessToken("");
        setApiPageId("");
        setApiIgUserId("");
        await loadSettings();
      } else {
        // Start OAuth flow — redirect to Instagram
        const res = await fetch(
          `/api/instagram/oauth?appId=${encodeURIComponent(apiAppId)}&appSecret=${encodeURIComponent(apiAppSecret)}`
        );
        const data = await res.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          alert(data.error || "Failed to generate auth URL");
        }
      }
    } catch (e: any) {
      alert(e.message || "Failed to connect");
    } finally {
      setSavingApi(false);
    }
  }

  async function handleDisconnectOfficialApi() {
    await fetch("/api/instagram/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disconnectOfficialApi: true }),
    });
    await loadSettings();
  }

  // ── Render Triggers ─────────────────────────────────────────────────

  function renderTriggers() {
    const activeTriggers = triggers.filter((t) => t.isActive).length;
    const totalDmsSent = triggers.reduce((s, t) => s + t.dmsSent, 0);

    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Active Triggers", value: activeTriggers, color: "blue" },
            { label: "DMs Sent (Total)", value: totalDmsSent, color: "emerald" },
            { label: "Comments Today", value: triggerCommentsToday, color: "purple" },
            { label: "DMs Today", value: triggerDmsSentToday, color: "pink" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className={`text-2xl font-bold text-${stat.color}-600`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* API Status Banner */}
        {!settings?.officialApi?.connected && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <Zap className="w-4 h-4 inline mr-2" />
            Official Instagram API not connected. Go to <button onClick={() => setTab("settings")} className="underline font-medium">Settings</button> to set up the API for interactive DMs with buttons.
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Auto-DM when someone comments a keyword on your posts.
          </p>
          <button
            onClick={() => {
              resetTriggerForm();
              setShowTriggerForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Trigger
          </button>
        </div>

        {/* Trigger Form */}
        {showTriggerForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingTrigger ? "Edit Trigger" : "New Trigger"}
            </h3>

            {/* Keyword + Match Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Keyword
                </label>
                <input
                  type="text"
                  value={triggerKeyword}
                  onChange={(e) => setTriggerKeyword(e.target.value)}
                  placeholder="e.g. GUIDE, LINK, YES"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Match Type
                </label>
                <select
                  value={triggerMatchType}
                  onChange={(e) => setTriggerMatchType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="contains">Contains</option>
                  <option value="exact">Exact Match</option>
                  <option value="starts_with">Starts With</option>
                </select>
              </div>
            </div>

            {/* Post Filter */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Post Filter (optional — leave empty for all posts)
              </label>
              <input
                type="text"
                value={triggerPostFilter}
                onChange={(e) => setTriggerPostFilter(e.target.value)}
                placeholder="Instagram Media ID (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Message Type */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Message Type
              </label>
              <div className="flex gap-3">
                {[
                  { value: "text", label: "Text Only" },
                  { value: "quick_reply", label: "Quick Replies" },
                  { value: "generic_template", label: "Template + Buttons" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTriggerMessageType(opt.value)}
                    className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                      triggerMessageType === opt.value
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Text */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                {triggerMessageType === "generic_template" ? "Card Title" : "Message Text"}
              </label>
              <textarea
                value={triggerMessageText}
                onChange={(e) => setTriggerMessageText(e.target.value)}
                rows={3}
                placeholder={
                  triggerMessageType === "generic_template"
                    ? "Check out our latest guide!"
                    : "Hey {{username}}! Here's what you asked for..."
                }
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Use {"{{username}}"} to insert the commenter&apos;s username
              </p>
            </div>

            {/* Quick Replies Builder */}
            {triggerMessageType === "quick_reply" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500">Quick Reply Buttons (max 13)</label>
                  <button
                    onClick={() =>
                      setTriggerQuickReplies([...triggerQuickReplies, { title: "", payload: "" }])
                    }
                    disabled={triggerQuickReplies.length >= 13}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    + Add Button
                  </button>
                </div>
                {triggerQuickReplies.map((qr, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={qr.title}
                      onChange={(e) => {
                        const copy = [...triggerQuickReplies];
                        copy[i] = { ...copy[i], title: e.target.value };
                        setTriggerQuickReplies(copy);
                      }}
                      placeholder="Button label (e.g. Yes please!)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={qr.payload}
                      onChange={(e) => {
                        const copy = [...triggerQuickReplies];
                        copy[i] = { ...copy[i], payload: e.target.value };
                        setTriggerQuickReplies(copy);
                      }}
                      placeholder="Payload ID"
                      className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() =>
                        setTriggerQuickReplies(triggerQuickReplies.filter((_, j) => j !== i))
                      }
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Template Buttons Builder */}
            {triggerMessageType === "generic_template" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500">CTA Buttons (max 3)</label>
                  <button
                    onClick={() =>
                      setTriggerButtons([...triggerButtons, { title: "", url: "" }])
                    }
                    disabled={triggerButtons.length >= 3}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    + Add Button
                  </button>
                </div>
                {triggerButtons.map((btn, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={btn.title}
                      onChange={(e) => {
                        const copy = [...triggerButtons];
                        copy[i] = { ...copy[i], title: e.target.value };
                        setTriggerButtons(copy);
                      }}
                      placeholder="Button text (e.g. Visit Website)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={btn.url}
                      onChange={(e) => {
                        const copy = [...triggerButtons];
                        copy[i] = { ...copy[i], url: e.target.value };
                        setTriggerButtons(copy);
                      }}
                      placeholder="https://..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() =>
                        setTriggerButtons(triggerButtons.filter((_, j) => j !== i))
                      }
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Preview */}
            {triggerMessageText && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-2">DM Preview:</p>
                <div className="bg-white rounded-lg p-3 border border-gray-200 max-w-sm">
                  <p className="text-sm text-gray-800">
                    {triggerMessageText.replace(/\{\{username\}\}/g, "johndoe")}
                  </p>
                  {triggerMessageType === "quick_reply" &&
                    triggerQuickReplies.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {triggerQuickReplies.map((qr, i) => (
                          <span
                            key={i}
                            className="bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-full font-medium"
                          >
                            {qr.title || "Button"}
                          </span>
                        ))}
                      </div>
                    )}
                  {triggerMessageType === "generic_template" &&
                    triggerButtons.length > 0 && (
                      <div className="flex flex-col gap-2 mt-3 border-t border-gray-100 pt-3">
                        {triggerButtons.map((btn, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-blue-600 text-sm font-medium"
                          >
                            <Link className="w-3.5 h-3.5" />
                            {btn.title || "Button"}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={resetTriggerForm}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTrigger}
                disabled={!triggerKeyword.trim() || !triggerMessageText.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editingTrigger ? "Update Trigger" : "Create Trigger"}
              </button>
            </div>
          </div>
        )}

        {/* Trigger List */}
        {triggers.length === 0 && !showTriggerForm ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            No triggers yet. Create one to start auto-DMing commenters.
          </div>
        ) : (
          <div className="space-y-3">
            {triggers.map((t) => (
              <div
                key={t.id}
                className={`bg-white rounded-xl border p-4 ${
                  t.isActive ? "border-gray-200" : "border-gray-200 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-sm font-mono font-bold">
                      {t.keyword}
                    </div>
                    <span className="text-xs text-gray-500">{t.matchType}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        t.messageType === "text"
                          ? "bg-gray-100 text-gray-600"
                          : t.messageType === "quick_reply"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-emerald-100 text-emerald-600"
                      }`}
                    >
                      {t.messageType === "generic_template" ? "template" : t.messageType}
                    </span>
                    {t.isActive ? (
                      <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {t.dmsSent} DMs sent
                    </span>
                    <button
                      onClick={() => handleViewTriggerLogs(t.id)}
                      className="text-gray-400 hover:text-gray-600"
                      title="View logs"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleTrigger(t.id, t.isActive)}
                      className={`w-9 h-5 rounded-full relative transition-colors ${
                        t.isActive ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          t.isActive ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => editTriggerFromList(t)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTrigger(t.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {t.postFilter && (
                  <p className="text-xs text-gray-400 mt-2">
                    Restricted to post: {t.postFilter}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Logs Modal */}
        {showLogs && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[70vh] overflow-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Comment Logs</h3>
                <button
                  onClick={() => setShowLogs(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {triggerLogs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  No comments received yet for this trigger.
                </p>
              ) : (
                <div className="space-y-2">
                  {triggerLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border border-gray-200 rounded-lg p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            @{log.username}
                          </span>
                          {log.matched && (
                            <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded">
                              Matched
                            </span>
                          )}
                          {log.dmSent && (
                            <span className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded">
                              DM Sent
                            </span>
                          )}
                          {log.dmStatus && !log.dmSent && (
                            <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded">
                              {log.dmStatus}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-600 mt-1">
                        &ldquo;{log.commentText}&rdquo;
                      </p>
                      {log.dmError && (
                        <p className="text-xs text-red-500 mt-1">{log.dmError}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="space-y-6">
        {/* Account Connection */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Camera className="w-4 h-4 text-pink-500" />
            Account Connection
          </h3>

          {connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    accountStatus === "active"
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    @{accountUsername}
                  </p>
                  <p className="text-xs text-gray-500">
                    Status: {accountStatus}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <Power className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Enter your Instagram credentials. Your session will be stored
                securely.
              </p>
              {loginError && (
                <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {loginError}
                </div>
              )}
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Instagram username"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Instagram password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleLogin}
                disabled={
                  loginLoading || !loginUsername.trim() || !loginPassword.trim()
                }
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50"
              >
                {loginLoading ? "Connecting..." : "Connect Instagram"}
              </button>
              <p className="text-xs text-amber-600">
                Warning: Using automation on Instagram carries risk of account
                restrictions. Use at your own risk.
              </p>
            </div>
          )}
        </div>

        {/* Auto-DM Settings */}
        {settings && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500" />
              Auto-DM Settings
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Enable Auto-DM
                </p>
                <p className="text-xs text-gray-500">
                  Automatically send DMs to new followers
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    autoDmEnabled: !settings.autoDmEnabled,
                  })
                }
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.autoDmEnabled ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.autoDmEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Max DMs / Day
                </label>
                <input
                  type="number"
                  value={settings.maxDmsPerDay}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxDmsPerDay: parseInt(e.target.value) || 20,
                    })
                  }
                  min={1}
                  max={100}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Poll Interval (min)
                </label>
                <input
                  type="number"
                  value={settings.pollIntervalMin}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      pollIntervalMin: parseInt(e.target.value) || 60,
                    })
                  }
                  min={15}
                  max={1440}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Min Delay (seconds)
                </label>
                <input
                  type="number"
                  value={settings.minDelaySeconds}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      minDelaySeconds: parseInt(e.target.value) || 30,
                    })
                  }
                  min={10}
                  max={300}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Max Delay (seconds)
                </label>
                <input
                  type="number"
                  value={settings.maxDelaySeconds}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxDelaySeconds: parseInt(e.target.value) || 120,
                    })
                  }
                  min={30}
                  max={600}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>
              <button
                onClick={handleRunAutoDm}
                disabled={runningAutoDm || !connected}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {runningAutoDm ? "Running..." : "Run Auto-DM Now"}
              </button>
            </div>

            {autoDmResult && (
              <div
                className={`text-sm px-3 py-2 rounded-lg ${
                  autoDmResult.startsWith("Error") || autoDmResult.startsWith("Skipped")
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {autoDmResult}
              </div>
            )}
          </div>
        )}

        {/* Official Instagram API */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-500" />
            Official Instagram API (for Comment Triggers)
          </h3>

          {settings?.officialApi?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    settings.officialApi.tokenStatus === "active" ? "bg-emerald-500" : "bg-red-500"
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Connected — Page ID: {settings.officialApi.pageId}
                    </p>
                    <p className="text-xs text-gray-500">
                      Token: {settings.officialApi.tokenStatus}
                      {settings.officialApi.tokenExpiresAt && (
                        <> — expires {new Date(settings.officialApi.tokenExpiresAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDisconnectOfficialApi}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  <Power className="w-4 h-4" />
                  Disconnect
                </button>
              </div>

              {/* Webhook Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-xs font-medium text-gray-700">Webhook Configuration</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500 flex-1 font-mono bg-white px-3 py-1.5 rounded border border-gray-200">
                    {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/instagram
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/api/webhooks/instagram`
                      );
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">Verify Token:</p>
                  <span className="text-xs font-mono bg-white px-3 py-1.5 rounded border border-gray-200">
                    {settings.officialApi.webhookVerifyToken}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        settings.officialApi?.webhookVerifyToken || ""
                      );
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy token"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Register this URL and verify token in your Meta Developer App Dashboard under Instagram Webhooks.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Connect the official Instagram API to enable interactive DMs with buttons and comment triggers.
                No Facebook Page needed — just an Instagram Professional account and a Meta Developer App.
              </p>

              {/* Step 1: App credentials */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Instagram App ID</label>
                  <input
                    type="text"
                    value={apiAppId}
                    onChange={(e) => setApiAppId(e.target.value)}
                    placeholder="From Meta Developer Dashboard"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">App Secret</label>
                  <input
                    type="password"
                    value={apiAppSecret}
                    onChange={(e) => setApiAppSecret(e.target.value)}
                    placeholder="App secret"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Connect button — starts OAuth */}
              <button
                onClick={handleConnectOfficialApi}
                disabled={savingApi || !apiAppId || !apiAppSecret}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 font-medium"
              >
                <Camera className="w-4 h-4" />
                {savingApi ? "Redirecting..." : "Connect with Instagram"}
              </button>

              {/* Advanced: manual token */}
              <details className="text-xs text-gray-400">
                <summary className="cursor-pointer hover:text-gray-600">
                  Advanced: Enter token manually
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Access Token</label>
                    <input
                      type="password"
                      value={apiAccessToken}
                      onChange={(e) => setApiAccessToken(e.target.value)}
                      placeholder="Long-lived Instagram token"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">IG User ID</label>
                      <input
                        type="text"
                        value={apiIgUserId}
                        onChange={(e) => setApiIgUserId(e.target.value)}
                        placeholder="Instagram User ID"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Page ID (or User ID)</label>
                      <input
                        type="text"
                        value={apiPageId}
                        onChange={(e) => setApiPageId(e.target.value)}
                        placeholder="Same as IG User ID"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleConnectOfficialApi}
                    disabled={savingApi || !apiAppId || !apiAppSecret || !apiAccessToken}
                    className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 disabled:opacity-50"
                  >
                    Save Manual Token
                  </button>
                </div>
              </details>

              <p className="text-xs text-gray-400">
                Requires: Instagram Professional account + Meta Developer App with
                instagram_business_manage_messages permission.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }
}
