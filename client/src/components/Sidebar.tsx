import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  MessageSquare, 
  FileText, 
  Users, 
  BarChart3, 
  LogOut,
  Settings,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  if (!user) return null;

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "support", "designer"] },
    { href: "/orders", label: "Orders", icon: FileText, roles: ["admin", "support", "designer"] },
    { href: "/chats", label: "Chats", icon: MessageSquare, roles: ["admin", "support", "designer"] },
    { href: "/users", label: "Team", icon: Users, roles: ["admin"] },
    { href: "/stats", label: "Analytics", icon: BarChart3, roles: ["admin"] },
  ];

  const allowedLinks = links.filter(link => link.roles.includes(user.role));

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-950 border-r border-slate-800 h-screen fixed left-0 top-0 z-50">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center">
            <span className="text-white font-bold font-display text-lg">P</span>
          </div>
          <h1 className="text-xl font-bold font-display tracking-tight text-white">PixelCRM</h1>
        </div>

        <div className="flex flex-col gap-6">
          <div className="space-y-1">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Menu</p>
            {allowedLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href} className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-blue-600/10 text-blue-400" 
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                )}>
                  <Icon className={cn("w-5 h-5", isActive ? "text-blue-400" : "text-slate-500 group-hover:text-white")} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-300 font-medium">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{user.role}</p>
          </div>
          <button className="text-slate-400 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
        
        <button 
          onClick={() => logoutMutation.mutate()}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
