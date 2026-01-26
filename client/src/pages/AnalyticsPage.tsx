import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isToday, startOfMonth, startOfDay, isSameDay, isSameMonth } from "date-fns";
import { 
  Users, 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  XCircle,
  BarChart3,
  Calendar as CalendarIcon,
  Megaphone,
  Layers,
  Palette
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderService {
  id: number;
  orderId: number;
  serviceType: string;
  quantity: number;
  instructions?: string;
  status: string;
}

interface OrderWithServices {
  id: number;
  orderNumber: string;
  clientName: string;
  status: string;
  assignedToId?: number;
  readyDate?: string;
  paymentStatus?: string;
  campaign?: string;
  adSet?: string;
  creative?: string;
  createdAt?: string;
  services: OrderService[];
  assignee?: {
    id: number;
    name: string;
  };
}

interface User {
  id: number;
  name: string;
  role: string;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color = "blue",
  testId
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  color?: "blue" | "green" | "purple" | "orange" | "red";
  testId?: string;
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    purple: "bg-purple-500/10 text-purple-500",
    orange: "bg-orange-500/10 text-orange-500",
    red: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800" data-testid={testId}>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-xl", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-slate-400">{title}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  
  const { data: orders, isLoading } = useQuery<OrderWithServices[]>({
    queryKey: ["/api/orders"],
  });
  
  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Only admin can access analytics
  if (user?.role !== "admin") {
    return <Redirect to="/" />;
  }

  if (isLoading) return null;

  const designers = teamMembers?.filter(u => u.role === "designer") || [];
  const now = new Date();
  const monthStart = startOfMonth(now);
  
  // Filter orders by selected month for monthly reports
  const selectedMonthOrders = orders?.filter(o => {
    const createdDate = new Date(o.createdAt!);
    return createdDate.getMonth().toString() === selectedMonth;
  }) || [];

  // Designer Performance Calculations
  // A designer's completion is counted when readyDate is set (Working → Ready transition)
  const getDesignerMetrics = (designerId: number) => {
    const assignedOrders = orders?.filter(o => o.assignedToId === designerId) || [];
    
    // Completed today = readyDate is today
    const completedToday = assignedOrders.filter(o => {
      if (!o.readyDate) return false;
      return isToday(new Date(o.readyDate));
    }).length;
    
    // Completed this month = readyDate is in current month
    const completedThisMonth = assignedOrders.filter(o => {
      if (!o.readyDate) return false;
      return new Date(o.readyDate) >= monthStart;
    }).length;
    
    // Total completed = has readyDate (meaning it reached Ready status at some point)
    const totalCompleted = assignedOrders.filter(o => o.readyDate).length;
    
    // Pending = new or working status
    const pendingOrders = assignedOrders.filter(o => o.status === 'new' || o.status === 'working').length;
    
    // Canceled
    const canceledOrders = assignedOrders.filter(o => o.status === 'canceled').length;
    
    // Average daily completion rate (for this month)
    const daysInMonth = now.getDate();
    const avgDailyRate = daysInMonth > 0 ? (completedThisMonth / daysInMonth).toFixed(1) : "0";
    
    return {
      completedToday,
      completedThisMonth,
      totalCompleted,
      pendingOrders,
      canceledOrders,
      avgDailyRate,
      totalAssigned: assignedOrders.length,
    };
  };

  // Marketing Analytics Calculations
  const getCampaignMetrics = () => {
    const campaigns = new Map<string, {
      total: number;
      paid: number;
      pending: number;
      adSets: Map<string, {
        total: number;
        paid: number;
        pending: number;
        creatives: Map<string, { total: number; paid: number; pending: number }>;
      }>;
    }>();
    
    orders?.forEach(order => {
      const campaignName = order.campaign || "Uncategorized";
      const adSetName = order.adSet || "No Ad Set";
      const creativeName = order.creative || "No Creative";
      
      if (!campaigns.has(campaignName)) {
        campaigns.set(campaignName, { total: 0, paid: 0, pending: 0, adSets: new Map() });
      }
      
      const campaign = campaigns.get(campaignName)!;
      campaign.total++;
      if (order.paymentStatus === 'paid') campaign.paid++;
      else campaign.pending++;
      
      if (!campaign.adSets.has(adSetName)) {
        campaign.adSets.set(adSetName, { total: 0, paid: 0, pending: 0, creatives: new Map() });
      }
      
      const adSet = campaign.adSets.get(adSetName)!;
      adSet.total++;
      if (order.paymentStatus === 'paid') adSet.paid++;
      else adSet.pending++;
      
      if (!adSet.creatives.has(creativeName)) {
        adSet.creatives.set(creativeName, { total: 0, paid: 0, pending: 0 });
      }
      
      const creative = adSet.creatives.get(creativeName)!;
      creative.total++;
      if (order.paymentStatus === 'paid') creative.paid++;
      else creative.pending++;
    });
    
    return campaigns;
  };

  const campaignMetrics = getCampaignMetrics();
  
  // Top summary stats
  const totalCompletedToday = orders?.filter(o => o.readyDate && isToday(new Date(o.readyDate))).length || 0;
  const totalCompletedThisMonth = orders?.filter(o => o.readyDate && new Date(o.readyDate) >= monthStart).length || 0;
  
  // Best performing designer
  const designerPerformance = designers.map(d => ({
    ...d,
    metrics: getDesignerMetrics(d.id)
  })).sort((a, b) => b.metrics.completedThisMonth - a.metrics.completedThisMonth);
  
  const bestDesigner = designerPerformance[0];
  
  // Best performing campaign
  const campaignArray = Array.from(campaignMetrics.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);
  const bestCampaign = campaignArray[0];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-white mb-2" data-testid="text-analytics-title">Analytics Dashboard</h1>
        <p className="text-slate-400">Track designer performance and marketing effectiveness.</p>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Completed Today" 
          value={totalCompletedToday} 
          icon={CheckCircle2} 
          color="green"
          testId="stat-completed-today"
        />
        <StatCard 
          title="Completed This Month" 
          value={totalCompletedThisMonth} 
          icon={TrendingUp}
          color="blue"
          testId="stat-completed-month"
        />
        <StatCard 
          title="Best Designer" 
          value={bestDesigner?.name || "N/A"} 
          icon={Users}
          color="purple"
          testId="stat-best-designer"
        />
        <StatCard 
          title="Best Campaign" 
          value={bestCampaign?.name || "N/A"} 
          icon={Megaphone}
          color="orange"
          testId="stat-best-campaign"
        />
      </div>

      <Tabs defaultValue="designers" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6">
          <TabsTrigger value="designers" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-designer-analytics">
            Designer Performance
          </TabsTrigger>
          <TabsTrigger value="marketing" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-marketing-analytics">
            Marketing Analytics
          </TabsTrigger>
        </TabsList>

        {/* Designer Performance Tab */}
        <TabsContent value="designers">
          <div className="space-y-6">
            {/* Daily Performance */}
            <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Designer Performance Report
                </h3>
                <p className="text-sm text-slate-500">Performance based on order completion (Working → Ready)</p>
              </div>
              <Table>
                <TableHeader className="bg-slate-900/50">
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400">Designer</TableHead>
                    <TableHead className="text-slate-400 text-center">Completed Today</TableHead>
                    <TableHead className="text-slate-400 text-center">Completed This Month</TableHead>
                    <TableHead className="text-slate-400 text-center">Total Completed</TableHead>
                    <TableHead className="text-slate-400 text-center">Pending</TableHead>
                    <TableHead className="text-slate-400 text-center">Canceled</TableHead>
                    <TableHead className="text-slate-400 text-center">Avg Daily Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {designerPerformance.map((designer) => (
                    <TableRow key={designer.id} className="border-slate-800" data-testid={`row-designer-${designer.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm text-slate-300">
                            {designer.name.charAt(0)}
                          </div>
                          <span className="text-white font-medium">{designer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          "border-0",
                          designer.metrics.completedToday > 0 ? "text-green-500" : "text-slate-500"
                        )}>
                          {designer.metrics.completedToday}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-blue-400 font-medium">{designer.metrics.completedThisMonth}</span>
                      </TableCell>
                      <TableCell className="text-center text-slate-300">{designer.metrics.totalCompleted}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          "border-0",
                          designer.metrics.pendingOrders > 0 ? "text-yellow-500" : "text-slate-500"
                        )}>
                          {designer.metrics.pendingOrders}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          "border-0",
                          designer.metrics.canceledOrders > 0 ? "text-red-500" : "text-slate-500"
                        )}>
                          {designer.metrics.canceledOrders}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-purple-400">{designer.metrics.avgDailyRate}/day</TableCell>
                    </TableRow>
                  ))}
                  {designers.length === 0 && (
                    <TableRow className="border-slate-800">
                      <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                        No designers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Marketing Analytics Tab */}
        <TabsContent value="marketing">
          <div className="space-y-6">
            {/* Campaign Performance */}
            <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-orange-500" />
                  Campaign Performance
                </h3>
                <p className="text-sm text-slate-500">Orders grouped by Campaign → Ad Set → Creative</p>
              </div>
              
              <div className="divide-y divide-slate-800">
                {campaignArray.map((campaign) => (
                  <div key={campaign.name} className="p-4" data-testid={`campaign-${campaign.name}`}>
                    {/* Campaign Level */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <Megaphone className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{campaign.name}</p>
                          <p className="text-xs text-slate-500">Campaign</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-white">{campaign.total}</p>
                          <p className="text-xs text-slate-500">Total Orders</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-green-500">{campaign.paid}</p>
                          <p className="text-xs text-slate-500">Paid</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-yellow-500">{campaign.pending}</p>
                          <p className="text-xs text-slate-500">Pending</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Ad Sets */}
                    <div className="ml-8 space-y-2">
                      {Array.from(campaign.adSets.entries()).map(([adSetName, adSet]) => (
                        <div key={adSetName} className="bg-slate-900/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-blue-500" />
                              <span className="text-slate-300">{adSetName}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-slate-400">{adSet.total} orders</span>
                              <Badge variant="outline" className="border-0 text-green-500">{adSet.paid} paid</Badge>
                              <Badge variant="outline" className="border-0 text-yellow-500">{adSet.pending} pending</Badge>
                            </div>
                          </div>
                          
                          {/* Creatives */}
                          <div className="ml-6 mt-2 space-y-1">
                            {Array.from(adSet.creatives.entries()).map(([creativeName, creative]) => (
                              <div key={creativeName} className="flex items-center justify-between text-sm py-1">
                                <div className="flex items-center gap-2">
                                  <Palette className="w-3 h-3 text-purple-500" />
                                  <span className="text-slate-400">{creativeName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500">{creative.total}</span>
                                  <span className="text-green-500/70">{creative.paid}p</span>
                                  <span className="text-yellow-500/70">{creative.pending}u</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {campaignArray.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    No campaign data available. Tag orders with campaigns to see analytics.
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
