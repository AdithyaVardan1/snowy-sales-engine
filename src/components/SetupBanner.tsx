"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, Settings, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";

interface RequiredKey {
  key: string;
  label: string;
}

interface SetupBannerProps {
  /** Which setting keys this page needs */
  requiredKeys: RequiredKey[];
  /** Short label for what needs setup, e.g. "Twitter", "AI Provider" */
  platform: string;
  /** Optional: link directly to settings with a hash/anchor */
  settingsHash?: string;
}

interface KeyStatus {
  key: string;
  label: string;
  isSet: boolean;
}

export default function SetupBanner({ requiredKeys, platform, settingsHash }: SetupBannerProps) {
  const [statuses, setStatuses] = useState<KeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data = await res.json();
        const settings: Array<{ key: string; isSet: boolean; isSetFromEnv: boolean }> = data.settings || [];

        const result: KeyStatus[] = requiredKeys.map((rk) => {
          const found = settings.find((s) => s.key === rk.key);
          return {
            key: rk.key,
            label: rk.label,
            isSet: found ? found.isSet || found.isSetFromEnv : false,
          };
        });
        setStatuses(result);
      } catch {
        // If settings API fails, don't show the banner
      } finally {
        setLoading(false);
      }
    }
    check();
  }, [requiredKeys]);

  if (loading) return null;

  const missing = statuses.filter((s) => !s.isSet);
  const allSet = missing.length === 0;

  if (allSet) return null;

  const settingsUrl = settingsHash
    ? `/dashboard/settings#${settingsHash}`
    : "/dashboard/settings";

  return (
    <div className="mb-4 border border-amber-200 bg-amber-50 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            {platform} account not fully configured
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            {missing.length} setting{missing.length > 1 ? "s" : ""} missing — some features won&apos;t work until configured.
          </p>
        </div>
        <Link
          href={settingsUrl}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          <Settings className="w-3.5 h-3.5" />
          Setup Account
        </Link>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-amber-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-400" />
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-amber-200">
          <div className="space-y-1.5 mt-2">
            {statuses.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                {s.isSet ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span className={s.isSet ? "text-green-700" : "text-amber-700"}>
                  {s.label}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    s.isSet
                      ? "bg-green-100 text-green-600"
                      : "bg-amber-100 text-amber-600"
                  }`}
                >
                  {s.isSet ? "Configured" : "Not set"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
