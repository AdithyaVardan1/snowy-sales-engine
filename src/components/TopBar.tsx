"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/community": "Community Monitor",
  "/dashboard/content": "Content Tracker",
  "/dashboard/partners": "Partners",
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitles[pathname] || "Dashboard";

  async function handleLogout() {
    document.cookie = "session=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>
    </header>
  );
}
