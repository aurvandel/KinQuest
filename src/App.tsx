import React, { useState, useEffect, useRef } from "react";
import { ScavengerItem, PlayerProfile, Submission, ChatMessage, AppSettings } from "./types";
import { MissionsList } from "./components/MissionsList";
import { Leaderboard } from "./components/Leaderboard";
import { Feed } from "./components/Feed";
import { GameMap } from "./components/GameMap";
import { Chat } from "./components/Chat";
import { AdminAuthModal } from "./components/AdminAuthModal";
import { UserSettingsModal } from "./components/UserSettingsModal";
import { AdminSettingsModal } from "./components/AdminSettingsModal";
import { CreateMissionModal } from "./components/CreateMissionModal";

import {
  Flame,
  Award,
  Users,
  LogIn,
  LogOut,
  Trophy,
  Loader2,
  ListFilter,
  UserCheck,
  Zap,
  PartyPopper,
  Sparkles,
  Map as MapIcon,
  Compass,
  AlertCircle,
  Database,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Settings,
  Upload,
  RotateCcw,
  User,
  Shield,
  Lock,
  Share2,
  QrCode
} from "lucide-react";

export default function App() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [items, setItems] = useState<ScavengerItem[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [appReady, setAppReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"missions" | "map" | "leaderboard" | "feed" | "chat">("missions");

  // Game branding states
  const [settings, setSettings] = useState<AppSettings>({ name: "KinQuest", icon: null, inviteRequired: true, activeInviteCode: "reunion-2026" });
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [adminNameInput, setAdminNameInput] = useState("");
  const [adminIconInput, setAdminIconInput] = useState<string | null>(null);
  const [adminLatInput, setAdminLatInput] = useState(40.7850);
  const [adminLngInput, setAdminLngInput] = useState(-73.9682);
  const [adminRadiusInput, setAdminRadiusInput] = useState(500);
  const [adminAiPromptCriteriaInput, setAdminAiPromptCriteriaInput] = useState("Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!");
  const [adminAiVerificationEnabledInput, setAdminAiVerificationEnabledInput] = useState(true);
  const [adminAllowForceSubmitInput, setAdminAllowForceSubmitInput] = useState(false);
  const [adminActiveInviteCodeInput, setAdminActiveInviteCodeInput] = useState("reunion-2026");
  const [adminInviteRequiredInput, setAdminInviteRequiredInput] = useState(true);
  const [manualInviteCode, setManualInviteCode] = useState("");
  const [manualInviteError, setManualInviteError] = useState<string | null>(null);
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [adminSaveSuccess, setAdminSaveSuccess] = useState(false);
  const [adminSaveError, setAdminSaveError] = useState<string | null>(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  // User Settings & Permissions Dashboard states
  const [userDashboardOpen, setUserDashboardOpen] = useState(false);
  const [showCreateMissionModal, setShowCreateMissionModal] = useState(false);
  const [profileDisplayNameInput, setProfileDisplayNameInput] = useState("");
  const [profileRoleInput, setProfileRoleInput] = useState<"user" | "admin" | "">("user");
  const [profileShareLocation, setProfileShareLocation] = useState(true);
  const [profileAllowNotifications, setProfileAllowNotifications] = useState(true);
  const [profileMakePrivate, setProfileMakePrivate] = useState(false);
  const [profileExtendedAiJudge, setProfileExtendedAiJudge] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  // Chat States
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<{ id: string; username: string }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Ref to track current active tab in WebSocket handlers without causing reconnection
  const activeTabRef = useRef<"missions" | "map" | "leaderboard" | "feed" | "chat">("missions");

  // Geolocation states
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationType, setLocationType] = useState<"gps" | "simulated">("gps");

  // Expanded card linkage
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Spinners / error maps per mission
  const [isSubmittingMap, setIsSubmittingMap] = useState<{ [itemId: string]: boolean }>({});
  const [submitErrorMap, setSubmitErrorMap] = useState<{ [itemId: string]: string | null }>({});
  const [rejectedSubmissionMap, setRejectedSubmissionMap] = useState<{ [itemId: string]: { explanation: string; base64: string } }>({});

  const [registerName, setRegisterName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [isAdminAuthLoading, setIsAdminAuthLoading] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [pendingAdminName, setPendingAdminName] = useState<string | null>(null);

  // DB diagnostic status
  const [dbStatus, setDbStatus] = useState<{ mode: "supabase" | "local_fallback"; error: string | null }>({
    mode: "local_fallback",
    error: null
  });
  const [sqlVisible, setSqlVisible] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const SQL_SCHEMA = `-- WilderHunt Supabase Relay Initialization Script
-- Execute this schema inside your Supabase Project SQL Editor:

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user',
  permissions JSONB DEFAULT '{}'::jsonb,
  score INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points INTEGER DEFAULT 10,
  category TEXT DEFAULT 'General',
  icon TEXT DEFAULT 'Sparkles',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  item_id TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'pending',
  ai_explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION
);`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // On mount: Try getting current positioning plus reading cached self-hosted user
  useEffect(() => {
    // 0. Parse invite search parameter
    try {
      const params = new URLSearchParams(window.location.search);
      const inviteUrlParam = params.get("invite");
      if (inviteUrlParam) {
        localStorage.setItem("wilderhunt_invite_code", inviteUrlParam.trim().toLowerCase());
        // Clean URL params from navigation bar
        const cleanURL = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanURL);
      }
    } catch (e) {
      console.warn("Failed parsing invite search parameter on mount:", e);
    }

    // 1. Check Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLng(position.coords.longitude);
          setLocationType("gps");
        },
        (error) => {
          console.warn("Browser GPS blocked, falling back to simulated NYC coordinates.");
          setUserLat(40.7829);
          setUserLng(-73.9654);
          setLocationType("simulated");
        }
      );
    } else {
      setUserLat(40.7829);
      setUserLng(-73.9654);
      setLocationType("simulated");
    }

    // 2. Load game profile
    const cachedUid = localStorage.getItem("scavenger_uid");
    const cachedUser = localStorage.getItem("scavenger_user");

    if (cachedUid && cachedUser) {
      try {
        setProfile(JSON.parse(cachedUser));
      } catch (e) {
        localStorage.removeItem("scavenger_uid");
        localStorage.removeItem("scavenger_user");
      }
    }
    setAppReady(true);
  }, []);

  // Central Game State Synchronizer (Polling loop every 2.5 seconds for real-time dynamic feel!)
  useEffect(() => {
    let intervalId: any;

    const fetchGameState = async () => {
      try {
        const res = await fetch("/api/game-state");
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.users || []);
          setItems(data.items || []);
          setSubmissions(data.submissions || []);
          if (data.settings) {
            setSettings(data.settings);
          }

          // Sync active user profile score dynamically
          const cachedUid = localStorage.getItem("scavenger_uid");
          if (cachedUid) {
            const serverProfile = (data.users || []).find((u: PlayerProfile) => u.id === cachedUid);
            if (serverProfile) {
              setProfile(serverProfile);
              localStorage.setItem("scavenger_user", JSON.stringify(serverProfile));
            } else {
              // Server wiped user data (e.g. during restart), need to re-register
              console.warn("Local profile was not found in server state database. Resetting auth.");
              handleSignOut();
            }
          }
        }

        // Fetch DB Mode Status
        const dbRes = await fetch("/api/db-status");
        if (dbRes.ok) {
          const dStatus = await dbRes.json();
          setDbStatus(dStatus);
        }
      } catch (err) {
        console.error("Polling game state failed:", err);
      }
    };

    fetchGameState();
    intervalId = setInterval(fetchGameState, 2500);

    return () => clearInterval(intervalId);
  }, []);

  // Download chat logs initially
  useEffect(() => {
    if (!profile) return;
    
    fetch("/api/chat-history")
      .then(res => res.json())
      .then(data => setChatMessages(data || []))
      .catch(err => console.error("Failed to load chat history:", err));
  }, [profile]);

  // Ref to track if profile ID actually changed (to avoid reconnection on object refresh)
  const profileIdRef = useRef<string | null>(null);

  // Connect Real-time WebSocket overlay
  useEffect(() => {
    // Check if profile ID actually changed
    const profileIdChanged = profile && profileIdRef.current !== profile.id;
    
    if (!profile) {
      console.log("No profile, closing WebSocket");
      if (socket) {
        socket.close();
        setSocket(null);
      }
      profileIdRef.current = null;
      return;
    }

    // If profile ID didn't change and socket exists, don't reconnect
    if (!profileIdChanged && socket) {
      console.log("Profile unchanged and socket exists, skipping reconnection");
      return;
    }

    profileIdRef.current = profile.id;

    if (!window.location.host) {
      console.warn("Skipping WebSocket: window.location.host is empty");
      return;
    }

    console.log("🔌 Initiating WebSocket connection for profile:", profile.id);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;
    
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error("Failed to create WebSocket:", e);
      return;
    }

    ws.onopen = () => {
      console.log("✅ WebSocket OPEN, sending join message");
      const joinMessage = {
        type: "join",
        userId: profile.id,
        username: profile.username
      };
      ws.send(JSON.stringify(joinMessage));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        if (payload.type === "message") {
          console.log("💬 Received chat message");
          setChatMessages((prev) => {
            if (prev.some(m => m.id === payload.message.id)) return prev;
            return [...prev, payload.message];
          });
          
          if (activeTabRef.current !== "chat") {
            setUnreadCount((c) => c + 1);
          }
        } else if (payload.type === "online_users") {
          console.log("👥 Online users:", payload.users?.length || 0);
          setOnlinePlayers(payload.users || []);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onclose = () => {
      console.log("❌ WebSocket closed");
      setSocket(null);
    };

    ws.onerror = (err) => {
      console.error("⚠️ WebSocket error:", err);
    };

    setSocket(ws);

    return () => {
      console.log("Cleanup: closing WebSocket");
      if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close();
      }
    };
  }, [profile?.id]);

  // Reset unread counts when clicking chat tab
  useEffect(() => {
    if (activeTab === "chat") {
      setUnreadCount(0);
    }
  }, [activeTab]);

  // Update the ref to track current active tab for WebSocket handlers
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const handleSendMessage = (text: string, receiverId: string | null) => {
    console.log("handleSendMessage called:", { text, receiverId, hasProfile: !!profile, socketState: socket?.readyState });
    
    if (!profile) {
      console.error("Cannot send message: profile is null");
      return;
    }
    
    if (!socket) {
      console.warn("Socket not ready yet, will retry in 500ms");
      setTimeout(() => handleSendMessage(text, receiverId), 500);
      return;
    }
    
    if (socket.readyState !== WebSocket.OPEN) {
      console.warn("Socket not OPEN (state:", socket.readyState, "), will retry in 500ms");
      setTimeout(() => handleSendMessage(text, receiverId), 500);
      return;
    }
    
    const message = {
      type: "send_message",
      userId: profile.id,
      username: profile.username,
      receiverId,
      text
    };
    
    console.log("📤 Sending message via WebSocket:", message);
    socket.send(JSON.stringify(message));
  };

  // Pre-populate admin inputs when settings load or when opening the panel
  useEffect(() => {
    if (settings) {
      setAdminNameInput(settings.name);
      setAdminIconInput(settings.icon);
    }
  }, [settings, adminPanelOpen]);

  // Ref to track which profile we've populated the form for
  const populatedProfileIdRef = useRef<string | null>(null);

  // Pre-populate user profile inputs ONLY when dashboard opens or profile ID changes
  useEffect(() => {
    if (!profile) return;
    
    // Only populate if dashboard just opened or profile ID changed
    if (userDashboardOpen && populatedProfileIdRef.current !== profile.id) {
      console.log("Populating profile form for profile ID:", profile.id);
      setProfileDisplayNameInput(profile.displayName || profile.username || "");
      setProfileRoleInput(profile.role || "user");
      setProfileShareLocation(profile.permissions?.shareLocation !== false);
      setProfileAllowNotifications(profile.permissions?.allowNotifications !== false);
      setProfileMakePrivate(profile.permissions?.makePrivate === true);
      setProfileExtendedAiJudge(profile.permissions?.extendedAiJudge === true);
      populatedProfileIdRef.current = profile.id;
    }
  }, [profile?.id, userDashboardOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!profileDisplayNameInput.trim()) {
      setProfileSaveError("Display name cannot be empty");
      return;
    }
    setIsProfileSaving(true);
    setProfileSaveSuccess(false);
    setProfileSaveError(null);

    const updatedPermissions = {
      shareLocation: profileShareLocation,
      allowNotifications: profileAllowNotifications,
      makePrivate: profileMakePrivate,
      extendedAiJudge: profileExtendedAiJudge
    };

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          displayName: profileDisplayNameInput.trim(),
          role: profileRoleInput,
          permissions: updatedPermissions
        })
      });

      if (res.ok) {
        const data = await res.json();
        const updatedProf = data.profile;
        setProfile(updatedProf);
        localStorage.setItem("scavenger_user", JSON.stringify(updatedProf));
        
        // Also update players list immediately so local updates mirror on leaderboard
        setPlayers((prev) => prev.map(p => p.id === updatedProf.id ? updatedProf : p));
        
        setProfileSaveSuccess(true);
        setTimeout(() => setProfileSaveSuccess(false), 3000);
      } else {
        const errData = await res.json();
        setProfileSaveError(errData.error || "Failed to update profile settings");
      }
    } catch (err: any) {
      setProfileSaveError(err.message || "Network error saving profile");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNameInput.trim()) {
      setAdminSaveError("Game title cannot be empty");
      return;
    }
    if (!adminActiveInviteCodeInput.trim()) {
      setAdminSaveError("Invite code cannot be empty");
      return;
    }
    setIsAdminSaving(true);
    setAdminSaveSuccess(false);
    setAdminSaveError(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: adminNameInput.trim(),
          icon: adminIconInput,
          defaultLat: Number(adminLatInput) || 40.7850,
          defaultLng: Number(adminLngInput) || -73.9682,
          defaultRadius: Number(adminRadiusInput) || 500,
          aiPromptCriteria: adminAiPromptCriteriaInput.trim(),
          aiVerificationEnabled: adminAiVerificationEnabledInput,
          allowForceSubmit: adminAllowForceSubmitInput,
          activeInviteCode: adminActiveInviteCodeInput.trim().toLowerCase(),
          inviteRequired: adminInviteRequiredInput
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setAdminSaveSuccess(true);
        setTimeout(() => setAdminSaveSuccess(false), 3000);
      } else {
        const errData = await res.json();
        setAdminSaveError(errData.error || "Failed to update branding settings");
      }
    } catch (err: any) {
      setAdminSaveError(err.message || "Network error saving settings");
    } finally {
      setIsAdminSaving(false);
    }
  };

  const handleResetSettings = async () => {
    setIsAdminSaving(true);
    setAdminSaveSuccess(false);
    setAdminSaveError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "KinQuest",
          icon: null,
          defaultLat: 40.7850,
          defaultLng: -73.9682,
          defaultRadius: 500,
          aiPromptCriteria: "Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!",
          aiVerificationEnabled: true,
          allowForceSubmit: false,
          activeInviteCode: "reunion-2026",
          inviteRequired: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setAdminNameInput("KinQuest");
        setAdminIconInput(null);
        setAdminLatInput(40.7850);
        setAdminLngInput(-73.9682);
        setAdminRadiusInput(500);
        setAdminAiPromptCriteriaInput("Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!");
        setAdminAiVerificationEnabledInput(true);
        setAdminAllowForceSubmitInput(false);
        setAdminActiveInviteCodeInput("reunion-2026");
        setAdminInviteRequiredInput(true);
        setAdminSaveSuccess(true);
        setTimeout(() => setAdminSaveSuccess(false), 3000);
      } else {
        const errData = await res.json();
        setAdminSaveError(errData.error || "Failed to reset settings");
      }
    } catch (err: any) {
      setAdminSaveError(err.message || "Network error resetting settings");
    } finally {
      setIsAdminSaving(false);
    }
  };

  const handleIconUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setAdminSaveError("Icon image file should be under 2MB for optimized storage.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAdminIconInput(reader.result as string);
    };
    reader.onerror = () => {
      setAdminSaveError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const registerUser = async (cleanUsername: string, role: "user" | "admin") => {
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          role,
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Authentication gateway reject.");
      }

      const activeUser = await response.json();
      localStorage.setItem("scavenger_uid", activeUser.id);
      localStorage.setItem("scavenger_user", JSON.stringify(activeUser));
      setProfile(activeUser);
    } catch (err: any) {
      setAuthError(err.message || "Failed to reach self-hosted api endpoint.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Self-hosted anonymous guest registration
  const handleRegisterInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = registerName.trim();
    if (!cleanUsername) {
      setAuthError("Please enter your name or family title!");
      return;
    }

    if (cleanUsername.toLowerCase() === "admin") {
      setPendingAdminName(cleanUsername);
      setAdminAuthError(null);
      setIsAdminAuthOpen(true);
      return;
    }

    await registerUser(cleanUsername, "user");
  };

  const handleAdminAuthSuccess = async (password: string) => {
    const cleanUsername = pendingAdminName?.trim() || "admin";
    setAdminAuthError(null);
    setIsAdminAuthLoading(true);

    try {
      const response = await fetch("/api/auth/admin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Invalid admin password");
      }

      setIsAdminAuthOpen(false);
      setPendingAdminName(null);
      await registerUser(cleanUsername, "admin");
    } catch (err: any) {
      setAdminAuthError(err.message || "Admin password verification failed");
    } finally {
      setIsAdminAuthLoading(false);
    }
  };

  const handleAdminAuthClose = () => {
    if (isAdminAuthLoading) return;
    setIsAdminAuthOpen(false);
    setPendingAdminName(null);
    setAdminAuthError(null);
  };

  const handleSignOut = () => {
    localStorage.removeItem("scavenger_uid");
    localStorage.removeItem("scavenger_user");
    setProfile(null);
  };

  // Submit base64 photo with current coordinates to server
  const handleUploadSubmission = async (itemId: string, base64Image: string, forceSubmit: boolean = false) => {
    if (!profile) return;

    setSubmitErrorMap((prev) => ({ ...prev, [itemId]: null }));
    setIsSubmittingMap((prev) => ({ ...prev, [itemId]: true }));

    try {
      const response = await fetch("/api/verify-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          itemId: itemId,
          imageBase64: base64Image,
          userLat: userLat,
          userLng: userLng,
          forceSubmit: forceSubmit
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Verification engine failed.");
      }

      const payload = await response.json();
      
      if (payload.submission.status === "rejected" && !forceSubmit) {
        // Store the rejected submission for potential force submission
        setRejectedSubmissionMap((prev) => ({
          ...prev,
          [itemId]: { explanation: payload.explanation, base64: base64Image }
        }));
        throw new Error(payload.explanation || "Verification declined by Referee.");
      }

      // Success approval: state updates automatically on next polling sweep!
      // Clear any rejected submission record
      setRejectedSubmissionMap((prev) => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });

    } catch (err: any) {
      console.error("Submission grading error:", err);
      setSubmitErrorMap((prev) => ({
        ...prev,
        [itemId]: err instanceof Error ? err.message : "Proof check declined. Retry."
      }));
    } finally {
      setIsSubmittingMap((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  // Force submit a rejected submission
  const handleForceSubmit = (itemId: string) => {
    const rejected = rejectedSubmissionMap[itemId];
    if (rejected) {
      handleUploadSubmission(itemId, rejected.base64, true);
    }
  };

  // Delete live submissions
  const handleDeleteSubmission = async (subId: string) => {
    try {
      const response = await fetch(`/api/submissions/${subId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Could not delete proof from self-hosted store.");
      }
      // Success: automatically visual refresh occurs in periodic loop!
    } catch (err) {
      console.error(err);
    }
  };

  // Create customized challenge
  const handleAddChallenge = async (newChallenge: Omit<ScavengerItem, "id">) => {
    const response = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newChallenge, createdBy: profile?.id })
    });

    if (!response.ok) {
      throw new Error("Challenge registration failed.");
    }
    // Saved in DB!
    setShowCreateMissionModal(false);
  };

  // Delete mission - admin or creator only
  const handleDeleteMission = async (itemId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this mission? This cannot be undone.");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/challenges/${itemId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile?.id })
      });

      if (!response.ok) {
        throw new Error("Failed to delete mission.");
      }

      // Remove from local state
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err: any) {
      console.error("Delete mission error:", err);
      alert(err instanceof Error ? err.message : "Failed to delete mission.");
    }
  };

  // Edit mission - admin or creator only
  const handleEditMission = async (itemId: string, updates: Partial<ScavengerItem>) => {
    try {
      const response = await fetch(`/api/challenges/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile?.id, ...updates })
      });

      if (!response.ok) {
        throw new Error("Failed to update mission.");
      }

      const data = await response.json();
      
      // Update local state
      setItems((prev) => prev.map((item) => (item.id === itemId ? data.item : item)));
    } catch (err: any) {
      console.error("Edit mission error:", err);
      alert(err instanceof Error ? err.message : "Failed to update mission.");
    }
  };

  // User simulated GPS movement updater
  const handleSimulateCoordinates = (lat: number, lng: number) => {
    setUserLat(lat);
    setUserLng(lng);
    setLocationType("simulated");
  };

  const handleRevertToDeviceGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLng(position.coords.longitude);
          setLocationType("gps");
        },
        (error) => {
          console.warn("Failed to get current device GPS:", error);
          alert("Unable to access device GPS. Please enable location permissions.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleCreateMissionFromMap = (lat: number, lng: number) => {
    // Pre-set the map coordinates for the new mission
    setUserLat(lat);
    setUserLng(lng);
    setShowCreateMissionModal(true);
  };

  // Map clicks link directly to challenge cards and expands them!
  const handleSelectChallengeFromMap = (itemId: string) => {
    setActiveTab("missions");
    // Trigger scroll-to frame
    setTimeout(() => {
      const element = document.getElementById(`challenge-card-${itemId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  };

  const handleManualInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualInviteError(null);
    const typed = manualInviteCode.trim().toLowerCase();
    if (!typed) {
      setManualInviteError("Please enter a join code");
      return;
    }
    if (settings && settings.activeInviteCode && typed === settings.activeInviteCode.toLowerCase()) {
      localStorage.setItem("wilderhunt_invite_code", typed);
      setManualInviteCode("");
      setManualInviteError(null);
    } else {
      setManualInviteError("Invalid invite code. Please check with the game administrator.");
    }
  };

  if (!appReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f5f0]">
        <Loader2 className="h-8 w-8 text-[#5a5a40] animate-spin" />
        <p className="text-xs text-[#8c8c82] mt-2 font-bold font-mono">Booyaking Self-Hosted Node...</p>
      </div>
    );
  }

  // Check invite-only access
  const isInviteModeActive = settings.inviteRequired !== false;
  const savedInviteCode = localStorage.getItem("wilderhunt_invite_code");
  const isInviteCodeValid = savedInviteCode && settings.activeInviteCode && savedInviteCode === settings.activeInviteCode;
  const isUserAdmin = (profile?.role === "admin") || (registerName.trim().toLowerCase() === "admin") || (profile?.username?.toLowerCase() === "admin");
  const isAuthorized = !isInviteModeActive || isInviteCodeValid || isUserAdmin;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 animate-fadeIn">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center animate-fadeIn">
          <div className="mx-auto h-16 w-16 rounded-[24px] bg-[#5a5a40]/15 flex items-center justify-center text-[#5a5a40] shadow-inner mb-6">
            <Lock className="h-8 w-8 text-[#5a5a40] animate-pulse" />
          </div>
          <h2 className="text-3xl font-serif font-bold text-[#5a5a40] tracking-tight text-balance">
            KinQuest
          </h2>
          <p className="mt-3 text-sm text-[#8c8c82] max-w-sm mx-auto font-medium leading-relaxed">
            Welcome to the family! This KinQuest scavenger adventure is private. Only clan members with an active family invitation code or those who scanned the event QR code can join the lobby.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-md border border-[#e5e5dd] rounded-[32px] space-y-6">
            <div className="bg-[#5a5a40]/5 p-4 rounded-2xl border border-[#5a5a40]/10 text-center">
              <span className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider block font-sans">How to Join The Fun</span>
              <p className="text-xs text-[#5a5a40] font-medium leading-relaxed mt-1.5 font-sans">
                Kindly ask the family reunion organizer or host to share their invitation link, or scan their custom event QR code off their screen!
              </p>
            </div>

            <form onSubmit={handleManualInviteSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5a5a40] uppercase tracking-widest block font-sans">
                  Enter Family Access Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. reunion-2026"
                  value={manualInviteCode}
                  onChange={(e) => setManualInviteCode(e.target.value)}
                  className="w-full text-xs bg-[#f5f5f0]/50 border border-[#dcdcd4] rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-[#5a5a40] font-mono text-center tracking-widest uppercase font-bold text-[#2d2d2d]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#5a5a40] hover:bg-[#464632] active:scale-98 transition shadow-md shadow-[#5a5a40]/15 cursor-pointer flex items-center justify-center gap-1.5 font-sans"
              >
                <Shield className="h-4 w-4" />
                Unlock Family Portal
              </button>
            </form>

            {manualInviteError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex gap-2 border border-red-100 font-sans">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span className="font-semibold">{manualInviteError}</span>
              </div>
            )}

            <div className="text-center pt-2 border-t border-brand-border/60">
              <p className="text-[9px] text-[#8c8c82] uppercase tracking-widest font-mono">
                Operator Portal: Seek Elder / Organizer
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Welcoming Gate
  if (!profile) {
    return (
      <>
        <div className="min-h-screen bg-[#f5f5f0] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-[#5a5a40] flex items-center justify-center shadow-lg text-white font-serif overflow-hidden">
              {settings.icon ? (
                <img src={settings.icon} alt="Game Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Compass className="h-6 w-6 animate-spin-slow text-[#f5f5f0]" />
              )}
            </div>
            <h2 className="mt-6 text-center text-3xl font-serif font-bold italic text-[#5a5a40] tracking-tight text-balance">
              {settings.name}
            </h2>
            <p className="mt-2 text-center text-sm text-[#8c8c82] font-medium leading-relaxed max-w-sm mx-auto">
              The ultimate family reunion scavenger hunt. Complete heartwarming photo missions, submit family checkpoints, chat with your cousins, and let our real-time AI Referee score your entries!
            </p>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-6 shadow-sm border border-brand-border rounded-[32px] space-y-6">
              <form onSubmit={handleRegisterInputSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#5a5a40] uppercase tracking-widest block font-sans">
                    Introduce Yourself (e.g. Aunt Sarah, Cousin Leo)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={18}
                    placeholder="e.g. Aunt Sarah or Cousin Leo"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full text-sm bg-[#f5f5f0]/50 border border-brand-border rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-[#5a5a40] font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#5a5a40] hover:bg-[#464632] active:scale-98 transition shadow-md shadow-[#5a5a40]/10 cursor-pointer disabled:opacity-50"
                >
                  {isAuthLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  Enter Family Reunion Lobby
                </button>
              </form>

              {authError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 border border-red-100">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="font-semibold">{authError}</p>
                </div>
              )}

              <div className="text-center pt-2 border-t border-brand-border/60">
                <p className="text-[10px] text-brand-muted tracking-wider uppercase font-mono">
                  KinQuest Private Sandbox Mode
                </p>
              </div>
            </div>
          </div>
        </div>

        <AdminAuthModal
          isOpen={isAdminAuthOpen}
          onClose={handleAdminAuthClose}
          onSuccess={handleAdminAuthSuccess}
          isLoading={isAdminAuthLoading}
          error={adminAuthError}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#2d2d2d] font-sans flex flex-col">
      {/* Top Header navbar with score indicators */}
      <header className="h-16 px-3 sm:px-8 flex items-center justify-between border-b border-brand-border bg-[#f5f5f0]/95 backdrop-blur-md sticky top-0 z-[1000] shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <div className="w-8 h-8 bg-[#5a5a40] rounded-lg flex items-center justify-center overflow-hidden shrink-0">
            {settings.icon ? (
              <img src={settings.icon} alt="Game Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-3 h-3 border-2 border-[#f5f5f0] rounded-sm rotate-45"></div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm md:text-base font-serif italic text-[#5a5a40] font-bold tracking-tight leading-none truncate max-w-[80px] sm:max-w-[150px] md:max-w-[200px]">
              {settings.name}
            </h1>
            <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-brand-muted hidden sm:block">Docker Node</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4 lg:space-x-6">
          <div className="hidden md:block text-right">
            <p className="text-[9px] uppercase tracking-widest font-bold text-brand-muted">Active Hunter</p>
            <p className="text-xs font-semibold">{profile.username}</p>
          </div>

          <div className="hidden md:block h-8 w-[1px] bg-[#dcdcd4]"></div>

          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
            {/* Real-time Score Badge */}
            <div className="bg-[#5a5a40] text-[#f5f5f0] px-2 sm:px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 sm:gap-2 shadow-sm shadow-[#5a5a40]/10 whitespace-nowrap">
              <Flame className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-[#c27d56] fill-[#c27d56] animate-pulse flex-shrink-0" />
              <div className="text-left leading-none hidden sm:block">
                <span className="text-[7px] sm:text-[8px] uppercase font-bold tracking-widest block opacity-75">TALLY</span>
                <span className="text-xs font-black font-mono">{profile.score} PTS</span>
              </div>
              <span className="text-xs sm:hidden font-black font-mono">{profile.score}</span>
            </div>

            {/* User Preferences Dashboard Button */}
            <button
              onClick={() => {
                setUserDashboardOpen(!userDashboardOpen);
                setProfileSaveSuccess(false);
                setProfileSaveError(null);
                if (profile) {
                  setProfileDisplayNameInput(profile.displayName || profile.username || "");
                  setProfileRoleInput(profile.role || "user");
                }
              }}
              type="button"
              className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                userDashboardOpen
                  ? "bg-[#5a5a40]/20 text-[#5a5a40] border-[#5a5a40]/30 font-bold"
                  : "text-[#8c8c82] hover:text-[#5a5a40] hover:bg-white border-transparent hover:border-brand-border/40"
              }`}
              title="User Settings & Persona Dashboard"
            >
              <User className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
            </button>

            {/* Database Status Indicator Icon - visible to all */}
            <button
              type="button"
              className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                dbStatus.mode === "supabase"
                  ? "text-green-600 hover:text-green-700 hover:bg-green-50 border-transparent hover:border-green-200"
                  : "text-red-600 hover:text-red-700 hover:bg-red-50 border-transparent hover:border-red-200"
              }`}
              title={`Storage: ${dbStatus.mode === "supabase" ? "Supabase Cloud" : "Local db.json"}`}
            >
              <Database className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
            </button>

            {/* Admin Branding Settings Cog */}
            {profile?.role === "admin" && (
              <button
                onClick={() => {
                  setAdminPanelOpen(!adminPanelOpen);
                  setAdminSaveSuccess(false);
                  setAdminSaveError(null);
                  if (settings) {
                    setAdminNameInput(settings.name);
                    setAdminIconInput(settings.icon);
                    setAdminLatInput(settings.defaultLat ?? 40.7850);
                    setAdminLngInput(settings.defaultLng ?? -73.9682);
                    setAdminRadiusInput(settings.defaultRadius ?? 500);
                    setAdminAiPromptCriteriaInput(settings.aiPromptCriteria ?? "Friendly, witty, and slightly funny AI Referee. High-spirited, playful 1-2 sentence description explaining what you spotted.");
                    setAdminAiVerificationEnabledInput(settings.aiVerificationEnabled !== false);
                    setAdminAllowForceSubmitInput(settings.allowForceSubmit === true);
                    setAdminActiveInviteCodeInput(settings.activeInviteCode ?? "hunt-party-2026");
                    setAdminInviteRequiredInput(settings.inviteRequired !== false);
                  }
                }}
                type="button"
                className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                  adminPanelOpen
                    ? "bg-[#5a5a40] text-white border-transparent"
                    : "text-[#8c8c82] hover:text-[#5a5a40] hover:bg-white border-transparent hover:border-brand-border/40"
                }`}
                title="Branding Identity Control Panel"
              >
                <Settings className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
              </button>
            )}

            <button
              onClick={handleSignOut}
              type="button"
              className="text-[#8c8c82] hover:text-red-600 transition p-1.5 sm:p-2 hover:bg-white rounded-xl border border-transparent hover:border-brand-border/40 shrink-0"
              title="Leave adventure lobby"
            >
              <LogOut className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Admin Settings Modal */}
        {profile?.role === "admin" && (
          <AdminSettingsModal
            isOpen={adminPanelOpen}
            onClose={() => setAdminPanelOpen(false)}
            settings={settings}
            nameInput={adminNameInput}
            onNameChange={setAdminNameInput}
            iconInput={adminIconInput}
            onIconUpload={handleIconUploadChange}
            latInput={adminLatInput}
            onLatChange={setAdminLatInput}
            lngInput={adminLngInput}
            onLngChange={setAdminLngInput}
            radiusInput={adminRadiusInput}
            onRadiusChange={setAdminRadiusInput}
            aiPromptInput={adminAiPromptCriteriaInput}
            onAiPromptChange={setAdminAiPromptCriteriaInput}
            aiVerificationEnabledInput={adminAiVerificationEnabledInput}
            onAiVerificationEnabledChange={setAdminAiVerificationEnabledInput}
            allowForceSubmitInput={adminAllowForceSubmitInput}
            onAllowForceSubmitChange={setAdminAllowForceSubmitInput}
            inviteCodeInput={adminActiveInviteCodeInput}
            onInviteCodeChange={setAdminActiveInviteCodeInput}
            inviteRequiredInput={adminInviteRequiredInput}
            onInviteRequiredChange={setAdminInviteRequiredInput}
            copiedInviteLink={copiedInviteLink}
            onCopyInviteLink={() => {
              const inviteLink = `${window.location.protocol}//${window.location.host}/?invite=${encodeURIComponent(adminActiveInviteCodeInput.trim().toLowerCase())}`;
              navigator.clipboard.writeText(inviteLink);
              setCopiedInviteLink(true);
              setTimeout(() => setCopiedInviteLink(false), 2000);
            }}
            isLoading={isAdminSaving}
            saveSuccess={adminSaveSuccess}
            saveError={adminSaveError}
            onSubmit={handleSaveSettings}
            onReset={handleResetSettings}
            onGenerateCode={() => {
              const rand = `hunt-${Math.floor(1000 + Math.random() * 9000)}`;
              setAdminActiveInviteCodeInput(rand);
            }}
          />
        )}

        {/* User Account & Persona Settings Dashboard */}
        <UserSettingsModal
          isOpen={userDashboardOpen}
          onClose={() => setUserDashboardOpen(false)}
          profile={profile}
          displayNameInput={profileDisplayNameInput}
          onDisplayNameChange={setProfileDisplayNameInput}
          shareLocation={profileShareLocation}
          onShareLocationChange={setProfileShareLocation}
          allowNotifications={profileAllowNotifications}
          onAllowNotificationsChange={setProfileAllowNotifications}
          makePrivate={profileMakePrivate}
          onMakePrivateChange={setProfileMakePrivate}
          extendedAiJudge={profileExtendedAiJudge}
          onExtendedAiJudgeChange={setProfileExtendedAiJudge}
          isLoading={isProfileSaving}
          saveSuccess={profileSaveSuccess}
          saveError={profileSaveError}
          onSubmit={handleSaveProfile}
        />

        {/* Create Mission Modal */}
        {profile && (
          <CreateMissionModal
            isOpen={showCreateMissionModal}
            onClose={() => setShowCreateMissionModal(false)}
            onSubmit={handleAddChallenge}
            userLat={userLat}
            userLng={userLng}
          />
        )}

        {/* Navigation tabs */}
        <div className="flex bg-white p-0.5 sm:p-1 rounded-2xl border border-brand-border shadow-sm w-full max-w-2xl mx-auto z-[990] gap-0.5 sm:gap-1">
          <button
            onClick={() => setActiveTab("missions")}
            className={`flex-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 ${
              activeTab === "missions"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark"
            }`}
            title="View missions"
          >
            <ListFilter className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
            <span className="hidden sm:inline">Missions</span>
          </button>
          <button
            onClick={() => setActiveTab("map")}
            className={`flex-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 ${
              activeTab === "map"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark"
            }`}
            title="View live map"
          >
            <MapIcon className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
            <span className="hidden sm:inline">Map</span>
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 ${
              activeTab === "leaderboard"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark"
            }`}
            title="View leaderboard"
          >
            <Trophy className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
            <span className="hidden sm:inline">Scores</span>
          </button>
          <button
            onClick={() => setActiveTab("feed")}
            className={`flex-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 ${
              activeTab === "feed"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark"
            }`}
            title="View feed"
          >
            <Users className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
            <span className="hidden sm:inline">Feed</span>
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 relative ${
              activeTab === "chat"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark"
            }`}
            title="Chat"
          >
            <MessageSquare className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
            <span className="hidden sm:inline">Chat</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#c27d56] text-white rounded-full text-[8px] w-4 h-4 flex items-center justify-center font-bold animate-pulse select-none">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Dynamic Location Indicator */}
        <div className="bg-white/80 border border-brand-border rounded-2xl px-4 py-2.5 max-w-md mx-auto flex items-center justify-between text-xs font-medium text-brand-moss shadow-sm">
          <div className="flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-brand-terracotta" />
            <span className="text-[11px]">
              Location Status:{" "}
              {userLat !== null && userLng !== null ? (
                <strong className="font-mono text-brand-dark">
                  ({userLat.toFixed(4)}, {userLng.toFixed(4)})
                </strong>
              ) : (
                "Locking..."
              )}
            </span>
          </div>

          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            locationType === "gps"
              ? "bg-green-100 text-green-700 border border-green-200 text-center"
              : "bg-amber-100 text-amber-700 border border-amber-200 text-center"
          }`}>
            {locationType === "gps" ? "Active satellite" : "Emulated GPS"}
          </span>
        </div>

        {/* Database Connectivity Status - Admin Only */}
        {profile?.role === "admin" && (
        <div className="bg-white/80 border border-[#d2d2c8] rounded-2xl p-4 max-w-md mx-auto shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium text-[#5a5a40]">
              <Database className="h-4 w-4 text-[#8c8c5a]" />
              <span>Storage Node:</span>
            </div>
            
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              dbStatus.mode === "supabase"
                ? "bg-emerald-150 text-emerald-800 border border-emerald-200"
                : "bg-[#eaeaee] text-[#4d4d42] border border-[#d2d2c8]"
            }`}>
              {dbStatus.mode === "supabase" ? "Supabase Cloud" : "Local db.json"}
            </span>
          </div>

          {dbStatus.mode === "local_fallback" && (
            <div className="text-[11px] text-[#8c8c78] leading-normal space-y-2">
              <p>
                Currently running on **Local isolated Sandbox** storage. To bind persistent game data across systems:
              </p>
              <div className="p-2.5 bg-[#f5f5f0] rounded-xl border border-brand-border/60 text-[10px] space-y-1">
                <p className="font-bold text-[#5a5a40]">Instructions:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Configure <strong>SUPABASE_URL</strong> and <strong>SUPABASE_ANON_KEY</strong> in Server settings.</li>
                  <li>Click below to copy and execute the database layout script in Supabase!</li>
                </ol>
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setSqlVisible(!sqlVisible)}
                  className="w-full text-center text-[10px] font-bold text-[#5a5a40] hover:text-[#464632] underline hover:no-underline transition cursor-pointer"
                >
                  {sqlVisible ? "Hide SQL Seed Script" : "Show Required Supabase SQL Schema"}
                </button>

                {sqlVisible && (
                  <div className="p-3 bg-[#2d2d25] rounded-xl text-[#f2f2eb] font-mono text-[9px] relative overflow-hidden max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={copySqlToClipboard}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#3d3d32] hover:bg-[#5a5a40] text-white transition flex items-center gap-1 cursor-pointer"
                      title="Copy schema SQL"
                    >
                      {copiedSql ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedSql ? "Copied!" : "Copy"}</span>
                    </button>
                    <pre className="whitespace-pre-wrap">{SQL_SCHEMA}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {dbStatus.mode === "supabase" && dbStatus.error && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-1 text-[11px] leading-relaxed">
              <p className="font-bold">⚠️ DB Schema Missing Warning:</p>
              <p className="text-[10px] opacity-90">{dbStatus.error}</p>
              <button
                type="button"
                onClick={() => setSqlVisible(!sqlVisible)}
                className="font-bold underline text-[10px] mt-1 block hover:no-underline"
              >
                {sqlVisible ? "Hide SQL Setup Script" : "View Setup SQL"}
              </button>
              {sqlVisible && (
                <div className="mt-1.5 p-2 bg-[#2d2d25] rounded text-white font-mono text-[9px] relative max-h-36 overflow-y-auto">
                  <button
                    type="button"
                    onClick={copySqlToClipboard}
                    className="absolute top-1 right-1 p-1 bg-[#3d3d32] text-[8px] rounded hover:bg-[#5a5a40] text-white transition"
                  >
                    {copiedSql ? "Copied!" : "Copy Code"}
                  </button>
                  <pre className="whitespace-pre-wrap">{SQL_SCHEMA}</pre>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Dynamic Panel Renders */}
        <div className="pt-2">
          {activeTab === "missions" && (
            <MissionsList
              items={items}
              submissions={submissions}
              currentUserId={profile.id}
              currentUserRole={profile.role || "user"}
              onUploadSubmission={handleUploadSubmission}
              isSubmittingMap={isSubmittingMap}
              submitErrorMap={submitErrorMap}
              rejectedSubmissionMap={rejectedSubmissionMap}
              onForceSubmit={handleForceSubmit}
              userLat={userLat}
              userLng={userLng}
              onAddChallenge={handleAddChallenge}
              onDeleteMission={handleDeleteMission}
              onEditMission={handleEditMission}
              onShowCreateModal={() => setShowCreateMissionModal(true)}
            />
          )}

          {activeTab === "map" && (
            <GameMap
              items={items}
              userLat={userLat}
              userLng={userLng}
              onSelectChallenge={handleSelectChallengeFromMap}
              onSimulateCoordinates={handleSimulateCoordinates}
              onRevertToDeviceGPS={handleRevertToDeviceGPS}
              onCreateMissionFromMap={handleCreateMissionFromMap}
            />
          )}

          {activeTab === "leaderboard" && (
            <Leaderboard players={players} currentUserId={profile.id} />
          )}

          {activeTab === "feed" && (
            <Feed
              submissions={submissions}
              items={items}
              currentUserId={profile.id}
              onDeleteSubmission={handleDeleteSubmission}
            />
          )}

          {activeTab === "chat" && (
            <Chat
              profile={profile}
              players={players}
              onlinePlayers={onlinePlayers}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>
      </main>

      {/* Footer credits bar */}
      <footer className="h-12 bg-[#5a5a40] text-white/60 px-4 sm:px-8 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] font-bold shrink-0 mt-auto">
        <span>Self-Hosted Instance: v2.0.0-stable</span>
        <div className="hidden md:flex space-x-6">
          <span>Real-time Dynamic Sync Active</span>
          <span>Docker Node: {profile?.id.substring(0, 10)}</span>
        </div>
      </footer>
    </div>
  );
}
