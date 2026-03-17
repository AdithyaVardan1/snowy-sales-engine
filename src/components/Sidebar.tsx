"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  MessageSquare,
  FileText,
  Users,
  Snowflake,
  PenTool,
  Share2,
  Clock,
  MessageCircle,
  Settings,
  Camera,
  Bot,
  TrendingUp,
  SearchCheck,
  Zap,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/dashboard/community", label: "Community", icon: MessageSquare },
  { href: "/dashboard/blog", label: "Blog", icon: PenTool },
  { href: "/dashboard/engagement", label: "Engagement", icon: MessageCircle },
  { href: "/dashboard/social", label: "Social", icon: Share2 },
  { href: "/dashboard/instagram", label: "Instagram", icon: Camera },
  { href: "/dashboard/trends", label: "Trends", icon: TrendingUp },
  { href: "/dashboard/content", label: "Content", icon: FileText },
  { href: "/dashboard/partners", label: "Partners", icon: Users },
  { href: "/dashboard/scheduler", label: "Scheduler", icon: Clock },
  { href: "/dashboard/seo", label: "SEO", icon: SearchCheck },
  { href: "/dashboard/sales", label: "Sales AI", icon: Zap },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];


export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col min-h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Snowflake className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-lg font-bold">Snowy AI</h1>
            <p className="text-xs text-slate-400">Sales Engine</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <a
          href="https://agent.snowballlabs.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          agent.snowballlabs.org
        </a>
      </div>
    </aside>
  );
}
