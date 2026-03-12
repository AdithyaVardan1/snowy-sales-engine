"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  X,
  Calendar,
} from "lucide-react";

interface ContentEntry {
  id: string;
  title: string;
  description?: string;
  url?: string;
  platform: string;
  channel: string;
  contentType: string;
  status: string;
  publishedAt?: string;
  scheduledFor?: string;
  author: string;
  likes: number;
  replies: number;
  shares: number;
  clicks: number;
  notes?: string;
  createdAt: string;
}

const CHANNELS = [
  { value: "", label: "All Channels" },
  { value: "community", label: "Community" },
  { value: "social_media", label: "Social Media" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "plg", label: "PLG" },
  { value: "partnerships", label: "Partnerships" },
];

const PLATFORMS = [
  "reddit",
  "twitter",
  "github",
  "discord",
  "linkedin",
  "blog",
  "youtube",
  "whatsapp",
];

const CONTENT_TYPES = ["post", "thread", "pr", "message", "article", "video", "comment"];

const PLATFORM_COLORS: Record<string, string> = {
  reddit: "bg-orange-100 text-orange-700",
  twitter: "bg-blue-100 text-blue-700",
  github: "bg-green-100 text-green-700",
  discord: "bg-indigo-100 text-indigo-700",
  linkedin: "bg-blue-100 text-blue-800",
  blog: "bg-purple-100 text-purple-700",
  youtube: "bg-red-100 text-red-700",
  whatsapp: "bg-emerald-100 text-emerald-700",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-yellow-100 text-yellow-700",
  published: "bg-emerald-100 text-emerald-700",
};

export default function ContentPage() {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ContentEntry | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (channelFilter) params.set("channel", channelFilter);
    try {
      const res = await fetch(`/api/content?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setTotal(data.total);
      }
    } catch (e) {
      console.error("Failed to load content", e);
    }
    setLoading(false);
  }, [channelFilter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this content entry?")) return;
    await fetch(`/api/content/${id}`, { method: "DELETE" });
    await loadEntries();
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Content Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">Track all published and scheduled content across platforms and channels. Log engagement metrics.</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {CHANNELS.map((ch) => (
            <button
              key={ch.value}
              onClick={() => setChannelFilter(ch.value)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                channelFilter === ch.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setEditingEntry(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Content
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Platform</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Channel</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Engagement</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Author</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No content entries yet. Click &quot;Add Content&quot; to start tracking.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 max-w-xs truncate">
                      {entry.title}
                    </div>
                    {entry.description && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {entry.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        PLATFORM_COLORS[entry.platform] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {entry.platform}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">
                    {entry.channel.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[entry.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>{entry.likes} likes</span>
                      <span>{entry.replies} replies</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{entry.author}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {entry.url && (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setEditingEntry(entry);
                          setShowForm(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal form */}
      {showForm && (
        <ContentFormModal
          entry={editingEntry}
          onClose={() => {
            setShowForm(false);
            setEditingEntry(null);
          }}
          onSaved={loadEntries}
        />
      )}
    </div>
  );
}

function ContentFormModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: ContentEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: entry?.title || "",
    description: entry?.description || "",
    url: entry?.url || "",
    platform: entry?.platform || "reddit",
    channel: entry?.channel || "community",
    contentType: entry?.contentType || "post",
    status: entry?.status || "draft",
    author: entry?.author || "",
    scheduledFor: entry?.scheduledFor?.split("T")[0] || "",
    notes: entry?.notes || "",
    likes: entry?.likes || 0,
    replies: entry?.replies || 0,
    shares: entry?.shares || 0,
    clicks: entry?.clicks || 0,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const url = entry ? `/api/content/${entry.id}` : "/api/content";
    const method = entry ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {entry ? "Edit Content" : "Add Content"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CHANNELS.filter((c) => c.value).map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
              <input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {form.status === "scheduled" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled For</label>
              <input
                type="date"
                value={form.scheduledFor}
                onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {entry && (
            <div className="grid grid-cols-4 gap-3">
              {(["likes", "replies", "shares", "clicks"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">
                    {field}
                  </label>
                  <input
                    type="number"
                    value={form[field]}
                    onChange={(e) =>
                      setForm({ ...form, [field]: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Saving..." : entry ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
