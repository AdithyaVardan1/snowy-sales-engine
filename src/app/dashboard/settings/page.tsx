"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Twitter,
    Linkedin,
    Save,
    CheckCircle,
    AlertCircle,
    Eye,
    EyeOff,
    RefreshCw,
} from "lucide-react";

interface Setting {
    key: string;
    label: string;
    category: string;
    secret: boolean;
    value: string;
    isSet: boolean;
    isSetFromEnv: boolean;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string; instructions: string }> = {
    twitter: {
        label: "Twitter / X",
        icon: <Twitter className="w-4 h-4" />,
        color: "blue",
        instructions: "Open x.com → Log in → DevTools (F12) → Application → Cookies → x.com → copy ct0 and auth_token values.",
    },
    linkedin: {
        label: "LinkedIn",
        icon: <Linkedin className="w-4 h-4" />,
        color: "blue",
        instructions: "Get an access token via the LinkedIn Developer Portal Token Generator (select openid + profile + w_member_social scopes). Your person URN is at /api/social/linkedin-me after adding the token.",
    },
    reddit: {
        label: "Reddit",
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
            </svg>
        ),
        color: "orange",
        instructions: "Open reddit.com → Log in → DevTools (F12) → Application → Cookies → reddit.com → copy the reddit_session value (it's long and URL-encoded).",
    },
    ai: {
        label: "AI Provider",
        icon: <span className="text-sm">✨</span>,
        color: "purple",
        instructions: "Add your Gemini API key from aistudio.google.com, or Anthropic key from console.anthropic.com. Gemini is free tier friendly. Claude is used if both are set.",
    },
    github: {
        label: "GitHub",
        icon: <span className="text-sm">🐙</span>,
        color: "gray",
        instructions: "Create a personal access token at github.com/settings/tokens with repo + read:discussion scopes. Set owner and repo to monitor issues/discussions.",
    },
    community: {
        label: "Community Sources",
        icon: <span className="text-sm">🔍</span>,
        color: "gray",
        instructions: "Comma-separated list of subreddits to monitor for mentions (e.g. openclaw,selfhosted,LocalLLaMA). The first subreddit fetches ALL new posts; others search for 'openclaw' mentions only.",
    },
};

const COLOR_MAP: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    orange: "bg-orange-50 border-orange-200",
    purple: "bg-purple-50 border-purple-200",
    gray: "bg-gray-50 border-gray-200",
};

const ICON_COLOR_MAP: Record<string, string> = {
    blue: "text-blue-600",
    orange: "text-orange-500",
    purple: "text-purple-600",
    gray: "text-gray-600",
};

export default function SettingsPage() {
    const [settings, setSettings] = useState<Setting[]>([]);
    const [loading, setLoading] = useState(true);
    const [values, setValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showValues, setShowValues] = useState<Record<string, boolean>>({});

    const load = useCallback(async () => {
        setLoading(true);
        const res = await fetch("/api/settings");
        if (res.ok) {
            const data = await res.json();
            setSettings(data.settings);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function saveSetting(key: string) {
        const value = values[key] ?? "";
        setSaving((s) => ({ ...s, [key]: true }));
        setErrors((e) => ({ ...e, [key]: "" }));

        const res = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value }),
        });

        if (res.ok) {
            setSaved((s) => ({ ...s, [key]: true }));
            setValues((v) => ({ ...v, [key]: "" })); // clear field after save
            setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 3000);
            await load(); // refresh statuses
        } else {
            const data = await res.json();
            setErrors((e) => ({ ...e, [key]: data.error ?? "Failed to save" }));
        }

        setSaving((s) => ({ ...s, [key]: false }));
    }

    // Group settings by category
    const categories = Object.keys(CATEGORY_META);
    const grouped = categories.map((cat) => ({
        cat,
        meta: CATEGORY_META[cat],
        settings: settings.filter((s) => s.category === cat),
    }));

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-12">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Platform Settings</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Configure API keys and cookies directly from here — no need to edit any files.
                    Values saved here take priority over environment variables.
                </p>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-40" />
                    ))}
                </div>
            ) : (
                grouped.map(({ cat, meta, settings: catSettings }) => {
                    const color = meta.color;
                    return (
                        <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            {/* Category header */}
                            <div className={`flex items-center gap-2 px-5 py-3 border-b border-gray-100 ${COLOR_MAP[color]}`}>
                                <span className={ICON_COLOR_MAP[color]}>{meta.icon}</span>
                                <h2 className="font-semibold text-gray-900 text-sm">{meta.label}</h2>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* Instructions */}
                                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                    📋 {meta.instructions}
                                </p>

                                {/* Inputs */}
                                {catSettings.map((setting) => (
                                    <div key={setting.key}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <label className="text-xs font-medium text-gray-700">{setting.label}</label>
                                            {setting.isSet && (
                                                <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                                                    <CheckCircle className="w-2.5 h-2.5" />
                                                    Set in DB
                                                </span>
                                            )}
                                            {!setting.isSet && setting.isSetFromEnv && (
                                                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                                                    Set in .env
                                                </span>
                                            )}
                                            {!setting.isSet && !setting.isSetFromEnv && (
                                                <span className="flex items-center gap-1 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                                                    <AlertCircle className="w-2.5 h-2.5" />
                                                    Not set
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type={setting.secret && !showValues[setting.key] ? "password" : "text"}
                                                    value={values[setting.key] ?? ""}
                                                    onChange={(e) => setValues((v) => ({ ...v, [setting.key]: e.target.value }))}
                                                    placeholder={
                                                        setting.isSet
                                                            ? "Enter new value to update..."
                                                            : setting.isSetFromEnv
                                                                ? "Using value from .env (override by entering here)"
                                                                : `Paste ${setting.label.toLowerCase()}...`
                                                    }
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                                                />
                                                {setting.secret && (
                                                    <button
                                                        onClick={() => setShowValues((v) => ({ ...v, [setting.key]: !v[setting.key] }))}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                    >
                                                        {showValues[setting.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => saveSetting(setting.key)}
                                                disabled={!values[setting.key]?.trim() || saving[setting.key]}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg whitespace-nowrap"
                                            >
                                                {saving[setting.key] ? (
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                ) : saved[setting.key] ? (
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Save className="w-3.5 h-3.5" />
                                                )}
                                                {saved[setting.key] ? "Saved!" : "Save"}
                                            </button>
                                            {setting.isSet && (
                                                <button
                                                    onClick={async () => {
                                                        await fetch("/api/settings", {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ key: setting.key, value: "" }),
                                                        });
                                                        await load();
                                                    }}
                                                    className="px-3 py-2 text-xs text-red-500 hover:bg-red-50 border border-red-200 rounded-lg"
                                                    title="Clear this value (will fall back to .env)"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        {errors[setting.key] && (
                                            <p className="text-[10px] text-red-600 mt-1">{errors[setting.key]}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
