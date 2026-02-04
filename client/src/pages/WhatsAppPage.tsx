import { useState, useEffect, useRef, useCallback } from "react";
import chatBgPattern from "@assets/d36bcceceaa1d390489ec70d93154311_1770214551405.jpg";
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
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Package,
  Plus,
  Trash2,
  Star,
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
import type { Chat, Message, User, MessageShortcut, Order, Catalog } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ChatWithDetails = Chat & {
  messages?: Message[];
  assignee?: User | null;
};

const CHAT_TAGS = ["New", "Working", "Pending", "Changes", "Issues", "Satisfied Client"];

const TAG_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  "New": { bg: "bg-blue-600", text: "text-white", hex: "#2563eb" },
  "Working": { bg: "bg-purple-600", text: "text-white", hex: "#9333ea" },
  "Pending": { bg: "bg-yellow-600", text: "text-white", hex: "#ca8a04" },
  "Changes": { bg: "bg-orange-600", text: "text-white", hex: "#ea580c" },
  "Issues": { bg: "bg-red-600", text: "text-white", hex: "#dc2626" },
  "Satisfied Client": { bg: "bg-green-600", text: "text-white", hex: "#16a34a" },
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
  const [activeTab, setActiveTab] = useState<"all" | "new" | "assigned">("all");
  const [designerFilter, setDesignerFilter] = useState<number | null>(null);
  const [showCreateChatDialog, setShowCreateChatDialog] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatPhone, setNewChatPhone] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [showCatalogDialog, setShowCatalogDialog] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameChatName, setRenameChatName] = useState("");
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const { data: catalogItems } = useQuery<Catalog[]>({
    queryKey: ["/api/catalogs"],
  });

  const { data: orders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const linkedOrder = orders?.find(o => o.id === selectedChat?.linkedOrderId);
  const designers = teamMembers?.filter(u => u.role === "designer") || [];

  const createChatMutation = useMutation({
    mutationFn: (data: { clientName: string; clientPhone?: string }) =>
      apiRequest("POST", "/api/chats", data),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      const newChat = await response.json();
      setSelectedChat(newChat);
      toast({ title: "Success", description: "Chat created" });
      setShowCreateChatDialog(false);
      setNewChatName("");
      setNewChatPhone("");
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: number) =>
      apiRequest("DELETE", `/api/messages/${messageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats", selectedChat?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({ title: "Deleted", description: "Message deleted" });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: (chatId: number) =>
      apiRequest("DELETE", `/api/chats/${chatId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setSelectedChat(null);
      toast({ title: "Deleted", description: "Chat deleted" });
    },
  });

  const sendVoiceWhatsAppMutation = useMutation({
    mutationFn: async ({ chatId, audioBlob }: { chatId: number; audioBlob: Blob }) => {
      const formData = new FormData();
      // MediaRecorder creates webm with opus codec - WhatsApp accepts audio/webm
      const extension = audioBlob.type.includes("webm") ? "webm" : "ogg";
      formData.append("media", audioBlob, `voice_message.${extension}`);
      formData.append("mediaType", "audio");
      return fetch(`/api/chats/${chatId}/send-whatsapp-media`, {
        method: "POST",
        body: formData,
        credentials: "include",
      }).then(res => {
        if (!res.ok) throw new Error("Failed to send voice message");
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats", selectedChat?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setAudioBlob(null);
      setRecordingTime(0);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to send voice message", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, content, file, useWhatsApp }: { chatId: number; content: string; file?: File; useWhatsApp?: boolean }) => {
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
      // Send via WhatsApp API if chat has a phone number
      if (useWhatsApp) {
        return apiRequest("POST", `/api/chats/${chatId}/send-whatsapp`, { message: content });
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
    onError: (error: Error) => {
      toast({ 
        title: "Failed to send", 
        description: error.message || "Could not send message",
        variant: "destructive"
      });
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

  // Mark chat as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (chatId: number) => {
      return apiRequest("POST", `/api/chats/${chatId}/mark-read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
  });

  // Function to select chat and mark as read
  const handleSelectChat = (chat: ChatWithDetails) => {
    setSelectedChat(chat);
    // Mark as read if there are unread messages
    if (chat.unreadCount && chat.unreadCount > 0) {
      markAsReadMutation.mutate(chat.id);
    }
  };

  // Common emojis for picker
  const emojiCategories = {
    smileys: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "🤔", "🤗", "🤭", "🥳", "😎", "🤩", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖"],
    gestures: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪", "🦾", "🦿"],
    hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "💌", "💋", "👄"],
    objects: ["📱", "💻", "⌨️", "🖥️", "🖨️", "📷", "📹", "🎥", "📞", "☎️", "📧", "📬", "📝", "📂", "📁", "📊", "📈", "📉", "🗓️", "📆", "📅", "⏰", "🕐", "💵", "💴", "💶", "💷", "💰", "💳", "🎁", "🎉", "🎊", "🎈", "✨", "🔥", "💯", "⭐", "🌟", "✅", "❌", "⚠️", "🚀"],
    nature: ["🌸", "🌹", "🌺", "🌻", "🌼", "🌷", "🌱", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷"]
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast({ title: "Error", description: "Could not access microphone", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    // Stop active recording if in progress
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    // Clear recording state whether recording or ready to send
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingTime(0);
    audioChunksRef.current = [];
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  const sendVoiceMessage = useCallback(() => {
    if (!audioBlob || !selectedChat) return;
    
    // Use WhatsApp API if chat has phone number
    if (selectedChat.clientPhone) {
      sendVoiceWhatsAppMutation.mutate({
        chatId: selectedChat.id,
        audioBlob: audioBlob,
      });
    } else {
      // Fallback to regular file upload for internal chats
      const voiceFile = new (window as any).File([audioBlob], "voice_message.webm", { type: "audio/webm" }) as File;
      sendMessageMutation.mutate({ 
        chatId: selectedChat.id, 
        content: "Voice message",
        file: voiceFile 
      });
      setAudioBlob(null);
      setRecordingTime(0);
    }
  }, [audioBlob, selectedChat, sendMessageMutation, sendVoiceWhatsAppMutation]);

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const insertEmoji = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    inputRef.current?.focus();
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
    // Use WhatsApp API if the chat has a phone number (real WhatsApp chat)
    const useWhatsApp = !!selectedChat.clientPhone;
    sendMessageMutation.mutate({ 
      chatId: selectedChat.id, 
      content: messageText,
      file: selectedFile || undefined,
      useWhatsApp
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
    
    // Tab filtering
    if (activeTab === "new" && !(chat.tags as string[] || []).includes("New")) return false;
    if (activeTab === "assigned") {
      if (!chat.assignedToId) return false;
      if (designerFilter && chat.assignedToId !== designerFilter) return false;
    }
    
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
            <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-white/5" data-testid="button-refresh">
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-white/5" data-testid="button-new-chat">
              <MessageSquarePlus className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-white/5" data-testid="button-menu">
                  <MoreVertical className="w-5 h-5" />
                </Button>
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

        {/* Search and Create */}
        <div className="px-3 py-2 flex gap-2" style={{ backgroundColor: "#111b21" }}>
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
          {(isAdmin || isSupport) && (
            <Button
              size="icon"
              onClick={() => setShowCreateChatDialog(true)}
              className="bg-[#00a884] hover:bg-[#00a884]/90 text-white"
              data-testid="button-create-chat"
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="px-3 py-2 flex gap-2" style={{ backgroundColor: "#111b21" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("all")}
            className={cn(
              "rounded-full text-xs px-4",
              activeTab === "all" 
                ? "bg-[#00a884] text-white hover:bg-[#00a884]" 
                : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
            )}
            data-testid="tab-all"
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("new")}
            className={cn(
              "rounded-full text-xs px-4",
              activeTab === "new" 
                ? "bg-[#00a884] text-white hover:bg-[#00a884]" 
                : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
            )}
            data-testid="tab-new"
          >
            New
          </Button>
          {(isAdmin || isSupport) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveTab("assigned");
                if (!designerFilter && designers.length > 0) {
                  setDesignerFilter(designers[0].id);
                }
              }}
              className={cn(
                "rounded-full text-xs px-4",
                activeTab === "assigned" 
                  ? "bg-[#00a884] text-white hover:bg-[#00a884]" 
                  : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
              )}
              data-testid="tab-assigned"
            >
              By Designer
            </Button>
          )}
          {activeTab === "assigned" && (isAdmin || isSupport) && (
            <Select
              value={designerFilter?.toString() || "all"}
              onValueChange={(val) => setDesignerFilter(val && val !== "all" ? Number(val) : null)}
            >
              <SelectTrigger 
                className="w-36 h-8 text-xs border-none"
                style={{ backgroundColor: "#202c33" }}
                data-testid="select-designer-filter"
              >
                <SelectValue placeholder="All Designers" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: "#202c33" }}>
                <SelectItem value="all">All Designers</SelectItem>
                {designers.map(d => (
                  <SelectItem key={d.id} value={d.id.toString()}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost"
                size="icon"
                className={cn(
                  "ml-auto hover:bg-white/5",
                  filterTag ? "text-green-500" : "text-slate-400"
                )}
                data-testid="button-filter-tags"
              >
                <Filter className="w-4 h-4" />
              </Button>
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
                All Tags
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
                  data-testid={`filter-tag-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: TAG_COLORS[tag]?.hex }}
                  />
                  {tag}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="py-1">
            {filteredChats?.map(chat => {
              const displayName = getDisplayName(chat);
              const isSelected = selectedChat?.id === chat.id;
              const unreadCount = chat.unreadCount || 0;
              const primaryTag = (chat.tags as string[] || [])[0];
              const assignedDesigner = teamMembers?.find(u => u.id === chat.assignedToId);
              
              return (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors",
                    isSelected && "bg-white/10"
                  )}
                  style={{ borderBottom: "1px solid #222d34" }}
                  data-testid={`chat-item-${chat.id}`}
                >
                  {/* Avatar with assignment indicator */}
                  <div className="relative flex-shrink-0">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg"
                      style={{ backgroundColor: getAvatarColor(displayName) }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    {assignedDesigner && (
                      <div 
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
                        style={{ 
                          backgroundColor: getAvatarColor(assignedDesigner.name),
                          borderColor: "#111b21"
                        }}
                        title={`Assigned to ${assignedDesigner.name}`}
                      >
                        {assignedDesigner.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white font-normal text-base truncate">
                          {displayName}
                        </span>
                        {assignedDesigner && (isAdmin || isSupport) && (
                          <span className="text-[10px] text-slate-500 flex-shrink-0">
                            {assignedDesigner.name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {chat.lastMessageAt ? format(new Date(chat.lastMessageAt), "HH:mm") : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                        <CheckCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        {chat.lastMessage?.includes(".pdf") || chat.lastMessage?.includes(".doc") ? (
                          <div className="flex items-center gap-1 text-sm text-slate-400 truncate">
                            <File className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{chat.lastMessage}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 truncate block max-w-full" style={{ 
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "180px"
                          }}>
                            {chat.lastMessage || "No messages"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                        {primaryTag && (
                          <span 
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap",
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
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-white/5" data-testid="button-chat-menu">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
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
                      data-testid="menu-copy-phone"
                    >
                      Copy phone number
                    </DropdownMenuItem>
                    <DropdownMenuSeparator style={{ backgroundColor: "#2a3942" }} />
                    
                    {CHAT_TAGS.map(tag => {
                      const isActive = (selectedChat.tags as string[] || []).includes(tag);
                      return (
                        <DropdownMenuItem 
                          key={tag}
                          className="text-slate-200 hover:bg-white/5 cursor-pointer flex items-center justify-between"
                          onClick={() => handleSetTag(tag)}
                          data-testid={`menu-tag-${tag.toLowerCase().replace(/\s+/g, "-")}`}
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
                          data-testid="menu-view-order"
                        >
                          View linked order
                        </DropdownMenuItem>
                        {(isAdmin || isSupport) && (
                          <DropdownMenuItem 
                            className="text-slate-200 hover:bg-white/5 cursor-pointer"
                            onClick={handleUnlinkOrder}
                            data-testid="menu-unlink-order"
                          >
                            Unlink order
                          </DropdownMenuItem>
                        )}
                      </>
                    ) : (isAdmin || isSupport) ? (
                      <DropdownMenuItem 
                        className="text-slate-200 hover:bg-white/5 cursor-pointer"
                        onClick={() => setShowLinkOrderDialog(true)}
                        data-testid="menu-link-order"
                      >
                        Link to order
                      </DropdownMenuItem>
                    ) : null}
                    
                    {(isAdmin || isSupport) && (
                      <>
                        <DropdownMenuSeparator style={{ backgroundColor: "#2a3942" }} />
                        <DropdownMenuItem 
                          className="text-slate-200 hover:bg-white/5 cursor-pointer"
                          onClick={() => {
                            setRenameChatName(selectedChat?.clientName || "");
                            setShowRenameDialog(true);
                          }}
                          data-testid="menu-rename-chat"
                        >
                          Rename chat
                        </DropdownMenuItem>
                      </>
                    )}
                    
                    {isAdmin && (
                      <DropdownMenuItem 
                        className="text-red-400 hover:bg-white/5 cursor-pointer"
                        onClick={() => setShowDeleteChatConfirm(true)}
                        data-testid="menu-delete-chat"
                      >
                        Delete chat
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea 
              className="flex-1 px-16 py-4"
              style={{ 
                backgroundImage: `url(${chatBgPattern})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "repeat"
              }}
            >
              <div className="space-y-2 max-w-3xl mx-auto">
                {/* Encryption Notice */}
                <div className="flex justify-center mb-4">
                  <div 
                    className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"
                    style={{ backgroundColor: "#182229" }}
                  >
                    <svg viewBox="0 0 24 24" className="w-3 h-3 text-yellow-500 fill-current">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.4 0 2.8 1.1 2.8 2.5V11c.6 0 1.2.6 1.2 1.3v3.5c0 .6-.6 1.2-1.2 1.2H9.2c-.6 0-1.2-.6-1.2-1.3v-3.5c0-.6.6-1.2 1.2-1.2V9.5C9.2 8.1 10.6 7 12 7zm0 1.2c-.8 0-1.5.5-1.5 1.3V11h3V9.5c0-.8-.7-1.3-1.5-1.3z"/>
                    </svg>
                    <span style={{ color: "#8696a0" }}>
                      Messages are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
                    </span>
                  </div>
                </div>
                
                {/* Today Marker */}
                <div className="flex justify-center mb-4">
                  <div 
                    className="px-3 py-1 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: "#182229", color: "#d1d7db" }}
                  >
                    TODAY
                  </div>
                </div>
                
                {messages?.map(msg => (
                  <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    onDelete={(isAdmin || isSupport) ? () => deleteMessageMutation.mutate(msg.id) : undefined}
                  />
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

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div 
                  className="absolute bottom-20 left-4 rounded-lg border shadow-xl z-50 p-3"
                  style={{ backgroundColor: "#233138", borderColor: "#2a3942" }}
                >
                  <div className="flex gap-2 mb-2 border-b pb-2" style={{ borderColor: "#2a3942" }}>
                    {Object.keys(emojiCategories).map(cat => (
                      <button
                        key={cat}
                        className="text-xs px-2 py-1 rounded text-slate-300 hover:bg-white/10 capitalize"
                        onClick={() => {}}
                      >
                        {cat === "smileys" ? "😀" : cat === "gestures" ? "👋" : cat === "hearts" ? "❤️" : cat === "objects" ? "📱" : "🌸"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                    {Object.values(emojiCategories).flat().map((emoji, idx) => (
                      <button
                        key={idx}
                        className="text-xl p-1 hover:bg-white/10 rounded"
                        onClick={() => {
                          insertEmoji(emoji);
                          setShowEmojiPicker(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Voice Recording UI */}
              {isRecording || audioBlob ? (
                <div className="flex items-center gap-3 w-full">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelRecording}
                    className="text-red-400 hover:bg-white/5"
                    data-testid="button-cancel-recording"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                  
                  <div 
                    className="flex-1 flex items-center gap-3 px-4 py-2 rounded-lg"
                    style={{ backgroundColor: "#2a3942" }}
                  >
                    {isRecording ? (
                      <>
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-white text-sm">{formatRecordingTime(recordingTime)}</span>
                        <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 w-full animate-pulse" />
                        </div>
                      </>
                    ) : (
                      <>
                        <Mic className="w-5 h-5 text-green-500" />
                        <span className="text-white text-sm">{formatRecordingTime(recordingTime)}</span>
                        <span className="text-slate-400 text-sm">Voice message ready</span>
                      </>
                    )}
                  </div>

                  {isRecording ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={stopRecording}
                      className="text-white bg-red-500 hover:bg-red-600 rounded-full"
                      data-testid="button-stop-recording"
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={sendVoiceMessage}
                      className="text-white bg-[#00a884] hover:bg-[#00a884]/80 rounded-full"
                      data-testid="button-send-voice"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={cn("text-slate-400 hover:bg-white/5", showEmojiPicker && "text-[#00a884]")}
                    data-testid="button-emoji"
                  >
                    <Smile className="w-6 h-6" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx"
                    data-testid="input-file-upload"
                  />
                  <Button 
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:bg-white/5"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="w-6 h-6" />
                  </Button>
                  <Button 
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:bg-white/5"
                    onClick={() => setShowCatalogDialog(true)}
                    data-testid="button-catalog"
                  >
                    <Package className="w-6 h-6" />
                  </Button>
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
                  {messageText.trim() || selectedFile ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSend}
                      disabled={sendMessageMutation.isPending}
                      className="text-slate-400 hover:bg-white/5 disabled:opacity-50"
                      data-testid="button-send-message"
                    >
                      <Send className="w-6 h-6" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={startRecording}
                      className="text-slate-400 hover:bg-white/5"
                      data-testid="button-start-recording"
                    >
                      <Mic className="w-6 h-6" />
                    </Button>
                  )}
                </div>
              )}
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
                Built by <span style={{ color: "#00a884" }}>Pixely_Digital</span>
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

      {/* Catalog Dialog */}
      <Dialog open={showCatalogDialog} onOpenChange={setShowCatalogDialog}>
        <DialogContent 
          className="border max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
          style={{ backgroundColor: "#233138", borderColor: "#2a3942" }}
        >
          <DialogHeader>
            <DialogTitle className="text-slate-100">Send Catalog</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {catalogItems && catalogItems.length > 0 ? catalogItems.map(item => (
                <button
                  key={item.id}
                  className="w-full p-3 rounded-lg text-left hover:bg-white/5 transition-colors flex items-start gap-3"
                  style={{ backgroundColor: "#2a3942" }}
                  onClick={() => {
                    if (selectedChat) {
                      const catalogMessage = `*${item.name}*\n${item.description || ''}\n\nPrice: PKR ${item.price.toLocaleString()}`;
                      sendMessageMutation.mutate({ 
                        chatId: selectedChat.id, 
                        content: catalogMessage,
                        useWhatsApp: !!selectedChat.clientPhone
                      });
                      setShowCatalogDialog(false);
                    }
                  }}
                  data-testid={`catalog-item-${item.id}`}
                >
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                    />
                  ) : (
                    <div 
                      className="w-16 h-16 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "#1a252d" }}
                    >
                      <Package className="w-6 h-6 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-100">{item.name}</div>
                    <div className="text-sm text-slate-400 truncate">{item.description || ''}</div>
                    <div className="text-[#00a884] font-medium mt-1">PKR {item.price.toLocaleString()}</div>
                  </div>
                </button>
              )) : (
                <div className="text-center py-8 text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No catalog items available</p>
                  <p className="text-sm mt-1">Ask admin to add items in Catalog settings</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create Chat Dialog */}
      <Dialog open={showCreateChatDialog} onOpenChange={setShowCreateChatDialog}>
        <DialogContent 
          className="border max-w-md"
          style={{ backgroundColor: "#233138", borderColor: "#2a3942" }}
        >
          <DialogHeader>
            <DialogTitle className="text-slate-100">Create New Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Client Name *</label>
              <Input
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                placeholder="Enter client name"
                className="border-slate-600 bg-[#2a3942] text-slate-100"
                data-testid="input-new-chat-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Phone Number</label>
              <Input
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="border-slate-600 bg-[#2a3942] text-slate-100"
                data-testid="input-new-chat-phone"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateChatDialog(false)}
                className="border-slate-600 text-slate-300 hover:bg-[#2a3942]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!newChatName.trim()) {
                    toast({ title: "Error", description: "Client name is required", variant: "destructive" });
                    return;
                  }
                  createChatMutation.mutate({
                    clientName: newChatName.trim(),
                    clientPhone: newChatPhone.trim() || undefined,
                  });
                }}
                disabled={createChatMutation.isPending}
                className="bg-[#00a884] hover:bg-[#00a884]/90 text-white"
                data-testid="button-submit-create-chat"
              >
                Create Chat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Chat Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent 
          className="border max-w-md"
          style={{ backgroundColor: "#233138", borderColor: "#2a3942" }}
        >
          <DialogHeader>
            <DialogTitle className="text-slate-100">Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Chat Name</label>
              <Input
                value={renameChatName}
                onChange={(e) => setRenameChatName(e.target.value)}
                placeholder="Enter new name"
                className="border-slate-600 bg-[#2a3942] text-slate-100"
                data-testid="input-rename-chat"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowRenameDialog(false)}
                className="border-slate-600 text-slate-300 hover:bg-[#2a3942]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!renameChatName.trim() || !selectedChat) return;
                  updateChatMutation.mutate({
                    id: selectedChat.id,
                    updates: { clientName: renameChatName.trim() }
                  });
                  setShowRenameDialog(false);
                }}
                disabled={updateChatMutation.isPending}
                className="bg-[#00a884] hover:bg-[#00a884]/90 text-white"
                data-testid="button-submit-rename"
              >
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Chat Confirmation Dialog */}
      <Dialog open={showDeleteChatConfirm} onOpenChange={setShowDeleteChatConfirm}>
        <DialogContent 
          className="border max-w-md"
          style={{ backgroundColor: "#233138", borderColor: "#2a3942" }}
        >
          <DialogHeader>
            <DialogTitle className="text-slate-100">Delete Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-300">
              Are you sure you want to delete this chat? This will permanently delete all messages and cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteChatConfirm(false)}
                className="border-slate-600 text-slate-300 hover:bg-[#2a3942]"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!selectedChat) return;
                  deleteChatMutation.mutate(selectedChat.id);
                  setShowDeleteChatConfirm(false);
                }}
                disabled={deleteChatMutation.isPending}
                data-testid="button-confirm-delete-chat"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBubble({ message, onDelete }: { message: Message; onDelete?: () => void }) {
  const isAgent = message.senderType === "agent" || message.senderType === "user";
  const isSystem = message.messageType === "system";
  const [showMenu, setShowMenu] = useState(false);
  
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
    <div 
      className={cn("flex group relative", isAgent ? "justify-end" : "justify-start")}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Delete button on hover */}
      {onDelete && showMenu && (
        <button
          onClick={onDelete}
          className={cn(
            "absolute top-1 p-1 rounded hover:bg-white/10 transition-opacity",
            isAgent ? "left-0 -translate-x-full mr-2" : "right-0 translate-x-full ml-2"
          )}
          data-testid={`button-delete-message-${message.id}`}
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      )}
      
      <div
        className="max-w-[65%] rounded-lg px-3 py-2 shadow-sm"
        style={{ 
          backgroundColor: isAgent ? "#005c4b" : "#202c33",
        }}
      >
        {message.messageType === "file" && message.fileUrl && (
          <div className="mb-2">
            {message.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <img 
                src={message.fileUrl} 
                alt={message.fileName || "Attachment"} 
                className="rounded-lg max-w-full"
              />
            ) : message.fileUrl.match(/\.(mp3|ogg|wav|webm|m4a|aac)$/i) ? (
              <div className="flex items-center gap-2 py-1">
                <Play className="w-5 h-5 text-white" />
                <audio controls className="h-8 max-w-[200px]">
                  <source src={message.fileUrl} />
                </audio>
              </div>
            ) : (
              <a 
                href={message.fileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-300 hover:underline"
              >
                <File className="w-4 h-4" />
                <span className="text-sm">{message.fileName || "Download file"}</span>
              </a>
            )}
          </div>
        )}
        {message.content && message.content !== "Voice message" && (
          <p className="text-sm text-slate-100 whitespace-pre-wrap">{message.content}</p>
        )}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[11px]" style={{ color: "#8696a0" }}>
            {format(new Date(message.createdAt!), "HH:mm")}
          </span>
          {isAgent && (
            <CheckCheck className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>
    </div>
  );
}
