import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

export function Layout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // If loading or strictly on auth page, render simple layout or spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Auth pages don't get the sidebar
  if (!user || location.startsWith("/auth")) {
    return <main className="min-h-screen bg-background">{children}</main>;
  }

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 lg:pl-64 h-screen flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
