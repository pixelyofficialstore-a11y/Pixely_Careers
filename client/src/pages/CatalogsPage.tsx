import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, ShoppingBag, Image } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Catalog } from "@shared/schema";

export default function CatalogsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");

  const isAdmin = user?.role === "admin";

  const { data: catalogs, isLoading } = useQuery<Catalog[]>({
    queryKey: ["/api/catalogs"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; price: number; imageUrl: string; isActive: boolean; sortOrder: number }) =>
      apiRequest("POST", "/api/catalogs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalogs"] });
      toast({ title: "Success", description: "Catalog item created" });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Catalog> }) =>
      apiRequest("PATCH", `/api/catalogs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalogs"] });
      toast({ title: "Success", description: "Catalog item updated" });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/catalogs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalogs"] });
      toast({ title: "Success", description: "Catalog item deleted" });
    },
  });

  const openCreate = () => {
    setEditingCatalog(null);
    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    setIsActive(true);
    setSortOrder("0");
    setIsDialogOpen(true);
  };

  const openEdit = (catalog: Catalog) => {
    setEditingCatalog(catalog);
    setName(catalog.name);
    setDescription(catalog.description || "");
    setPrice(catalog.price.toString());
    setImageUrl(catalog.imageUrl || "");
    setIsActive(catalog.isActive ?? true);
    setSortOrder((catalog.sortOrder || 0).toString());
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCatalog(null);
    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    setIsActive(true);
    setSortOrder("0");
  };

  const handleSubmit = () => {
    if (!name.trim() || !price.trim()) {
      toast({ title: "Error", description: "Name and price are required", variant: "destructive" });
      return;
    }
    
    const priceNum = parseInt(price, 10);
    if (isNaN(priceNum) || priceNum < 0) {
      toast({ title: "Error", description: "Price must be a valid number", variant: "destructive" });
      return;
    }

    const data = { 
      name: name.trim(), 
      description: description.trim(), 
      price: priceNum, 
      imageUrl: imageUrl.trim(),
      isActive,
      sortOrder: parseInt(sortOrder, 10) || 0
    };
    
    if (editingCatalog) {
      updateMutation.mutate({ id: editingCatalog.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-slate-400">You don't have permission to manage catalogs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Catalog Management</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage service catalog items for WhatsApp
          </p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-catalog">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <ShoppingBag className="w-5 h-5" />
            Catalog Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : !catalogs || catalogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No catalog items yet.</p>
              <p className="text-sm mt-1">Click "Add Item" to create your first catalog entry.</p>
            </div>
          ) : (
            <div className="table-scroll-wrapper">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Price (PKR)</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Order</TableHead>
                    <TableHead className="w-24 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalogs.map((catalog) => (
                    <TableRow key={catalog.id} data-testid={`row-catalog-${catalog.id}`}>
                      <TableCell>
                        {catalog.imageUrl ? (
                          <img 
                            src={catalog.imageUrl} 
                            alt={catalog.name}
                            className="w-12 h-12 object-cover rounded-md"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-slate-700 rounded-md flex items-center justify-center">
                            <Image className="w-6 h-6 text-slate-500" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-slate-100">
                        {catalog.name}
                      </TableCell>
                      <TableCell className="text-slate-400 max-w-xs truncate">
                        {catalog.description || "-"}
                      </TableCell>
                      <TableCell className="text-right text-[#00a884] font-medium">
                        ₨{catalog.price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={catalog.isActive ? "default" : "secondary"}>
                          {catalog.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-slate-400">
                        {catalog.sortOrder}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(catalog)}
                            data-testid={`button-edit-catalog-${catalog.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this catalog item?")) {
                                deleteMutation.mutate(catalog.id);
                              }
                            }}
                            data-testid={`button-delete-catalog-${catalog.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCatalog ? "Edit Catalog Item" : "Add Catalog Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., ATS-Optimized Resume"
                data-testid="input-catalog-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the service..."
                rows={3}
                data-testid="input-catalog-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price (PKR) *</Label>
              <Input
                id="price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g., 5000"
                data-testid="input-catalog-price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                data-testid="input-catalog-image"
              />
              {imageUrl && (
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className="w-20 h-20 object-cover rounded-md mt-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
                data-testid="input-catalog-sort"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="switch-catalog-active"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-catalog"
            >
              {editingCatalog ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
