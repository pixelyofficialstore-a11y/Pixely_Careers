import { useState } from "react";
import { useOrders } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { useUsers } from "@/hooks/use-users";
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
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isPast } from "date-fns";
import { 
  Search, 
  Eye, 
  UserPlus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Package,
  Calendar as CalendarIcon
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function OrdersPage() {
  const { user } = useAuth();
  const { data: orders, isLoading } = useOrders();
  const { data: teamMembers } = useUsers();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());

  if (isLoading) return null;

  const isAdmin = user?.role === "admin";
  const isSupport = user?.role === "support";
  const canSeeFinance = isAdmin || isSupport;

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.clientName.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const todayOrders = filteredOrders?.filter(order => {
    const deadlineDate = new Date(order.deadline);
    return isToday(deadlineDate) || (isPast(deadlineDate) && order.status !== "delivered");
  });

  const monthlyOrders = filteredOrders?.filter(order => {
    return new Date(order.createdAt).getMonth().toString() === selectedMonth;
  });

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      await apiRequest("PATCH", `/api/orders/${orderId}`, { status });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: `Order status updated to ${status}` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const assignDesigner = async (orderId: number, designerId: string) => {
    try {
      await apiRequest("PATCH", `/api/orders/${orderId}`, { assignedToId: parseInt(designerId) });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: "Designer assigned successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign designer", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">New</Badge>;
      case "working": return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Working</Badge>;
      case "ready": return <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">Ready</Badge>;
      case "delivered": return <Badge variant="secondary" className="bg-slate-500/10 text-slate-400 border-slate-500/20">Delivered</Badge>;
      default: return null;
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-white mb-2">Orders Management</h1>
          <p className="text-slate-400">Manage ATS CV, LinkedIn, and Cover Letter requests.</p>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input 
            placeholder="Search Order ID or Client..." 
            className="pl-10 bg-slate-900 border-slate-800 text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Package className="w-5 h-5" /></div>
            <div><p className="text-xs text-slate-500">Total Monthly</p><p className="font-bold text-white">{monthlyOrders?.length || 0}</p></div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500"><CheckCircle2 className="w-5 h-5" /></div>
            <div><p className="text-xs text-slate-500">Delivered</p><p className="font-bold text-white">{monthlyOrders?.filter(o => o.status === 'delivered').length || 0}</p></div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500"><Clock className="w-5 h-5" /></div>
            <div><p className="text-xs text-slate-500">Pending</p><p className="font-bold text-white">{monthlyOrders?.filter(o => o.status !== 'delivered').length || 0}</p></div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500"><TrendingUp className="w-5 h-5" /></div>
            <div><p className="text-xs text-slate-500">Collected</p><p className="font-bold text-white">₨{((monthlyOrders?.reduce((acc, o) => acc + (o.amountPaid || 0), 0) || 0) / 100).toLocaleString()}</p></div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg text-red-500"><AlertCircle className="w-5 h-5" /></div>
            <div><p className="text-xs text-slate-500">Remaining</p><p className="font-bold text-white">₨{((monthlyOrders?.reduce((acc, o) => acc + ((o.price || 0) - (o.amountPaid || 0)), 0) || 0) / 100).toLocaleString()}</p></div>
          </div>
        </div>
      )}

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6">
          <TabsTrigger value="today" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Today's Orders</TabsTrigger>
          <TabsTrigger value="monthly" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Monthly Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Today's Orders</h3>
              <p className="text-sm text-slate-500">Orders received or active today</p>
            </div>
            <Table>
              <TableHeader className="bg-slate-900/50">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Order ID</TableHead>
                  <TableHead className="text-slate-400">Client</TableHead>
                  <TableHead className="text-slate-400">Service</TableHead>
                  <TableHead className="text-slate-400">Designer</TableHead>
                  <TableHead className="text-slate-400">Deadline</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  {canSeeFinance && <TableHead className="text-slate-400">Payment</TableHead>}
                  <TableHead className="text-right text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayOrders?.map((order) => {
                  const isOverdue = isPast(new Date(order.deadline)) && order.status !== 'delivered';
                  return (
                    <TableRow key={order.id} className={cn("border-slate-800 hover:bg-slate-900/50", isOverdue && "bg-red-500/5")}>
                      <TableCell className="font-mono text-xs text-blue-400">{order.orderNumber}</TableCell>
                      <TableCell className="text-white font-medium">{order.clientName}</TableCell>
                      <TableCell className="text-slate-300">{order.serviceType}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400">
                            {order.assignee?.name.charAt(0) || "?"}
                          </div>
                          <span className="text-sm text-slate-300">{order.assignee?.name || "Unassigned"}</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-slate-300", isOverdue && "text-red-400 font-semibold")}>
                        {format(new Date(order.deadline), "MMM dd, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Select defaultValue={order.status} onValueChange={(val) => updateOrderStatus(order.id, val)}>
                          <SelectTrigger className="w-32 bg-transparent border-0 h-auto p-0 focus:ring-0 shadow-none hover:bg-white/5 rounded px-2 py-1">
                            <SelectValue>{getStatusBadge(order.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800">
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="working">Working</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {canSeeFinance && (
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "border-0 px-0",
                            (order.amountPaid || 0) >= (order.price || 0) ? "text-green-500" : "text-yellow-500"
                          )}>
                            {(order.amountPaid || 0) >= (order.price || 0) ? "Paid" : "Pending"}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(isAdmin || isSupport) && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white"><UserPlus className="w-4 h-4" /></Button>
                              </DialogTrigger>
                              <DialogContent className="bg-slate-900 border-slate-800">
                                <DialogHeader><DialogTitle className="text-white font-display">Assign Designer</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                  <Select 
                                    defaultValue={order.assignedToId?.toString()} 
                                    onValueChange={(val) => assignDesigner(order.id, val)}
                                  >
                                    <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                      <SelectValue placeholder="Select designer" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                      {teamMembers?.filter(u => u.role === 'designer').map(designer => (
                                        <SelectItem key={designer.id} value={designer.id.toString()}>{designer.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white"><Eye className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="monthly">
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Monthly Orders</h3>
                <p className="text-sm text-slate-500">All orders for the selected month</p>
              </div>
              
              <div className="flex gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-40 bg-slate-900 border-slate-800 text-white">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>{format(new Date(2026, i, 1), "MMMM")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Table>
              <TableHeader className="bg-slate-900/50">
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400">Order ID</TableHead>
                  <TableHead className="text-slate-400">Client</TableHead>
                  <TableHead className="text-slate-400">Service</TableHead>
                  <TableHead className="text-slate-400">Designer</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  {canSeeFinance && <TableHead className="text-slate-400">Payment</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyOrders?.map((order) => (
                  <TableRow key={order.id} className="border-slate-800">
                    <TableCell className="text-slate-400 text-xs">{format(new Date(order.createdAt), "MMM dd")}</TableCell>
                    <TableCell className="font-mono text-xs text-blue-400">{order.orderNumber}</TableCell>
                    <TableCell className="text-white font-medium">{order.clientName}</TableCell>
                    <TableCell className="text-slate-300">{order.serviceType}</TableCell>
                    <TableCell className="text-slate-300">{order.assignee?.name || "Unassigned"}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    {canSeeFinance && (
                      <TableCell className="text-white">₨{((order.price || 0) / 100).toLocaleString()}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
