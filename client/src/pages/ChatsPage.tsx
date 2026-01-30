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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Send,
  Phone,
  MoreVertical,
  Paperclip,
  Tag,
  UserPlus,
  MessageSquare,
  Users,
  Clock,
  Check,
  CheckCheck,
  Link2,
  Copy,
  FileText,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Chat, Message, User, MessageShortcut } from "@shared/schema";

type ChatWithDetails = Chat & {
  messages?: Message[];
  assignee?: User | null;
};

const CHAT_TAGS = ["New", "Changes", "Satisfied", "Issues"];

export default function ChatsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState<ChatWithDetails | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "admin";
  const isSupport = user?.role === "support";
  const isDesigner = user?.role === "designer";

  const { data: chats, isLoading } = useQuery<ChatWithDetails[]>({
    queryKey: ["/api/chats"],
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["/api/chats", selectedChat?.id, "messages"],
    enabled: !!selectedChat,
  });

  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: shortcuts } = useQuery<MessageShortcut[]>({
    queryKey: ["/api/shortcuts"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, content }: { chatId: number; content: string }) => {
      return apiRequest("POST", `/api/chats/${chatId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats", selectedChat?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setMessageText("");
    },
  });

  const updateChatMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Chat> }) => {
      return apiRequest("PATCH", `/api/chats/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({ title: "Success", description: "Chat updated" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!messageText.trim() || !selectedChat) return;
    sendMessageMutation.mutate({ chatId: selectedChat.id, content: messageText });
  };

  const handleShortcut = (command: string) => {
    const shortcut = shortcuts?.find(s => s.command === command);
    if (shortcut) {
      setMessageText(shortcut.content);
      setShowShortcuts(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "/" && messageText === "") {
      setShowShortcuts(true);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      setShowShortcuts(false);
    }
  };

  const filteredChats = chats?.filter(chat => {
    // Don't show internal chats in the main list
    if (chat.isInternal) return false;
    // Designers only see their assigned chats
    if (isDesigner && chat.assignedToId !== user?.id) return false;
    // Filter by search if provided
    if (search) {
      return (
        chat.clientName.toLowerCase().includes(search.toLowerCase()) ||
        chat.clientPhone?.includes(search)
      );
    }
    return true;
  });

  const newMessageChats = filteredChats?.filter(c => (c.unreadCount || 0) > 0);
  const designerGroups = isAdmin || isSupport
    ? Array.from(new Set(chats?.filter(c => c.assignee).map(c => c.assignee?.id)))
        .map(id => ({
          designer: chats?.find(c => c.assignee?.id === id)?.assignee,
          chats: filteredChats?.filter(c => c.assignedToId === id) || [],
        }))
    : [];

  const getTagColor = (tag: string) => {
    switch (tag.toLowerCase()) {
      case "new": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "changes": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "satisfied": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "issues": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  if (isLoading) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white mb-3">Chats</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search by name or phone..."
              className="pl-10 bg-slate-900 border-slate-800 text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-chats"
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="flex-1 flex flex-col">
          <TabsList className="bg-slate-900 border-b border-slate-800 rounded-none p-1 mx-2 mt-2">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-blue-600">
              {isDesigner ? "My Chats" : "All Chats"}
            </TabsTrigger>
            <TabsTrigger value="new" className="text-xs data-[state=active]:bg-blue-600">
              New ({newMessageChats?.length || 0})
            </TabsTrigger>
            {(isAdmin || isSupport) && (
              <TabsTrigger value="designers" className="text-xs data-[state=active]:bg-blue-600">
                <Users className="w-3 h-3 mr-1" />
                By Designer
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-1 p-2">
                {filteredChats?.map(chat => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isSelected={selectedChat?.id === chat.id}
                    onClick={() => setSelectedChat(chat)}
                    getTagColor={getTagColor}
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
              <div className="space-y-1 p-2">
                {newMessageChats?.map(chat => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isSelected={selectedChat?.id === chat.id}
                    onClick={() => setSelectedChat(chat)}
                    getTagColor={getTagColor}
                  />
                ))}
                {(!newMessageChats || newMessageChats.length === 0) && (
                  <p className="text-slate-500 text-center py-8 text-sm">No new messages</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {(isAdmin || isSupport) && (
            <TabsContent value="designers" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-4">
                  {designerGroups.map(group => (
                    <div key={group.designer?.id || "unassigned"}>
                      <h4 className="text-xs font-semibold text-slate-400 px-2 mb-2">
                        {group.designer?.name || "Unassigned"} ({group.chats.length})
                      </h4>
                      <div className="space-y-1">
                        {group.chats.map(chat => (
                          <ChatListItem
                            key={chat.id}
                            chat={chat}
                            isSelected={selectedChat?.id === chat.id}
                            onClick={() => setSelectedChat(chat)}
                            getTagColor={getTagColor}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <div className="flex-1 flex flex-col bg-slate-900">
        {selectedChat ? (
          <>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg text-white">
                  {selectedChat.clientName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-white font-medium">{selectedChat.clientName}</h3>
                  <div className="flex items-center gap-2">
                    {selectedChat.clientPhone && (
                      <span className="text-xs text-slate-400">{selectedChat.clientPhone}</span>
                    )}
                    {selectedChat.linkedOrderId && (
                      <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                        <Link2 className="w-3 h-3 mr-1" />
                        Order Linked
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedChat.clientPhone && (
                  <a
                    href={`https://wa.me/${selectedChat.clientPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-green-500 hover:bg-green-500/10"
                    data-testid="button-whatsapp-call"
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-400">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
                    {(isAdmin || isSupport) && (
                      <>
                        <DropdownMenuItem className="text-slate-300">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Assign Designer
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-slate-300">
                          <Link2 className="w-4 h-4 mr-2" />
                          Link to Order
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-800" />
                      </>
                    )}
                    <DropdownMenuItem className="text-slate-300">
                      <Tag className="w-4 h-4 mr-2" />
                      Set Tag
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {(selectedChat.tags as string[] || []).length > 0 && (
              <div className="px-4 py-2 border-b border-slate-800 flex gap-2">
                {(selectedChat.tags as string[] || []).map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className={getTagColor(tag)}>
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages?.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        msg.senderType === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      {msg.messageType === 'file' && msg.fileUrl && (
                        <div className="mb-2">
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm underline"
                          >
                            <FileText className="w-4 h-4" />
                            {msg.fileName || "Attachment"}
                          </a>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.senderType === 'user' ? 'text-blue-200' : 'text-slate-500'}`}>
                        {format(new Date(msg.createdAt!), "h:mm a")}
                        {msg.senderType === 'user' && (
                          <span className="ml-1">
                            {msg.isRead ? <CheckCheck className="w-3 h-3 inline" /> : <Check className="w-3 h-3 inline" />}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-slate-800 relative">
              {showShortcuts && (isAdmin || isSupport) && (
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-h-48 overflow-y-auto">
                  <div className="p-2">
                    <p className="text-xs text-slate-400 mb-2">Quick Messages (type / to open)</p>
                    {shortcuts?.map(shortcut => (
                      <button
                        key={shortcut.id}
                        className="w-full text-left px-3 py-2 rounded hover:bg-slate-700 text-sm text-slate-300"
                        onClick={() => handleShortcut(shortcut.command)}
                      >
                        <span className="text-blue-400">/{shortcut.command}</span>
                        <span className="text-slate-500 ml-2">{shortcut.content.substring(0, 40)}...</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white shrink-0">
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Textarea
                  placeholder="Type a message..."
                  className="bg-slate-800 border-slate-700 text-white resize-none min-h-[44px] max-h-32"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 shrink-0"
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
              <p className="text-slate-400">Choose a conversation from the sidebar to start messaging</p>
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
  getTagColor,
}: {
  chat: ChatWithDetails;
  isSelected: boolean;
  onClick: () => void;
  getTagColor: (tag: string) => string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        isSelected ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-slate-800/50'
      }`}
      data-testid={`chat-item-${chat.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm text-white shrink-0">
          {chat.clientName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium text-sm truncate">{chat.clientName}</span>
            {chat.lastMessageAt && (
              <span className="text-xs text-slate-500">
                {format(new Date(chat.lastMessageAt), "h:mm a")}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5">{chat.lastMessage || "No messages yet"}</p>
          <div className="flex items-center gap-1 mt-1">
            {(chat.tags as string[] || []).slice(0, 2).map((tag, idx) => (
              <Badge key={idx} variant="secondary" className={`text-[10px] px-1 py-0 ${getTagColor(tag)}`}>
                {tag}
              </Badge>
            ))}
            {(chat.unreadCount || 0) > 0 && (
              <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 ml-auto">
                {chat.unreadCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
