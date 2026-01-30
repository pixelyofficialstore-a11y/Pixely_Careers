import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, MessageSquare } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MessageShortcut } from "@shared/schema";

export default function ShortcutsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<MessageShortcut | null>(null);
  const [command, setCommand] = useState("");
  const [content, setContent] = useState("");

  const isAdmin = user?.role === "admin";

  const { data: shortcuts, isLoading } = useQuery<MessageShortcut[]>({
    queryKey: ["/api/shortcuts"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { command: string; content: string }) =>
      apiRequest("POST", "/api/shortcuts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shortcuts"] });
      toast({ title: "Success", description: "Shortcut created" });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { command: string; content: string } }) =>
      apiRequest("PATCH", `/api/shortcuts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shortcuts"] });
      toast({ title: "Success", description: "Shortcut updated" });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/shortcuts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shortcuts"] });
      toast({ title: "Success", description: "Shortcut deleted" });
    },
  });

  const openCreate = () => {
    setEditingShortcut(null);
    setCommand("");
    setContent("");
    setIsDialogOpen(true);
  };

  const openEdit = (shortcut: MessageShortcut) => {
    setEditingShortcut(shortcut);
    setCommand(shortcut.command);
    setContent(shortcut.content);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingShortcut(null);
    setCommand("");
    setContent("");
  };

  const handleSubmit = () => {
    if (!command.trim() || !content.trim()) {
      toast({ title: "Error", description: "Command and content are required", variant: "destructive" });
      return;
    }
    
    if (editingShortcut) {
      updateMutation.mutate({ id: editingShortcut.id, data: { command, content } });
    } else {
      createMutation.mutate({ command, content });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this shortcut?")) {
      deleteMutation.mutate(id);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <p className="text-slate-400 text-center">Only admins can manage message shortcuts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-white">Message Shortcuts</h1>
        </div>
        <Button onClick={openCreate} data-testid="button-add-shortcut">
          <Plus className="w-4 h-4 mr-2" />
          Add Shortcut
        </Button>
      </div>

      <p className="text-slate-400">
        Manage quick message templates. Users can type "/" in chat to access these shortcuts.
      </p>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">All Shortcuts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-500">Loading...</p>
          ) : shortcuts && shortcuts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Command</TableHead>
                  <TableHead className="text-slate-400">Content</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shortcuts.map(shortcut => (
                  <TableRow key={shortcut.id} className="border-slate-800">
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        /{shortcut.command}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300 max-w-md truncate">
                      {shortcut.content}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(shortcut)}
                          data-testid={`button-edit-shortcut-${shortcut.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(shortcut.id)}
                          data-testid={`button-delete-shortcut-${shortcut.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-slate-500 text-center py-8">No shortcuts found. Click "Add Shortcut" to create one.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingShortcut ? "Edit Shortcut" : "Create Shortcut"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Command</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">/</span>
                <Input
                  placeholder="e.g., payment, thanks, welcome"
                  className="bg-slate-800 border-slate-700 text-white"
                  value={command}
                  onChange={(e) => setCommand(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                  data-testid="input-shortcut-command"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Message Content</label>
              <Textarea
                placeholder="The full message that will be inserted when this shortcut is used..."
                className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                data-testid="input-shortcut-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} className="text-slate-400">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-shortcut"
            >
              {editingShortcut ? "Save Changes" : "Create Shortcut"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
