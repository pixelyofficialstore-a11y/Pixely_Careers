import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import chatBgPattern from "@assets/d36bcceceaa1d390489ec70d93154311_1770214551405.jpg";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search,
  Send,
  MoreVertical,
  Paperclip,
  Check,
  CheckCheck,
  X,
  File,
  LinkIcon,
  ImageIcon,
  Smile,
  Mic,
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  Star,
  Bell,
  Lock,
  ChevronDown,
  Download,
  MapPin,
  UserCircle,
  Upload,
  ShoppingBag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Chat, Message, User, MessageShortcut, Order } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ChatWithDetails = Chat & {
  messages?: Message[];
  assignee?: User | null;
};

type ChatTag = "New" | "Working" | "Pending" | "Changes" | "Issues" | "Satisfied Client";

const CHAT_TAGS: ChatTag[] = ["New", "Working", "Pending", "Changes", "Issues", "Satisfied Client"];

const TAG_CONFIG: Record<ChatTag, { label: string; bgClass: string }> = {
  "New": { label: "New", bgClass: "bg-tag-new" },
  "Working": { label: "Working", bgClass: "bg-tag-working" },
  "Pending": { label: "Pending", bgClass: "bg-tag-pending" },
  "Changes": { label: "Changes", bgClass: "bg-tag-pending" },
  "Issues": { label: "Issues", bgClass: "bg-tag-issues" },
  "Satisfied Client": { label: "Satisfied", bgClass: "bg-tag-satisfied" },
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

function ChatListItem({ 
  chat, 
  isActive, 
  onClick, 
  showAssignee = true 
}: { 
  chat: ChatWithDetails; 
  isActive: boolean; 
  onClick: () => void;
  showAssignee?: boolean;
}) {
  const tag = (chat.tags as string[] || [])[0] as ChatTag || "New";
  const tagConfig = TAG_CONFIG[tag] || TAG_CONFIG["New"];
  const displayName = chat.clientName && chat.clientName !== "New Lead" && chat.clientName.trim() !== "" 
    ? chat.clientName 
    : chat.clientPhone || "Unknown";

  const formatTimestamp = (date: Date | string | null | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    if (isToday(d)) return format(d, "HH:mm");
    if (isYesterday(d)) return "Yesterday";
    return format(d, "dd/MM/yyyy");
  };

  const getMessagePreview = () => {
    if (!chat.lastMessage) return "No messages yet";
    const preview = chat.lastMessage;
    if (preview.length > 40) return `${preview.substring(0, 40)}...`;
    return preview;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-whatsapp-divider",
        isActive ? "bg-whatsapp-active" : "hover:bg-whatsapp-hover"
      )}
      data-testid={`chat-item-${chat.id}`}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarFallback 
            className="text-white font-medium"
            style={{ backgroundColor: getAvatarColor(displayName) }}
          >
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-whatsapp-bg-panel",
            tagConfig.bgClass
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1">
          <span className="font-medium text-whatsapp-text-primary truncate">
            {displayName}
          </span>
          <span className={cn(
            "text-xs flex-shrink-0 ml-2",
            chat.unreadCount && chat.unreadCount > 0 ? "text-whatsapp-unread" : "text-whatsapp-text-secondary"
          )}>
            {formatTimestamp(chat.lastMessageAt)}
          </span>
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-sm text-whatsapp-text-secondary truncate flex-1 min-w-0">
            <span className="truncate">{getMessagePreview()}</span>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {showAssignee && chat.assignee && (
              <span className="text-xs text-whatsapp-teal truncate max-w-[60px]">
                {chat.assignee.name?.split(" ")[0]}
              </span>
            )}
            {chat.unreadCount && chat.unreadCount > 0 && (
              <Badge 
                className="h-5 min-w-[20px] flex items-center justify-center rounded-full bg-whatsapp-unread text-white text-xs font-medium px-1.5 no-default-hover-elevate no-default-active-elevate"
              >
                {chat.unreadCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// WhatsApp-style voice message player with waveform visualization
function VoiceMessagePlayer({ 
  message, 
  isOutgoing,
  formatTime,
  getStatusIcon
}: { 
  message: Message;
  isOutgoing: boolean;
  formatTime: (date: Date | string) => string;
  getStatusIcon: () => React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Generate consistent waveform bars based on message ID
  const waveformBars = useMemo(() => {
    const seed = message.id;
    const bars: number[] = [];
    for (let i = 0; i < 35; i++) {
      // Create pseudo-random heights based on message ID
      const hash = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
      bars.push(Math.floor(hash * 18) + 4);
    }
    return bars;
  }, [message.id]);
  
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };
  
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const playedBars = Math.floor((progress / 100) * waveformBars.length);
  
  return (
    <div className="flex items-center gap-2 min-w-[280px] max-w-[320px]">
      <audio 
        ref={audioRef}
        src={message.fileUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
      
      {/* Play/Pause Button */}
      <button 
        onClick={togglePlay}
        className="h-11 w-11 rounded-full bg-whatsapp-green flex items-center justify-center flex-shrink-0 hover:bg-whatsapp-green/90 transition-colors"
        data-testid="button-voice-play"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 text-white" />
        ) : (
          <Play className="h-5 w-5 text-white ml-0.5" />
        )}
      </button>
      
      {/* Waveform and Duration */}
      <div className="flex-1 flex flex-col gap-1">
        {/* Waveform Bars */}
        <div className="flex items-center gap-[2px] h-6">
          {waveformBars.map((height, i) => (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-colors ${
                i < playedBars 
                  ? 'bg-whatsapp-green' 
                  : isOutgoing 
                    ? 'bg-[#8696a0]' 
                    : 'bg-[#8696a0]'
              }`}
              style={{ height: `${height}px` }}
            />
          ))}
        </div>
        
        {/* Duration / Current Time */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-whatsapp-text-secondary">
            {isPlaying || currentTime > 0 
              ? formatDuration(currentTime) 
              : duration > 0 
                ? formatDuration(duration)
                : '0:00'
            }
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-whatsapp-text-secondary">
              {message.createdAt ? formatTime(message.createdAt) : ''}
            </span>
            {isOutgoing && getStatusIcon()}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ 
  message, 
  onDelete,
  onReact
}: { 
  message: Message; 
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isOutgoing = message.senderType === "agent";
  const reactions = (message.reactions as { emoji: string; senderPhone?: string }[] | null) || [];
  const quickReactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const formatTime = (date: Date | string | null) => {
    if (!date) return "";
    return format(new Date(date), "HH:mm");
  };

  const getStatusIcon = () => {
    if (!isOutgoing) return null;
    if (message.isRead) {
      return <CheckCheck className="h-4 w-4 text-whatsapp-icon" />;
    }
    return <Check className="h-4 w-4 text-whatsapp-icon" />;
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const isImageFile = (url: string | null, fileName: string | null, meta: any) => {
    if (!url) return false;
    if (meta?.type?.startsWith("image/")) return true;
    if (fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return true;
    return false;
  };

  const isAudioFile = (url: string | null, fileName: string | null, meta: any) => {
    if (!url) return false;
    if (meta?.type?.startsWith("audio/")) return true;
    if (fileName?.match(/\.(mp3|ogg|webm|wav|m4a)$/i)) return true;
    return false;
  };

  const isVideoFile = (url: string | null, fileName: string | null, meta: any) => {
    if (!url) return false;
    if (meta?.type?.startsWith("video/")) return true;
    if (fileName?.match(/\.(mp4|mov|avi|mkv|webm)$/i)) return true;
    return false;
  };

  const renderContent = () => {
    if (message.messageType === "file" && message.fileUrl) {
      if (isImageFile(message.fileUrl, message.fileName, message.fileMeta)) {
        return (
          <div className="max-w-[280px]">
            <img
              src={message.fileUrl}
              alt="Shared image"
              className="rounded-lg max-w-full h-auto"
            />
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-xs text-whatsapp-text-secondary">
                {formatTime(message.createdAt)}
              </span>
              {getStatusIcon()}
            </div>
          </div>
        );
      }

      if (isAudioFile(message.fileUrl, message.fileName, message.fileMeta)) {
        return (
          <VoiceMessagePlayer 
            message={message} 
            isOutgoing={isOutgoing} 
            formatTime={formatTime}
            getStatusIcon={getStatusIcon}
          />
        );
      }

      if (isVideoFile(message.fileUrl, message.fileName, message.fileMeta)) {
        return (
          <div className="max-w-[280px]">
            <video
              src={message.fileUrl}
              controls
              className="rounded-lg max-w-full h-auto"
              preload="metadata"
            />
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-xs text-whatsapp-text-secondary">
                {formatTime(message.createdAt)}
              </span>
              {getStatusIcon()}
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="h-12 w-12 rounded-lg bg-whatsapp-bg-dark flex items-center justify-center flex-shrink-0">
            <File className="h-6 w-6 text-whatsapp-text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-whatsapp-text-primary truncate">
              {message.fileName || "Document"}
            </div>
          </div>
          <a 
            href={message.fileUrl}
            download={message.fileName || undefined}
            className="p-2 hover:bg-whatsapp-hover rounded-full transition-colors"
          >
            <Download className="h-5 w-5 text-whatsapp-icon" />
          </a>
          <div className="flex items-center gap-1">
            <span className="text-xs text-whatsapp-text-secondary">
              {formatTime(message.createdAt)}
            </span>
            {getStatusIcon()}
          </div>
        </div>
      );
    }

    // Try to parse special message types (location, contacts, reaction)
    try {
      const parsed = JSON.parse(message.content);
      
      if (parsed.type === "location") {
        return (
          <div className="min-w-[200px]">
            <a
              href={`https://www.google.com/maps?q=${parsed.latitude},${parsed.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="bg-whatsapp-bg-dark rounded-lg overflow-hidden">
                <img
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${parsed.latitude},${parsed.longitude}&zoom=15&size=280x150&markers=color:red%7C${parsed.latitude},${parsed.longitude}&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8`}
                  alt="Location"
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="p-2">
                  <div className="flex items-center gap-2 text-whatsapp-text-primary">
                    <MapPin className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">{parsed.name || "Location"}</span>
                  </div>
                  {parsed.address && (
                    <p className="text-xs text-whatsapp-text-secondary mt-1 truncate">{parsed.address}</p>
                  )}
                </div>
              </div>
            </a>
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-xs text-whatsapp-text-secondary">
                {formatTime(message.createdAt)}
              </span>
              {getStatusIcon()}
            </div>
          </div>
        );
      }
      
      if (parsed.type === "contacts") {
        return (
          <div className="min-w-[200px]">
            {parsed.contacts.map((contact: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-whatsapp-bg-dark rounded-lg mb-2">
                <div className="h-10 w-10 rounded-full bg-whatsapp-green flex items-center justify-center">
                  <UserCircle className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-whatsapp-text-primary">{contact.name}</div>
                  {contact.phones && contact.phones.length > 0 && (
                    <div className="text-xs text-whatsapp-text-secondary">{contact.phones[0]}</div>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-xs text-whatsapp-text-secondary">
                {formatTime(message.createdAt)}
              </span>
              {getStatusIcon()}
            </div>
          </div>
        );
      }
      
      if (parsed.type === "reaction") {
        return (
          <div className="flex items-center gap-2">
            <span className="text-2xl">{parsed.emoji}</span>
            <span className="text-xs text-whatsapp-text-secondary italic">reacted</span>
            <span className="text-xs text-whatsapp-text-secondary">
              {formatTime(message.createdAt)}
            </span>
          </div>
        );
      }
    } catch {
      // Not a special message type, render as normal text
    }

    return (
      <>
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-xs text-whatsapp-text-secondary">
            {formatTime(message.createdAt)}
          </span>
          {getStatusIcon()}
        </div>
      </>
    );
  };

  return (
    <div className={cn("flex group relative", isOutgoing ? "justify-end" : "justify-start")}>
      <div className="relative">
        <div
          className={cn(
            "max-w-[65%] px-3 py-2 rounded-lg relative",
            isOutgoing
              ? "bg-whatsapp-bubble-out text-white rounded-tr-none"
              : "bg-whatsapp-bubble-in text-whatsapp-text-primary rounded-tl-none"
          )}
        >
          {renderContent()}
        </div>
        
        {/* Reactions display */}
        {reactions.length > 0 && (
          <div className={cn(
            "absolute -bottom-3 flex gap-0.5 px-1 py-0.5 bg-whatsapp-bg-dark rounded-full border border-whatsapp-divider shadow-sm",
            isOutgoing ? "right-2" : "left-2"
          )}>
            {reactions.map((r, idx) => (
              <span key={idx} className="text-sm">{r.emoji}</span>
            ))}
          </div>
        )}
        
        {/* Action buttons on hover */}
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1",
          isOutgoing ? "-left-20" : "-right-20"
        )}>
          {/* React button */}
          {!isOutgoing && onReact && (
            <div className="relative">
              <button
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="p-1 hover:bg-whatsapp-hover rounded"
                data-testid="button-react-message"
              >
                <Smile className="h-4 w-4 text-whatsapp-icon" />
              </button>
              {showReactionPicker && (
                <div className="absolute bottom-full left-0 mb-1 flex gap-1 p-2 bg-whatsapp-bg-panel border border-whatsapp-divider rounded-full shadow-xl z-50">
                  {quickReactions.map(emoji => (
                    <button
                      key={emoji}
                      className="text-lg hover:scale-125 transition-transform"
                      onClick={() => {
                        onReact(emoji);
                        setShowReactionPicker(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Delete button */}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 hover:bg-whatsapp-hover rounded"
              title="Delete message"
            >
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickReplyDropdown({
  isOpen,
  searchQuery,
  shortcuts,
  onSelect,
  selectedIndex,
}: {
  isOpen: boolean;
  searchQuery: string;
  shortcuts: MessageShortcut[];
  onSelect: (shortcut: MessageShortcut) => void;
  selectedIndex: number;
}) {
  if (!isOpen) return null;

  const filteredReplies = shortcuts.filter(reply =>
    reply.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filteredReplies.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-whatsapp-bg-panel border border-whatsapp-divider rounded-lg shadow-xl overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-whatsapp-divider">
        <span className="text-xs text-whatsapp-text-secondary">Quick Replies</span>
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        {filteredReplies.map((reply, index) => (
          <div
            key={reply.id}
            onClick={() => onSelect(reply)}
            className={cn(
              "px-4 py-3 cursor-pointer transition-colors border-b border-whatsapp-divider last:border-0",
              index === selectedIndex ? "bg-whatsapp-active" : "hover:bg-whatsapp-hover"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-whatsapp-green font-mono text-sm">/{reply.command}</span>
            </div>
            <p className="text-xs text-whatsapp-text-secondary line-clamp-2">
              {reply.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WhatsAppPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState<ChatWithDetails | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcutSearch, setShortcutSearch] = useState("");
  const [selectedShortcutIndex, setSelectedShortcutIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [showLinkOrderDialog, setShowLinkOrderDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedDesigners, setExpandedDesigners] = useState<string[]>([]);
  const [showCreateChatDialog, setShowCreateChatDialog] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatPhone, setNewChatPhone] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameChatName, setRenameChatName] = useState("");
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = user?.role === "admin";
  const isSupport = user?.role === "support";
  const isDesigner = user?.role === "designer";
  const isAdminOrSupport = isAdmin || isSupport;

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

  const { data: catalogs } = useQuery<{ id: number; name: string; description: string; price: number; imageUrl: string; isActive: boolean }[]>({
    queryKey: ["/api/catalogs"],
  });

  const activeCatalogs = catalogs?.filter(c => c.isActive) || [];

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

  // Note: WhatsApp Business API does not support "delete for everyone"
  // Messages can only be deleted locally in our system

  const reactToMessageMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: number; emoji: string }) =>
      apiRequest("POST", `/api/messages/${messageId}/react`, { emoji }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats", selectedChat?.id, "messages"] });
      toast({ title: "Reacted", description: "Reaction sent" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send reaction", variant: "destructive" });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: (chatId: number) =>
      apiRequest("DELETE", `/api/chats/${chatId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setSelectedChat(null);
      setShowContactInfo(false);
      toast({ title: "Deleted", description: "Chat deleted" });
    },
  });

  const sendVoiceWhatsAppMutation = useMutation({
    mutationFn: async ({ chatId, audioBlob }: { chatId: number; audioBlob: Blob }) => {
      const formData = new FormData();
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
        // For WhatsApp chats, use the WhatsApp media endpoint
        if (useWhatsApp) {
          formData.append("media", file);
          if (content && content !== "Sent a file") {
            formData.append("caption", content);
          }
          return fetch(`/api/chats/${chatId}/send-whatsapp-media`, {
            method: "POST",
            body: formData,
            credentials: "include",
          }).then(res => {
            if (!res.ok) throw new Error("Failed to send file to WhatsApp");
            return res.json();
          });
        }
        // For internal chats, use the internal upload endpoint
        formData.append("file", file);
        formData.append("content", content);
        return fetch(`/api/chats/${chatId}/messages/upload`, {
          method: "POST",
          body: formData,
          credentials: "include",
        }).then(res => res.json());
      }
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

  const markAsReadMutation = useMutation({
    mutationFn: async (chatId: number) => {
      return apiRequest("POST", `/api/chats/${chatId}/mark-read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
  });

  const handleSelectChat = (chat: ChatWithDetails) => {
    setSelectedChat(chat);
    setShowContactInfo(false);
    if (chat.unreadCount && chat.unreadCount > 0) {
      markAsReadMutation.mutate(chat.id);
    }
  };

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

  const emojiCategories = {
    smileys: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "🤔", "🤗", "🤭", "🥳", "😎", "🤩", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡"],
    gestures: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏"],
    hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"],
    objects: ["📱", "💻", "⌨️", "🖥️", "📷", "📹", "📞", "📧", "📝", "📂", "📁", "📊", "⏰", "💵", "💰", "💳", "🎁", "🎉", "✨", "🔥", "💯", "⭐", "✅", "❌", "⚠️", "🚀"],
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use audio/ogg or audio/mp4 for WhatsApp compatibility
      // WhatsApp supports: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg, audio/opus
      let mimeType = 'audio/ogg;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Use the actual mimeType from the recorder
        const actualMimeType = mediaRecorder.mimeType || mimeType;
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
        setAudioBlob(blob);
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
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
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
    
    if (selectedChat.clientPhone) {
      sendVoiceWhatsAppMutation.mutate({
        chatId: selectedChat.id,
        audioBlob: audioBlob,
      });
    } else {
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
    if (value.startsWith("/")) {
      setShowShortcuts(true);
      setShortcutSearch(value.slice(1));
      setSelectedShortcutIndex(0);
    } else {
      setShowShortcuts(false);
      setShortcutSearch("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showShortcuts && shortcuts) {
      const filteredReplies = shortcuts.filter(reply =>
        reply.command.toLowerCase().includes(shortcutSearch.toLowerCase())
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedShortcutIndex(prev => 
          prev < filteredReplies.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedShortcutIndex(prev => 
          prev > 0 ? prev - 1 : filteredReplies.length - 1
        );
      } else if (e.key === "Enter" && filteredReplies.length > 0) {
        e.preventDefault();
        handleShortcut(filteredReplies[selectedShortcutIndex]);
      } else if (e.key === "Escape") {
        setShowShortcuts(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAssign = (designerId: number | null) => {
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  }, []);

  const toggleDesigner = (designerId: string) => {
    setExpandedDesigners(prev => 
      prev.includes(designerId) 
        ? prev.filter(id => id !== designerId)
        : [...prev, designerId]
    );
  };

  const getChatsByDesigner = (designerId: number) => {
    return (chats || [])
      .filter(chat => !chat.isInternal && chat.assignedToId === designerId)
      .sort((a, b) => {
        const aTime = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
  };

  const getFilteredChats = () => {
    let filtered = (chats || []).filter(chat => !chat.isInternal);

    if (isDesigner) {
      filtered = filtered.filter(chat => 
        chat.assignedToId === user?.id || (chat.tags as string[] || []).includes("New")
      );
    }

    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(chat => {
        const name = chat.clientName?.toLowerCase() || "";
        const phone = chat.clientPhone?.toLowerCase() || "";
        return name.includes(query) || phone.includes(query);
      });
    }

    switch (activeTab) {
      case "new":
        filtered = filtered.filter(chat => (chat.tags as string[] || []).includes("New"));
        break;
      case "designer":
        break;
    }

    return filtered.sort((a, b) => {
      const aTime = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  };

  const filteredChats = getFilteredChats();

  const getDateLabel = (date: Date | string | null) => {
    if (!date) return "Unknown";
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "dd/MM/yyyy");
  };

  const groupedMessages: { date: Date; messages: Message[] }[] = [];
  (messages || []).forEach(message => {
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    const msgDate = message.createdAt ? new Date(message.createdAt) : new Date();
    if (lastGroup && isSameDay(lastGroup.date, msgDate)) {
      lastGroup.messages.push(message);
    } else {
      groupedMessages.push({
        date: msgDate,
        messages: [message],
      });
    }
  });

  if (isLoading) return null;

  const displayName = selectedChat 
    ? (selectedChat.clientName && selectedChat.clientName !== "New Lead" && selectedChat.clientName.trim() !== "" 
        ? selectedChat.clientName 
        : selectedChat.clientPhone || "Unknown")
    : "";

  const currentTag = selectedChat ? ((selectedChat.tags as string[] || [])[0] as ChatTag || "New") : "New";
  const canEditTag = isAdmin || isSupport || 
    (isDesigner && selectedChat?.assignedToId === user?.id);
  const canAssign = isAdmin || isSupport;

  const sharedImages = (messages || []).filter(m => 
    m.messageType === "file" && m.fileUrl && m.fileMeta && 
    (m.fileMeta as any)?.type?.startsWith("image/")
  );
  const sharedFiles = (messages || []).filter(m => 
    m.messageType === "file" && m.fileUrl && 
    !(m.fileMeta as any)?.type?.startsWith("image/") && 
    !(m.fileMeta as any)?.type?.startsWith("audio/")
  );

  return (
    <div className="flex h-screen w-full bg-whatsapp-bg-dark">
      {/* Left Sidebar - Chat List */}
      <div className="w-[400px] flex-shrink-0 flex flex-col h-full bg-whatsapp-bg-panel border-r border-whatsapp-divider">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-whatsapp-header">
          <Avatar className="h-10 w-10 cursor-pointer">
            <AvatarFallback 
              className="text-white font-medium"
              style={{ backgroundColor: getAvatarColor(user?.name || "U") }}
            >
              {user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-2">
            {isAdminOrSupport && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowCreateChatDialog(true)}
                className="text-whatsapp-icon hover:text-whatsapp-text-primary hover:bg-whatsapp-hover"
                data-testid="button-create-chat"
              >
                <Plus className="h-5 w-5" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-whatsapp-icon hover:text-whatsapp-text-primary hover:bg-whatsapp-hover"
                  data-testid="button-menu"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56 bg-whatsapp-bg-panel border-whatsapp-divider"
              >
                <DropdownMenuItem className="text-whatsapp-text-primary hover:bg-whatsapp-hover cursor-pointer">
                  Starred messages
                </DropdownMenuItem>
                <DropdownMenuItem className="text-whatsapp-text-primary hover:bg-whatsapp-hover cursor-pointer">
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-whatsapp-icon" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or start new chat"
              className="pl-10 bg-whatsapp-bg-input border-0 text-whatsapp-text-primary placeholder:text-whatsapp-text-secondary rounded-lg h-9"
              data-testid="input-search-chats"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-2 py-1">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-transparent gap-1 h-auto p-0">
              {isAdminOrSupport ? (
                <>
                  <TabsTrigger 
                    value="all"
                    className="flex-1 px-3 py-1.5 text-xs rounded-full data-[state=active]:bg-whatsapp-green data-[state=active]:text-white bg-whatsapp-bg-input text-whatsapp-text-secondary"
                    data-testid="tab-all"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger 
                    value="new"
                    className="flex-1 px-3 py-1.5 text-xs rounded-full data-[state=active]:bg-whatsapp-green data-[state=active]:text-white bg-whatsapp-bg-input text-whatsapp-text-secondary"
                    data-testid="tab-new"
                  >
                    New
                  </TabsTrigger>
                  <TabsTrigger 
                    value="designer"
                    className="flex-1 px-3 py-1.5 text-xs rounded-full data-[state=active]:bg-whatsapp-green data-[state=active]:text-white bg-whatsapp-bg-input text-whatsapp-text-secondary"
                    data-testid="tab-designer"
                  >
                    By Designer
                  </TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger 
                    value="all"
                    className="flex-1 px-3 py-1.5 text-xs rounded-full data-[state=active]:bg-whatsapp-green data-[state=active]:text-white bg-whatsapp-bg-input text-whatsapp-text-secondary"
                    data-testid="tab-my"
                  >
                    My Chats
                  </TabsTrigger>
                  <TabsTrigger 
                    value="new"
                    className="flex-1 px-3 py-1.5 text-xs rounded-full data-[state=active]:bg-whatsapp-green data-[state=active]:text-white bg-whatsapp-bg-input text-whatsapp-text-secondary"
                    data-testid="tab-new"
                  >
                    New
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </Tabs>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          {activeTab === "designer" && isAdminOrSupport ? (
            <div className="py-1">
              {designers.map(designer => {
                const designerChats = getChatsByDesigner(designer.id);
                const isExpanded = expandedDesigners.includes(String(designer.id));
                
                return (
                  <Collapsible 
                    key={designer.id} 
                    open={isExpanded}
                    onOpenChange={() => toggleDesigner(String(designer.id))}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-whatsapp-hover transition-colors">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-whatsapp-green text-white">
                            {designer.name?.charAt(0) || "D"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <div className="text-whatsapp-text-primary font-medium">
                            {designer.name}
                          </div>
                          <div className="text-xs text-whatsapp-text-secondary">
                            {designerChats.length} chats
                          </div>
                        </div>
                        <ChevronDown className={cn(
                          "h-4 w-4 text-whatsapp-icon transition-transform",
                          isExpanded && "rotate-180"
                        )} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-4">
                        {designerChats.map(chat => (
                          <ChatListItem
                            key={chat.id}
                            chat={chat}
                            isActive={selectedChat?.id === chat.id}
                            onClick={() => handleSelectChat(chat)}
                            showAssignee={false}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <div>
              {filteredChats.length === 0 ? (
                <div className="text-center py-8 text-whatsapp-text-secondary">
                  No chats found
                </div>
              ) : (
                filteredChats.map(chat => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isActive={selectedChat?.id === chat.id}
                    onClick={() => handleSelectChat(chat)}
                    showAssignee={isAdminOrSupport}
                  />
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Center - Conversation View */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col bg-whatsapp-bg-chat min-w-0">
          {/* Header */}
          <div 
            onClick={() => setShowContactInfo(!showContactInfo)}
            className="flex items-center justify-between px-4 py-2.5 bg-whatsapp-header cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback 
                  className="text-white font-medium"
                  style={{ backgroundColor: getAvatarColor(displayName) }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium text-whatsapp-text-primary">
                  {displayName}
                </h3>
                {selectedChat.clientPhone && (
                  <p className="text-xs text-whatsapp-text-secondary">
                    {selectedChat.clientPhone}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-whatsapp-icon hover:text-whatsapp-text-primary transition-colors">
                <Search className="h-5 w-5" />
              </button>
              <button className="text-whatsapp-icon hover:text-whatsapp-text-primary transition-colors">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div 
            className="flex-1 relative overflow-hidden min-h-0"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 z-50 bg-whatsapp-bg-chat/90 flex items-center justify-center border-2 border-dashed border-whatsapp-green rounded-lg">
                <div className="text-center">
                  <Upload className="h-16 w-16 text-whatsapp-green mx-auto mb-4" />
                  <p className="text-lg font-medium text-whatsapp-text-primary">Drop files here to send</p>
                  <p className="text-sm text-whatsapp-text-secondary">Images, Documents, Videos</p>
                </div>
              </div>
            )}
            <ScrollArea 
              className="h-full px-16 py-4"
              style={{ 
                backgroundImage: `url(${chatBgPattern})`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            >
              <div className="space-y-4">
              {groupedMessages.map((group, groupIndex) => (
                <div key={groupIndex}>
                  <div className="flex justify-center mb-4">
                    <span className="px-3 py-1 bg-whatsapp-bubble-in text-whatsapp-text-secondary text-xs rounded-lg">
                      {getDateLabel(group.date)}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {group.messages.map(message => (
                      <MessageBubble 
                        key={message.id} 
                        message={message}
                        onDelete={isAdminOrSupport ? () => deleteMessageMutation.mutate(message.id) : undefined}
                        onReact={isAdminOrSupport && message.senderType === "client" && message.externalMessageId 
                          ? (emoji: string) => reactToMessageMutation.mutate({ messageId: message.id, emoji }) 
                          : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          </div>

          {/* Input */}
          <div className="relative px-4 py-3 bg-whatsapp-header">
            <QuickReplyDropdown
              isOpen={showShortcuts}
              searchQuery={shortcutSearch}
              shortcuts={shortcuts || []}
              onSelect={handleShortcut}
              selectedIndex={selectedShortcutIndex}
            />

            {selectedFile && (
              <div className="mb-2 p-2 rounded-lg flex items-center gap-2 max-w-xs bg-whatsapp-bg-input">
                {selectedFile.type.startsWith("image/") ? (
                  <ImageIcon className="w-5 h-5 text-whatsapp-icon" />
                ) : (
                  <File className="w-5 h-5 text-whatsapp-icon" />
                )}
                <span className="text-sm text-whatsapp-text-primary truncate flex-1">{selectedFile.name}</span>
                <button 
                  className="p-1 hover:bg-whatsapp-hover rounded"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="w-4 h-4 text-whatsapp-icon" />
                </button>
              </div>
            )}

            {showEmojiPicker && (
              <div className="absolute bottom-20 left-4 rounded-lg border shadow-xl z-50 p-3 bg-whatsapp-bg-panel border-whatsapp-divider">
                <div className="flex gap-2 mb-2 border-b pb-2 border-whatsapp-divider">
                  {Object.keys(emojiCategories).map(cat => (
                    <button
                      key={cat}
                      className="text-xs px-2 py-1 rounded text-whatsapp-text-secondary hover:bg-whatsapp-hover capitalize"
                    >
                      {cat === "smileys" ? "😀" : cat === "gestures" ? "👋" : cat === "hearts" ? "❤️" : "📱"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                  {Object.values(emojiCategories).flat().map((emoji, idx) => (
                    <button
                      key={idx}
                      className="text-xl p-1 hover:bg-whatsapp-hover rounded"
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

            {showCatalogPicker && (
              <div className="absolute bottom-20 left-4 rounded-lg border shadow-xl z-50 p-3 bg-whatsapp-bg-panel border-whatsapp-divider w-80 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-3 border-b pb-2 border-whatsapp-divider">
                  <h4 className="font-medium text-whatsapp-text-primary flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" />
                    Catalog Items
                  </h4>
                  <button 
                    onClick={() => setShowCatalogPicker(false)}
                    className="text-whatsapp-text-secondary hover:text-whatsapp-text-primary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {activeCatalogs.length === 0 ? (
                  <p className="text-sm text-whatsapp-text-secondary text-center py-4">No catalog items available</p>
                ) : (
                  <div className="space-y-2">
                    {activeCatalogs.map(item => (
                      <button
                        key={item.id}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-whatsapp-hover text-left"
                        onClick={() => {
                          const catalogMessage = `*${item.name}*\n${item.description}\n\nPrice: Rs. ${(item.price / 100).toLocaleString()}`;
                          setMessageText(catalogMessage);
                          setShowCatalogPicker(false);
                          inputRef.current?.focus();
                        }}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-whatsapp-bg-input flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-whatsapp-icon" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-whatsapp-text-primary truncate">{item.name}</p>
                          <p className="text-xs text-whatsapp-text-secondary truncate">{item.description}</p>
                          <p className="text-sm text-whatsapp-green font-medium">Rs. {(item.price / 100).toLocaleString()}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isRecording || audioBlob ? (
              <div className="flex items-center gap-3 w-full">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cancelRecording}
                  className="text-red-400 hover:bg-whatsapp-hover"
                  data-testid="button-cancel-recording"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
                
                <div className="flex-1 flex items-center gap-3 px-4 py-2 rounded-lg bg-whatsapp-bg-input">
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
                      <Mic className="w-5 h-5 text-whatsapp-green" />
                      <span className="text-white text-sm">{formatRecordingTime(recordingTime)}</span>
                      <span className="text-whatsapp-text-secondary text-sm">Voice message ready</span>
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
                    className="text-white bg-whatsapp-green hover:bg-whatsapp-green-dark rounded-full"
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
                  className={cn("text-whatsapp-icon hover:bg-whatsapp-hover", showEmojiPicker && "text-whatsapp-green")}
                  data-testid="button-emoji"
                >
                  <Smile className="w-6 h-6" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  data-testid="input-file-upload"
                />
                <Button 
                  variant="ghost"
                  size="icon"
                  className="text-whatsapp-icon hover:bg-whatsapp-hover"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-attach-file"
                >
                  <Paperclip className="w-6 h-6" />
                </Button>
                <Button 
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCatalogPicker(!showCatalogPicker)}
                  className={cn("text-whatsapp-icon hover:bg-whatsapp-hover", showCatalogPicker && "text-whatsapp-green")}
                  data-testid="button-catalog"
                >
                  <ShoppingBag className="w-6 h-6" />
                </Button>
                <div className="flex-1">
                  <Textarea
                    ref={inputRef}
                    placeholder="Type a message"
                    className="border-0 text-whatsapp-text-primary bg-whatsapp-bg-input resize-none min-h-[40px] max-h-32 text-sm rounded-lg placeholder:text-whatsapp-text-secondary"
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
                    className="text-whatsapp-icon hover:bg-whatsapp-hover disabled:opacity-50"
                    data-testid="button-send-message"
                  >
                    <Send className="w-6 h-6" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={startRecording}
                    className="text-whatsapp-icon hover:bg-whatsapp-hover"
                    data-testid="button-start-recording"
                  >
                    <Mic className="w-6 h-6" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-whatsapp-bg-chat">
          <div className="text-center">
            <div className="w-64 h-64 mx-auto mb-4 opacity-20">
              <svg viewBox="0 0 303 172" className="fill-whatsapp-text-secondary">
                <path d="M229.565 160.229C262.212 149.245 286.931 118.241 283.39 73.4194C278.009 5.31929 212.315 -11.5738 171.472 8.48673C115.998 37.0981 60.0166 25.0687 28.9267 69.5983C-2.16336 114.128 24.9692 162.53 68.849 168.993C112.729 175.456 186.392 175.074 229.565 160.229Z" />
                <path fill="#FFFFFF" d="M135.5 80.5C135.5 87.4036 129.904 93 123 93C116.096 93 110.5 87.4036 110.5 80.5C110.5 73.5964 116.096 68 123 68C129.904 68 135.5 73.5964 135.5 80.5Z" />
                <path fill="#FFFFFF" d="M192.5 80.5C192.5 87.4036 186.904 93 180 93C173.096 93 167.5 87.4036 167.5 80.5C167.5 73.5964 173.096 68 180 68C186.904 68 192.5 73.5964 192.5 80.5Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-light text-whatsapp-text-primary mb-2">
              WhatsApp Web
            </h2>
            <p className="text-sm text-whatsapp-text-secondary max-w-md">
              Send and receive messages without keeping your phone online.
              <br />
              Select a chat to start messaging.
            </p>
          </div>
        </div>
      )}

      {/* Right Panel - Contact Info */}
      {showContactInfo && selectedChat && (
        <div className="w-[340px] flex flex-col bg-whatsapp-bg-panel border-l border-whatsapp-divider">
          <div className="flex items-center gap-4 px-4 py-4 bg-whatsapp-header">
            <button
              onClick={() => setShowContactInfo(false)}
              className="text-whatsapp-icon hover:text-whatsapp-text-primary transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            <span className="text-whatsapp-text-primary font-medium">Contact info</span>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col items-center py-8 bg-whatsapp-header">
              <Avatar className="h-48 w-48 mb-4">
                <AvatarFallback 
                  className="text-white text-6xl font-medium"
                  style={{ backgroundColor: getAvatarColor(displayName) }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-medium text-whatsapp-text-primary">
                {displayName}
              </h2>
              <p className="text-sm text-whatsapp-text-secondary mt-1">
                {selectedChat.clientPhone || "No phone number"}
              </p>
            </div>

            <div className="h-2 bg-whatsapp-bg-dark" />

            <div className="px-6 py-4 bg-whatsapp-header">
              <label className="text-sm text-whatsapp-text-secondary mb-2 block">
                Chat Tag
              </label>
              <Select
                value={currentTag}
                onValueChange={handleSetTag}
                disabled={!canEditTag}
              >
                <SelectTrigger className="bg-whatsapp-bg-input border-0 text-whatsapp-text-primary">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-3 w-3 rounded-full", TAG_CONFIG[currentTag]?.bgClass || "bg-tag-new")} />
                      <span>{TAG_CONFIG[currentTag]?.label || currentTag}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-whatsapp-bg-panel border-whatsapp-divider">
                  {CHAT_TAGS.map((tag) => (
                    <SelectItem 
                      key={tag} 
                      value={tag}
                      className="text-whatsapp-text-primary focus:bg-whatsapp-hover focus:text-whatsapp-text-primary"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("h-3 w-3 rounded-full", TAG_CONFIG[tag].bgClass)} />
                        <span>{TAG_CONFIG[tag].label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canAssign && (
              <>
                <div className="h-px bg-whatsapp-divider" />
                <div className="px-6 py-4 bg-whatsapp-header">
                  <label className="text-sm text-whatsapp-text-secondary mb-2 block">
                    Assigned Designer
                  </label>
                  <Select
                    value={String(selectedChat.assignedToId || "unassigned")}
                    onValueChange={(value) => handleAssign(value === "unassigned" ? null : Number(value))}
                  >
                    <SelectTrigger className="bg-whatsapp-bg-input border-0 text-whatsapp-text-primary">
                      <SelectValue>
                        {selectedChat.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-whatsapp-green text-white text-xs">
                                {selectedChat.assignee.name?.charAt(0) || "D"}
                              </AvatarFallback>
                            </Avatar>
                            <span>{selectedChat.assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-whatsapp-text-secondary">Unassigned</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-whatsapp-bg-panel border-whatsapp-divider">
                      <SelectItem 
                        value="unassigned"
                        className="text-whatsapp-text-primary focus:bg-whatsapp-hover focus:text-whatsapp-text-primary"
                      >
                        <span className="text-whatsapp-text-secondary">Unassigned</span>
                      </SelectItem>
                      {designers.map(designer => (
                        <SelectItem 
                          key={designer.id} 
                          value={String(designer.id)}
                          className="text-whatsapp-text-primary focus:bg-whatsapp-hover focus:text-whatsapp-text-primary"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-whatsapp-green text-white text-xs">
                                {designer.name?.charAt(0) || "D"}
                              </AvatarFallback>
                            </Avatar>
                            <span>{designer.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="h-2 bg-whatsapp-bg-dark" />

            {linkedOrder && (
              <>
                <div className="px-6 py-4 bg-whatsapp-header">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-whatsapp-text-secondary">Linked Order</label>
                    <button
                      onClick={handleUnlinkOrder}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Unlink
                    </button>
                  </div>
                  <button
                    onClick={() => setShowOrderPanel(true)}
                    className="w-full p-3 rounded-lg bg-whatsapp-bg-input hover:bg-whatsapp-hover transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-whatsapp-teal" />
                      <span className="text-whatsapp-text-primary font-medium">
                        {linkedOrder.orderNumber || `#${linkedOrder.id}`}
                      </span>
                    </div>
                    <p className="text-xs text-whatsapp-text-secondary mt-1">
                      {linkedOrder.clientName} - {linkedOrder.status}
                    </p>
                  </button>
                </div>
                <div className="h-2 bg-whatsapp-bg-dark" />
              </>
            )}

            {!linkedOrder && isAdminOrSupport && (
              <>
                <div className="px-6 py-4 bg-whatsapp-header">
                  <Button
                    variant="outline"
                    onClick={() => setShowLinkOrderDialog(true)}
                    className="w-full border-whatsapp-divider text-whatsapp-text-primary hover:bg-whatsapp-hover"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Link to Order
                  </Button>
                </div>
                <div className="h-2 bg-whatsapp-bg-dark" />
              </>
            )}

            <div className="bg-whatsapp-header">
              <div className="px-6 py-3 flex items-center justify-between">
                <span className="text-whatsapp-text-secondary text-sm">Media, links and docs</span>
                <span className="text-whatsapp-teal text-sm">
                  {sharedImages.length + sharedFiles.length}
                </span>
              </div>
              
              {sharedImages.length > 0 && (
                <div className="px-6 pb-4 grid grid-cols-3 gap-1">
                  {sharedImages.slice(0, 6).map(img => (
                    <div 
                      key={img.id} 
                      className="aspect-square bg-whatsapp-bg-input rounded overflow-hidden"
                    >
                      {img.fileUrl && (
                        <img 
                          src={img.fileUrl} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-2 bg-whatsapp-bg-dark" />

            <div className="bg-whatsapp-header">
              <button className="w-full px-6 py-4 flex items-center gap-6 hover:bg-whatsapp-hover transition-colors">
                <Star className="h-5 w-5 text-whatsapp-icon" />
                <span className="text-whatsapp-text-primary">Starred messages</span>
              </button>
              <button className="w-full px-6 py-4 flex items-center gap-6 hover:bg-whatsapp-hover transition-colors">
                <Bell className="h-5 w-5 text-whatsapp-icon" />
                <span className="text-whatsapp-text-primary">Mute notifications</span>
              </button>

              {isAdminOrSupport && (
                <>
                  <button 
                    onClick={() => {
                      setRenameChatName(displayName);
                      setShowRenameDialog(true);
                    }}
                    className="w-full px-6 py-4 flex items-center gap-6 hover:bg-whatsapp-hover transition-colors"
                  >
                    <Lock className="h-5 w-5 text-whatsapp-icon" />
                    <span className="text-whatsapp-text-primary">Rename chat</span>
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => setShowDeleteChatConfirm(true)}
                      className="w-full px-6 py-4 flex items-center gap-6 hover:bg-whatsapp-hover transition-colors"
                    >
                      <Trash2 className="h-5 w-5 text-red-400" />
                      <span className="text-red-400">Delete chat</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={showLinkOrderDialog} onOpenChange={setShowLinkOrderDialog}>
        <DialogContent className="border bg-whatsapp-bg-panel border-whatsapp-divider max-w-md">
          <DialogHeader>
            <DialogTitle className="text-whatsapp-text-primary">Link to Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {orders?.filter(o => o.advancePaymentStatus === "approved").map(order => (
              <button
                key={order.id}
                className="w-full text-left p-3 rounded-lg transition-colors hover:bg-whatsapp-hover bg-whatsapp-bg-input"
                onClick={() => handleLinkOrder(order.id)}
                data-testid={`link-order-${order.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-whatsapp-text-primary">{order.orderNumber || `Order #${order.id}`}</span>
                  <Badge variant="outline" className="text-xs border-whatsapp-divider text-whatsapp-text-secondary">
                    {order.status}
                  </Badge>
                </div>
                <p className="text-sm text-whatsapp-text-secondary mt-1">{order.clientName}</p>
              </button>
            ))}
            {(!orders || orders.filter(o => o.advancePaymentStatus === "approved").length === 0) && (
              <p className="text-center text-whatsapp-text-secondary py-4">No orders available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOrderPanel} onOpenChange={setShowOrderPanel}>
        <DialogContent className="border bg-whatsapp-bg-panel border-whatsapp-divider max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-whatsapp-text-primary flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-whatsapp-teal" />
              Linked Order Details
            </DialogTitle>
          </DialogHeader>
          {linkedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-whatsapp-text-secondary mb-1">Order ID</p>
                  <p className="font-medium text-whatsapp-text-primary">{linkedOrder.orderNumber || `#${linkedOrder.id}`}</p>
                </div>
                <div>
                  <p className="text-xs text-whatsapp-text-secondary mb-1">Status</p>
                  <Badge className="capitalize">{linkedOrder.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-whatsapp-text-secondary mb-1">Client</p>
                  <p className="font-medium text-whatsapp-text-primary">{linkedOrder.clientName}</p>
                </div>
                <div>
                  <p className="text-xs text-whatsapp-text-secondary mb-1">Phone</p>
                  <p className="font-medium text-whatsapp-text-primary">{linkedOrder.clientPhone || "—"}</p>
                </div>
                {isAdmin && (
                  <>
                    <div>
                      <p className="text-xs text-whatsapp-text-secondary mb-1">Total Price</p>
                      <p className="font-medium text-whatsapp-text-primary">₨{((linkedOrder.totalPrice || 0) / 100).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-whatsapp-text-secondary mb-1">Payment Status</p>
                      <Badge variant={linkedOrder.paymentStatus === "paid" ? "default" : "secondary"}>
                        {linkedOrder.paymentStatus}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-4 border-t border-whatsapp-divider">
                <Button 
                  variant="outline" 
                  className="flex-1 border-whatsapp-divider text-whatsapp-text-primary hover:bg-whatsapp-hover"
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

      <Dialog open={showCreateChatDialog} onOpenChange={setShowCreateChatDialog}>
        <DialogContent className="border bg-whatsapp-bg-panel border-whatsapp-divider max-w-md">
          <DialogHeader>
            <DialogTitle className="text-whatsapp-text-primary">Create New Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-whatsapp-text-secondary">Client Name *</label>
              <Input
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                placeholder="Enter client name"
                className="border-whatsapp-divider bg-whatsapp-bg-input text-whatsapp-text-primary"
                data-testid="input-new-chat-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-whatsapp-text-secondary">Phone Number</label>
              <Input
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="border-whatsapp-divider bg-whatsapp-bg-input text-whatsapp-text-primary"
                data-testid="input-new-chat-phone"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateChatDialog(false)}
                className="border-whatsapp-divider text-whatsapp-text-secondary hover:bg-whatsapp-hover"
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
                className="bg-whatsapp-green hover:bg-whatsapp-green-dark text-white"
                data-testid="button-submit-create-chat"
              >
                Create Chat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="border bg-whatsapp-bg-panel border-whatsapp-divider max-w-md">
          <DialogHeader>
            <DialogTitle className="text-whatsapp-text-primary">Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-whatsapp-text-secondary">Chat Name</label>
              <Input
                value={renameChatName}
                onChange={(e) => setRenameChatName(e.target.value)}
                placeholder="Enter new name"
                className="border-whatsapp-divider bg-whatsapp-bg-input text-whatsapp-text-primary"
                data-testid="input-rename-chat"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowRenameDialog(false)}
                className="border-whatsapp-divider text-whatsapp-text-secondary hover:bg-whatsapp-hover"
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
                className="bg-whatsapp-green hover:bg-whatsapp-green-dark text-white"
                data-testid="button-submit-rename"
              >
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteChatConfirm} onOpenChange={setShowDeleteChatConfirm}>
        <DialogContent className="border bg-whatsapp-bg-panel border-whatsapp-divider max-w-md">
          <DialogHeader>
            <DialogTitle className="text-whatsapp-text-primary">Delete Chat</DialogTitle>
          </DialogHeader>
          <p className="text-whatsapp-text-secondary">
            Are you sure you want to delete this chat? This will also delete all messages. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteChatConfirm(false)}
              className="border-whatsapp-divider text-whatsapp-text-secondary hover:bg-whatsapp-hover"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedChat) {
                  deleteChatMutation.mutate(selectedChat.id);
                  setShowDeleteChatConfirm(false);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
