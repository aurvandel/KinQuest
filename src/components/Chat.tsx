import React, { useState, useEffect, useRef } from "react";
import { ChatMessage, PlayerProfile } from "../types";
import { 
  Send, 
  Globe, 
  Lock, 
  User, 
  MessageSquare, 
  Search, 
  ShieldCheck
} from "lucide-react";

interface ChatProps {
  profile: PlayerProfile;
  players: PlayerProfile[];
  onlinePlayers: { id: string; username: string }[];
  chatMessages: ChatMessage[];
  onSendMessage: (text: string, receiverId: string | null) => void;
}

export function Chat({ profile, players, onlinePlayers, chatMessages, onSendMessage }: ChatProps) {
  const [activeSubTab, setActiveSubTab] = useState<"shout" | "pm">("shout");
  const [selectedRecipient, setSelectedRecipient] = useState<PlayerProfile | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, activeSubTab, selectedRecipient]);

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
  };

  // Auto-select a user on switching to pm tab if none selected
  useEffect(() => {
    if (activeSubTab === "pm" && !selectedRecipient && candidateRecipients.length > 0) {
      setSelectedRecipient(candidateRecipients[0]);
    }
  }, [activeSubTab]);

  return (
    <div id="chat-section" className="bg-white border border-[#d2d2c8] rounded-3xl overflow-hidden shadow-sm flex flex-col md:flex-row h-[550px]">
      {/* Side bar: Tab switching and user search list */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#e5e5dd] bg-[#fafaf7] flex flex-col shrink-0">
        {/* Navigation Selector */}
        <div className="p-3 border-b border-[#e5e5dd] flex gap-2">
          <button
            onClick={() => setActiveSubTab("shout")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold tracking-tight transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === "shout"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-[#8c8c82] hover:bg-white border border-transparent hover:border-[#e5e5dd] hover:text-[#5a5a40]"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Shout Box
          </button>
          <button
            onClick={() => setActiveSubTab("pm")}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold tracking-tight transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === "pm"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-[#8c8c82] hover:bg-white border border-transparent hover:border-[#e5e5dd] hover:text-[#5a5a40]"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            Direct DM
          </button>
        </div>

        {/* Players List for PM Tab */}
        {activeSubTab === "pm" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[#e5e5dd] relative">
              <Search className="absolute left-6 top-5.5 h-3.5 w-3.5 text-[#a0a095]" />
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#f0f0e8]/50 border border-[#e5e5dd] rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:ring-1 focus:ring-[#5a5a40] font-medium"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {candidateRecipients.length === 0 ? (
                <p className="text-[10px] text-center text-[#8c8c82] italic py-6">No other players found.</p>
              ) : (
                candidateRecipients.map((p) => {
                  const online = isOnline(p.id);
                  const isSelected = selectedRecipient?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedRecipient(p)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition cursor-pointer ${
                        isSelected 
                          ? "bg-[#5a5a40]/10 border-l-4 border-[#5a5a40]" 
                          : "hover:bg-[#f0f0e8]/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-6 h-6 rounded-full bg-[#e5e5dd] flex items-center justify-center shrink-0">
                          <User className="h-3 w-3 text-[#5a5a40]" />
                        </div>
                        <div className="truncate">
                          <p className="font-semibold text-[#2d2d2d] truncate">{p.username}</p>
                          <p className="text-[9px] text-[#8c8c82] font-mono">{p.score} pts</p>
                        </div>
                      </div>

                      <div className="flex items-center pr-1 select-none">
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
          // Global Shoutbox list (shows list of active online users as a summary)
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-widest block font-sans mb-3">
              Active Transmitters ({onlinePlayers.length})
            </h3>
            <div className="space-y-2">
              {onlinePlayers.map((player) => (
                <div key={player.id} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                  <span className="font-semibold text-[#4d4d42] truncate">
                    {player.username} {player.id === profile.id && "(You)"}
                  </span>
                </div>
              ))}
              {onlinePlayers.length === 0 && (
                <div className="text-[10px] text-[#8c8c82] italic">Mapping live connections...</div>
              )}
            </div>
            
            <div className="mt-8 border-t border-[#e5e5dd] pt-4 text-[10px] text-[#8c8c82] leading-relaxed">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafaf9]/20">
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
              const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              });
              
              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 px-1 select-none">
                    <span className="text-[10px] font-bold text-[#5a5a40]">
                      {isMe ? "You" : msg.senderName}
                    </span>
                    <span className="text-[8px] text-[#a0a095] font-mono">
                      {formattedTime}
                    </span>
                  </div>

                  <div 
                    className={`max-w-xs md:max-w-md p-3 rounded-2xl text-xs font-medium leading-relaxed ${
                      isMe 
                        ? "bg-[#5a5a40] text-white rounded-br-none" 
                        : "bg-[#eaeaee] text-[#2d2d2c] rounded-bl-none border border-[#e5e5dd]"
                    }`}
                  >
                    <p className="break-words">{msg.text}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message sender console */}
        <form onSubmit={handleSend} className="p-3 border-t border-[#e5e5dd] flex gap-2 bg-[#fafaf7] shrink-0">
          <input
            type="text"
            required
            maxLength={300}
            disabled={activeSubTab === "pm" && !selectedRecipient}
            placeholder={
              activeSubTab === "pm" && !selectedRecipient
                ? "Select a player to begin typing..."
                : `Say something to ${activeSubTab === "shout" ? "the lobby..." : selectedRecipient?.username + "..."}`
            }
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="flex-1 bg-white border border-[#e5e5dd] rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-[#5a5a40] font-medium disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!messageText.trim() || (activeSubTab === "pm" && !selectedRecipient)}
            className="bg-[#5a5a40] text-white p-2.5 rounded-xl hover:bg-[#464632] transition active:scale-95 cursor-pointer disabled:opacity-40 shrink-0 flex items-center justify-center"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
