import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  MoreHorizontal,
  MessageSquare,
  ExternalLink,
  Copy,
  Share2,
  ChevronDown,
  CheckCircle,
  Paperclip,
  Check,
  X,
  Image,
  File,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Chat, Message, User, MessageShortcut } from "@shared/schema";
import { cn } from "@/lib/utils";

type ChatWithDetails = Chat & {
  messages?: Message[];
  assignee?: User | null;
};

const CHAT_TAGS = ["New", "Changes", "Satisfied", "Issues"];

const TAG_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "New": { bg: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-500" },
  "New Inquiry": { bg: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-500" },
  "Changes": { bg: "bg-yellow-500/20", text: "text-yellow-400", dot: "bg-yellow-500" },
  "Satisfied": { bg: "bg-green-500/20", text: "text-green-400", dot: "bg-green-500" },
  "Issues": { bg: "bg-red-500/20", text: "text-red-400", dot: "bg-red-500" },
  "Issue": { bg: "bg-red-500/20", text: "text-red-400", dot: "bg-red-500" },
  "Pending Payment": { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-500" },
  "Urgent": { bg: "bg-orange-500/20", text: "text-orange-400", dot: "bg-orange-500" },
};

const AVATAR_COLORS = [
  "bg-purple-600",
  "bg-blue-600",
  "bg-green-600",
  "bg-orange-600",
  "bg-pink-600",
  "bg-cyan-600",
];

function getAvatarColor(name: string) {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export default function ChatsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState<ChatWithDetails | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDesignerFilter, setSelectedDesignerFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin";
  const isSupport = user?.role === "support";
  const isDesigner = user?.role === "designer";

  const { data: chats, isLoading } = useQuery<ChatWithDetails[]>({
    queryKey: ["/api/chats"],
    refetchInterval: 5000, // Poll every 5 seconds for real-time sync
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["/api/chats", selectedChat?.id, "messages"],
    enabled: !!selectedChat,
    refetchInterval: 3000, // Poll messages more frequently
  });

  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: shortcuts } = useQuery<MessageShortcut[]>({
    queryKey: ["/api/shortcuts"],
  });

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
    updateChatMutation.mutate({ 
      id: selectedChat.id, 
      updates: { tags: [newTag] } 
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const copyPhoneNumber = () => {
    if (selectedChat?.clientPhone) {
      navigator.clipboard.writeText(selectedChat.clientPhone);
      toast({ title: "Copied", description: "Phone number copied" });
    }
  };

  // Show phone number instead of "New Lead" placeholder
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

  const newMessageChats = filteredChats?.filter(c => (c.unreadCount || 0) > 0);
  
  // Group chats by designer for "By Designer" tab
  const designerGroups = (() => {
    if (!isAdmin && !isSupport) return [];
    const groups: { designer: User | null; chats: ChatWithDetails[] }[] = [];
    const assignedDesignerIds = new Set<number>();
    
    filteredChats?.forEach(chat => {
      if (chat.assignedToId) {
        assignedDesignerIds.add(chat.assignedToId);
      }
    });
    
    // Add groups for each designer with assigned chats
    designers.forEach(d => {
      const designerChats = filteredChats?.filter(c => c.assignedToId === d.id) || [];
      if (designerChats.length > 0) {
        groups.push({ designer: d, chats: designerChats });
      }
    });
    
    // Add unassigned group
    const unassignedChats = filteredChats?.filter(c => !c.assignedToId) || [];
    if (unassignedChats.length > 0) {
      groups.push({ designer: null, chats: unassignedChats });
    }
    
    return groups;
  })();

  const getTagStyle = (tag: string) => TAG_COLORS[tag] || TAG_COLORS["New"];

  const filteredShortcuts = shortcuts?.filter(s => {
    const searchTerm = messageText.replace(/^\/+/, "").toLowerCase();
    return s.command.toLowerCase().includes(searchTerm);
  });

  if (isLoading) return null;

  return (
    <div className="flex h-full w-full bg-slate-950">
      {/* Left Sidebar - Chat List */}
      <div className="w-72 lg:w-80 min-w-[260px] max-w-[320px] border-r border-slate-800 flex flex-col bg-slate-950 flex-shrink-0">
        {/* Header */}
        <div className="p-3 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-white">Chats</h2>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search by name, number, or order ID"
              className="pl-10 bg-slate-900 border-slate-700 text-white text-sm h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-chats"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-3 border-b border-slate-800">
            <TabsList className="bg-slate-800/50 p-1 h-auto w-full grid grid-cols-3 gap-1">
              <TabsTrigger 
                value="all" 
                className="px-2 py-2 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white rounded"
                data-testid="tab-all-chats"
              >
                All Chats
              </TabsTrigger>
              <TabsTrigger 
                value="new" 
                className="px-2 py-2 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white rounded"
                data-testid="tab-new-messages"
              >
                New {newMessageChats && newMessageChats.length > 0 && `(${newMessageChats.length})`}
              </TabsTrigger>
              {(isAdmin || isSupport) && (
                <TabsTrigger 
                  value="designers" 
                  className="px-2 py-2 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white rounded"
                  data-testid="tab-by-designer"
                >
                  By Designer
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="all" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {filteredChats?.map(chat => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isSelected={selectedChat?.id === chat.id}
                    onClick={() => setSelectedChat(chat)}
                    getTagStyle={getTagStyle}
                    getDisplayName={getDisplayName}
                  />
                ))}
                {(!filteredChats || filteredChats.length === 0) && (
                  <p className="text-slate-500 text-center py-8 text-sm">No chats found</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="new" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {newMessageChats?.map(chat => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isSelected={selectedChat?.id === chat.id}
                    onClick={() => setSelectedChat(chat)}
                    getTagStyle={getTagStyle}
                    getDisplayName={getDisplayName}
                  />
                ))}
                {(!newMessageChats || newMessageChats.length === 0) && (
                  <p className="text-slate-500 text-center py-8 text-sm">No new messages</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {(isAdmin || isSupport) && (
            <TabsContent value="designers" className="flex-1 m-0 overflow-hidden flex flex-col">
              {/* Designer Filter Dropdown */}
              <div className="p-2 border-b border-slate-800">
                <Select
                  value={selectedDesignerFilter}
                  onValueChange={setSelectedDesignerFilter}
                >
                  <SelectTrigger className="w-full h-9 bg-slate-800 border-slate-700 text-slate-300 text-sm" data-testid="select-designer-filter">
                    <SelectValue placeholder="Select Designer" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="all" className="text-slate-300 text-sm">All Designers</SelectItem>
                    {designers.map(d => (
                      <SelectItem key={d.id} value={d.id.toString()} className="text-slate-300 text-sm">
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-3">
                  {designerGroups
                    .filter(group => {
                      if (selectedDesignerFilter === "all") return true;
                      return group.designer?.id.toString() === selectedDesignerFilter;
                    })
                    .map(group => (
                    <div key={group.designer?.id || "unassigned"}>
                      <div className="flex items-center gap-2 px-2 py-1 mb-1">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium",
                          group.designer ? getAvatarColor(group.designer.name) : "bg-slate-600"
                        )}>
                          {group.designer?.name.charAt(0) || "?"}
                        </div>
                        <span className="text-xs font-semibold text-slate-300">
                          {group.designer?.name || "Unassigned"}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {group.chats.length}
                        </Badge>
                      </div>
                      <div className="space-y-1 pl-2">
                        {group.chats.map(chat => (
                          <ChatListItem
                            key={chat.id}
                            chat={chat}
                            isSelected={selectedChat?.id === chat.id}
                            onClick={() => setSelectedChat(chat)}
                            getTagStyle={getTagStyle}
                            getDisplayName={getDisplayName}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {designerGroups.filter(group => {
                    if (selectedDesignerFilter === "all") return true;
                    if (selectedDesignerFilter === "unassigned") return !group.designer;
                    return group.designer?.id.toString() === selectedDesignerFilter;
                  }).length === 0 && (
                    <p className="text-slate-500 text-center py-8 text-sm">No chats found</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>

        {/* Filter Tags */}
        <div className="p-3 border-t border-slate-800">
          <p className="text-xs text-slate-500 mb-2">Filter Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {CHAT_TAGS.map(tag => {
              const style = getTagStyle(tag);
              const isActive = filterTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setFilterTag(isActive ? null : tag)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                    isActive ? style.bg : "bg-slate-800 hover:bg-slate-700",
                    isActive ? style.text : "text-slate-400"
                  )}
                  data-testid={`filter-tag-${tag.toLowerCase()}`}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Panel - Chat Detail */}
      <div className="flex-1 flex flex-col bg-slate-900 min-w-0 overflow-hidden">
        {selectedChat ? (
          <>
            {/* Chat Header - Responsive */}
            <div className="p-3 border-b border-slate-800">
              <div className="flex items-center justify-between gap-2">
                {/* Left: Avatar and Name */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0",
                    getAvatarColor(selectedChat.clientName)
                  )}>
                    {selectedChat.clientName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold truncate">{getDisplayName(selectedChat)}</h3>
                      <span className="text-slate-400 text-sm">{selectedChat.clientPhone}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {(selectedChat.tags as string[] || []).slice(0, 2).map((tag, idx) => {
                        const style = getTagStyle(tag);
                        return (
                          <Badge key={idx} className={cn("text-[10px] px-1.5 py-0", style.bg, style.text, "border-0")}>
                            {tag}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(isAdmin || isSupport) && (
                    <Select
                      value={selectedChat.assignedToId?.toString() || ""}
                      onValueChange={(val) => handleAssign(Number(val))}
                    >
                      <SelectTrigger className="w-auto h-8 bg-slate-800 border-slate-700 text-slate-300 text-xs gap-1 px-2">
                        <span className="hidden sm:inline text-slate-500">Assign:</span>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
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
                      <Button variant="ghost" size="sm" className="text-slate-400 gap-1 h-8 px-2">
                        <span className="hidden sm:inline">Tag</span>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                      {CHAT_TAGS.map(tag => {
                        const isActive = (selectedChat.tags as string[] || []).includes(tag);
                        return (
                          <DropdownMenuItem 
                            key={tag} 
                            onClick={() => handleSetTag(tag)}
                            className="text-slate-300 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn("w-2 h-2 rounded-full", getTagStyle(tag).dot)} />
                              {tag}
                            </div>
                            {isActive && <Check className="w-4 h-4 text-green-500" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="ghost" size="icon" onClick={copyPhoneNumber} data-testid="button-copy-phone">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="hidden sm:flex" data-testid="button-external-link">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="button-more-options">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                      <DropdownMenuItem className="text-slate-300">View Order</DropdownMenuItem>
                      <DropdownMenuItem className="text-slate-300">Mark as Read</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-400">Archive Chat</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages?.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-3 border-t border-slate-800 relative">
              {showShortcuts && filteredShortcuts && filteredShortcuts.length > 0 && (
                <div className="absolute bottom-full left-3 right-3 mb-2 bg-slate-800 rounded-lg border border-slate-700 shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-slate-700">
                    <div className="flex items-center gap-2 text-slate-400 text-sm px-2">
                      <span className="text-blue-400">&gt;</span>
                      <span>{messageText}</span>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredShortcuts.map(shortcut => (
                      <button
                        key={shortcut.id}
                        className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-3 text-sm"
                        onClick={() => handleShortcut(shortcut)}
                        data-testid={`shortcut-${shortcut.command}`}
                      >
                        <span className="text-blue-400 font-medium">/{shortcut.command}</span>
                        <span className="text-slate-400 truncate">{shortcut.content.substring(0, 40)}...</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* File Preview */}
              {selectedFile && (
                <div className="mb-2 p-2 bg-slate-800 rounded-lg flex items-center gap-2 max-w-xs">
                  {selectedFile.type.startsWith("image/") ? (
                    <Image className="w-5 h-5 text-blue-400" />
                  ) : (
                    <File className="w-5 h-5 text-blue-400" />
                  )}
                  <span className="text-sm text-slate-300 truncate flex-1">{selectedFile.name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-slate-400"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 h-10 w-10"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-attach-file"
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                  <Textarea
                    ref={inputRef}
                    placeholder="Type a message... (use / for shortcuts)"
                    className="bg-slate-800 border-slate-700 text-white resize-none min-h-[40px] max-h-32 text-sm"
                    value={messageText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    data-testid="input-message"
                  />
                </div>
                <Button
                  onClick={handleSend}
                  disabled={(!messageText.trim() && !selectedFile) || sendMessageMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 h-10 px-4"
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Select a Chat</h3>
              <p className="text-slate-400">Choose a conversation from the sidebar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatListItem({
  chat,
  isSelected,
  onClick,
  getTagStyle,
  getDisplayName,
  compact = false,
}: {
  chat: ChatWithDetails;
  isSelected: boolean;
  onClick: () => void;
  getTagStyle: (tag: string) => { bg: string; text: string; dot: string };
  getDisplayName: (chat: ChatWithDetails) => string;
  compact?: boolean;
}) {
  const primaryTag = (chat.tags as string[] || [])[0];
  const tagStyle = primaryTag ? getTagStyle(primaryTag) : null;
  const displayName = getDisplayName(chat);
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg transition-colors relative",
        compact ? "p-2" : "p-3",
        isSelected 
          ? "bg-slate-800/70 border-l-2 border-l-blue-500" 
          : "hover:bg-slate-800/50"
      )}
      data-testid={`chat-item-${chat.id}`}
    >
      <div className="flex items-start gap-2">
        <div className="relative flex-shrink-0">
          <div className={cn(
            "rounded-full flex items-center justify-center text-white font-medium",
            compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm",
            getAvatarColor(displayName)
          )}>
            {displayName.charAt(0)}
          </div>
          {(chat.unreadCount || 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-950" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={cn(
              "text-white font-medium truncate",
              compact ? "text-xs" : "text-sm"
            )}>
              {displayName}
            </span>
            {chat.lastMessageAt && (
              <span className="text-[10px] text-slate-500 flex-shrink-0">
                {format(new Date(chat.lastMessageAt), "h:mm a")}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1 mt-0.5">
            {primaryTag && tagStyle && (
              <Badge className={cn("text-[10px] px-1 py-0 h-4", tagStyle.bg, tagStyle.text, "border-0")}>
                {primaryTag}
              </Badge>
            )}
            {(chat.unreadCount || 0) > 0 && (
              <Badge className="bg-blue-600 text-white text-[10px] px-1 py-0 h-4">
                {chat.unreadCount} New
              </Badge>
            )}
          </div>
          
          {!compact && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{chat.lastMessage || "No messages"}</p>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.senderType === "user";
  const isSystem = message.messageType === "system";
  
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {message.content}
          <span className="text-emerald-500/70 text-xs">
            {format(new Date(message.createdAt!), "h:mm a")}
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2",
          isUser ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-200"
        )}
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
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={cn("text-xs mt-1 text-right", isUser ? "text-slate-400" : "text-slate-500")}>
          {format(new Date(message.createdAt!), "h:mm a")}
        </p>
      </div>
    </div>
  );
}
