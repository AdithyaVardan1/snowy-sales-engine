"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Sparkles,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  X,
  Globe,
} from "lucide-react";
import SetupBanner from "@/components/SetupBanner";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  metaDescription?: string;
  keywords?: string;
  status: string;
  publishedAt?: string;
  scheduledFor?: string;
  generatedFrom?: string;
  createdAt: string;
}

const TOPIC_PRESETS = [
  "What is Snowy AI? The complete guide to AI-powered sales engines",
  "Why AI agents are replacing traditional SDRs in 2026",
  "Snowy AI vs Clay vs Apollo — AI sales tools compared",
  "How to automate your GTM strategy with AI agents",
  "AI sales automation explained: a beginner's guide",
  "The AI agent ecosystem guide — sales, outreach, and more",
  "Why autonomous AI agents are the next big thing in sales",
  "Building AI-powered outreach: developer guide and best practices",
  "Top 10 use cases for AI agents in B2B sales",
  "The future of AI-powered GTM and sales automation",
];

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [generatedPost, setGeneratedPost] = useState<Partial<BlogPost> | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/blog");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
      }
    } catch (e) {
      console.error("Failed to load blog posts", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedPost({ ...data, generatedFrom: topic });
        setShowGenerator(false);
        setShowEditor(true);
      }
    } catch (e) {
      console.error("Generation failed", e);
    }
    setGenerating(false);
  }

  async function handleSave(post: Partial<BlogPost>, status: string) {
    const isEdit = !!editingPost;
    const url = isEdit ? `/api/blog/${editingPost!.slug}` : "/api/blog";
    const method = isEdit ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...post, status }),
    });

    setShowEditor(false);
    setEditingPost(null);
    setGeneratedPost(null);
    await loadPosts();
  }

  async function handleDelete(slug: string) {
    if (!confirm("Delete this blog post?")) return;
    await fetch(`/api/blog/${slug}`, { method: "DELETE" });
    await loadPosts();
  }

  return (
    <div className="space-y-4">
      <SetupBanner
        platform="AI Provider"
        requiredKeys={[
          { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude) API key" },
          { key: "GEMINI_API_KEY", label: "Gemini API key" },
        ]}
      />

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Blog Manager</h1>
        <p className="text-sm text-gray-500 mt-1">Generate SEO-optimized articles with AI, edit, and publish to your public blog at /blog.</p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{posts.length} blog posts</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGenerator(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate Article
          </button>
          <button
            onClick={() => {
              setEditingPost(null);
              setGeneratedPost(null);
              setShowEditor(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>
      </div>

      {/* Posts table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Keywords</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No blog posts yet. Click &quot;Generate Article&quot; to create one with AI.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{post.title}</div>
                    <div className="text-xs text-gray-400">/{post.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        post.status === "published"
                          ? "bg-emerald-100 text-emerald-700"
                          : post.status === "scheduled"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {post.keywords || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : new Date(post.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {post.status === "published" && (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setEditingPost(post);
                          setGeneratedPost(null);
                          setShowEditor(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(post.slug)}
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

      {/* Topic generator modal */}
      {showGenerator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Generate Blog Article</h3>
              <button onClick={() => setShowGenerator(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic / Keyword</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., How AI agents are transforming B2B sales"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Quick Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {TOPIC_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setTopic(preset)}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 rounded transition-colors"
                    >
                      {preset.length > 40 ? preset.slice(0, 40) + "..." : preset}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || generating}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Sparkles className={`w-4 h-4 ${generating ? "animate-pulse" : ""}`} />
                {generating ? "Generating (this takes ~30s)..." : "Generate with Claude AI"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor modal */}
      {showEditor && (
        <BlogEditorModal
          post={editingPost || generatedPost}
          onClose={() => {
            setShowEditor(false);
            setEditingPost(null);
            setGeneratedPost(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function BlogEditorModal({
  post,
  onClose,
  onSave,
}: {
  post: Partial<BlogPost> | null;
  onClose: () => void;
  onSave: (post: Partial<BlogPost>, status: string) => void;
}) {
  const [form, setForm] = useState({
    title: post?.title || "",
    slug: post?.slug || "",
    content: post?.content || "",
    metaDescription: post?.metaDescription || "",
    keywords: post?.keywords || "",
    generatedFrom: post?.generatedFrom || "",
  });
  const [preview, setPreview] = useState(false);

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {post?.id ? "Edit Post" : "New Blog Post"}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreview(!preview)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg ${
                preview ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                value={form.title}
                onChange={(e) => {
                  setForm({
                    ...form,
                    title: e.target.value,
                    slug: form.slug || generateSlug(e.target.value),
                  });
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
            <input
              value={form.metaDescription}
              onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
              maxLength={160}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">{form.metaDescription.length}/160</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <input
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              placeholder="comma, separated, keywords"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {preview ? (
            <div className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-6 min-h-[300px]">
              <h1>{form.title}</h1>
              <div className="whitespace-pre-wrap">{form.content}</div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content (Markdown)</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={20}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={() => onSave(form, "draft")}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg"
          >
            Save Draft
          </button>
          <button
            onClick={() => onSave(form, "published")}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
