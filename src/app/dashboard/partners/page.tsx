"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  X,
  ExternalLink,
  MessageSquare,
  ChevronRight,
  User,
  Search,
  Sparkles,
  RefreshCw,
  Check,
  Copy,
  Send,
} from "lucide-react";

interface PartnerNote {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

interface Partner {
  id: string;
  name: string;
  platform: string;
  profileUrl?: string;
  followers: number;
  category: string;
  status: string;
  dealTerms?: string;
  dealDetails?: string;
  email?: string;
  contactedAt?: string;
  onboardedAt?: string;
  createdAt: string;
  notes: PartnerNote[];
}

const PIPELINE_STAGES = [
  "identified",
  "contacted",
  "replied",
  "negotiating",
  "onboarded",
  "active",
];

const STAGE_COLORS: Record<string, string> = {
  identified: "bg-gray-100 border-gray-300",
  contacted: "bg-blue-50 border-blue-300",
  replied: "bg-yellow-50 border-yellow-300",
  negotiating: "bg-orange-50 border-orange-300",
  onboarded: "bg-green-50 border-green-300",
  active: "bg-emerald-50 border-emerald-300",
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "bg-red-100 text-red-700",
  twitter: "bg-blue-100 text-blue-700",
  github: "bg-green-100 text-green-700",
  instagram: "bg-pink-100 text-pink-700",
  tiktok: "bg-gray-100 text-gray-700",
  telegram: "bg-blue-100 text-blue-800",
  whatsapp: "bg-emerald-100 text-emerald-700",
};

const CATEGORIES = ["skill_developer", "youtuber", "community_leader", "api_provider"];
const PLATFORMS = ["youtube", "twitter", "github", "instagram", "tiktok", "telegram", "whatsapp"];

function formatFollowers(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

interface DiscoveredProspect {
  name: string;
  handle: string;
  platform: string;
  profileUrl: string;
  followers: number;
  bio: string;
  recentPost: string;
  engagement: number;
  alreadyExists: boolean;
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  // Discover modal state
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverPlatform, setDiscoverPlatform] = useState("twitter");
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverCategory, setDiscoverCategory] = useState("skill_developer");
  const [discovering, setDiscovering] = useState(false);
  const [prospects, setProspects] = useState<DiscoveredProspect[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<Set<number>>(new Set());
  const [addingProspects, setAddingProspects] = useState(false);
  const [discoverError, setDiscoverError] = useState("");

  async function loadPartners() {
    setLoading(true);
    try {
      const res = await fetch("/api/partners");
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners);
      }
    } catch (e) {
      console.error("Failed to load partners", e);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPartners();
  }, []);

  async function updateStatus(partnerId: string, newStatus: string) {
    await fetch(`/api/partners/${partnerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    await loadPartners();
  }

  async function deletePartner(partnerId: string) {
    if (!confirm("Delete this partner?")) return;
    await fetch(`/api/partners/${partnerId}`, { method: "DELETE" });
    setSelectedPartner(null);
    await loadPartners();
  }

  async function discoverPartners() {
    if (!discoverQuery.trim()) return;
    setDiscovering(true);
    setProspects([]);
    setSelectedProspects(new Set());
    setDiscoverError("");
    try {
      const res = await fetch("/api/partners/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: discoverPlatform, query: discoverQuery, category: discoverCategory, count: 20 }),
      });
      const data = await res.json();
      setProspects(data.prospects || []);
      if (data.error) setDiscoverError(data.error);
    } catch (e) {
      console.error("Discovery failed", e);
      setDiscoverError("Network error — check console");
    }
    setDiscovering(false);
  }

  function toggleProspect(idx: number) {
    setSelectedProspects((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function addSelectedProspects() {
    setAddingProspects(true);
    const toAdd = Array.from(selectedProspects).map((i) => prospects[i]).filter((p) => !p.alreadyExists);
    for (const p of toAdd) {
      await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name || p.handle,
          platform: p.platform,
          profileUrl: p.profileUrl,
          followers: p.followers,
          category: discoverCategory,
          status: "identified",
        }),
      });
    }
    setAddingProspects(false);
    setShowDiscover(false);
    setProspects([]);
    setSelectedProspects(new Set());
    await loadPartners();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Partner Pipeline</h1>
        <p className="text-sm text-gray-500 mt-1">Manage influencer and partner relationships through a Kanban pipeline — from identification to active collaboration.</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
      {/* Pipeline */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{partners.length} partners</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiscover(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Search className="w-4 h-4" />
              Discover Partners
            </button>
            <button
              onClick={() => {
                setEditingPartner(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Partner
            </button>
          </div>
        </div>

        <div className="flex-1 flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const stagePartners = partners.filter((p) => p.status === stage);
            return (
              <div
                key={stage}
                className="flex-shrink-0 w-52 flex flex-col"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {stage}
                  </h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {stagePartners.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {stagePartners.map((partner) => (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedPartner(partner)}
                      className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${
                        STAGE_COLORS[stage] || "bg-white border-gray-200"
                      } ${
                        selectedPartner?.id === partner.id
                          ? "ring-2 ring-blue-500"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            PLATFORM_COLORS[partner.platform] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {partner.platform}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatFollowers(partner.followers)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {partner.name}
                      </p>
                      <p className="text-[10px] text-gray-400 capitalize mt-0.5">
                        {partner.category.replace("_", " ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selectedPartner && (
        <PartnerDetail
          partner={selectedPartner}
          onClose={() => setSelectedPartner(null)}
          onStatusChange={(newStatus) =>
            updateStatus(selectedPartner.id, newStatus)
          }
          onDelete={() => deletePartner(selectedPartner.id)}
          onEdit={() => {
            setEditingPartner(selectedPartner);
            setShowForm(true);
          }}
          onNoteAdded={loadPartners}
        />
      )}

      {showForm && (
        <PartnerFormModal
          partner={editingPartner}
          onClose={() => {
            setShowForm(false);
            setEditingPartner(null);
          }}
          onSaved={loadPartners}
        />
      )}

      {/* Discover Partners Modal */}
      {showDiscover && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-purple-600" />
                Discover Partners
              </h3>
              <button onClick={() => { setShowDiscover(false); setProspects([]); setSelectedProspects(new Set()); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="flex gap-3">
                <select
                  value={discoverPlatform}
                  onChange={(e) => setDiscoverPlatform(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="twitter">Twitter / X</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
                <select
                  value={discoverCategory}
                  onChange={(e) => setDiscoverCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.replace("_", " ")}</option>
                  ))}
                </select>
                <input
                  value={discoverQuery}
                  onChange={(e) => setDiscoverQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && discoverPartners()}
                  placeholder="Search keywords (e.g. AI agents, LLM tools)"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={discoverPartners}
                  disabled={discovering || !discoverQuery.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {discovering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {discovering ? "Searching..." : "Search"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {discoverError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-600">{discoverError}</p>
                </div>
              )}
              {prospects.length === 0 && !discovering && !discoverError && (
                <p className="text-sm text-gray-400 text-center py-8">Search for potential partners on Twitter or LinkedIn</p>
              )}
              {discovering && (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-purple-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Searching {discoverPlatform} for &quot;{discoverQuery}&quot;...</p>
                </div>
              )}
              {prospects.length > 0 && (
                <div className="space-y-2">
                  {prospects.map((p, idx) => (
                    <div
                      key={idx}
                      onClick={() => !p.alreadyExists && toggleProspect(idx)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        p.alreadyExists
                          ? "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed"
                          : selectedProspects.has(idx)
                          ? "bg-purple-50 border-purple-300 ring-1 ring-purple-400"
                          : "bg-white border-gray-200 hover:border-purple-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                          p.alreadyExists ? "border-gray-300 bg-gray-100" :
                          selectedProspects.has(idx) ? "border-purple-500 bg-purple-500" : "border-gray-300"
                        }`}>
                          {(selectedProspects.has(idx) || p.alreadyExists) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{p.name || p.handle}</span>
                            <span className="text-xs text-gray-400">@{p.handle}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PLATFORM_COLORS[p.platform] || "bg-gray-100 text-gray-600"}`}>
                              {p.platform}
                            </span>
                            {p.followers > 0 && (
                              <span className="text-[10px] text-gray-400">{formatFollowers(p.followers)}</span>
                            )}
                            {p.alreadyExists && (
                              <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Already added</span>
                            )}
                          </div>
                          {p.recentPost && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.recentPost}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {prospects.length > 0 && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {selectedProspects.size} selected &middot; {prospects.filter((p) => !p.alreadyExists).length} new prospects
                </p>
                <button
                  onClick={addSelectedProspects}
                  disabled={selectedProspects.size === 0 || addingProspects}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {addingProspects ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {addingProspects ? "Adding..." : "Add Selected to Pipeline"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function PartnerDetail({
  partner,
  onClose,
  onStatusChange,
  onDelete,
  onEdit,
  onNoteAdded,
}: {
  partner: Partner;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  onEdit: () => void;
  onNoteAdded: () => void;
}) {
  const [newNote, setNewNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("");
  const [notes, setNotes] = useState<PartnerNote[]>(partner.notes || []);

  // Outreach state
  const [generatingDM, setGeneratingDM] = useState(false);
  const [outreachMessage, setOutreachMessage] = useState("");
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [outreachResult, setOutreachResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNotes(partner.notes || []);
  }, [partner]);

  async function addNote() {
    if (!newNote.trim()) return;
    const res = await fetch(`/api/partners/${partner.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newNote, author: noteAuthor || "team" }),
    });
    if (res.ok) {
      const note = await res.json();
      setNotes([note, ...notes]);
      setNewNote("");
      onNoteAdded();
    }
  }

  async function generateOutreach() {
    setGeneratingDM(true);
    setOutreachResult(null);
    try {
      const res = await fetch("/api/partners/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: partner.id, platform: partner.platform }),
      });
      if (res.ok) {
        const data = await res.json();
        setOutreachMessage(data.message || "");
      }
    } catch (e) {
      console.error("Failed to generate outreach", e);
    }
    setGeneratingDM(false);
  }

  async function sendOutreach() {
    if (!outreachMessage.trim()) return;
    setSendingOutreach(true);
    setOutreachResult(null);
    try {
      const res = await fetch("/api/partners/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: partner.id, platform: partner.platform, message: outreachMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutreachResult({ success: true });
        setOutreachMessage("");
        onNoteAdded(); // refresh to show the logged note
      } else {
        setOutreachResult({ error: data.error || "Send failed" });
      }
    } catch (e: unknown) {
      setOutreachResult({ error: e instanceof Error ? e.message : "Send failed" });
    }
    setSendingOutreach(false);
  }

  function copyMessage() {
    navigator.clipboard.writeText(outreachMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="w-[380px] bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{partner.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              PLATFORM_COLORS[partner.platform] || "bg-gray-100 text-gray-600"
            }`}
          >
            {partner.platform}
          </span>
          <span className="text-xs text-gray-500">
            {formatFollowers(partner.followers)} followers
          </span>
          <span className="text-xs text-gray-400 capitalize">
            {partner.category.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="p-4 border-b border-gray-100 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select
            value={partner.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {partner.email && (
          <div>
            <label className="text-xs font-medium text-gray-500">Email</label>
            <p className="text-sm text-gray-700">{partner.email}</p>
          </div>
        )}

        {partner.dealTerms && (
          <div>
            <label className="text-xs font-medium text-gray-500">Deal Terms</label>
            <p className="text-sm text-gray-700">{partner.dealTerms}</p>
          </div>
        )}

        {partner.profileUrl && (
          <a
            href={partner.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Profile
          </a>
        )}

        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Outreach */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            Outreach
          </h4>
          <button
            onClick={generateOutreach}
            disabled={generatingDM}
            className="px-3 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {generatingDM ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {generatingDM ? "Generating..." : "Generate DM"}
          </button>
        </div>

        {outreachMessage && (
          <div className="space-y-2">
            <textarea
              value={outreachMessage}
              onChange={(e) => setOutreachMessage(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <div className="flex gap-2">
              {partner.platform === "twitter" ? (
                <button
                  onClick={sendOutreach}
                  disabled={sendingOutreach || !outreachMessage.trim()}
                  className="flex-1 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-1.5"
                >
                  {sendingOutreach ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  {sendingOutreach ? "Sending..." : "Send via Twitter"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    copyMessage();
                    // Also log it as sent (manual send)
                    sendOutreach();
                  }}
                  disabled={sendingOutreach || !outreachMessage.trim()}
                  className="flex-1 px-3 py-1.5 text-xs bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-1.5"
                >
                  {sendingOutreach ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                  {sendingOutreach ? "Logging..." : "Copy & Mark Sent"}
                </button>
              )}
              <button
                onClick={copyMessage}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {outreachResult?.success && (
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <Check className="w-3 h-3" /> Outreach sent & logged
          </p>
        )}
        {outreachResult?.error && (
          <p className="text-xs text-red-600 mt-2">Error: {outreachResult.error}</p>
        )}

        {!outreachMessage && !generatingDM && (
          <p className="text-xs text-gray-400 mt-1">Generate a personalized DM using AI</p>
        )}
      </div>

      {/* Notes */}
      <div className="flex-1 p-4 flex flex-col overflow-hidden">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Notes</h4>

        <div className="space-y-2 mb-3">
          <input
            value={noteAuthor}
            onChange={(e) => setNoteAuthor(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addNote}
              disabled={!newNote.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-lg"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {notes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No notes yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="bg-gray-50 rounded-lg p-2.5">
                <p className="text-xs text-gray-700">{note.content}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {note.author} &middot;{" "}
                  {new Date(note.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PartnerFormModal({
  partner,
  onClose,
  onSaved,
}: {
  partner: Partner | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: partner?.name || "",
    platform: partner?.platform || "youtube",
    profileUrl: partner?.profileUrl || "",
    followers: partner?.followers || 0,
    category: partner?.category || "youtuber",
    status: partner?.status || "identified",
    dealTerms: partner?.dealTerms || "",
    dealDetails: partner?.dealDetails || "",
    email: partner?.email || "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const url = partner ? `/api/partners/${partner.id}` : "/api/partners";
    const method = partner ? "PUT" : "POST";

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
            {partner ? "Edit Partner" : "Add Partner"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Followers</label>
              <input
                type="number"
                value={form.followers}
                onChange={(e) =>
                  setForm({ ...form, followers: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profile URL</label>
            <input
              value={form.profileUrl}
              onChange={(e) => setForm({ ...form, profileUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal Terms</label>
              <select
                value={form.dealTerms}
                onChange={(e) => setForm({ ...form, dealTerms: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                <option value="free_access">Free Access</option>
                <option value="rev_share">Revenue Share</option>
                <option value="referral_code">Referral Code</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deal Details</label>
            <textarea
              value={form.dealDetails}
              onChange={(e) => setForm({ ...form, dealDetails: e.target.value })}
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
              {saving ? "Saving..." : partner ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
