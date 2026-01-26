import { useStats } from "@/hooks/use-stats";
import { useAuth } from "@/hooks/use-auth";
import { 
  Users, 
  ShoppingCart, 
  MessageSquare, 
  DollarSign, 
  ArrowUpRight,
  Clock,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color = "blue" 
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  trend?: string;
  color?: "blue" | "green" | "purple" | "orange";
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    purple: "bg-purple-500/10 text-purple-500",
    orange: "bg-orange-500/10 text-orange-500",
  };

  return (
    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-xl", colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-lg">
            <ArrowUpRight className="w-3 h-3" />
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold font-display text-white">{value}</h3>
      </div>
      
      {/* Decorative background glow */}
      <div className={cn(
        "absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity",
        color === "blue" && "bg-blue-500",
        color === "green" && "bg-green-500",
        color === "purple" && "bg-purple-500",
        color === "orange" && "bg-orange-500",
      )} />
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useStats();

  if (isLoading) return null;

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Welcome back, {user?.name}. Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Today's Orders" 
          value={stats?.orders.pending || 0} 
          icon={ShoppingCart} 
          trend="+5%"
          color="blue"
        />
        <StatCard 
          title="This Month Orders" 
          value={stats?.orders.total || 0} 
          icon={MessageSquare}
          color="purple"
        />
        <StatCard 
          title="Orders In Progress" 
          value={stats?.orders.working || 0} 
          icon={Clock}
          color="orange"
        />
        <StatCard 
          title="Total Revenue" 
          value={`$${((stats?.finance?.totalRevenue || 0) / 100).toLocaleString()}`} 
          icon={DollarSign}
          color="green"
        />
      </div>

      {isAdmin && stats?.finance && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold font-display text-white mb-6">Revenue Overview</h3>
            <div className="h-64 flex items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
              {/* Placeholder for Recharts - fully implemented in StatsPage */}
              <p>Revenue Chart Area</p>
            </div>
          </div>
          
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold font-display text-white mb-6">Financial Summary</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total Revenue</p>
                    <p className="font-bold text-white">${(stats.finance.totalRevenue || 0) / 100}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Monthly</p>
                    <p className="font-bold text-white">${(stats.finance.monthlyRevenue || 0) / 100}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
