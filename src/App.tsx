import React, { useState, useEffect, useRef } from "react";
import { ScavengerItem, PlayerProfile, Submission, ChatMessage, AppSettings } from "./types";
import { MissionsList } from "./components/MissionsList";
import { Leaderboard } from "./components/Leaderboard";
import { Feed } from "./components/Feed";
import { GameMap } from "./components/GameMap";
import { Chat } from "./components/Chat";
import { Gallery } from "./components/Gallery";
import { SlideshowViewer } from "./components/SlideshowViewer";
import { PhotoApprovalPanel } from "./components/PhotoApprovalPanel";
import { AdminAuthModal } from "./components/AdminAuthModal";
import { UserSettingsModal } from "./components/UserSettingsModal";
import { AdminSettingsModal } from "./components/AdminSettingsModal";
import { CreateMissionModal } from "./components/CreateMissionModal";
import { SlideshowGeneratorModal } from "./components/SlideshowGeneratorModal";
import { TutorialModal } from "./components/TutorialModal";
import { CameraModal } from "./components/CameraModal";
import { ServerLogs } from "./components/ServerLogs";
import { useMeshNetwork } from "./utils/useMeshNetwork";
import { QueuedSubmission } from "./utils/meshSubmissionQueue";

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
  QrCode,
  Image as ImageIcon,
  Film,
  ShieldCheck,
  Satellite,
  X,
  PlusCircle,
  ChevronDown
} from "lucide-react";

