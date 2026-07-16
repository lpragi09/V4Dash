import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-50 overflow-hidden selection:bg-red-500/30">
      <Sidebar />
      
      <main className="flex-1 h-full overflow-y-auto relative">
        {/* Top Subtle Red Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-red-900/15 rounded-full blur-[100px] pointer-events-none z-0" />
        
        {children}
      </main>
    </div>
  );
}
