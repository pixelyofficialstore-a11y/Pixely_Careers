import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Send,
  MoreVertical,
  ArrowLeft,
  Paperclip,
  Check,
  CheckCheck,
  X,
  File,
  LinkIcon,
  ImageIcon,
  CheckCircle,
  Smile,
  RefreshCw,
  MessageSquarePlus,
  Filter,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Chat, Message, User, MessageShortcut, Order } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ChatWithDetails = Chat & {
  messages?: Message[];
  assignee?: User | null;
};

const CHAT_TAGS = ["New", "Working", "Pending", "Changes", "Issues", "Satisfied Client"];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "New": { bg: "bg-blue-600", text: "text-white" },
  "Working": { bg: "bg-purple-600", text: "text-white" },
  "Pending": { bg: "bg-yellow-600", text: "text-white" },
  "Changes": { bg: "bg-orange-600", text: "text-white" },
  "Issues": { bg: "bg-red-600", text: "text-white" },
  "Satisfied Client": { bg: "bg-green-600", text: "text-white" },
};

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
];

function getAvatarColor(name: string) {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export default function WhatsAppPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState<ChatWithDetails | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [showLinkOrderDialog, setShowLinkOrderDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin";
  const isSupport = user?.role === "support";
  const isDesigner = user?.role === "designer";

  const { data: chats, isLoading } = useQuery<ChatWithDetails[]>({
    queryKey: ["/api/chats"],
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["/api/chats", selectedChat?.id, "messages"],
    enabled: !!selectedChat,
    refetchInterval: 3000,
    placeholderData: keepPreviousData,
  });

  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: shortcuts } = useQuery<MessageShortcut[]>({
    queryKey: ["/api/shortcuts"],
  });

  const { data: orders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const linkedOrder = orders?.find(o => o.id === selectedChat?.linkedOrderId);
  const designers = teamMembers?.filter(u => u.role === "designer") || [];

  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, content, file }: { chatId: number; content: string; file?: File }) => {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("content", content);
        return fetch(`/api/chats/${chatId}/messages/upload`, {
          method: "POST",
          body: formData,
          credentials: "include",
        }).then(res => res.json());
      }
      return apiRequest("POST", `/api/chats/${chatId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats", selectedChat?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setMessageText("");
      setSelectedFile(null);
      setShowShortcuts(false);
    },
  });

  const updateChatMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Chat> }) => {
      return apiRequest("PATCH", `/api/chats/${id}`, updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      if (selectedChat && variables.id === selectedChat.id) {
        setSelectedChat(prev => prev ? { ...prev, ...variables.updates } : null);
      }
      toast({ title: "Updated", description: "Chat updated successfully" });
    },
  });

  const handleLinkOrder = (orderId: number) => {
    if (!selectedChat) return;
    updateChatMutation.mutate({
      id: selectedChat.id,
      updates: { linkedOrderId: orderId }
    });
    setShowLinkOrderDialog(false);
  };

  const handleUnlinkOrder = () => {
    if (!selectedChat) return;
    updateChatMutation.mutate({
      id: selectedChat.id,
      updates: { linkedOrderId: null }
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedChat && chats) {
      const updated = chats.find(c => c.id === selectedChat.id);
      if (updated) {
        setSelectedChat(updated);
      }
    }
  }, [chats]);

  const handleSend = () => {
    if ((!messageText.trim() && !selectedFile) || !selectedChat) return;
    sendMessageMutation.mutate({ 
      chatId: selectedChat.id, 
      content: messageText,
      file: selectedFile || undefined
    });
  };

  const handleShortcut = (shortcut: MessageShortcut) => {
    setMessageText(shortcut.content);
    setShowShortcuts(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageText(value);
    setShowShortcuts(value.startsWith("/") || value.startsWith("//"));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      setShowShortcuts(false);
    }
  };

  const handleAssign = (designerId: number) => {
    if (!selectedChat) return;
    updateChatMutation.mutate({ 
      id: selectedChat.id, 
      updates: { assignedToId: designerId } 
    });
  };

  const handleSetTag = (newTag: string) => {
    if (!selectedChat) return;
    
    const updates: Partial<Chat> = { tags: [newTag] };
    
    if (newTag === "Satisfied Client" && isDesigner) {
      updates.assignedToId = null;
      toast({ 
        title: "Chat Completed", 
        description: "Chat marked as satisfied and unassigned. Great work!" 
      });
    }
    
    updateChatMutation.mutate({ 
      id: selectedChat.id, 
      updates
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const getDisplayName = (chat: ChatWithDetails) => {
    if (chat.clientName && chat.clientName !== "New Lead" && chat.clientName.trim() !== "") {
      return chat.clientName;
    }
    return chat.clientPhone || "Unknown";
  };

  const filteredChats = chats?.filter(chat => {
    if (chat.isInternal) return false;
    if (isDesigner && chat.assignedToId !== user?.id) return false;
    if (filterTag && !(chat.tags as string[] || []).includes(filterTag)) return false;
    if (search) {
      const name = getDisplayName(chat).toLowerCase();
      return name.includes(search.toLowerCase()) || chat.clientPhone?.includes(search);
    }
    return true;
  });

  const filteredShortcuts = shortcuts?.filter(s => {
    const searchTerm = messageText.replace(/^\/+/, "").toLowerCase();
    return s.command.toLowerCase().includes(searchTerm);
  });

  if (isLoading) return null;

  return (
    <div className="flex h-screen w-full" style={{ backgroundColor: "#0b141a" }}>
      {/* Left Sidebar - Chat List */}
      <div 
        className="w-[420px] min-w-[300px] max-w-[420px] flex flex-col border-r"
        style={{ backgroundColor: "#111b21", borderColor: "#222d34" }}
      >
        {/* Header */}
        <div 
          className="h-14 px-4 flex items-center justify-between"
          style={{ backgroundColor: "#202c33" }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#2a3942" }}
            >
              <span className="text-slate-300 font-medium">
                {user?.name?.charAt(0) || "U"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-full hover:bg-white/5 text-slate-400">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-white/5 text-slate-400">
              <MessageSquarePlus className="w-5 h-5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-full hover:bg-white/5 text-slate-400">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56"
                style={{ backgroundColor: "#233138", borderColor: "#233138" }}
              >
                <DropdownMenuItem className="text-slate-200 hover:bg-white/5 cursor-pointer">
                  New group
                </DropdownMenuItem>
                <DropdownMenuItem className="text-slate-200 hover:bg-white/5 cursor-pointer">
                  Starred messages
                </DropdownMenuItem>
                <DropdownMenuItem className="text-slate-200 hover:bg-white/5 cursor-pointer">
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2" style={{ backgroundColor: "#111b21" }}>
          <div className="flex items-center gap-3">
            <div 
              className="flex-1 flex items-center gap-4 px-3 py-2 rounded-lg"
              style={{ backgroundColor: "#202c33" }}
            >
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search or start a new chat"
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-chats"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className={cn(
                    "p-2 rounded-full hover:bg-white/5",
                    filterTag ? "text-green-500" : "text-slate-400"
                  )}
                >
                  <Filter className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end"
                style={{ backgroundColor: "#233138", borderColor: "#233138" }}
              >
                <DropdownMenuItem 
                  className={cn(
                    "text-slate-200 hover:bg-white/5 cursor-pointer",
                    !filterTag && "bg-white/10"
                  )}
                  onClick={() => setFilterTag(null)}
                >
                  All Chats
                </DropdownMenuItem>
                <DropdownMenuSeparator style={{ backgroundColor: "#2a3942" }} />
                {CHAT_TAGS.map(tag => (
                  <DropdownMenuItem
                    key={tag}
                    className={cn(
                      "text-slate-200 hover:bg-white/5 cursor-pointer flex items-center gap-2",
                      filterTag === tag && "bg-white/10"
                    )}
                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                  >
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: TAG_COLORS[tag]?.bg.replace("bg-", "#").replace("-600", "") }}
                    />
                    {tag}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="py-1">
            {filteredChats?.map(chat => {
              const displayName = getDisplayName(chat);
              const isSelected = selectedChat?.id === chat.id;
              const unreadCount = chat.unreadCount || 0;
              const primaryTag = (chat.tags as string[] || [])[0];
              
              return (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors",
                    isSelected && "bg-white/10"
                  )}
                  style={{ borderBottom: "1px solid #222d34" }}
                  data-testid={`chat-item-${chat.id}`}
                >
                  {/* Avatar */}
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg flex-shrink-0"
                    style={{ backgroundColor: getAvatarColor(displayName) }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white font-normal text-base truncate">
                        {displayName}
                      </span>
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {chat.lastMessageAt ? format(new Date(chat.lastMessageAt), "HH:mm") : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <CheckCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-sm text-slate-400 truncate">
                          {chat.lastMessage || "No messages"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {primaryTag && (
                          <span 
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium",
                              TAG_COLORS[primaryTag]?.bg,
                              TAG_COLORS[primaryTag]?.text
                            )}
                          >
                            {primaryTag}
                          </span>
                        )}
                        {unreadCount > 0 && (
                          <span 
                            className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-xs font-medium text-white"
                            style={{ backgroundColor: "#00a884" }}
                          >
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {(!filteredChats || filteredChats.length === 0) && (
              <div className="text-center py-12">
                <p className="text-slate-500">No chats found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: "#0b141a" }}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div 
              className="h-14 px-4 flex items-center justify-between"
              style={{ backgroundColor: "#202c33" }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                  style={{ backgroundColor: getAvatarColor(getDisplayName(selectedChat)) }}
                >
                  {getDisplayName(selectedChat).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-white font-medium">{getDisplayName(selectedChat)}</h3>
                  <p className="text-xs text-slate-400">{selectedChat.clientPhone}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {(isAdmin || isSupport) && (
                  <Select
                    value={selectedChat.assignedToId?.toString() || ""}
                    onValueChange={(val) => handleAssign(Number(val))}
                  >
                    <SelectTrigger 
                      className="w-auto h-8 border-0 text-slate-300 text-xs gap-1 px-2"
                      style={{ backgroundColor: "#2a3942" }}
                    >
                      <SelectValue placeholder="Assign" />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: "#233138", borderColor: "#233138" }}>
                      {designers.map(d => (
                        <SelectItem key={d.id} value={d.id.toString()} className="text-slate-300 text-sm">
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 rounded-full hover:bg-white/5 text-slate-400">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-56"
                    style={{ backgroundColor: "#233138", borderColor: "#233138" }}
                  >
                    <DropdownMenuItem 
                      className="text-slate-200 hover:bg-white/5 cursor-pointer"
                      onClick={() => {
                        if (selectedChat?.clientPhone) {
                          navigator.clipboard.writeText(selectedChat.clientPhone);
                          toast({ title: "Copied", description: "Phone number copied" });
                        }
                      }}
                    >
                      Copy phone number
                    </DropdownMenuItem>
                    <DropdownMenuSeparator style={{ backgroundColor: "#2a3942" }} />
                    
                    {/* Tags submenu */}
                    {CHAT_TAGS.map(tag => {
                      const isActive = (selectedChat.tags as string[] || []).includes(tag);
                      return (
                        <DropdownMenuItem 
                          key={tag}
                          className="text-slate-200 hover:bg-white/5 cursor-pointer flex items-center justify-between"
                          onClick={() => handleSetTag(tag)}
                        >
                          <span>{tag}</span>
                          {isActive && <Check className="w-4 h-4 text-green-500" />}
                        </DropdownMenuItem>
                      );
                    })}
                    
                    <DropdownMenuSeparator style={{ backgroundColor: "#2a3942" }} />
                    
                    {linkedOrder ? (
                      <>
                        <DropdownMenuItem 
                          className="text-slate-200 hover:bg-white/5 cursor-pointer"
                          onClick={() => setShowOrderPanel(true)}
                        >
                          View linked order
                        </DropdownMenuItem>
                        {(isAdmin || isSupport) && (
                          <DropdownMenuItem 
                            className="text-slate-200 hover:bg-white/5 cursor-pointer"
                            onClick={handleUnlinkOrder}
                          >
                            Unlink order
                          </DropdownMenuItem>
                        )}
                      </>
                    ) : (isAdmin || isSupport) ? (
                      <DropdownMenuItem 
                        className="text-slate-200 hover:bg-white/5 cursor-pointer"
                        onClick={() => setShowLinkOrderDialog(true)}
                      >
                        Link to order
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea 
              className="flex-1 px-16 py-4"
              style={{ 
                backgroundImage: "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAAUVBMVEWFhYWDg4N3d3dtbW17e3t1dXWBgYGHh4d5eXlzc3Oeli5Reli5ReijReli5Reli5Reli5Reli5Reli5Reli5Reli5Reli5VVVV2dnZ4eHg/P38teleY1CulAAAAG3RSTlNAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAvEOwtAAABaklEQVR4AeXPW3KDMAwF0JvYJrYx75f9L7SjH1lpM/0w7Ug+T3eCEPR7aQYRSKbR8eXl+Hd6PWoNDowAP0+a2ZpJk0afJz1t1Zc0afJF0tPZRv0kfZ50tdZ+AAAA')",
                backgroundColor: "#0b141a" 
              }}
            >
              <div className="space-y-2 max-w-3xl mx-auto">
                {messages?.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div 
              className="px-4 py-3"
              style={{ backgroundColor: "#202c33" }}
            >
              {showShortcuts && filteredShortcuts && filteredShortcuts.length > 0 && (
                <div 
                  className="absolute bottom-20 left-4 right-4 rounded-lg border overflow-hidden shadow-xl"
                  style={{ backgroundColor: "#233138", borderColor: "#2a3942" }}
                >
                  <div className="max-h-40 overflow-y-auto">
                    {filteredShortcuts.map(shortcut => (
                      <button
                        key={shortcut.id}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3"
                        onClick={() => handleShortcut(shortcut)}
                        data-testid={`shortcut-${shortcut.command}`}
                      >
                        <span className="text-green-400 font-medium">/{shortcut.command}</span>
                        <span className="text-slate-400 text-sm truncate">{shortcut.content.substring(0, 50)}...</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedFile && (
                <div 
                  className="mb-2 p-2 rounded-lg flex items-center gap-2 max-w-xs"
                  style={{ backgroundColor: "#2a3942" }}
                >
                  {selectedFile.type.startsWith("image/") ? (
                    <ImageIcon className="w-5 h-5 text-slate-400" />
                  ) : (
                    <File className="w-5 h-5 text-slate-400" />
                  )}
                  <span className="text-sm text-slate-300 truncate flex-1">{selectedFile.name}</span>
                  <button 
                    className="p-1 hover:bg-white/10 rounded"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <button 
                  className="p-2 rounded-full hover:bg-white/5 text-slate-400"
                  data-testid="button-emoji"
                >
                  <Smile className="w-6 h-6" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx"
                />
                <button 
                  className="p-2 rounded-full hover:bg-white/5 text-slate-400"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-attach-file"
                >
                  <Paperclip className="w-6 h-6" />
                </button>
                <div className="flex-1">
                  <Textarea
                    ref={inputRef}
                    placeholder="Type a message"
                    className="border-0 text-white resize-none min-h-[40px] max-h-32 text-sm rounded-lg"
                    style={{ backgroundColor: "#2a3942" }}
                    value={messageText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    data-testid="input-message"
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={(!messageText.trim() && !selectedFile) || sendMessageMutation.isPending}
                  className="p-2 rounded-full hover:bg-white/5 text-slate-400 disabled:opacity-50"
                  data-testid="button-send-message"
                >
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* WhatsApp Web Intro Screen */
          <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: "#222e35" }}>
            <div className="text-center max-w-md">
              {/* Illustration */}
              <div className="mb-8 relative">
                <div className="flex items-center justify-center gap-8">
                  {/* Laptop Icon */}
                  <div className="relative">
                    <div 
                      className="w-32 h-24 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: "#233138", border: "2px solid #2a3942" }}
                    >
                      <div className="w-8 h-6 rounded" style={{ backgroundColor: "#00a884" }} />
                    </div>
                    <div 
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-2 rounded-b-lg"
                      style={{ backgroundColor: "#233138" }}
                    />
                  </div>
                  
                  {/* Phone Icon */}
                  <div 
                    className="w-12 h-20 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "#233138", border: "2px solid #2a3942" }}
                  >
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#00a884" }}>
                      <Check className="w-4 h-4 text-white p-0.5" />
                    </div>
                  </div>
                </div>
              </div>
              
              <h1 className="text-3xl font-light text-slate-200 mb-4">WhatsApp Web</h1>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                Send and receive messages without keeping your phone online.<br />
                Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
              </p>
              
              <p className="text-sm text-slate-500">
                Built by <span style={{ color: "#00a884" }}>Jazim Abbas</span> <span className="text-red-400">❤</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Link Order Dialog */}
      <Dialog open={showLinkOrderDialog} onOpenChange={setShowLinkOrderDialog}>
        <DialogContent 
          className="border max-w-md"
          style={{ backgroundColor: "#233138", borderColor: "#2a3942" }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Link to Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {orders?.filter(o => o.advancePaymentStatus === "approved").map(order => (
              <button
                key={order.id}
                className="w-full text-left p-3 rounded-lg transition-colors hover:bg-white/5"
                style={{ backgroundColor: "#2a3942" }}
                onClick={() => handleLinkOrder(order.id)}
                data-testid={`link-order-${order.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{order.orderNumber || `Order #${order.id}`}</span>
                  <Badge 
                    variant="outline" 
                    className="text-xs border-slate-600 text-slate-300"
                  >
                    {order.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-400 mt-1">{order.clientName}</p>
              </button>
            ))}
            {(!orders || orders.filter(o => o.advancePaymentStatus === "approved").length === 0) && (
              <p className="text-center text-slate-400 py-4">No orders available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Panel */}
      <Dialog open={showOrderPanel} onOpenChange={setShowOrderPanel}>
        <DialogContent 
          className="border max-w-lg"
          style={{ backgroundColor: "#233138", borderColor: "#2a3942" }}
        >
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <LinkIcon className="w-5 h-5" style={{ color: "#00a884" }} />
              Linked Order Details
            </DialogTitle>
          </DialogHeader>
          {linkedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Order ID</p>
                  <p className="font-medium text-white">{linkedOrder.orderNumber || `#${linkedOrder.id}`}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Status</p>
                  <Badge className="capitalize">{linkedOrder.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Client</p>
                  <p className="font-medium text-white">{linkedOrder.clientName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Phone</p>
                  <p className="font-medium text-white">{linkedOrder.clientPhone || "—"}</p>
                </div>
                {isAdmin && (
                  <>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Total Price</p>
                      <p className="font-medium text-white">₨{((linkedOrder.totalPrice || 0) / 100).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Payment Status</p>
                      <Badge variant={linkedOrder.paymentStatus === "paid" ? "default" : "secondary"}>
                        {linkedOrder.paymentStatus}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-4" style={{ borderTop: "1px solid #2a3942" }}>
                <Button 
                  variant="outline" 
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-white/5"
                  onClick={() => {
                    setShowOrderPanel(false);
                    window.location.href = "/orders";
                  }}
                  data-testid="button-go-to-orders"
                >
                  Go to Orders
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.senderType === "user";
  const isSystem = message.messageType === "system";
  
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div 
          className="px-3 py-1 rounded-lg text-xs"
          style={{ backgroundColor: "#182229", color: "#8696a0" }}
        >
          {message.content}
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className="max-w-[65%] rounded-lg px-3 py-2 shadow-sm"
        style={{ 
          backgroundColor: isUser ? "#005c4b" : "#202c33",
        }}
      >
        {message.messageType === "file" && message.fileUrl && (
          <div className="mb-2">
            <img 
              src={message.fileUrl} 
              alt={message.fileName || "Attachment"} 
              className="rounded-lg max-w-full"
            />
          </div>
        )}
        <p className="text-sm text-slate-100 whitespace-pre-wrap">{message.content}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[11px]" style={{ color: "#8696a0" }}>
            {format(new Date(message.createdAt!), "HH:mm")}
          </span>
          {isUser && (
            <CheckCheck className="w-4 h-4" style={{ color: "#53bdeb" }} />
          )}
        </div>
      </div>
    </div>
  );
}
