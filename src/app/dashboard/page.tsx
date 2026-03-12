"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  FileText,
  Users,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface Metrics {
  totalResponses: number;
  contentPublished: number;
  activePartnerships: number;
  responseRate: number;
}

interface ChannelData {
  channel: string;
  count: number;
}

interface TrendData {
  week: string;
  responses: number;
  content: number;
  partners: number;
}

interface AnalyticsData {
  metrics: Metrics;
  channelBreakdown: ChannelData[];
  weeklyTrend: TrendData[];
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

const CHANNEL_COLORS: Record<string, string> = {
  community: "#3B82F6",
  social_media: "#8B5CF6",
  whatsapp: "#10B981",
  plg: "#F59E0B",
  partnerships: "#EF4444",
};

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics?period=${period}`);
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error("Failed to load analytics", e);
      }
      setLoading(false);
    }
    load();
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse h-28"
            />
          ))}
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    totalResponses: 0,
    contentPublished: 0,
    activePartnerships: 0,
    responseRate: 0,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of community responses, content output, partnerships, and engagement metrics.</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        {["7d", "30d", "90d"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              period === p
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-6">
        <MetricCard
          label="Community Responses"
          value={metrics.totalResponses}
          icon={MessageSquare}
          color="bg-blue-500"
        />
        <MetricCard
          label="Content Published"
          value={metrics.contentPublished}
          icon={FileText}
          color="bg-purple-500"
        />
        <MetricCard
          label="Active Partnerships"
          value={metrics.activePartnerships}
          icon={Users}
          color="bg-emerald-500"
        />
        <MetricCard
          label="Response Rate"
          value={`${Math.round(metrics.responseRate * 100)}%`}
          icon={TrendingUp}
          color="bg-amber-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Activity by Channel
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.channelBreakdown || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar
                dataKey="count"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Weekly Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.weeklyTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="responses"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="content"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="partners"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
