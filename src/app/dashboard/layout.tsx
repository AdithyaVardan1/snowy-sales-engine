import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-60 min-w-0">
        <TopBar />
        <main className="p-6 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
