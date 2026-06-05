import React, { useState, useEffect, useRef } from "react";
import { ChatMessage, PlayerProfile } from "../types";
import { 
  Send, 
  Globe, 
  Lock, 
  User, 
  MessageSquare, 
  Search, 
  ShieldCheck,
  Trash2,
  Volume2,
  VolumeX,
  LogOut
} from "lucide-react";

interface ChatProps {
  profile: PlayerProfile;
  players: PlayerProfile[];
  onlinePlayers: { id: string; username: string }[];
  chatMessages: ChatMessage[];
  onSendMessage: (text: string, receiverId: string | null) => void;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onMuteUser?: (userId: string) => Promise<void>;
  onUnmuteUser?: (userId: string) => Promise<void>;
  onBootUser?: (userId: string) => Promise<void>;
}

export function Chat({ profile, players, onlinePlayers, chatMessages, onSendMessage, onDeleteMessage, onMuteUser, onUnmuteUser, onBootUser }: ChatProps) {
  const [activeSubTab, setActiveSubTab] = useState<"shout" | "pm">("shout");
  const [selectedRecipient, setSelectedRecipient] = useState<PlayerProfile | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isAdmin] = useState(profile?.role === "admin");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // Check if scrolled to bottom
  const isAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 50; // Within 50px of bottom
  };

  // Auto scroll to bottom only if user was already at the bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Track scroll position to detect if user is reading history
  const handleScroll = () => {
    shouldAutoScrollRef.current = isAtBottom();
  };

  // Only auto-scroll if user was already at the bottom or this is their own message
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [chatMessages]);

  // Auto-scroll when switching tabs or recipients
  useEffect(() => {
    shouldAutoScrollRef.current = true;
    scrollToBottom();
    setSelectedMessageId(null); // Clear message selection when switching tabs
  }, [activeSubTab, selectedRecipient]);

  // Mark messages as read when viewing PM tab
  useEffect(() => {
    if (activeSubTab === "pm") {
      const unreadMessages = chatMessages.filter(msg => 
        msg.receiverId === profile.id && // User is the recipient
        msg.senderId !== profile.id && // Message is from someone else
        !msg.isRead // Message hasn't been read
      );

      if (unreadMessages.length > 0) {
        const unreadMessageIds = unreadMessages.map(msg => msg.id);
        fetch("/api/messages/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: profile.id,
            messageIds: unreadMessageIds
          })
        }).catch(err => console.error("Failed to mark messages as read:", err));
      }
    }
  }, [activeSubTab, chatMessages, profile.id]);

  // Check if player is online
  const isOnline = (playerId: string) => {
    return onlinePlayers.some(p => p.id === playerId) || playerId === profile.id;
  };

  // Filter messages for current view
  const filteredMessages = chatMessages.filter(msg => {
    if (activeSubTab === "shout") {
      return msg.receiverId === null;
    } else {
      // Direct message: either from sender to recipient or vice versa
      if (!selectedRecipient) return false;
      return (
        (msg.senderId === profile.id && msg.receiverId === selectedRecipient.id) ||
        (msg.senderId === selectedRecipient.id && msg.receiverId === profile.id)
      );
    }
  });

  // Filter player list for DM initialization
  const candidateRecipients = players
    .filter(p => p.id !== profile.id)
    .filter(p => p.username.toLowerCase().includes(searchQuery.toLowerCase()));

  // Count unread DMs
  const unreadDMCount = chatMessages.filter(msg => 
    msg.receiverId === profile.id && // User is the recipient
    msg.senderId !== profile.id && // Message is from someone else
    !msg.isRead // Message hasn't been read
  ).length;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    if (activeSubTab === "shout") {
      onSendMessage(messageText, null);
    } else {
      if (!selectedRecipient) return;
      onSendMessage(messageText, selectedRecipient.id);
    }
    setMessageText("");
    setSelectedMessageId(null); // Clear message selection after sending
  };

  // Auto-select a user on switching to pm tab if none selected
  useEffect(() => {
    if (activeSubTab === "pm" && !selectedRecipient && candidateRecipients.length > 0) {
      setSelectedRecipient(candidateRecipients[0]);
    }
  }, [activeSubTab]);

  return (
    <div id="chat-section" className="bg-white border border-[#d2d2c8] rounded-3xl shadow-sm flex flex-col md:flex-row h-[550px] md:h-[550px]" style={{ overflow: "visible" }}>
      {/* Side bar: Tab switching and user search list */}
      <div className="w-full md:w-64 flex flex-col shrink-0 border-b md:border-b-0 md:border-r border-[#e5e5dd] bg-[#fafaf7]">
        {/* Navigation Selector */}
        <div className="px-2 md:px-3 pb-2 md:pb-3 border-b border-[#e5e5dd] flex gap-2 shrink-0" style={{ paddingTop: "1.25rem" }}>
          <button
            onClick={() => setActiveSubTab("shout")}
            className={`flex-1 py-1.5 md:py-2 px-2 md:px-3 rounded-lg md:rounded-xl text-[11px] md:text-xs font-bold tracking-tight transition flex items-center justify-center gap-0.5 md:gap-1.5 cursor-pointer relative ${
              activeSubTab === "shout"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-[#8c8c82] hover:bg-white border border-transparent hover:border-[#e5e5dd] hover:text-[#5a5a40]"
            }`}
          >
            <Globe className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <span className="hidden sm:inline">Shout Box</span>
          </button>
          <button
            onClick={() => setActiveSubTab("pm")}
            className={`flex-1 py-1.5 md:py-2 px-2 md:px-3 rounded-lg md:rounded-xl text-[11px] md:text-xs font-bold tracking-tight transition flex items-center justify-center gap-0.5 md:gap-1.5 cursor-pointer relative ${
              activeSubTab === "pm"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-[#8c8c82] hover:bg-white border border-transparent hover:border-[#e5e5dd] hover:text-[#5a5a40]"
            }`}
          >
            <Lock className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <span className="hidden sm:inline">Direct DM</span>
            {unreadDMCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full h-5 w-5 flex items-center justify-center z-10">
                {unreadDMCount > 9 ? "9+" : unreadDMCount}
              </span>
            )}
          </button>
        </div>

        {/* Players List for PM Tab - visible on all sizes when in PM tab */}
        {activeSubTab === "pm" ? (
          <div className="flex-1 flex flex-col overflow-hidden max-h-32 md:max-h-none">
            <div className="p-2 md:p-3 border-b border-[#e5e5dd] relative shrink-0">
              <Search className="absolute left-5 md:left-6 top-4 md:top-5.5 h-3 md:h-3.5 w-3 md:w-3.5 text-[#a0a095]" />
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#f0f0e8]/50 border border-[#e5e5dd] rounded-lg md:rounded-xl pl-8 md:pl-9 pr-3 md:pr-4 py-1.5 md:py-2 text-[11px] md:text-xs outline-none focus:ring-1 focus:ring-[#5a5a40] font-medium"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 md:p-2 space-y-0.5 md:space-y-1">
              {candidateRecipients.length === 0 ? (
                <p className="text-[9px] md:text-[10px] text-center text-[#8c8c82] italic py-3 md:py-6">No other players found.</p>
              ) : (
                candidateRecipients.map((p) => {
                  const online = isOnline(p.id);
                  const isSelected = selectedRecipient?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedRecipient(p)}
                      className={`w-full flex items-center justify-between p-1.5 md:p-2 rounded-lg md:rounded-xl text-left text-[11px] md:text-xs transition cursor-pointer ${
                        isSelected 
                          ? "bg-[#5a5a40]/10 border-l-4 border-[#5a5a40]" 
                          : "hover:bg-[#f0f0e8]/40"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 md:gap-2 truncate min-w-0">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#e5e5dd] flex items-center justify-center shrink-0">
                          <User className="h-2.5 w-2.5 md:h-3 md:w-3 text-[#5a5a40]" />
                        </div>
                        <div className="truncate min-w-0">
                          <p className="font-semibold text-[#2d2d2d] truncate text-[10px] md:text-xs">{p.username}</p>
                          <p className="text-[8px] md:text-[9px] text-[#8c8c82] font-mono">{p.score} pts</p>
                        </div>
                      </div>

                      <div className="flex items-center pr-0.5 md:pr-1 select-none shrink-0">
                        <span 
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            online ? "bg-green-500 animate-pulse" : "bg-gray-300"
                          }`}
                          title={online ? "Online" : "Offline"}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          // Global Shoutbox info - hidden on mobile
          <div className="flex-1 p-4 overflow-y-auto flex flex-col hidden md:flex">
            <div className="mt-auto border-t border-[#e5e5dd] pt-4 text-[10px] text-[#8c8c82] leading-relaxed">
              <p className="font-medium text-[#5a5a40] mb-1 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[#8c8c5a]" /> 
                Explorer Rules:
              </p>
              <p>Keep comments helpful! Share coordinate clues, check point hints, and celebrate approved AI proofs together.</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Feed Block */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Recipient / Channel Banner */}
        <header className="h-12 border-b border-[#e5e5dd] px-4 flex items-center justify-between bg-[#fafaf7] shrink-0">
          <div className="flex items-center gap-2">
            {activeSubTab === "shout" ? (
              <>
                <Globe className="h-4 w-4 text-[#8c8c5a]" />
                <span className="text-xs font-bold text-[#2d2d2d]">📢 Public Shout Box</span>
              </>
            ) : (
              selectedRecipient ? (
                <>
                  <Lock className="h-4 w-4 text-[#c27d56]" />
                  <span className="text-xs font-bold text-[#2d2d2d]">
                    🔒 Direct Message: <span className="underline italic">{selectedRecipient.username}</span>
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold select-none ${
                    isOnline(selectedRecipient.id) ? "bg-green-100 text-green-700 font-mono" : "bg-gray-100 text-gray-500 font-mono"
                  }`}>
                    {isOnline(selectedRecipient.id) ? "online" : "offline"}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[#8c8c82]">Select an explorer on the left to DM</span>
              )
            )}
          </div>
        </header>

        {/* Message Logs Pane */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafaf9]/20"
        >
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#9a9a8f] space-y-2">
              <MessageSquare className="h-8 w-8 text-[#cccbc0]" />
              <div>
                <p className="text-xs font-semibold">No transmissions received.</p>
                <p className="text-[10px]">Send the first message to sync up.</p>
              </div>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isMe = msg.senderId === profile.id;
              const sender = players.find(p => p.id === msg.senderId);
              const isSenderMuted = sender?.isMuted || false;
              const isSenderBooted = sender?.isBooted || false;
              const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              });
              
              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"} group cursor-pointer md:cursor-default`}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  onClick={() => {
                    if (isMe) {
                      setSelectedMessageId(selectedMessageId === msg.id ? null : msg.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 px-1 select-none">
                    <span className="text-[10px] font-bold text-[#5a5a40]">
                      {isMe ? "You" : msg.senderName}
                    </span>
                    <span className="text-[8px] text-[#a0a095] font-mono">
                      {formattedTime}
                    </span>
                    {isSenderMuted && (
                      <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">🔇 MUTED</span>
                    )}
                    {isSenderBooted && (
                      <span className="text-[8px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-bold">🚫 BOOTED</span>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <div 
                      className={`max-w-xs md:max-w-md p-3 rounded-2xl text-xs font-medium leading-relaxed ${
                        msg.isDeleted
                          ? "bg-gray-200 text-gray-500 italic rounded-lg"
                          : isMe 
                          ? "bg-[#5a5a40] text-white rounded-br-none" 
                          : "bg-[#eaeaee] text-[#2d2d2c] rounded-bl-none border border-[#e5e5dd]"
                      }`}
                    >
                      <p className="break-words">
                        {msg.isDeleted 
                          ? msg.deletedBy && msg.deletedBy !== msg.senderId 
                            ? "Deleted by moderator" 
                            : "Deleted"
                          : msg.text}
                      </p>
                    </div>

                    {/* Admin action buttons - show on hover on desktop, always visible for own messages on mobile */}
                    {(isAdmin || isMe) && hoveredMessageId === msg.id && !msg.isDeleted && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex">
                        <button
                          type="button"
                          onClick={() => onDeleteMessage?.(msg.id)}
                          className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded transition"
                          title={isMe ? "Delete your message" : "Delete message (Admin)"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {isAdmin && !isSenderMuted ? (
                          <button
                            type="button"
                            onClick={() => onMuteUser?.(msg.senderId)}
                            className="p-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-600 rounded transition"
                            title="Mute user"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        ) : isAdmin && isSenderMuted ? (
                          <button
                            type="button"
                            onClick={() => onUnmuteUser?.(msg.senderId)}
                            className="p-1 bg-green-100 hover:bg-green-200 text-green-600 rounded transition"
                            title="Unmute user"
                          >
                            <VolumeX className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => onBootUser?.(msg.senderId)}
                            className="p-1 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded transition"
                            title="Boot user"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Mobile action buttons - visible only when message is selected */}
                    {isMe && !msg.isDeleted && selectedMessageId === msg.id && (
                      <div className="flex gap-1 md:hidden">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteMessage?.(msg.id);
                            setSelectedMessageId(null);
                          }}
                          className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded transition"
                          title="Delete your message"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message sender console */}
        <form onSubmit={handleSend} className="p-3 border-t border-[#e5e5dd] flex gap-2 bg-[#fafaf7] shrink-0">
          <div className="flex-1 flex flex-col gap-1">
            <input
              type="text"
              required
              maxLength={300}
              disabled={activeSubTab === "pm" && !selectedRecipient || profile?.isMuted}
              placeholder={
                profile?.isMuted
                  ? "You have been muted by a moderator"
                  : activeSubTab === "pm" && !selectedRecipient
                  ? "Select a player to begin typing..."
                  : `Say something to ${activeSubTab === "shout" ? "the lobby..." : selectedRecipient?.username + "..."}`
              }
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="flex-1 bg-white border border-[#e5e5dd] rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-[#5a5a40] font-medium disabled:opacity-50"
            />
            {profile?.isMuted && (
              <p className="text-[10px] text-red-600 font-semibold">🔇 You are muted and cannot send messages</p>
            )}
            {profile?.isBooted && (
              <p className="text-[10px] text-gray-600 font-semibold">🚫 You have been removed from this game</p>
            )}
          </div>
          <button
            type="submit"
            disabled={!messageText.trim() || (activeSubTab === "pm" && !selectedRecipient) || profile?.isMuted || profile?.isBooted}
            className="bg-[#5a5a40] text-white p-2.5 rounded-xl hover:bg-[#464632] transition active:scale-95 cursor-pointer disabled:opacity-40 shrink-0 flex items-center justify-center"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