export default function App() {
  const USER_ID_KEY = "scavenger_uid";
  const USER_PROFILE_KEY = "scavenger_user";
  const USER_SESSION_ID_KEY = "kinquest_user_session_id";
  const SESSION_META_KEY = "kinquest_session_meta";
  const ADMIN_SESSION_ID_KEY = "kinquest_admin_session_id";
  const USER_SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [items, setItems] = useState<ScavengerItem[]>([]);
  const pendingDeleteIds = useRef<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [appReady, setAppReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"missions" | "map" | "leaderboard" | "feed" | "chat" | "gallery" | "slideshows" | "approval" | "logs">("missions");

  // Game branding states
  const [settings, setSettings] = useState<AppSettings>({ name: "KinQuest", icon: "/kinquest_logo.png", inviteRequired: true, activeInviteCode: "watkins" });
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [adminNameInput, setAdminNameInput] = useState("");
  const [adminIconInput, setAdminIconInput] = useState<string | null>(null);
  const [adminMapModeInput, setAdminMapModeInput] = useState<"original" | "satellite_labels" | "missions_only" | "disabled">("original");
  const [adminLatInput, setAdminLatInput] = useState(41.9076);
  const [adminLngInput, setAdminLngInput] = useState(-111.3800);
  const [adminRadiusInput, setAdminRadiusInput] = useState(200);
  const [adminAiPromptCriteriaInput, setAdminAiPromptCriteriaInput] = useState("Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!");
  const [adminAiJudgeModelInput, setAdminAiJudgeModelInput] = useState<"gemini-3.5-flash" | "gemini-2.0-flash">("gemini-3.5-flash");
  const [adminAiVerificationEnabledInput, setAdminAiVerificationEnabledInput] = useState(true);
  const [adminAllowForceSubmitInput, setAdminAllowForceSubmitInput] = useState(false);
  const [adminActiveInviteCodeInput, setAdminActiveInviteCodeInput] = useState("watkins");
  const [adminInviteRequiredInput, setAdminInviteRequiredInput] = useState(true);
  const [manualInviteCode, setManualInviteCode] = useState("");
  const [manualInviteError, setManualInviteError] = useState<string | null>(null);
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [adminSaveSuccess, setAdminSaveSuccess] = useState(false);
  const [adminSaveError, setAdminSaveError] = useState<string | null>(null);
  const [adminSessionCount, setAdminSessionCount] = useState<number>(0);
  const [adminSessionIsActive, setAdminSessionIsActive] = useState<boolean>(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [adminImageCompressionMaxDimInput, setAdminImageCompressionMaxDimInput] = useState(800);
  const [adminImageCompressionQualityInput, setAdminImageCompressionQualityInput] = useState(0.7);
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [adminShowTitleInput, setAdminShowTitleInput] = useState(true);
  const [adminShowLogoInput, setAdminShowLogoInput] = useState(true);
  const [adminChatDisabledByAdminInput, setAdminChatDisabledByAdminInput] = useState(false);

  // Admin password change states
  const [adminCurrentPasswordInput, setAdminCurrentPasswordInput] = useState("");
  const [adminNewPasswordInput, setAdminNewPasswordInput] = useState("");
  const [adminConfirmPasswordInput, setAdminConfirmPasswordInput] = useState("");
  const [adminPasswordChangeSuccess, setAdminPasswordChangeSuccess] = useState(false);
  const [adminPasswordChangeError, setAdminPasswordChangeError] = useState<string | null>(null);

  // User Settings & Permissions Dashboard states
  const [userDashboardOpen, setUserDashboardOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showCreateMissionModal, setShowCreateMissionModal] = useState(false);
  const [creatingFromMap, setCreatingFromMap] = useState(false);
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

  // Mission notification states
  const [seenMissionIds, setSeenMissionIds] = useState<Set<string>>(new Set());
  const [newMissionsCount, setNewMissionsCount] = useState(0);

  // Slideshow Generator States
  const [slideshowGeneratorOpen, setSlideshowGeneratorOpen] = useState(false);
  const [slideshowGenerating, setSlideshowGenerating] = useState(false);
  const [slideshowGeneratedScript, setSlideshowGeneratedScript] = useState<string | null>(null);
  const [slideshowError, setSlideshowError] = useState<string | null>(null);
  const [slideshowRefreshKey, setSlideshowRefreshKey] = useState(0);
  
  // Ref to track current active tab in WebSocket handlers without causing reconnection
  const activeTabRef = useRef<"missions" | "map" | "leaderboard" | "feed" | "chat" | "gallery" | "slideshows" | "approval" | "logs">("missions");
  
  // Ref for user menu dropdown
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Geolocation states
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationType, setLocationType] = useState<"gps" | "simulated">("gps");

  // Database connection state
  const [dbError, setDbError] = useState<boolean>(false);

  // Mesh Network states
  const [meshNetworkEnabled, setMeshNetworkEnabled] = useState(true);
  const [meshConnectedPeers, setMeshConnectedPeers] = useState<any[]>([]);
  const [meshSyncStatus, setMeshSyncStatus] = useState({
    isSyncing: false,
    lastSyncTime: 0,
    pendingCount: 0,
    failedCount: 0
  });

  // Initialize mesh network
  const {
    isInitialized: meshInitialized,
    meshEnabled,
    connectedPeers,
    syncStatus,
    sendMessage: sendMeshMessage,
    queueSubmission,
    getQueuedSubmissions,
    manualSync: meshManualSync,
    getSyncReport,
    getPeers
  } = useMeshNetwork({
    username: profile?.username || "Guest",
    enabled: meshNetworkEnabled,
    onMessage: (msg) => {
      if (msg.type === "chat") {
        console.log("[Mesh] Received chat message:", msg.payload);
        // Add to chat messages
        setChatMessages(prev => [...prev, msg.payload]);
      } else if (msg.type === "submission") {
        console.log("[Mesh] Received submission from peer:", msg.payload);
      }
    },
    onPeerConnected: (peer) => {
      console.log(`[Mesh] Peer connected: ${peer.username}`);
      setMeshConnectedPeers(prev => [...prev, peer]);
    },
    onPeerDisconnected: (peer) => {
      console.log(`[Mesh] Peer disconnected: ${peer.peerId}`);
      setMeshConnectedPeers(prev => prev.filter(p => p.peerId !== peer.peerId));
    },
    onSyncProgress: (progress) => {
      console.log(`[Mesh] Sync progress: ${progress.completed}/${progress.submissions.length}`);
      setMeshSyncStatus(prev => ({
        ...prev,
        isSyncing: true,
        pendingCount: progress.submissions.length - progress.completed
      }));
    },
    onSyncComplete: (results) => {
      console.log("[Mesh] Sync complete:", results);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      setMeshSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now(),
        failedCount: failed,
        pendingCount: 0
      }));
      if (failed > 0) {
        console.warn(`[Mesh] ${failed} submissions failed to sync`);
      }
    },
    onSyncError: (error) => {
      console.error("[Mesh] Sync error:", error);
      setMeshSyncStatus(prev => ({
        ...prev,
        isSyncing: false
      }));
    }
  });

  // Tracks which mission should be focused/highlighted on the map
  const [selectedMapItemId, setSelectedMapItemId] = useState<string | null>(null);

  // Spinners / error maps per mission
  const [isSubmittingMap, setIsSubmittingMap] = useState<{ [itemId: string]: boolean }>({});
  const [submitErrorMap, setSubmitErrorMap] = useState<{ [itemId: string]: string | null }>({});
  const [rejectedSubmissionMap, setRejectedSubmissionMap] = useState<{ [itemId: string]: { id: string; explanation: string; base64: string } }>({});

  // Submission retry queue state
  const [pendingSubmissions, setPendingSubmissions] = useState<QueuedSubmission[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState("All submissions synced ✓");

  const effectiveMapMode =
    settings.mapMode === "satellite_labels" || settings.mapMode === "missions_only" || settings.mapMode === "disabled"
      ? settings.mapMode
      : "original";
  const isMapDisabled = effectiveMapMode === "disabled";

  const buildQueueStatusText = (pendingCount: number, syncing: boolean) => {
    if (syncing) {
      return `Syncing ${pendingCount} pending submission${pendingCount !== 1 ? "s" : ""}...`;
    }
    if (pendingCount === 0) {
      return "All submissions synced ✓";
    }
    return `${pendingCount} pending submission${pendingCount !== 1 ? "s" : ""}`;
  };

  const [registerName, setRegisterName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [isAdminAuthLoading, setIsAdminAuthLoading] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [pendingAdminName, setPendingAdminName] = useState<string | null>(null);

  // App uses Supabase exclusively for data persistence
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

  const clearStoredAuth = () => {
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
    localStorage.removeItem(USER_SESSION_ID_KEY);
    localStorage.removeItem(SESSION_META_KEY);
    localStorage.removeItem(ADMIN_SESSION_ID_KEY);
  };

  const getAdminSessionId = () => localStorage.getItem(ADMIN_SESSION_ID_KEY);
  const getUserSessionId = () => localStorage.getItem(USER_SESSION_ID_KEY);

  const writeLocalSessionMeta = (role: "user" | "admin") => {
    const timeoutMs = role === "admin" ? 24 * 60 * 60 * 1000 : USER_SESSION_TIMEOUT_MS;
    const now = Date.now();
    localStorage.setItem(
      SESSION_META_KEY,
      JSON.stringify({
        role,
        lastActivityAt: new Date(now).toISOString(),
        expiresAt: new Date(now + timeoutMs).toISOString()
      })
    );
  };

  const refreshLocalSessionMeta = (role?: "user" | "admin") => {
    const currentRole = role || (profile?.role === "admin" ? "admin" : "user");
    writeLocalSessionMeta(currentRole);
  };

  const isLocalSessionExpired = () => {
    const raw = localStorage.getItem(SESSION_META_KEY);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.expiresAt) return false;
      return Date.now() > new Date(parsed.expiresAt).getTime();
    } catch {
      return false;
    }
  };

  const releaseAdminSession = () => {
    const sessionId = getAdminSessionId();
    if (!sessionId) return;

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ sessionId })], { type: "application/json" });
        navigator.sendBeacon("/api/auth/admin-session/logout", blob);
      } else {
        fetch("/api/auth/admin-session/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          keepalive: true
        }).catch(() => {});
      }
    } catch {
      // Ignore transport issues; stale sessions are cleaned up server-side by timeout.
    }
  };

  const releaseUserSession = () => {
    const sessionId = getUserSessionId();
    const userId = localStorage.getItem(USER_ID_KEY);
    if (!sessionId || !userId) return;

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ sessionId, userId })], { type: "application/json" });
        navigator.sendBeacon("/api/auth/session/logout", blob);
      } else {
        fetch("/api/auth/session/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, userId }),
          keepalive: true
        }).catch(() => {});
      }
    } catch {
      // Ignore transport issues; server-side expiry still applies.
    }
  };

  const silentReconnectInFlightRef = useRef(false);

  const silentlyReconnectUserSession = async (cachedProfile?: PlayerProfile | null): Promise<boolean> => {
    if (silentReconnectInFlightRef.current) return false;

    const profileFromArg = cachedProfile || profile;
    if (!profileFromArg || profileFromArg.role === "admin") {
      return false;
    }

    const username = profileFromArg.username?.trim();
    if (!username) {
      return false;
    }

    silentReconnectInFlightRef.current = true;
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          role: "user",
          existingSessionId: getUserSessionId()
        })
      });

      if (!response.ok) {
        return false;
      }

      const activeUser = await response.json();
      localStorage.setItem(USER_ID_KEY, activeUser.id);
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(activeUser));
      if (activeUser.sessionId) {
        localStorage.setItem(USER_SESSION_ID_KEY, activeUser.sessionId);
      }
      writeLocalSessionMeta("user");
      setProfile(activeUser);
      return true;
    } catch {
      return false;
    } finally {
      silentReconnectInFlightRef.current = false;
    }
  };

  const fetchAdminSessionStatus = async () => {
    const sessionId = getAdminSessionId();
    if (!sessionId) {
      setAdminSessionCount(0);
      setAdminSessionIsActive(false);
      return;
    }

    try {
      const res = await fetch(`/api/auth/admin-session/status?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) {
        setAdminSessionIsActive(false);
        return;
      }
      const data = await res.json();
      setAdminSessionCount(Number(data.activeSessions) || 0);
      setAdminSessionIsActive(Boolean(data.currentSessionActive));
    } catch {
      // Ignore temporary fetch errors in debug panel.
    }
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
          setUserLat(41.9076);
          setUserLng(-111.3800);
          setLocationType("simulated");
        }
      );
    } else {
      setUserLat(41.9076);
      setUserLng(-111.3800);
      setLocationType("simulated");
    }

    // 2. Load game profile
    const cachedUid = localStorage.getItem(USER_ID_KEY);
    const cachedUser = localStorage.getItem(USER_PROFILE_KEY);

    if (cachedUid && cachedUser) {
      try {
        const cachedProfile = JSON.parse(cachedUser) as PlayerProfile;

        if (isLocalSessionExpired()) {
          if (cachedProfile.role === "admin") {
            clearStoredAuth();
          } else {
            silentlyReconnectUserSession(cachedProfile).then((reconnected) => {
              if (!reconnected) {
                clearStoredAuth();
                setProfile(null);
              }
            });
          }
        } else if (cachedProfile.role === "admin") {
          const existingSessionId = getAdminSessionId();
          if (!existingSessionId) {
            clearStoredAuth();
          } else {
            fetch("/api/auth/admin-session/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: existingSessionId })
            })
              .then(async (res) => {
                if (!res.ok) {
                  clearStoredAuth();
                  setProfile(null);
                  return;
                }
                setProfile(cachedProfile);
                refreshLocalSessionMeta("admin");
              })
              .catch(() => {
                clearStoredAuth();
                setProfile(null);
              });
          }
        } else {
          const existingUserSessionId = getUserSessionId();
          if (!existingUserSessionId) {
            clearStoredAuth();
          } else {
            fetch("/api/auth/session/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: existingUserSessionId, userId: cachedProfile.id })
            })
              .then(async (res) => {
                if (!res.ok) {
                  const reconnected = await silentlyReconnectUserSession(cachedProfile);
                  if (!reconnected) {
                    clearStoredAuth();
                    setProfile(null);
                  }
                  return;
                }
                setProfile(cachedProfile);
                refreshLocalSessionMeta("user");
              })
              .catch(() => {
                silentlyReconnectUserSession(cachedProfile).then((reconnected) => {
                  if (!reconnected) {
                    clearStoredAuth();
                    setProfile(null);
                  }
                });
              });
          }
        }
      } catch (e) {
        clearStoredAuth();
      }
    }
    setAppReady(true);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen]);

  // Back button warning state
  const [showBackWarning, setShowBackWarning] = useState(false);
  const [hasPendingPhoto, setHasPendingPhoto] = useState(false);
  const allowNextBackNavigationRef = useRef(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [tutorialDismissedThisSession, setTutorialDismissedThisSession] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraModalItemId, setCameraModalItemId] = useState<string | null>(null);
  const [cameraModalItemTitle, setCameraModalItemTitle] = useState("");
  const [cameraSelectedImage, setCameraSelectedImage] = useState<string | null>(null);
  const [cameraIsSubmitting, setCameraIsSubmitting] = useState(false);

  // Ref so popstate handler always reads current values without stale closures
  const backStateRef = useRef({
    hasPendingPhoto: false,
    cameraModalOpen: false,
    showCreateMissionModal: false,
    adminPanelOpen: false,
    userDashboardOpen: false,
    slideshowGeneratorOpen: false,
  });
  useEffect(() => {
    backStateRef.current = {
      hasPendingPhoto,
      cameraModalOpen,
      showCreateMissionModal,
      adminPanelOpen,
      userDashboardOpen,
      slideshowGeneratorOpen,
    };
  }, [hasPendingPhoto, cameraModalOpen, showCreateMissionModal, adminPanelOpen, userDashboardOpen, slideshowGeneratorOpen]);

  // Push sentinel state once so back button has something to intercept
  useEffect(() => {
    history.pushState({ kinquestSentinel: true }, "");

    const handlePopState = () => {
      // User confirmed leaving, allow exactly one real back navigation.
      if (allowNextBackNavigationRef.current) {
        allowNextBackNavigationRef.current = false;
        return;
      }

      // Intercept every back action and show warning first.
      history.pushState({ kinquestSentinel: true }, "");
      setShowBackWarning(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Native browser/tab-close warning for actual data-loss scenarios
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (backStateRef.current.hasPendingPhoto || backStateRef.current.showCreateMissionModal) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    setTutorialDismissedThisSession(false);
  }, [profile?.id]);

  // Show tutorial on first login if not completed
  useEffect(() => {
    if (profile && appReady && !profile.tutorialCompleted && !tutorialDismissedThisSession) {
      setShowTutorialModal(true);
    }
  }, [profile?.id, appReady, profile?.tutorialCompleted, tutorialDismissedThisSession]);

  useEffect(() => {
    setHasPendingPhoto(Boolean(cameraSelectedImage));
  }, [cameraSelectedImage]);

  // Offline snapshot + connectivity state
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [snapshotAge, setSnapshotAge] = useState<number | null>(null); // ms since last good state
  const consecutiveFailuresRef = useRef(0);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Central Game State Synchronizer — adapts its poll interval based on connectivity
  useEffect(() => {
    const FAST_INTERVAL = 2500;
    const SLOW_INTERVAL = 15000; // back off after repeated failures
    const OFFLINE_INTERVAL = 30000; // minimal check when offline
    const SNAPSHOT_KEY = "kinquest_game_snapshot";

    let intervalId: any;

    const fetchGameState = async () => {
      // Skip fetch if clearly offline — just update banner age
      if (!navigator.onLine) {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        if (raw) {
          try {
            const snap = JSON.parse(raw);
            setSnapshotAge(Date.now() - snap.savedAt);
          } catch {}
        }
        setDbError(true);
        return;
      }

      try {
        const currentUid = localStorage.getItem(USER_ID_KEY);
        const currentSessionId = getUserSessionId();
        const query = currentUid && currentSessionId
          ? `?userId=${encodeURIComponent(currentUid)}&sessionId=${encodeURIComponent(currentSessionId)}`
          : "";

        const res = await fetch(`/api/game-state${query}`);
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.users || []);
          setItems((data.items || []).filter((item: ScavengerItem) => !pendingDeleteIds.current.has(item.id)));
          setSubmissions(data.submissions || []);
          if (data.settings) {
            setSettings(data.settings);
          }
          setDbError(false);
          setSnapshotAge(null);
          consecutiveFailuresRef.current = 0;

          // Persist snapshot for offline fallback
          localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));

          // Sync active user profile score dynamically
          const cachedUid = localStorage.getItem(USER_ID_KEY);
          if (cachedUid) {
            const serverProfile = (data.users || []).find((u: PlayerProfile) => u.id === cachedUid);
            if (serverProfile) {
              setProfile(serverProfile);
              localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(serverProfile));
              refreshLocalSessionMeta(serverProfile.role === "admin" ? "admin" : "user");
            } else {
              console.warn("Local profile was not found in server state database. Resetting auth.");
              handleSignOut();
            }
          }
        } else if (res.status === 401 && profile?.role !== "admin") {
          const reconnected = await silentlyReconnectUserSession(profile);
          if (!reconnected) {
            handleSignOut();
          }
          return;
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (err) {
        console.error("Polling game state failed:", err);
        consecutiveFailuresRef.current += 1;
        setDbError(true);

        // Hydrate from snapshot if we have one and haven't shown it yet
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        if (raw) {
          try {
            const snap = JSON.parse(raw);
            if (consecutiveFailuresRef.current === 1) {
              // Only hydrate once — don't thrash state on every failure
              setPlayers(snap.users || []);
              setItems((snap.items || []).filter((item: ScavengerItem) => !pendingDeleteIds.current.has(item.id)));
              setSubmissions(snap.submissions || []);
              if (snap.settings) setSettings(snap.settings);
            }
            setSnapshotAge(Date.now() - snap.savedAt);
          } catch {}
        }
      }

      // Reschedule at adaptive interval
      const failures = consecutiveFailuresRef.current;
      const nextInterval = !navigator.onLine
        ? OFFLINE_INTERVAL
        : failures >= 3
          ? SLOW_INTERVAL
          : FAST_INTERVAL;

      clearInterval(intervalId);
      intervalId = setInterval(fetchGameState, nextInterval);
    };

    fetchGameState();
    intervalId = setInterval(fetchGameState, FAST_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  // Keep unified queue status in sync with mesh sync manager
  useEffect(() => {
    const pending = getQueuedSubmissions();
    setPendingSubmissions(pending);
    setIsSyncing(syncStatus.isSyncing);
    setSyncStatusText(buildQueueStatusText(pending.length, syncStatus.isSyncing));
  }, [getQueuedSubmissions, syncStatus.isSyncing, syncStatus.pendingCount, syncStatus.failedCount]);

  // Download chat logs initially
  useEffect(() => {
    if (!profile || settings.chatDisabledByAdmin) {
      setChatMessages([]);
      setUnreadCount(0);
      return;
    }
    
    fetch("/api/chat-history")
      .then(res => res.json())
      .then(data => setChatMessages(data || []))
      .catch(err => console.error("Failed to load chat history:", err));
  }, [profile, settings.chatDisabledByAdmin]);

  // Track new missions and update badge
  useEffect(() => {
    const newMissions = items.filter(item => !seenMissionIds.has(item.id));
    const newCount = newMissions.length;
    setNewMissionsCount(newCount);

    // Update PWA badge if app is installed
    if ('setAppBadge' in navigator) {
      if (newCount > 0) {
        (navigator as any).setAppBadge(newCount);
      } else {
        (navigator as any).clearAppBadge?.();
      }
    }
  }, [items, seenMissionIds]);

  // Mark missions as seen when clicking the missions tab
  useEffect(() => {
    if (activeTab === "missions") {
      const currentIds = new Set(items.map(item => item.id));
      setSeenMissionIds(currentIds);
      setNewMissionsCount(0);

      // Clear PWA badge
      if ('clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge?.();
      }
    }
  }, [activeTab, items]);

  // Ref to track if profile ID actually changed (to avoid reconnection on object refresh)
  const profileIdRef = useRef<string | null>(null);

  // Connect Real-time WebSocket overlay
  useEffect(() => {
    if (settings.chatDisabledByAdmin) {
      if (socket) {
        socket.close();
        setSocket(null);
      }
      return;
    }

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
  }, [profile?.id, settings.chatDisabledByAdmin]);

  // Reset unread counts when clicking chat tab
  useEffect(() => {
    if (activeTab === "chat") {
      setUnreadCount(0);
    }
  }, [activeTab]);

  useEffect(() => {
    if (settings.chatDisabledByAdmin && activeTab === "chat") {
      setActiveTab("missions");
    }
  }, [activeTab, settings.chatDisabledByAdmin]);

  // Update the ref to track current active tab for WebSocket handlers
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Chat offline outbox — flush pending messages when socket becomes ready
  const CHAT_OUTBOX_KEY = "kinquest_chat_outbox";

  const saveChatOutbox = (msgs: ChatMessage[]) => {
    try { localStorage.setItem(CHAT_OUTBOX_KEY, JSON.stringify(msgs)); } catch {}
  };

  const loadChatOutbox = (): ChatMessage[] => {
    try { return JSON.parse(localStorage.getItem(CHAT_OUTBOX_KEY) || "[]"); } catch { return []; }
  };

  const flushChatOutbox = (ws: WebSocket) => {
    const outbox = loadChatOutbox();
    if (outbox.length === 0) return;
    const remaining: ChatMessage[] = [];
    for (const msg of outbox) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "send_message", userId: msg.senderId, username: msg.senderName, receiverId: msg.receiverId ?? null, text: msg.text, clientId: msg.id }));
      } else {
        remaining.push(msg);
      }
    }
    saveChatOutbox(remaining);
    if (outbox.length > remaining.length) {
      console.log(`[ChatOutbox] Flushed ${outbox.length - remaining.length} queued message(s)`);
    }
  };

  const handleSendMessage = (text: string, receiverId: string | null) => {
    console.log("handleSendMessage called:", { text, receiverId, hasProfile: !!profile, socketState: socket?.readyState, onLine: navigator.onLine });

    if (settings.chatDisabledByAdmin) {
      console.warn("Chat is disabled by admin setting");
      return;
    }
    
    if (!profile) {
      console.error("Cannot send message: profile is null");
      return;
    }

    // Offline path: try mesh network first, then outbox
    if (!navigator.onLine || !socket || socket.readyState !== WebSocket.OPEN) {
      const messagePayload: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        senderId: profile.id,
        senderName: profile.username,
        text,
        receiverId: receiverId || null,
        createdAt: new Date().toISOString(),
        isRead: true
      };

      // Try mesh peers first
      if (meshEnabled && connectedPeers.length > 0) {
        try {
          sendMeshMessage("chat", messagePayload, receiverId || undefined);
          setChatMessages(prev => [...prev, messagePayload]);
          console.log("📡 Message sent via mesh network");
          return;
        } catch (error) {
          console.error("[Mesh] Failed to send message via mesh:", error);
        }
      }

      // Queue to outbox for delivery when socket reconnects
      const outbox = loadChatOutbox();
      if (!outbox.some(m => m.id === messagePayload.id)) {
        outbox.push(messagePayload);
        saveChatOutbox(outbox);
      }
      // Show optimistically in local chat
      setChatMessages(prev => prev.some(m => m.id === messagePayload.id) ? prev : [...prev, { ...messagePayload, text: `[queued] ${text}` }]);
      console.warn("[ChatOutbox] No connection — message queued for later delivery");
      return;
    }

    // Flush any outbox items before sending new message
    flushChatOutbox(socket);

    // Send online
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

  // Flush outbox whenever socket opens
  useEffect(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      flushChatOutbox(socket);
    }
  }, [socket?.readyState]);

  // Admin action handlers for chat moderation
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile?.id })
      });
      if (!response.ok) throw new Error("Failed to delete message");
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const handleMuteUser = async (userId: string) => {
    if (profile?.role !== "admin") return;
    try {
      const response = await fetch(`/api/users/${userId}/mute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: profile.id })
      });
      if (!response.ok) throw new Error("Failed to mute user");
    } catch (err) {
      console.error("Error muting user:", err);
    }
  };

  const handleUnmuteUser = async (userId: string) => {
    if (profile?.role !== "admin") return;
    try {
      const response = await fetch(`/api/users/${userId}/mute`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: profile.id })
      });
      if (!response.ok) throw new Error("Failed to unmute user");
    } catch (err) {
      console.error("Error unmuting user:", err);
    }
  };

  const handleBootUser = async (userId: string) => {
    if (profile?.role !== "admin") return;
    try {
      const response = await fetch(`/api/users/${userId}/boot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: profile.id })
      });
      if (!response.ok) throw new Error("Failed to boot user");
    } catch (err) {
      console.error("Error booting user:", err);
    }
  };

  // Ref to track if we've initialized the admin form for the current open state
  const initializedAdminFormRef = useRef<boolean>(false);

  // Pre-populate admin inputs ONLY when panel opens (not on every settings change)
  useEffect(() => {
    if (adminPanelOpen && !initializedAdminFormRef.current && settings) {
      // Only initialize when opening, not on every settings change
      setAdminNameInput(settings.name);
      setAdminIconInput(settings.icon);
      setAdminMapModeInput(
        settings.mapMode === "satellite_labels" || settings.mapMode === "missions_only" || settings.mapMode === "disabled"
          ? settings.mapMode
          : "original"
      );
      setAdminLatInput(settings.defaultLat ?? 41.9076);
      setAdminLngInput(settings.defaultLng ?? -111.3800);
      setAdminRadiusInput(settings.defaultRadius ?? 200);
      setAdminAiPromptCriteriaInput(settings.aiPromptCriteria ?? "Friendly, witty, and slightly funny AI Referee. High-spirited, playful 1-2 sentence description explaining what you spotted.");
      setAdminAiJudgeModelInput(settings.aiJudgeModel === "gemini-2.0-flash" ? "gemini-2.0-flash" : "gemini-3.5-flash");
      setAdminAiVerificationEnabledInput(settings.aiVerificationEnabled !== false);
      setAdminAllowForceSubmitInput(settings.allowForceSubmit === true);
      setAdminActiveInviteCodeInput(settings.activeInviteCode ?? "hunt-party-2026");
      setAdminInviteRequiredInput(settings.inviteRequired !== false);
      setAdminImageCompressionMaxDimInput(settings.imageCompressionMaxDim ?? 800);
      setAdminImageCompressionQualityInput(settings.imageCompressionQuality ?? 0.7);
      setAdminShowTitleInput(settings.showTitle !== false);
      setAdminShowLogoInput(settings.showLogo !== false);
      setAdminChatDisabledByAdminInput(settings.chatDisabledByAdmin === true);
      initializedAdminFormRef.current = true;
    } else if (!adminPanelOpen) {
      // Reset the flag when panel closes so it can initialize again when reopened
      initializedAdminFormRef.current = false;
    }
  }, [adminPanelOpen, settings]);

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
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(updatedProf));
        refreshLocalSessionMeta(updatedProf.role === "admin" ? "admin" : "user");
        
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
          mapMode: adminMapModeInput,
          defaultLat: Number(adminLatInput) || 41.9076,
          defaultLng: Number(adminLngInput) || -111.3800,
          defaultRadius: Number(adminRadiusInput) || 200,
          aiPromptCriteria: adminAiPromptCriteriaInput.trim(),
          aiJudgeModel: adminAiJudgeModelInput,
          aiVerificationEnabled: adminAiVerificationEnabledInput,
          allowForceSubmit: adminAllowForceSubmitInput,
          activeInviteCode: adminActiveInviteCodeInput.trim().toLowerCase(),
          inviteRequired: adminInviteRequiredInput,
          imageCompressionMaxDim: Number(adminImageCompressionMaxDimInput) || 800,
          imageCompressionQuality: Number(adminImageCompressionQualityInput) || 0.7,
          showTitle: adminShowTitleInput,
          showLogo: adminShowLogoInput,
          chatDisabledByAdmin: adminChatDisabledByAdminInput
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
          icon: "/kinquest_logo.png",
          mapMode: "original",
          defaultLat: 41.9076,
          defaultLng: -111.3800,
          defaultRadius: 200,
          aiPromptCriteria: "Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!",
          aiJudgeModel: "gemini-3.5-flash",
          aiVerificationEnabled: true,
          allowForceSubmit: false,
          activeInviteCode: "watkins",
          inviteRequired: true,
          imageCompressionMaxDim: 800,
          imageCompressionQuality: 0.7,
          showTitle: true,
          showLogo: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setAdminNameInput("KinQuest");
        setAdminIconInput("/kinquest_logo.png");
        setAdminMapModeInput("original");
        setAdminLatInput(41.9076);
        setAdminLngInput(-111.3800);
        setAdminRadiusInput(200);
        setAdminAiPromptCriteriaInput("Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!");
        setAdminAiJudgeModelInput("gemini-3.5-flash");
        setAdminAiVerificationEnabledInput(true);
        setAdminAllowForceSubmitInput(false);
        setAdminActiveInviteCodeInput("watkins");
        setAdminInviteRequiredInput(true);
        setAdminImageCompressionMaxDimInput(800);
        setAdminImageCompressionQualityInput(0.7);
        setAdminShowTitleInput(true);
        setAdminShowLogoInput(true);
        setAdminChatDisabledByAdminInput(false);
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

  const handleAdminPasswordChange = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Clear previous messages
    setAdminPasswordChangeError(null);
    setAdminPasswordChangeSuccess(false);

    // Validation
    if (!adminCurrentPasswordInput.trim()) {
      setAdminPasswordChangeError("Current password is required");
      return;
    }
    if (!adminNewPasswordInput.trim()) {
      setAdminPasswordChangeError("New password is required");
      return;
    }
    if (!adminConfirmPasswordInput.trim()) {
      setAdminPasswordChangeError("Password confirmation is required");
      return;
    }
    if (adminNewPasswordInput !== adminConfirmPasswordInput) {
      setAdminPasswordChangeError("New passwords do not match");
      return;
    }
    if (adminNewPasswordInput.length < 6) {
      setAdminPasswordChangeError("New password must be at least 6 characters");
      return;
    }
    if (adminCurrentPasswordInput === adminNewPasswordInput) {
      setAdminPasswordChangeError("New password must be different from current password");
      return;
    }

    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: adminCurrentPasswordInput,
          newPassword: adminNewPasswordInput
        })
      });

      if (res.ok) {
        setAdminPasswordChangeSuccess(true);
        // Clear form
        setAdminCurrentPasswordInput("");
        setAdminNewPasswordInput("");
        setAdminConfirmPasswordInput("");
        // Clear success message after 3 seconds
        setTimeout(() => setAdminPasswordChangeSuccess(false), 3000);
      } else {
        const errData = await res.json();
        setAdminPasswordChangeError(errData.error || "Failed to change password");
      }
    } catch (err: any) {
      setAdminPasswordChangeError(err.message || "Network error changing password");
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
      localStorage.setItem(USER_ID_KEY, activeUser.id);
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(activeUser));
      if (activeUser.sessionId) {
        localStorage.setItem(USER_SESSION_ID_KEY, activeUser.sessionId);
      }
      writeLocalSessionMeta(role === "admin" ? "admin" : "user");
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
        body: JSON.stringify({ password, existingSessionId: getAdminSessionId() }),
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Invalid admin password");
      }

      const verifyPayload = await response.json();
      if (verifyPayload?.sessionId) {
        localStorage.setItem(ADMIN_SESSION_ID_KEY, verifyPayload.sessionId);
        fetchAdminSessionStatus();
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
    releaseUserSession();
    if (profile?.role === "admin") {
      releaseAdminSession();
    }
    clearStoredAuth();
    setProfile(null);
  };

  useEffect(() => {
    if (profile?.role !== "admin") return;

    const sessionId = getAdminSessionId();
    if (!sessionId) {
      handleSignOut();
      return;
    }

    const refreshServerSession = async () => {
      try {
        const res = await fetch("/api/auth/admin-session/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId })
        });

        if (!res.ok) {
          const reconnected = await silentlyReconnectUserSession(profile);
          if (!reconnected) {
            handleSignOut();
          }
          return;
        }

        refreshLocalSessionMeta("admin");
      } catch {
        // Leave current local state intact during transient network failures.
      }
    };

    refreshServerSession();
    const keepAliveInterval = window.setInterval(refreshServerSession, 60 * 1000);
    const statusInterval = window.setInterval(fetchAdminSessionStatus, 15000);
    fetchAdminSessionStatus();

    const onPageHide = () => {
      releaseUserSession();
      releaseAdminSession();
    };

    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(keepAliveInterval);
      window.clearInterval(statusInterval);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    if (!profile) return;

    const userSessionId = getUserSessionId();
    if (!userSessionId) {
      handleSignOut();
      return;
    }

    const refreshUserServerSession = async () => {
      try {
        const res = await fetch("/api/auth/session/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: userSessionId, userId: profile.id })
        });

        if (!res.ok) {
          handleSignOut();
          return;
        }

        refreshLocalSessionMeta(profile.role === "admin" ? "admin" : "user");
      } catch {
        // Allow transient failures without forcing logout.
      }
    };

    refreshUserServerSession();
    const userKeepAliveInterval = window.setInterval(refreshUserServerSession, 60 * 1000);
    return () => window.clearInterval(userKeepAliveInterval);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;

    const checkExpiry = () => {
      if (isLocalSessionExpired()) {
        if (profile.role === "admin") {
          handleSignOut();
        } else {
          silentlyReconnectUserSession(profile).then((reconnected) => {
            if (!reconnected) {
              handleSignOut();
            }
          });
        }
      }
    };

    checkExpiry();
    const expiryInterval = window.setInterval(checkExpiry, 60 * 1000);
    return () => window.clearInterval(expiryInterval);
  }, [profile?.id]);

  // Submit base64 photo with current coordinates to server
  const handleUploadSubmission = async (itemId: string, base64Image: string, forceSubmit: boolean = false, submissionId?: string): Promise<boolean> => {
    if (!profile) return false;

    setSubmitErrorMap((prev) => ({ ...prev, [itemId]: null }));
    setIsSubmittingMap((prev) => ({ ...prev, [itemId]: true }));

    try {
      // Check if we're offline
      if (!navigator.onLine) {
        // Offline flow: queue the submission locally
        console.log("[Offline] Queuing submission for later sync");
        
        const queued = await queueSubmission(
          profile.id,
          profile.username,
          itemId,
          base64Image,
          userLat || undefined,
          userLng || undefined,
          forceSubmit,
          submissionId,
          "error",
          "Offline submission queued"
        );

        setSubmitErrorMap((prev) => ({
          ...prev,
          [itemId]: "📡 Offline: Photo saved locally. Will verify when you're back online."
        }));

        // Attempt to share with mesh peers if available
        if (meshEnabled && connectedPeers.length > 0) {
          try {
            await sendMeshMessage("submission", queued);
            console.log("[Mesh] Shared submission with peers");
          } catch (error) {
            console.warn("[Mesh] Could not share submission with peers:", error);
          }
        }

        setIsSubmittingMap((prev) => ({ ...prev, [itemId]: false }));
        const pending = getQueuedSubmissions();
        setPendingSubmissions(pending);
        setSyncStatusText(buildQueueStatusText(pending.length, syncStatus.isSyncing));
        return false;
      }

      // Online flow: send to server immediately (existing code)
      const response = await fetch("/api/verify-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          itemId: itemId,
          imageBase64: base64Image,
          userLat: userLat,
          userLng: userLng,
          forceSubmit: forceSubmit,
          submissionId: submissionId
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
          [itemId]: { id: payload.submission.id, explanation: payload.explanation, base64: base64Image }
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

      return true;

    } catch (err: any) {
      console.error("Submission grading error:", err);
      
      // Determine if this is a network/retry issue or validation error
      const isNetworkError = err.message?.includes("fetch") || 
                            err.message?.includes("Network") ||
                            err.message?.includes("timeout") ||
                            err.message?.includes("rate");
      
      if (isNetworkError || (err instanceof TypeError)) {
        // Network error - queue into unified offline queue
        const retryReason = err.message?.includes("rate") ? "rate_limit" : "error";
        await queueSubmission(
          profile.id,
          profile.username,
          itemId,
          base64Image,
          userLat || undefined,
          userLng || undefined,
          forceSubmit,
          submissionId,
          retryReason as "rate_limit" | "timeout" | "error",
          err instanceof Error ? err.message : "Network error"
        );
        
        setSubmitErrorMap((prev) => ({
          ...prev,
          [itemId]: "Network issue detected. Will retry in background. " + (err instanceof Error ? err.message : "Retry will occur automatically.")
        }));
        
        // Update pending submissions display
        const pending = getQueuedSubmissions();
        setPendingSubmissions(pending);
        setSyncStatusText(buildQueueStatusText(pending.length, syncStatus.isSyncing));
      } else {
        // Validation or other error - show to user
        setSubmitErrorMap((prev) => ({
          ...prev,
          [itemId]: err instanceof Error ? err.message : "Proof check declined. Retry."
        }));
      }
      return false;
    } finally {
      setIsSubmittingMap((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  // Force submit a rejected submission
  const handleForceSubmit = async (itemId: string): Promise<boolean> => {
    const rejected = rejectedSubmissionMap[itemId];
    if (rejected) {
      return handleUploadSubmission(itemId, rejected.base64, true, rejected.id);
    }
    return false;
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

  // Retry pending submission (for rate-limited or timed-out submissions)
  const handleRetryPendingSubmission = async (subId: string) => {
    try {
      const response = await fetch(`/api/submissions/${subId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Could not retry submission verification.");
      }
      // Success: submission is now retrying, UI will refresh on next poll
    } catch (err: any) {
      console.error("Retry error:", err);
      alert(err instanceof Error ? err.message : "Failed to retry submission");
    }
  };

  // Manually trigger a full sync of all pending submissions
  const handleManualSync = async () => {
    const before = getQueuedSubmissions();
    if (before.length === 0) {
      alert("No pending submissions to sync");
      return;
    }

    setIsSyncing(true);
    await meshManualSync();

    const pending = getQueuedSubmissions();
    const syncedCount = Math.max(0, before.length - pending.length);
    setPendingSubmissions(pending);
    setSyncStatusText(buildQueueStatusText(pending.length, false));
    setIsSyncing(false);

    alert(`Manual sync complete!\n✓ ${syncedCount} synced\n\nStill pending: ${pending.length}`);
  };

  // Approve submission - admin only
  const handleApproveSubmission = async (subId: string, points?: number) => {
    try {
      const response = await fetch(`/api/submissions/${subId}/manual-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", points })
      });
      if (!response.ok) {
        throw new Error("Could not approve submission.");
      }
      // Success: automatically visual refresh occurs in periodic loop!
    } catch (err) {
      console.error("Error approving submission:", err);
      throw err;
    }
  };

  // Reject submission - admin only
  const handleRejectSubmission = async (subId: string) => {
    try {
      const response = await fetch(`/api/submissions/${subId}/manual-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" })
      });
      if (!response.ok) {
        throw new Error("Could not reject submission.");
      }
      // Success: automatically visual refresh occurs in periodic loop!
    } catch (err) {
      console.error("Error rejecting submission:", err);
      throw err;
    }
  };

  // Update points for an approved submission
  const handleUpdateSubmissionPoints = async (subId: string, points: number) => {
    try {
      const response = await fetch(`/api/submissions/${subId}/update-points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points })
      });
      if (!response.ok) {
        throw new Error("Could not update submission points.");
      }
      // Success: automatically visual refresh occurs in periodic loop!
    } catch (err) {
      console.error("Error updating submission points:", err);
      throw err;
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

    // Optimistically mark as pending delete so polls don't bring it back
    pendingDeleteIds.current.add(itemId);
    setItems((prev) => prev.filter((item) => item.id !== itemId));

    try {
      const response = await fetch(`/api/challenges/${itemId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile?.id })
      });

      if (!response.ok) {
        throw new Error("Failed to delete mission.");
      }
    } catch (err: any) {
      // Restore item on failure by clearing the pending delete
      pendingDeleteIds.current.delete(itemId);
      console.error("Delete mission error:", err);
      alert(err instanceof Error ? err.message : "Failed to delete mission.");
    } finally {
      // After a delay, clean up the pending set (poll will have fresh data by then)
      setTimeout(() => pendingDeleteIds.current.delete(itemId), 5000);
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
    setCreatingFromMap(true);
    setShowCreateMissionModal(true);
  };

  const handleFocusMissionOnMap = (itemId: string) => {
    if (isMapDisabled) {
      return;
    }
    setSelectedMapItemId(itemId);
    setActiveTab("map");
  };

  useEffect(() => {
    if (isMapDisabled && activeTab === "map") {
      setActiveTab("missions");
    }
  }, [activeTab, isMapDisabled]);

  // Map clicks link directly to challenge cards and expands them!
  const handleSelectChallengeFromMap = (itemId: string) => {
    setSelectedMapItemId(itemId);
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
            <h2 className="mt-6 text-center text-3xl font-serif font-bold text-[#5a5a40] tracking-tight text-balance">
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

  const handleCompleteTutorial = async () => {
    if (!profile) return;
    try {
      const res = await fetch("/api/tutorial/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id })
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setShowTutorialModal(false);
        setTutorialDismissedThisSession(false);
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(data.profile));
      } else {
        console.error("Failed to mark tutorial complete:", res.statusText);
      }
    } catch (err) {
      console.error("Error marking tutorial complete:", err);
    }
  };

  const handleCameraModalSubmit = async () => {
    if (!cameraSelectedImage || !cameraModalItemId) return;
    
    setCameraIsSubmitting(true);
    try {
      const wasSuccessful = await handleUploadSubmission(cameraModalItemId, cameraSelectedImage);
      if (wasSuccessful) {
        setCameraModalOpen(false);
        setCameraSelectedImage(null);
        setCameraModalItemId(null);
        setCameraModalItemTitle("");
      }
    } finally {
      setCameraIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#2d2d2d] font-sans flex flex-col">
      {/* Top Header navbar with score indicators */}
      <header className="flex flex-col border-b border-brand-border bg-[#f5f5f0]/95 backdrop-blur-md sticky top-0 z-[1000] shrink-0">
        {/* Header Top Row */}
        <div className="h-16 px-3 sm:px-8 flex items-center justify-between">
          <div className="flex items-center min-w-0">
            {/* Logo and Title merged when both are shown */}
            {settings.showLogo && settings.showTitle ? (
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#5a5a40] rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {settings.icon ? (
                    <img src={settings.icon} alt="Game Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-3 h-3 border-2 border-[#f5f5f0] rounded-sm rotate-45"></div>
                  )}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <h1 className="text-sm sm:text-base md:text-lg font-serif text-[#5a5a40] font-bold tracking-tight leading-none truncate max-w-[100px] sm:max-w-[180px] md:max-w-[240px]">
                    {settings.name}
                  </h1>
                </div>
              </div>
            ) : settings.showLogo ? (
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#5a5a40] rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                {settings.icon ? (
                  <img src={settings.icon} alt="Game Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-3 h-3 border-2 border-[#f5f5f0] rounded-sm rotate-45"></div>
                )}
              </div>
            ) : settings.showTitle ? (
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base md:text-lg font-serif text-[#5a5a40] font-bold tracking-tight leading-none truncate max-w-[100px] sm:max-w-[180px] md:max-w-[240px]">
                  {settings.name}
                </h1>
              </div>
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10"></div>
            )}
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

              {/* Active Hunters Count Badge */}
              <div className="bg-[#8c8c5a] text-[#f5f5f0] px-2 sm:px-3 py-1.5 rounded-xl flex items-center gap-1 sm:gap-1.5 shadow-sm shadow-[#8c8c5a]/10 whitespace-nowrap">
                <Users className="h-3.5 sm:h-4 w-3.5 sm:w-4 flex-shrink-0" />
                <div className="text-left leading-none hidden sm:block">
                  <span className="text-[7px] sm:text-[8px] uppercase font-bold tracking-widest block opacity-75">Active</span>
                  <span className="text-xs font-black font-mono">{onlinePlayers.length}</span>
                </div>
                <span className="text-xs sm:hidden font-black font-mono">{onlinePlayers.length}</span>
              </div>

              {/* Sync Status Badge - clickable to trigger manual sync, hover for diagnostics */}
              <div className="relative group">
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  type="button"
                  className={`px-2 sm:px-3 py-1.5 rounded-xl flex items-center gap-1 sm:gap-1.5 shadow-sm whitespace-nowrap transition cursor-pointer font-bold text-xs sm:text-xs ${
                    pendingSubmissions.filter(s => s.status === "failed").length > 0
                      ? "bg-red-500/20 text-red-700 hover:bg-red-500/30 border border-red-200/50"
                      : pendingSubmissions.length > 0
                        ? "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 border border-amber-200/50"
                        : "bg-green-500/20 text-green-700 border border-green-200/50"
                  } disabled:opacity-50`}
                  title="Click to sync pending submissions"
                >
                  {isSyncing ? (
                    <Loader2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin flex-shrink-0" />
                  ) : pendingSubmissions.length > 0 ? (
                    <>
                      <RotateCcw className="h-3.5 sm:h-4 w-3.5 sm:w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">{pendingSubmissions.length}</span>
                      <span className="sm:hidden font-black">{pendingSubmissions.length}</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 sm:h-4 w-3.5 sm:w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">Synced</span>
                    </>
                  )}
                </button>
                {/* Diagnostics tooltip on hover */}
                <div className="absolute bottom-full mb-2 right-0 bg-[#2d2d2d] text-white px-3 py-2.5 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition z-50 shadow-lg min-w-[180px]">
                  <p className="font-bold mb-1.5">Submission Queue</p>
                  <div className="space-y-0.5 text-[10px] font-mono">
                    <div className="flex justify-between gap-4">
                      <span className="text-amber-300">Queued</span>
                      <span>{pendingSubmissions.filter(s => s.status === "queued").length}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-blue-300">Syncing</span>
                      <span>{pendingSubmissions.filter(s => s.status === "syncing").length}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-red-300">Failed</span>
                      <span>{pendingSubmissions.filter(s => s.status === "failed").length}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-green-300">Synced</span>
                      <span>{pendingSubmissions.filter(s => s.status === "synced").length}</span>
                    </div>
                  </div>
                  {pendingSubmissions.length > 0 && (
                    <p className="mt-1.5 text-[10px] opacity-70">Oldest: {Math.floor(
                      Math.max(0, ...pendingSubmissions.map(s => Date.now() - new Date(s.createdAt).getTime())) / 60000
                    )}m ago</p>
                  )}
                  <p className="mt-1 text-[10px] opacity-60">Click to force sync</p>
                </div>
              </div>

              {/* Database Status Indicator Icon - only visible if there's an error */}
              {dbError && (
                <button
                  type="button"
                  className="p-1.5 sm:p-2 rounded-xl border transition cursor-pointer shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-transparent hover:border-red-200 animate-pulse"
                  title="Database connection error"
                >
                  <Database className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                </button>
              )}

              {/* GPS Status Indicator Icon */}
              <button
                type="button"
                className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer shrink-0 relative group ${
                  locationType === "gps"
                    ? "text-green-600 hover:text-green-700 hover:bg-green-50 border-transparent hover:border-green-200"
                    : "text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-transparent hover:border-amber-200"
                }`}
                title={`GPS: ${locationType === "gps" ? "Active" : "Emulated"} (${userLat?.toFixed(4)}, ${userLng?.toFixed(4)})`}
              >
                <div className="relative">
                  <Satellite className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                  {locationType === "simulated" && (
                    <X className="h-3 sm:h-3.5 w-3 sm:w-3.5 absolute -top-1 -right-1 stroke-[3]" />
                  )}
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-[#2d2d2d] text-white px-3 py-2 rounded-lg text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition z-50 shadow-lg">
                  <div className="font-bold">{locationType === "gps" ? "📡 Active GPS" : "🎮 Emulated GPS"}</div>
                  <div className="text-[10px] opacity-90 font-mono mt-0.5">{userLat?.toFixed(4)}, {userLng?.toFixed(4)}</div>
                </div>
              </button>

              {/* User Menu Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  type="button"
                  className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer shrink-0 flex items-center gap-1 ${
                    userMenuOpen
                      ? "bg-[#5a5a40]/20 text-[#5a5a40] border-[#5a5a40]/30 font-bold"
                      : "text-[#8c8c82] hover:text-[#5a5a40] hover:bg-white border-transparent hover:border-brand-border/40"
                  }`}
                  title="User menu"
                >
                  <User className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                  <ChevronDown className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                </button>
                
                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-[#e5e5dd] rounded-xl shadow-lg z-[1200]">
                    <button
                      onClick={() => {
                        setUserDashboardOpen(true);
                        setProfileSaveSuccess(false);
                        setProfileSaveError(null);
                        if (profile) {
                          setProfileDisplayNameInput(profile.displayName || profile.username || "");
                          setProfileRoleInput(profile.role || "user");
                        }
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-xs font-semibold text-[#2d2d2d] hover:bg-[#f5f5f0] border-b border-[#e5e5dd] transition flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      User Settings
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-3 text-xs font-semibold text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </button>
                  </div>
                )}
              </div>

              {/* Admin Branding Settings Cog */}
              {profile?.role === "admin" && (
                <button
                  onClick={() => {
                    setAdminPanelOpen(!adminPanelOpen);
                    setAdminSaveSuccess(false);
                    setAdminSaveError(null);
                    // Fetch storage info when panel opens
                    if (!adminPanelOpen) {
                      fetch("/api/storage-info")
                        .then(res => res.json())
                        .then(data => setStorageInfo(data))
                        .catch(err => console.error("Failed to fetch storage info:", err));
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
            </div>
          </div>
        </div>

        {/* Navigation tabs - now below the header icons */}
        <div className="px-3 sm:px-8 pt-2 pb-5 sm:pb-6 flex justify-center gap-0.5 sm:gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab("missions")}
            className={`flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 relative ${
              activeTab === "missions"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark hover:bg-white/50"
            }`}
            title="View missions"
          >
            <ListFilter className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
            <span className="hidden sm:inline">Missions</span>
            {newMissionsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold rounded-full h-5 w-5 flex items-center justify-center z-[1050]">
                {newMissionsCount > 9 ? "9+" : newMissionsCount}
              </span>
            )}
          </button>
          {!isMapDisabled && (
            <button
              onClick={() => setActiveTab("map")}
              className={`flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 ${
                activeTab === "map"
                  ? "bg-[#5a5a40] text-white shadow-sm"
                  : "text-brand-muted hover:text-brand-dark hover:bg-white/50"
              }`}
              title="View live map"
            >
              <MapIcon className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
              <span className="hidden sm:inline">Map</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 ${
              activeTab === "leaderboard"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark hover:bg-white/50"
            }`}
            title="View leaderboard"
          >
            <Trophy className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
            <span className="hidden sm:inline">Scores</span>
          </button>
          <button
            onClick={() => setActiveTab("feed")}
            className={`flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 ${
              activeTab === "feed"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark hover:bg-white/50"
            }`}
            title="View feed"
          >
            <Users className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
            <span className="hidden sm:inline">Feed</span>
          </button>
          <button
            onClick={() => setActiveTab("gallery")}
            className={`flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 ${
              activeTab === "gallery"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark hover:bg-white/50"
            }`}
            title="Photo gallery"
          >
            <ImageIcon className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
            <span className="hidden sm:inline">Gallery</span>
          </button>
          <button
            onClick={() => setActiveTab("slideshows")}
            className={`flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 ${
              activeTab === "slideshows"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark hover:bg-white/50"
            }`}
            title="Slide Shows"
          >
            <Film className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
            <span className="hidden sm:inline">Slide Shows</span>
          </button>
          {profile?.role === "admin" && (
            <>
              <button
                onClick={() => setActiveTab("approval")}
                className={`flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 relative ${
                  activeTab === "approval"
                    ? "bg-[#5a5a40] text-white shadow-sm"
                    : "text-brand-muted hover:text-brand-dark hover:bg-white/50"
                }`}
                title="Review & approve photos"
              >
                <ShieldCheck className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
                <span className="hidden sm:inline">Approve</span>
                {submissions.filter(s => s.status === "pending").length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full text-[8px] w-4 h-4 flex items-center justify-center font-bold animate-pulse select-none z-[1050]">
                    {submissions.filter(s => s.status === "pending").length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 ${
                  activeTab === "logs"
                    ? "bg-[#5a5a40] text-white shadow-sm"
                    : "text-brand-muted hover:text-brand-dark hover:bg-white/50"
                }`}
                title="View server logs"
              >
                <svg className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" />
                </svg>
                <span className="hidden sm:inline">Logs</span>
              </button>
            </>
          )}
          {!settings.chatDisabledByAdmin && (
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-shrink-0 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1.5 relative ${
              activeTab === "chat"
                ? "bg-[#5a5a40] text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark hover:bg-white/50"
            }`}
            title="Chat"
          >
            <MessageSquare className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
            <span className="hidden sm:inline">Chat</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#c27d56] text-white rounded-full text-[8px] w-4 h-4 flex items-center justify-center font-bold animate-pulse select-none z-[1050]">
                {unreadCount}
              </span>
            )}
          </button>
          )}
        </div>
      </header>

      {/* Offline & Mesh Network Status Banners */}
      {!navigator.onLine && (
        <div className="bg-red-100 border-b border-red-300 text-red-700 px-3 sm:px-8 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>⚠️ You are offline.</span>
            {meshEnabled && connectedPeers.length > 0 && (
              <span className="ml-2 text-green-700 bg-green-100 px-2 py-1 rounded text-[11px] font-bold">
                ✓ {connectedPeers.length} mesh peer{connectedPeers.length !== 1 ? 's' : ''} connected
              </span>
            )}
          </div>
        </div>
      )}

      {navigator.onLine && dbError && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-800 px-3 sm:px-8 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>⚠️ No service detected. You may be on Wi-Fi without server connectivity.</span>
          </div>
        </div>
      )}

      {/* Mesh Sync Progress Banner */}
      {meshSyncStatus.isSyncing && (
        <div className="bg-blue-100 border-b border-blue-300 text-blue-700 px-3 sm:px-8 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
            <span>⤵️ Syncing {meshSyncStatus.pendingCount} submission{meshSyncStatus.pendingCount !== 1 ? 's' : ''}...</span>
          </div>
        </div>
      )}

      {/* Sync Failure Banner */}
      {!meshSyncStatus.isSyncing && meshSyncStatus.failedCount > 0 && (
        <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-700 px-3 sm:px-8 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>⚠️ {meshSyncStatus.failedCount} submission{meshSyncStatus.failedCount !== 1 ? 's' : ''} failed to sync</span>
          </div>
        </div>
      )}

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
            mapModeInput={adminMapModeInput}
            onMapModeChange={setAdminMapModeInput}
            latInput={adminLatInput}
            onLatChange={setAdminLatInput}
            lngInput={adminLngInput}
            onLngChange={setAdminLngInput}
            radiusInput={adminRadiusInput}
            onRadiusChange={setAdminRadiusInput}
            aiPromptInput={adminAiPromptCriteriaInput}
            onAiPromptChange={setAdminAiPromptCriteriaInput}
            aiJudgeModelInput={adminAiJudgeModelInput}
            onAiJudgeModelChange={setAdminAiJudgeModelInput}
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
            imageCompressionMaxDimInput={adminImageCompressionMaxDimInput}
            onImageCompressionMaxDimChange={setAdminImageCompressionMaxDimInput}
            imageCompressionQualityInput={adminImageCompressionQualityInput}
            onImageCompressionQualityChange={setAdminImageCompressionQualityInput}
            showTitleInput={adminShowTitleInput}
            onShowTitleChange={setAdminShowTitleInput}
            showLogoInput={adminShowLogoInput}
            onShowLogoChange={setAdminShowLogoInput}
            chatDisabledByAdminInput={adminChatDisabledByAdminInput}
            onChatDisabledByAdminChange={setAdminChatDisabledByAdminInput}
            storageInfo={storageInfo}
            isLoading={isAdminSaving}
            saveSuccess={adminSaveSuccess}
            saveError={adminSaveError}
            onSubmit={handleSaveSettings}
            onReset={handleResetSettings}
            onGenerateCode={() => {
              const rand = `hunt-${Math.floor(1000 + Math.random() * 9000)}`;
              setAdminActiveInviteCodeInput(rand);
            }}
            currentPasswordInput={adminCurrentPasswordInput}
            onCurrentPasswordChange={setAdminCurrentPasswordInput}
            newPasswordInput={adminNewPasswordInput}
            onNewPasswordChange={setAdminNewPasswordInput}
            confirmPasswordInput={adminConfirmPasswordInput}
            onConfirmPasswordChange={setAdminConfirmPasswordInput}
            passwordChangeSuccess={adminPasswordChangeSuccess}
            passwordChangeError={adminPasswordChangeError}
            onSubmitPasswordChange={handleAdminPasswordChange}
            adminSessionId={getAdminSessionId()}
            adminActiveSessions={adminSessionCount}
            adminCurrentSessionActive={adminSessionIsActive}
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
          syncStatusText={syncStatusText}
          isSyncing={isSyncing}
          onManualSync={handleManualSync}
        />

        {/* Create Mission Modal */}
        {profile && (
          <CreateMissionModal
            isOpen={showCreateMissionModal}
            onClose={() => {
              setShowCreateMissionModal(false);
              setCreatingFromMap(false);
            }}
            onSubmit={handleAddChallenge}
            userLat={userLat}
            userLng={userLng}
            preFilledFromMap={creatingFromMap}
          />
        )}

        {/* Slideshow Generator Modal - Admin Only */}
        {profile?.role === "admin" && (
          <SlideshowGeneratorModal
            isOpen={slideshowGeneratorOpen}
            onClose={() => {
              setSlideshowGeneratorOpen(false);
              setSlideshowGeneratedScript(null);
              setSlideshowError(null);
            }}
            adminUserId={profile?.id || null}
            submissions={submissions}
            items={items}
            isLoading={slideshowGenerating}
            error={slideshowError}
            generatedScript={slideshowGeneratedScript}
            onScriptGenerated={(script) => {
              setSlideshowGeneratedScript(script);
            }}
            onSlideshowCreated={() => {
              setSlideshowGeneratorOpen(false);
              setActiveTab("slideshows");
              setSlideshowRefreshKey((prev) => prev + 1);
            }}
          />
        )}

        {/* Tutorial Modal - First time users */}
        <TutorialModal
          isOpen={showTutorialModal}
          onClose={() => {
            setTutorialDismissedThisSession(true);
            setShowTutorialModal(false);
          }}
          onComplete={handleCompleteTutorial}
          gameName={settings.name}
        />

        {/* Camera/Photo Submission Modal */}
        {profile && cameraModalItemId && (
          <CameraModal
            isOpen={cameraModalOpen}
            itemTitle={cameraModalItemTitle}
            selectedImage={cameraSelectedImage}
            isSubmitting={cameraIsSubmitting}
            uploadError={submitErrorMap[cameraModalItemId] || null}
            hasForceSubmitOption={Boolean(settings.allowForceSubmit && rejectedSubmissionMap[cameraModalItemId])}
            onImageSelected={(base64) => {
              setCameraSelectedImage(base64 || null);
              if (cameraModalItemId) {
                setSubmitErrorMap((prev) => ({ ...prev, [cameraModalItemId]: null }));
              }
            }}
            onClose={() => {
              setCameraModalOpen(false);
              setCameraSelectedImage(null);
              if (cameraModalItemId) {
                setSubmitErrorMap((prev) => ({ ...prev, [cameraModalItemId]: null }));
              }
            }}
            onSubmit={handleCameraModalSubmit}
            onForceSubmit={async () => {
              if (!cameraModalItemId) return;
              setCameraIsSubmitting(true);
              try {
                const wasSuccessful = await handleForceSubmit(cameraModalItemId);
                if (wasSuccessful) {
                  setCameraModalOpen(false);
                  setCameraSelectedImage(null);
                  setCameraModalItemId(null);
                  setCameraModalItemTitle("");
                }
              } finally {
                setCameraIsSubmitting(false);
              }
            }}
          />
        )}

        {/* Dynamic Location Indicator - HIDDEN (moved to header icon) */}
        <div className="hidden">
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

        {/* Offline / Snapshot Banner */}
        {(isOffline || snapshotAge !== null) && (
          <div className={`mx-4 mb-3 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            isOffline
              ? "bg-amber-100 text-amber-800 border border-amber-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}>
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {isOffline
              ? `You are offline. Showing last known game state${snapshotAge !== null ? ` (${Math.floor(snapshotAge / 60000)}m ago)` : ""}.`
              : `Reconnecting… showing snapshot from ${Math.floor((snapshotAge ?? 0) / 60000)}m ago.`}
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
              onFocusMissionOnMap={isMapDisabled ? undefined : handleFocusMissionOnMap}
              onOpenCamera={(itemId, itemTitle) => {
                setCameraModalItemId(itemId);
                setCameraModalItemTitle(itemTitle);
                setCameraModalOpen(true);
              }}
              players={players}
            />
          )}

          {activeTab === "map" && (
            <GameMap
              items={items}
              userLat={userLat}
              userLng={userLng}
              isAdmin={profile?.role === "admin"}
              mapMode={effectiveMapMode === "missions_only" ? "missions_only" : effectiveMapMode === "satellite_labels" ? "satellite_labels" : "original"}
              selectedItemId={selectedMapItemId}
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
              onRetryPending={handleRetryPendingSubmission}
              currentUserRole={profile?.role || "user"}
            />
          )}

          {activeTab === "gallery" && (
            <Gallery
              submissions={submissions}
              items={items}
              currentUserId={profile?.id || null}
              userRole={profile?.role || "user"}
              onDeleteSubmission={handleDeleteSubmission}
            />
          )}

          {activeTab === "slideshows" && (
            <div className="space-y-3">
              {profile?.role === "admin" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSlideshowGeneratorOpen(true)}
                    className="py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Film className="h-3.5 w-3.5" />
                    Generate Slideshow
                  </button>
                </div>
              )}

              <SlideshowViewer
                userId={profile?.id || null}
                userRole={profile?.role || "user"}
                submissions={submissions}
                items={items}
                refreshKey={slideshowRefreshKey}
              />
            </div>
          )}

          {activeTab === "approval" && profile?.role === "admin" && (
            <PhotoApprovalPanel
              submissions={submissions}
              items={items}
              players={players}
              onApprove={handleApproveSubmission}
              onReject={handleRejectSubmission}
              onUpdatePoints={handleUpdateSubmissionPoints}
            />
          )}

          {activeTab === "logs" && profile?.role === "admin" && (
            <>
              <div className="bg-white/80 border border-[#d2d2c8] rounded-2xl p-4 max-w-md mx-auto shadow-sm space-y-3 mb-6">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium text-[#5a5a40]">
                    <Database className="h-4 w-4 text-[#8c8c5a]" />
                    <span>Storage Node:</span>
                  </div>
                  
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-150 text-emerald-800 border border-emerald-200">
                    Supabase Cloud
                  </span>
                </div>
              </div>
              <ServerLogs />
            </>
          )}

          {activeTab === "chat" && !settings.chatDisabledByAdmin && (
            <Chat
              profile={profile}
              players={players}
              onlinePlayers={onlinePlayers}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              onDeleteMessage={handleDeleteMessage}
              onMuteUser={handleMuteUser}
              onUnmuteUser={handleUnmuteUser}
              onBootUser={handleBootUser}
            />
          )}
        </div>
      </main>

      {/* Floating Plus Button - Create Mission */}
      {activeTab === "missions" && profile && (
        <button
          onClick={() => setShowCreateMissionModal(true)}
          className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-brand-moss hover:bg-brand-moss-dark text-white shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center z-50 flex-shrink-0 group"
          title="Create a new mission"
        >
          <PlusCircle className="h-8 w-8 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Back Button Warning Modal */}
      {showBackWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#f5f5f0] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-[#d2d2c8]">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#2d2d2d] leading-tight">
                  Leave KinQuest?
                </h2>
                <p className="text-sm text-[#6b6b5a] mt-1 leading-snug">
                  Using the back button will leave your current screen. Continue only if you are sure you want to go back.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowBackWarning(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#5a5a40] text-white text-sm font-bold hover:bg-[#4a4a32] active:scale-95 transition-all cursor-pointer"
              >
                Stay Here
              </button>
              <button
                onClick={() => {
                  setShowBackWarning(false);
                  allowNextBackNavigationRef.current = true;
                  window.history.back();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#d2d2c8] bg-white text-[#c27d56] text-sm font-bold hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all cursor-pointer"
              >
                Leave App
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
