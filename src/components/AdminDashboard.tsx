import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  deleteDoc,
  updateDoc,
  increment,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import {
  TrendingUp,
  Users,
  MousePointer,
  Link,
  Trash2,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  UserX,
  Plus,
  Compass,
  DollarSign,
  Briefcase,
  Globe,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { AffiliateLink, UserProfile, Comment } from "../types";
import { curatedGames } from "../data/games";

interface AdminDashboardProps {
  currentUser: UserProfile;
}

export default function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"analytics" | "affiliates" | "users" | "moderation" | "seo">("analytics");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>([]);
  const [flaggedComments, setFlaggedComments] = useState<Comment[]>([]);
  const [clickStats, setClickStats] = useState<any[]>([]);

  // System SEO Integrated Properties States
  const [googleSearchConsoleKey, setGoogleSearchConsoleKey] = useState("");
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState("");
  const [bingWebmasterKey, setBingWebmasterKey] = useState("");
  const [seoSaving, setSeoSaving] = useState(false);

  // Affiliate Form State
  const [scopeType, setScopeType] = useState<"specific" | "all">("specific");
  const [formGameId, setFormGameId] = useState(curatedGames[0].id);
  const [formPlatform, setFormPlatform] = useState<"steam" | "epic" | "gog" | "official">("steam");
  const [formUrl, setFormUrl] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [loading, setLoading] = useState(true);
  const [searchUserQuery, setSearchUserQuery] = useState("");

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users list
      const usersSnap = await getDocs(collection(db, "users"));
      const usersData: UserProfile[] = [];
      usersSnap.forEach((doc) => {
        usersData.push(doc.data() as UserProfile);
      });
      setUsers(usersData);

      // 2. Fetch Affiliate Links
      const linksSnap = await getDocs(collection(db, "affiliate_links"));
      const linksData: AffiliateLink[] = [];
      linksSnap.forEach((d) => {
        linksData.push({ id: d.id, ...d.data() } as AffiliateLink);
      });
      setAffiliateLinks(linksData);

      // 3. Fetch Flagged Comments
      const commentsSnap = await getDocs(collection(db, "comments"));
      const commentsData: Comment[] = [];
      commentsSnap.forEach((d) => {
        const commentObj = { id: d.id, ...d.data() } as Comment;
        if (commentObj.isReported) {
          commentsData.push(commentObj);
        }
      });
      setFlaggedComments(commentsData);

      // 4. Build clicks tracking visual stats
      const mockClickStats = [
        { name: "Mon", Steam: 140, Epic: 80, gog: 35 },
        { name: "Tue", Steam: 220, Epic: 120, gog: 45 },
        { name: "Wed", Steam: 180, Epic: 190, gog: 60 },
        { name: "Thu", Steam: 290, Epic: 140, gog: 90 },
        { name: "Fri", Steam: 380, Epic: 240, gog: 110 },
        { name: "Sat", Steam: 490, Epic: 310, gog: 150 },
        { name: "Sun", Steam: 420, Epic: 290, gog: 130 },
      ];
      setClickStats(mockClickStats);

      // 5. Fetch Global Integrated SEO Parameters
      try {
        const seoSnap = await getDoc(doc(db, "settings", "seo_config"));
        if (seoSnap.exists()) {
          const sData = seoSnap.data();
          setGoogleSearchConsoleKey(sData.googleSearchConsoleKey || "");
          setGoogleAnalyticsId(sData.googleAnalyticsId || "");
          setBingWebmasterKey(sData.bingWebmasterKey || "");
        }
      } catch (e) {
        console.warn("Could not retrieve SEO configuration node:", e);
      }

    } catch (error) {
      console.error("Admin loader error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Delete / Create Affiliate custom parameters
  const handleCreateAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    let processedUrl = formUrl.trim();
    if (!processedUrl) {
      setMsg("Please input a valid landing URL.");
      return;
    }
    // Auto-prepend https:// if missing
    if (!processedUrl.startsWith("http://") && !processedUrl.startsWith("https://")) {
      processedUrl = `https://${processedUrl}`;
    }

    setFormLoading(true);
    setMsg("");
    const linkId = `${formGameId}_${formPlatform}`;

    try {
      const payload: AffiliateLink = {
        gameId: formGameId,
        platform: formPlatform,
        affiliateUrl: processedUrl,
        clicks: 0,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "affiliate_links", linkId), payload);
      setMsg(`SUCCESS: Affiliate link configured for ${formPlatform} successfully!`);
      setFormUrl("");
      loadAllAdminData();
    } catch (err: any) {
      console.error("Affiliate config failed:", err);
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes("permission-denied") || 
        errMsg.includes("Permission denied") || 
        errMsg.includes("insufficient permissions") || 
        errMsg.includes("Insufficient permissions")
      ) {
        setMsg(
          "DATABASE PERMISSION EXCEPTION: Save request was blocked by Firestore security. " +
          "This happens if you haven't published our production security rules in your 'aikennet' project yet. " +
          "Please verify that Firestore rules in your Firebase Console matches the layout. (You can copy the rules from the yellow notice on the Home screen)."
        );
      } else {
        setMsg(`FAILED TO SAVE: ${errMsg}`);
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    setMsg("");
    try {
      await deleteDoc(doc(db, "affiliate_links", id));
      setMsg("SUCCESS: Affiliate link deleted successfully.");
      loadAllAdminData();
    } catch (err: any) {
      console.error("Affiliate delete failed:", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes("permission-denied") || errMsg.includes("insufficient permissions")) {
        setMsg("DATABASE EXCEPTION: Permission Denied while deleting. Verify your custom Firebase project rules.");
      } else {
        setMsg(`FAILED: ${errMsg}`);
      }
    }
  };

  // Toggle user ban state
  const handleToggleBan = async (user: UserProfile) => {
    if (user.uid === currentUser.uid) {
      setMsg("Self suspension is prohibited.");
      return;
    }
    setMsg("");
    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        isBanned: !user.isBanned,
      });
      setMsg(`SUCCESS: Updated ${user.username}'s suspension status to ${!user.isBanned ? "Banned" : "Active"}.`);
      loadAllAdminData();
    } catch (err: any) {
      console.error("User toggle ban failed:", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes("permission-denied") || errMsg.includes("insufficient permissions")) {
        setMsg("DATABASE EXCEPTION: Permission Denied while editing users. Administrator privileges required.");
      } else {
        setMsg(`FAILED: ${errMsg}`);
      }
    }
  };

  // Moderation: Remove spam and delete comments
  const handleNukeComment = async (commentId: string) => {
    setMsg("");
    const path = `comments/${commentId}`;
    try {
      await deleteDoc(doc(db, "comments", commentId));
      setMsg("SUCCESS: Comment deleted from moderator queue.");
      setFlaggedComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err: any) {
      console.error("Comment nuke failed:", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes("permission-denied") || errMsg.includes("insufficient permissions")) {
        setMsg("DATABASE EXCEPTION: Permission Denied while deleting comment.");
      } else {
        setMsg(`FAILED: ${errMsg}`);
      }
    }
  };

  // Clear reports (Pardon comment)
  const handlePardonComment = async (commentId: string) => {
    setMsg("");
    const path = `comments/${commentId}`;
    try {
      await updateDoc(doc(db, "comments", commentId), {
        isReported: false,
        reportsCount: 0,
      });
      setMsg("SUCCESS: Flagged comment pardoned successfully.");
      setFlaggedComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err: any) {
      console.error("Comment pardon failed:", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes("permission-denied") || errMsg.includes("insufficient permissions")) {
        setMsg("DATABASE EXCEPTION: Permission Denied while pardoning comment.");
      } else {
        setMsg(`FAILED: ${errMsg}`);
      }
    }
  };

  // Save Integrated Webmaster and Tracking settings
  const handleSaveSeoSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSeoSaving(true);
    setMsg("");
    try {
      await setDoc(doc(db, "settings", "seo_config"), {
        googleSearchConsoleKey,
        googleAnalyticsId,
        bingWebmasterKey,
        updatedAt: serverTimestamp(),
      });
      setMsg("SUCCESS: Google Search Console, Google Analytics, and Bing Webmaster properties configured successfully in cloud node database.");
    } catch (err: any) {
      console.error("Fail save SEO config:", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes("permission-denied") || errMsg.includes("insufficient permissions")) {
        setMsg("DATABASE EXCEPTION: Permission Denied while updating global settings registry.");
      } else {
        setMsg(`FAILED: ${errMsg}`);
      }
    } finally {
      setSeoSaving(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const q = searchUserQuery.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  // Derived analysis analytics
  const totalClicks = affiliateLinks.reduce((acc, curr) => acc + (curr.clicks || 0), 0);
  const conversionRate = totalClicks > 0 ? ((totalClicks * 0.12).toFixed(1)) : "0.0";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold font-display tracking-tight text-white uppercase italic">
            AIKENNET <span className="text-cyan-400">SaaS CONTROL CENTER</span>
          </h1>
          <p className="text-sm font-mono text-gray-400 mt-1">
            Logged as Administrator: <span className="text-cyan-400 font-semibold">{currentUser.username}</span>
          </p>
        </div>
        <button
          onClick={loadAllAdminData}
          className="px-5 py-2.5 border border-white/10 bg-white/5 text-cyan-400 rounded-full hover:bg-white/10 text-xs font-mono transition-all cursor-pointer shadow-lg"
        >
          SYNC DATABASE NET
        </button>
      </div>

      {msg && (
        <div className={`mb-6 p-4 rounded-2xl border backdrop-blur-md animate-in slide-in-from-top-4 duration-300 ${
          msg.startsWith("SUCCESS")
            ? "bg-cyan-950/20 border-cyan-500/30 text-cyan-300"
            : "bg-amber-950/20 border-amber-500/30 text-amber-300"
        }`}>
          <div className="flex items-start gap-3">
            <span className="p-1 rounded-lg bg-white/5 border border-white/10 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div className="flex-grow">
              <p className="text-xs font-mono leading-relaxed">{msg}</p>
            </div>
            <button 
              onClick={() => setMsg("")}
              className="text-gray-400 hover:text-white font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border border-white/10 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-2 mb-8 overflow-x-auto pb-1">
        {[
          { id: "analytics", label: "Analytics Board", icon: TrendingUp },
          { id: "affiliates", label: "Affiliate Management", icon: Link },
          { id: "users", label: "User Management", icon: Users },
          { id: "moderation", label: "Moderation Queue", icon: AlertTriangle },
          { id: "seo", label: "SEO & Integrations", icon: Globe },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-display text-sm font-bold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === "moderation" && flaggedComments.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] h-4 min-w-4 px-1 rounded-full flex items-center justify-center animate-bounce">
                  {flaggedComments.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-96 flex flex-col justify-center items-center gap-4">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-mono text-xs text-cyan-400 animate-pulse">Syncing encrypted data channels...</p>
        </div>
      ) : (
        <>
          {/* ===================================== */}
          {/* TAB 1: ANALYTICS BOARD */}
          {/* ===================================== */}
          {activeTab === "analytics" && (
            <div className="space-y-8">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[24px] relative overflow-hidden transition-all hover:bg-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-mono text-xs text-gray-400 uppercase tracking-wider">Total Citizens</span>
                    <Users className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-white font-mono">{users.length}</h3>
                  <div className="text-[10px] font-mono text-green-405 mt-2 flex items-center gap-1">
                    <span>+12 today</span> · <span>84% active</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[24px] relative overflow-hidden transition-all hover:bg-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-mono text-xs text-gray-400 uppercase tracking-wider">Store Click-Throughs</span>
                    <MousePointer className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-white font-mono">{totalClicks}</h3>
                  <div className="text-[10px] font-mono text-cyan-400 mt-2 flex items-center gap-1">
                    <span>Avg {totalClicks > 0 ? (totalClicks / 7).toFixed(0) : 0}/day logged</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[24px] relative overflow-hidden transition-all hover:bg-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-mono text-xs text-gray-400 uppercase tracking-wider">Estd. Conversion Value</span>
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-cyan-400 font-mono">${conversionRate}</h3>
                  <div className="text-[10px] font-mono text-gray-400 mt-2">
                    Estimated 12% affiliate commission
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[24px] relative overflow-hidden transition-all hover:bg-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-mono text-xs text-gray-400 uppercase tracking-wider">Spam / Reports</span>
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-white font-mono">{flaggedComments.length}</h3>
                  <div className="text-[10px] font-mono text-red-405 mt-2 flex items-center gap-1">
                    <span>Requires urgent moderation</span>
                  </div>
                </div>
              </div>

              {/* Graphical Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[32px]">
                  <h4 className="text-base font-bold font-display text-gray-200 mb-6 uppercase tracking-wider">
                    Affiliate Traffic Breakdown (Weekly)
                  </h4>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={clickStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSteam" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorEpic" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff/5" />
                        <XAxis dataKey="name" stroke="#777" fontSize={11} />
                        <YAxis stroke="#777" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#0c0d12", borderColor: "rgba(255,255,255,0.1)" }} />
                        <Area type="monotone" dataKey="Steam" stroke="#22d3ee" fillOpacity={1} fill="url(#colorSteam)" />
                        <Area type="monotone" dataKey="Epic" stroke="#a855f7" fillOpacity={1} fill="url(#colorEpic)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[32px]">
                  <h4 className="text-base font-bold font-display text-gray-200 mb-6 uppercase tracking-wider">
                    Top Affiliate Conversions per Game
                  </h4>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={affiliateLinks.slice(0, 5).map((l) => ({
                          name: curatedGames.find((g) => g.id === l.gameId)?.title.slice(0, 10) || l.gameId,
                          Clicks: l.clicks || 0,
                        }))}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" stroke="#777" fontSize={11} />
                        <YAxis stroke="#777" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#0c0d12", borderColor: "rgba(255,255,255,0.1)" }} />
                        <Bar dataKey="Clicks" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================== */}
          {/* TAB 2: AFFILIATE MANAGEMENT */}
          {/* ===================================== */}
          {activeTab === "affiliates" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form Input */}
              <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[32px] h-fit">
                <h3 className="text-lg font-bold font-display text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-cyan-400" /> Configure Outlet
                </h3>
                
                {msg && (
                  <div className="mb-4 p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl text-xs text-[#00ffff] font-mono">
                    {msg}
                  </div>
                )}

                <form onSubmit={handleCreateAffiliate} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5 flex justify-between items-center">
                      <span>Affiliate Scope</span>
                      <span className="text-cyan-400 font-bold lowercase text-[9px]">Select target scope</span>
                    </label>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setScopeType("specific");
                          setFormGameId(curatedGames[0].id);
                        }}
                        className={`py-2 px-3 rounded-xl border font-mono text-xs font-semibold uppercase cursor-pointer transition-all ${
                          scopeType === "specific"
                            ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-300"
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        Specific Game
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScopeType("all");
                          setFormGameId("ALL_GAMES");
                        }}
                        className={`py-2 px-3 rounded-xl border font-mono text-xs font-semibold uppercase cursor-pointer transition-all ${
                          scopeType === "all"
                            ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-300"
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        All Games
                      </button>
                    </div>

                    {scopeType === "specific" ? (
                      <select
                        value={formGameId}
                        onChange={(e) => setFormGameId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
                      >
                        {curatedGames.map((g) => (
                          <option key={g.id} value={g.id} className="bg-slate-950">{g.title}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="px-3.5 py-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
                        🌐 Universal tracking. Applies link automatically to matching checkout outlets search-wide.
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5">Choice of Merchant</label>
                    <select
                      value={formPlatform}
                      onChange={(e: any) => setFormPlatform(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
                    >
                      <option value="steam" className="bg-slate-950">Steam Store</option>
                      <option value="epic" className="bg-slate-950">Epic Games Store</option>
                      <option value="gog" className="bg-slate-950">GOG Store</option>
                      <option value="official" className="bg-slate-950">Official Developer Site</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5">Merchant Affiliate Link</label>
                    <input
                      type="text"
                      required
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://store.steampowered.com/app/..."
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono placeholder-gray-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full py-3.5 rounded-full bg-white text-black font-extrabold text-xs uppercase hover:bg-cyan-400 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    {formLoading ? "Deploying..." : "Publish Affiliate Direct"}
                  </button>
                </form>
              </div>

              {/* Connections list */}
              <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[32px] lg:col-span-2 overflow-hidden">
                <h3 className="text-lg font-bold font-display text-white uppercase tracking-wider mb-4">
                  Merchant Affiliate Directory ({affiliateLinks.length})
                </h3>

                {affiliateLinks.length === 0 ? (
                  <div className="h-48 border border-dashed border-white/10 rounded-[24px] flex items-center justify-center">
                    <p className="text-sm font-mono text-gray-500">No custom affiliate outlets mapped yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] uppercase font-mono text-gray-400">
                          <th className="py-3 px-2">Game</th>
                          <th className="py-3 px-2">Store</th>
                          <th className="py-3 px-2">Total Clicks</th>
                          <th className="py-3 px-2 text-right">Access Controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {affiliateLinks.map((link) => {
                          const isGlobal = link.gameId === "ALL_GAMES";
                          const matchedGame = curatedGames.find((g) => g.id === link.gameId);
                          return (
                            <tr key={link.id} className={`text-sm hover:bg-white/5 transition-colors ${isGlobal ? "bg-teal-950/20 border-l border-teal-500" : ""}`}>
                              <td className="py-4 px-2">
                                {isGlobal ? (
                                  <>
                                    <span className="font-extrabold text-teal-300 block flex items-center gap-1.5 font-display text-xs uppercase tracking-wider">
                                      ⭐ ALL GAMES (Global fallback)
                                    </span>
                                    <span className="text-[10px] text-teal-500 font-mono block leading-none mt-1">Universal Scope Target</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-semibold text-gray-200 block">{matchedGame?.title || link.gameId}</span>
                                    <span className="text-[10px] text-gray-400 font-mono block leading-none mt-1">{link.gameId}</span>
                                  </>
                                )}
                              </td>
                              <td className="py-4 px-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-cyan-400/10 border border-cyan-400/20 text-cyan-400">
                                  {link.platform}
                                </span>
                              </td>
                              <td className="py-4 px-2 font-mono text-cyan-400">{link.clicks || 0} clicks</td>
                              <td className="py-4 px-2 text-right">
                                <button
                                  onClick={() => link.id && handleDeleteLink(link.id)}
                                  className="p-1.5 px-3 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 hover:border-red-500 hover:bg-red-500 hover:text-white transition-all text-xs cursor-pointer font-bold"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================================== */}
          {/* TAB 3: USER MANAGEMENT */}
          {/* ===================================== */}
          {activeTab === "users" && (
            <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[32px]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-lg font-bold font-display text-white uppercase tracking-wider">
                  System Citizens Registry ({filteredUsers.length})
                </h3>
                <input
                  type="text"
                  placeholder="Search citizens by name/email..."
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  className="px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 w-full sm:w-80 font-mono placeholder-gray-550"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase font-mono text-gray-400">
                      <th className="py-3 px-2">Citizen Profile</th>
                      <th className="py-3 px-2">Auth Email</th>
                      <th className="py-3 px-2">Assigned Role</th>
                      <th className="py-3 px-2 text-right">Security Toggles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((user) => (
                      <tr key={user.uid} className="text-sm hover:bg-white/5 transition-colors">
                        <td className="py-4 px-2 flex items-center gap-3">
                          <img
                            src={user.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                            alt={user.username}
                            loading="lazy"
                            decoding="async"
                            className="w-9 h-9 rounded-lg object-cover border border-white/10"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="font-semibold text-gray-200 block">{user.username}</span>
                            {user.isBanned && (
                              <span className="bg-red-500/20 text-red-405 border border-red-500/30 text-[9px] px-1.5 py-0.2 rounded font-mono uppercase">
                                SUSPENDED
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-2 font-mono text-xs text-gray-400">{user.email}</td>
                        <td className="py-4 px-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                            user.role === "admin" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-white/5 text-gray-400 border border-white/10"
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <button
                            onClick={() => handleToggleBan(user)}
                            className={`p-1.5 px-3.5 rounded-full text-xs font-bold tracking-wide transition-all ${
                              user.isBanned
                                ? "bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500 hover:text-white cursor-pointer"
                                : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white cursor-pointer"
                            }`}
                          >
                            {user.isBanned ? "Pardon User" : "Suspend User"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================================== */}
          {/* TAB 4: MODERATION QUEUE */}
          {/* ===================================== */}
          {activeTab === "moderation" && (
            <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[32px]">
              <h3 className="text-lg font-bold font-display text-white uppercase tracking-wider mb-6 flex items-center gap-2 italic">
                <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" /> Urgent Public discussion Reports
              </h3>

              {flaggedComments.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-white/10 rounded-[24px] bg-white/5">
                  <CheckCircle className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
                  <p className="text-sm font-mono text-gray-300">Net channels secure. No pending reports found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {flaggedComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5 hover:border-red-500/40 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-gray-200 text-sm">{comment.username}</span>
                          <span className="font-mono text-[10px] text-gray-500">game: {comment.gameId}</span>
                          <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-mono">
                            {comment.reportsCount} Reports
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 italic">"{comment.content}"</p>
                      </div>

                      <div className="flex gap-2 w-full md:w-auto self-end md:self-center">
                        <button
                          onClick={() => comment.id && handlePardonComment(comment.id)}
                          className="flex-1 md:flex-initial px-4 py-2 rounded-full border border-green-500/20 bg-green-500/10 text-green-400 text-xs hover:bg-green-500 hover:text-white transition-all cursor-pointer font-bold"
                        >
                          Clear Flag
                        </button>
                        <button
                          onClick={() => comment.id && handleNukeComment(comment.id)}
                          className="flex-1 md:flex-initial px-4 py-2 rounded-full border border-red-500/40 bg-red-500/20 text-red-400 text-xs hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Nuke Post
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================================== */}
          {/* TAB 5: PROGRESSIVE SEO INTEGRATE CONTROL */}
          {/* ===================================== */}
          {activeTab === "seo" && (
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[32px]">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6 pb-6 border-b border-white/10">
                  <div>
                    <h3 className="text-xl font-extrabold font-display text-white tracking-wider uppercase">
                      Site Verification & Tracking Matrix
                    </h3>
                    <p className="text-xs text-gray-400 font-mono mt-1">
                      Configure search analytics properties and crawler verification handshakes.
                    </p>
                  </div>
                  <div className="bg-cyan-500/10 border border-cyan-400/20 px-3 py-1.5 rounded-xl flex items-center gap-2 self-start lg:self-center">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span className="text-[10px] font-mono text-cyan-400 tracking-wider uppercase font-bold">
                      Dynamic Injection Online
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSaveSeoSettings} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Google Search Console */}
                    <div className="space-y-2 bg-slate-950/40 p-5 rounded-2xl border border-white/5 hover:border-[#00ffff]/20 transition-all flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] tracking-widest font-mono text-cyan-400 uppercase font-black">
                          Search Authority
                        </span>
                        <h4 className="text-sm font-bold text-gray-100 mt-1">Google Search Console</h4>
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                          Enter your verification meta content key so Google discovers, crawls, and indexes page structures properly.
                        </p>
                      </div>
                      <div className="mt-4 space-y-2">
                        <label className="text-[10px] font-display text-gray-400 uppercase font-bold block">
                          Value token (e.g. google-site-verification)
                        </label>
                        <input
                          type="text"
                          value={googleSearchConsoleKey}
                          onChange={(e) => setGoogleSearchConsoleKey(e.target.value)}
                          placeholder="google-site-verification=dH3g9X8..."
                          className="w-full bg-white/5 border border-white/10 focus:border-[#00ffff]/50 rounded-lg py-2 px-3 text-sm font-mono text-gray-100 outline-none transition-all placeholder:text-gray-600"
                        />
                      </div>
                    </div>

                    {/* Google Analytics */}
                    <div className="space-y-2 bg-slate-950/40 p-5 rounded-2xl border border-white/5 hover:border-[#00ffff]/20 transition-all flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] tracking-widest font-mono text-cyan-400 uppercase font-black">
                          Traffic Intelligence
                        </span>
                        <h4 className="text-sm font-bold text-gray-100 mt-1">Google Analytics</h4>
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                          Provide your Google Universal or GA4 Measurement ID to stream web user sessions and CTR interactions.
                        </p>
                      </div>
                      <div className="mt-4 space-y-2">
                        <label className="text-[10px] font-display text-gray-400 uppercase font-bold block">
                          Measurement ID (G-XXXXXXXXXX)
                        </label>
                        <input
                          type="text"
                          value={googleAnalyticsId}
                          onChange={(e) => setGoogleAnalyticsId(e.target.value)}
                          placeholder="G-B7RE9Y8..."
                          className="w-full bg-white/5 border border-white/10 focus:border-[#00ffff]/50 rounded-lg py-2 px-3 text-sm font-mono text-gray-100 outline-none transition-all placeholder:text-gray-600"
                        />
                      </div>
                    </div>

                    {/* Bing Webmaster */}
                    <div className="space-y-2 bg-slate-950/40 p-5 rounded-2xl border border-white/5 hover:border-[#00ffff]/20 transition-all flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] tracking-widest font-mono text-cyan-400 uppercase font-black">
                          Microsoft Indexing
                        </span>
                        <h4 className="text-sm font-bold text-gray-100 mt-1">Bing Webmaster Tools</h4>
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                          Input your Bing metadata validation hash to unlock direct crawlers in Microsoft indexing centers.
                        </p>
                      </div>
                      <div className="mt-4 space-y-2">
                        <label className="text-[10px] font-display text-gray-400 uppercase font-bold block">
                          Validation Key (msvalidate.01)
                        </label>
                        <input
                          type="text"
                          value={bingWebmasterKey}
                          onChange={(e) => setBingWebmasterKey(e.target.value)}
                          placeholder="86F90E11DB2F9..."
                          className="w-full bg-white/5 border border-white/10 focus:border-[#00ffff]/50 rounded-lg py-2 px-3 text-sm font-mono text-gray-100 outline-none transition-all placeholder:text-gray-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/5">
                    <button
                      type="submit"
                      disabled={seoSaving}
                      className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold text-xs px-6 py-3 rounded-full uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer font-extrabold"
                    >
                      {seoSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                          Syncing Configurations...
                        </>
                      ) : (
                        "Save SEO Properties"
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Developer / Operations Meta Preview Diagnostics */}
              <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-[32px] space-y-4">
                <h4 className="text-sm font-extrabold font-display text-gray-200 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> Live Crawler Injected Meta Tags Preview
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
                  These dynamically configured properties are serialized from Firebase and pre-rendered matching organic E-E-A-T schemas on Aikennet's server-side crawler router.
                </p>

                <div className="bg-black/40 border border-white/5 p-5 rounded-2xl font-mono text-xs text-cyan-300 overflow-x-auto space-y-2">
                  <div className="text-gray-500">// HTML Head Injection Node</div>
                  <div>
                    <span className="text-[#a855f7]">&lt;meta</span> <span className="text-cyan-400">name</span>=<span className="text-[#e2e8f0]">"google-site-verification"</span> <span className="text-cyan-400">content</span>=<span className="text-amber-300">"{googleSearchConsoleKey || "undefined_or_empty"}"</span> <span className="text-[#a855f7]">/&gt;</span>
                  </div>
                  <div>
                    <span className="text-[#a855f7]">&lt;meta</span> <span className="text-cyan-400">name</span>=<span className="text-[#e2e8f0]">"msvalidate.01"</span> <span className="text-cyan-400">content</span>=<span className="text-amber-300">"{bingWebmasterKey || "undefined_or_empty"}"</span> <span className="text-[#a855f7]">/&gt;</span>
                  </div>
                  <div>
                    <span className="text-[#a855f7]">&lt;!-- Google tag (gtag.js) --&gt;</span>
                  </div>
                  <div>
                    <span className="text-[#a855f7]">&lt;script</span> <span className="text-cyan-400">async src</span>=<span className="text-amber-300">"https://www.googletagmanager.com/gtag/js?id={googleAnalyticsId || "G-XXXXXXXXXX"}"</span><span className="text-[#a855f7]">&gt;&lt;/script&gt;</span>
                  </div>
                  <div>
                    <span className="text-[#a855f7]">&lt;script&gt;</span>
                  </div>
                  <div className="pl-4 text-cyan-400/80">
                    window.dataLayer = window.dataLayer || [];
                  </div>
                  <div className="pl-4 text-cyan-400/80">
                    function gtag()&#123;dataLayer.push(arguments);&#125;
                  </div>
                  <div className="pl-4 text-cyan-400/80">
                    gtag('js', new Date());
                  </div>
                  <div className="pl-4 text-cyan-400/80">
                    gtag('config', '{googleAnalyticsId || "G-XXXXXXXXXX"}');
                  </div>
                  <div>
                    <span className="text-[#a855f7]">&lt;/script&gt;</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
