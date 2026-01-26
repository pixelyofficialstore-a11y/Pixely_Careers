import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { format, isToday, isPast, startOfMonth } from "date-fns";
import { 
  Search, 
  Eye, 
  UserPlus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Package,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { OrderWithServices, User } from "@shared/schema";

const SERVICE_TYPES = [
  "ATS CV",
  "Professional CV", 
  "Europass CV",
  "LinkedIn Profile",
  "Cover Letter (ATS)",
  "Cover Letter (Professional)",
  "Cover Letter (Europass)",
];

export default function OrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: orders, isLoading } = useQuery<OrderWithServices[]>({
    queryKey: ["/api/orders"],
  });

  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      return apiRequest("PATCH", `/api/orders/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: "Order updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update order", variant: "destructive" });
    },
  });

  if (isLoading) return null;

  const isAdmin = user?.role === "admin";
  const isSupport = user?.role === "support";
  const canSeeFinance = isAdmin;
  const canSeePaymentStatus = isAdmin || isSupport;
  const canCreateOrder = isAdmin || isSupport;

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.clientName.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const todayOrders = filteredOrders?.filter(order => {
    const createdDate = new Date(order.createdAt!);
    const deadlineDate = new Date(order.deadline);
    return isToday(createdDate) || isToday(deadlineDate) || (isPast(deadlineDate) && order.status !== "delivered");
  });

  const monthlyOrders = filteredOrders?.filter(order => {
    return new Date(order.createdAt!).getMonth().toString() === selectedMonth;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">New</Badge>;
      case "working": return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Working</Badge>;
      case "ready": return <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">Ready</Badge>;
      case "delivered": return <Badge variant="secondary" className="bg-slate-500/10 text-slate-400 border-slate-500/20">Delivered</Badge>;
      default: return null;
    }
  };

  const getServicesDisplay = (services: any[]) => {
    if (!services || services.length === 0) return "-";
    return services.map(s => `${s.quantity}x ${s.serviceType}`).join(", ");
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-white mb-2">Orders Management</h1>
          <p className="text-slate-400">Manage ATS CV, LinkedIn, and Cover Letter requests.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input 
              placeholder="Search Order ID or Client..." 
              className="pl-10 bg-slate-900 border-slate-800 text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-orders"
            />
          </div>
          
          {canCreateOrder && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary" data-testid="button-create-order">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Order
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-white font-display text-xl">Create New Order</DialogTitle>
                </DialogHeader>
                <CreateOrderForm 
                  designers={teamMembers?.filter(u => u.role === 'designer') || []} 
                  onSuccess={() => setCreateDialogOpen(false)} 
                />
              </DialogContent>
            </Dialog>
          )}
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
            <div><p className="text-xs text-slate-500">Remaining</p><p className="font-bold text-white">₨{((monthlyOrders?.reduce((acc, o) => acc + ((o.totalPrice || 0) - (o.amountPaid || 0)), 0) || 0) / 100).toLocaleString()}</p></div>
          </div>
        </div>
      )}

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6">
          <TabsTrigger value="today" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-today-orders">Today's Orders</TabsTrigger>
          <TabsTrigger value="monthly" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-monthly-orders">Monthly Orders</TabsTrigger>
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
                  <TableHead className="text-slate-400">Services</TableHead>
                  <TableHead className="text-slate-400">Designer</TableHead>
                  <TableHead className="text-slate-400">Deadline</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  {canSeePaymentStatus && <TableHead className="text-slate-400">Payment</TableHead>}
                  <TableHead className="text-right text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayOrders?.map((order) => {
                  const isOverdue = isPast(new Date(order.deadline)) && order.status !== 'delivered';
                  return (
                    <TableRow key={order.id} className={cn("border-slate-800 hover:bg-slate-900/50", isOverdue && "bg-red-500/5")} data-testid={`row-order-${order.id}`}>
                      <TableCell className="font-mono text-xs text-blue-400">{order.orderNumber}</TableCell>
                      <TableCell className="text-white font-medium">{order.clientName}</TableCell>
                      <TableCell className="text-slate-300 text-sm max-w-[200px] truncate">{getServicesDisplay(order.services)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400">
                            {order.assignee?.name?.charAt(0) || "?"}
                          </div>
                          <span className="text-sm text-slate-300">{order.assignee?.name || "Unassigned"}</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-slate-300", isOverdue && "text-red-400 font-semibold")}>
                        {format(new Date(order.deadline), "MMM dd, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Select 
                          defaultValue={order.status} 
                          onValueChange={(val) => updateOrderMutation.mutate({ id: order.id, updates: { status: val } })}
                        >
                          <SelectTrigger className="w-32 bg-transparent border-0 h-auto p-0 focus:ring-0 shadow-none hover:bg-white/5 rounded px-2 py-1" data-testid={`select-status-${order.id}`}>
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
                      {canSeePaymentStatus && (
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "border-0 px-0",
                            order.paymentStatus === 'paid' ? "text-green-500" : "text-yellow-500"
                          )}>
                            {order.paymentStatus === 'paid' ? "Paid" : "Pending"}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(isAdmin || isSupport) && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" data-testid={`button-assign-${order.id}`}><UserPlus className="w-4 h-4" /></Button>
                              </DialogTrigger>
                              <DialogContent className="bg-slate-900 border-slate-800">
                                <DialogHeader><DialogTitle className="text-white font-display">Assign Designer</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                  <Select 
                                    defaultValue={order.assignedToId?.toString()} 
                                    onValueChange={(val) => updateOrderMutation.mutate({ id: order.id, updates: { assignedToId: parseInt(val) } })}
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" data-testid={`button-view-${order.id}`}><Eye className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!todayOrders || todayOrders.length === 0) && (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={canSeePaymentStatus ? 8 : 7} className="text-center text-slate-500 py-8">
                      No orders for today
                    </TableCell>
                  </TableRow>
                )}
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
                  <SelectTrigger className="w-40 bg-slate-900 border-slate-800 text-white" data-testid="select-month">
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
                  <TableHead className="text-slate-400">Services</TableHead>
                  <TableHead className="text-slate-400">Designer</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  {canSeePaymentStatus && <TableHead className="text-slate-400">Payment</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyOrders?.map((order) => (
                  <TableRow key={order.id} className="border-slate-800" data-testid={`row-monthly-order-${order.id}`}>
                    <TableCell className="text-slate-400 text-xs">{format(new Date(order.createdAt!), "MMM dd")}</TableCell>
                    <TableCell className="font-mono text-xs text-blue-400">{order.orderNumber}</TableCell>
                    <TableCell className="text-white font-medium">{order.clientName}</TableCell>
                    <TableCell className="text-slate-300 text-sm">{getServicesDisplay(order.services)}</TableCell>
                    <TableCell className="text-slate-300">{order.assignee?.name || "Unassigned"}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    {canSeePaymentStatus && (
                      <TableCell>
                        <Badge variant="outline" className={cn("border-0", order.paymentStatus === 'paid' ? "text-green-500" : "text-yellow-500")}>
                          {order.paymentStatus === 'paid' ? "Paid" : "Pending"}
                        </Badge>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {(!monthlyOrders || monthlyOrders.length === 0) && (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={canSeePaymentStatus ? 7 : 6} className="text-center text-slate-500 py-8">
                      No orders for this month
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateOrderForm({ designers, onSuccess }: { designers: User[]; onSuccess: () => void }) {
  const { toast } = useToast();
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [services, setServices] = useState([{ serviceType: "", quantity: 1, instructions: "" }]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Success", description: "Order created successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create order", variant: "destructive" });
    },
  });

  const addService = () => {
    setServices([...services, { serviceType: "", quantity: 1, instructions: "" }]);
  };

  const removeService = (index: number) => {
    if (services.length > 1) {
      setServices(services.filter((_, i) => i !== index));
    }
  };

  const updateService = (index: number, field: string, value: any) => {
    const updated = [...services];
    (updated[index] as any)[field] = value;
    setServices(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const missingFields: string[] = [];
    if (!clientName.trim()) missingFields.push("Client Name");
    if (!clientPhone.trim()) missingFields.push("WhatsApp Number");
    if (!deadline) missingFields.push("Expected Delivery");
    if (services.every(s => !s.serviceType)) missingFields.push("At least one service");
    
    if (missingFields.length > 0) {
      toast({ 
        title: "Missing Fields", 
        description: `Please fill: ${missingFields.join(", ")}`, 
        variant: "destructive" 
      });
      return;
    }

    createMutation.mutate({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim() || null,
      deadline: new Date(deadline).toISOString(),
      assignedToId: assignedToId ? parseInt(assignedToId) : null,
      paymentStatus,
      notes: notes.trim() || null,
      services: services.filter(s => s.serviceType).map(s => ({
        serviceType: s.serviceType,
        quantity: s.quantity || 1,
        instructions: s.instructions || null,
      })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Client Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Client Name *</Label>
            <Input 
              value={clientName} 
              onChange={(e) => setClientName(e.target.value)} 
              className="bg-slate-950 border-slate-800 text-white"
              placeholder="Enter client name"
              data-testid="input-client-name"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">WhatsApp Number *</Label>
            <Input 
              value={clientPhone} 
              onChange={(e) => setClientPhone(e.target.value)} 
              className="bg-slate-950 border-slate-800 text-white"
              placeholder="+92 300 1234567"
              data-testid="input-client-phone"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Email (Optional)</Label>
          <Input 
            value={clientEmail} 
            onChange={(e) => setClientEmail(e.target.value)} 
            className="bg-slate-950 border-slate-800 text-white"
            placeholder="client@email.com"
            type="email"
            data-testid="input-client-email"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Order Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Expected Delivery *</Label>
            <Input 
              type="datetime-local" 
              value={deadline} 
              onChange={(e) => setDeadline(e.target.value)} 
              className="bg-slate-950 border-slate-800 text-white"
              data-testid="input-deadline"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Assigned Designer</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-white" data-testid="select-designer">
                <SelectValue placeholder="Select designer" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {designers.map(d => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Services</h4>
          <Button type="button" variant="ghost" size="sm" onClick={addService} className="text-blue-400 hover:text-blue-300" data-testid="button-add-service">
            <Plus className="w-4 h-4 mr-1" /> Add Service
          </Button>
        </div>
        
        {services.map((service, index) => (
          <div key={index} className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Service {index + 1}</span>
              {services.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)} className="h-6 w-6 text-red-400 hover:text-red-300" data-testid={`button-remove-service-${index}`}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Select value={service.serviceType} onValueChange={(val) => updateService(index, 'serviceType', val)}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white" data-testid={`select-service-type-${index}`}>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {SERVICE_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input 
                  type="number" 
                  min="1" 
                  value={service.quantity} 
                  onChange={(e) => updateService(index, 'quantity', parseInt(e.target.value) || 1)} 
                  className="bg-slate-900 border-slate-700 text-white"
                  placeholder="Qty"
                  data-testid={`input-quantity-${index}`}
                />
              </div>
            </div>
            <Textarea 
              value={service.instructions} 
              onChange={(e) => updateService(index, 'instructions', e.target.value)} 
              className="bg-slate-900 border-slate-700 text-white resize-none"
              placeholder="Special instructions for this service..."
              rows={2}
              data-testid={`input-instructions-${index}`}
            />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Payment</h4>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="bg-slate-950 border-slate-800 text-white w-40" data-testid="select-payment-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-white">
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Internal Notes</Label>
        <Textarea 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)} 
          className="bg-slate-950 border-slate-800 text-white resize-none"
          placeholder="Add any internal notes..."
          rows={3}
          data-testid="input-notes"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
        <Button type="submit" className="bg-primary" disabled={createMutation.isPending} data-testid="button-submit-order">
          {createMutation.isPending ? "Creating..." : "Create Order"}
        </Button>
      </div>
    </form>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
