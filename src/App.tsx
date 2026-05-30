import React, { useState, useEffect, useMemo } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import {
  Search,
  Star,
  Sparkles,
  Bot,
  Plus,
  Flame,
  ArrowRight,
  Shield,
  Heart,
  Settings,
  X,
  PlusCircle,
  Clock,
  Briefcase,
  Layers,
  Gamepad2,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { Game, UserProfile, CustomCollectionList } from "./types";
import { curatedGames } from "./data/games";

// Sub-components
import Navbar from "./components/Navbar";
const AuthModal = React.lazy(() => import("./components/AuthModal"));
const GameDetailsModal = React.lazy(() => import("./components/GameDetailsModal"));
const AdminDashboard = React.lazy(() => import("./components/AdminDashboard"));

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialAdmin, setAuthInitialAdmin] = useState(false);

  // Firebase integration status states
  const [firebaseWarningDismissed, setFirebaseWarningDismissed] = useState(() => {
    return localStorage.getItem("firebase_rules_warning_dismissed") === "true";
  });
  const [firebaseRulesWarningHappened, setFirebaseRulesWarningHappened] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  // Layout navigation states
  const [currentView, setView] = useState<string>("home"); // home, favorites, lists, admin
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Local game indexes
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortBy, setSortBy] = useState("rating"); // rating, alphabetical

  // Dynamic AI gaming synthesis list from backend
  const [dynamicAIGames, setDynamicAIGames] = useState<Game[]>([]);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Curated Lists state
  const [communityLists, setCommunityLists] = useState<CustomCollectionList[]>([]);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [createListName, setCreateListName] = useState("");
  const [createListDesc, setCreateListDesc] = useState("");
  const [listSubmitLoading, setListSubmitLoading] = useState(false);

  // Live FreeToGame specifications state parameters
  const [freeGames, setFreeGames] = useState<Game[]>([]);
  const [freeLoading, setFreeLoading] = useState(false);
  const [freeCategory, setFreeCategory] = useState("all");
  const [freePlatform, setFreePlatform] = useState("all");
  const [freeSortBy, setFreeSortBy] = useState("popularity");
  const [freeSearchQuery, setFreeSearchQuery] = useState("");

  // Live CheapShark Discount Deals states
  const [deals, setDeals] = useState<any[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsStoreID, setDealsStoreID] = useState("all");
  const [dealsMaxPrice, setDealsMaxPrice] = useState("50");
  const [dealsSearchQuery, setDealsSearchQuery] = useState("");
  const [dealsSortBy, setDealsSortBy] = useState("Savings"); // Savings, Price, Reviews, Title

  // Gemini AI Analytics Report states
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportVibeInput, setAiReportVibeInput] = useState("");
  const [aiReportError, setAiReportError] = useState("");

  // Fetch CheapShark Discount Deals
  useEffect(() => {
    if (currentView !== "deals") return;

    const fetchCheapSharkDeals = async () => {
      setDealsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (dealsStoreID !== "all") queryParams.append("storeID", dealsStoreID);
        if (dealsMaxPrice) queryParams.append("upperPrice", dealsMaxPrice);
        if (dealsSortBy) queryParams.append("sortBy", dealsSortBy);
        if (dealsSearchQuery) queryParams.append("title", dealsSearchQuery);

        const response = await fetch(`/api/cheapshark/deals?${queryParams.toString()}`);
        if (!response.ok) {
          throw new Error("CheapShark index retrieval protocol failed.");
        }
        const parsed = await response.json();
        setDeals(parsed || []);
      } catch (err) {
        console.error("Failed to fetch CheapShark deals:", err);
      } finally {
        setDealsLoading(false);
      }
    };

    const handler = setTimeout(() => {
      fetchCheapSharkDeals();
    }, 300);

    return () => clearTimeout(handler);
  }, [currentView, dealsStoreID, dealsMaxPrice, dealsSortBy, dealsSearchQuery]);

  // Live stream Free-to-Play triggers
  useEffect(() => {
    if (currentView !== "free-games") return;

    const fetchLiveFreeGames = async () => {
      setFreeLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (freeCategory !== "all") queryParams.append("category", freeCategory);
        if (freePlatform !== "all") queryParams.append("platform", freePlatform);
        if (freeSortBy !== "popularity") queryParams.append("sortBy", freeSortBy);

        const response = await fetch(`/api/freetogame/games?${queryParams.toString()}`);
        if (!response.ok) {
          throw new Error("FreeToGame index retrieval protocol failed.");
        }
        const parsed = await response.json();
        setFreeGames(parsed || []);
      } catch (err) {
        console.error("Failed to fetch Live Free Games:", err);
      } finally {
        setFreeLoading(false);
      }
    };

    fetchLiveFreeGames();
  }, [currentView, freeCategory, freePlatform, freeSortBy]);

  // Load Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Resolve custom profile from users doc
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const snap = await getDoc(userDocRef);

          if (snap.exists()) {
            setCurrentUser(snap.data() as UserProfile);
          } else {
            // Provision default user doc if missing
            const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
            const generatedName = firebaseUser.displayName || `Gamer_${firebaseUser.uid.slice(0, 5)}`;
            const userRole = firebaseUser.email?.toLowerCase() === "thefeedbuzz.store@gmail.com" ? "admin" : "user";

            const initialProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              username: generatedName,
              avatarUrl: firebaseUser.photoURL || defaultAvatar,
              role: userRole,
              isBanned: false,
              createdAt: serverTimestamp(),
            };

            await setDoc(userDocRef, initialProfile);
            setCurrentUser(initialProfile);

            if (userRole === "admin") {
              await setDoc(doc(db, "admins", firebaseUser.uid), {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
              });
            }
          }
        } catch (dbErr) {
          console.warn("User profile retrieval/sync bypassed due to Firestore permissions standard state:", dbErr);
          setFirebaseRulesWarningHappened(true);
          // Set standard fallback profile so standard UI and favorites features run locally
          setCurrentUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            username: firebaseUser.displayName || "Authenticated Core",
            avatarUrl: firebaseUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
            role: firebaseUser.email?.toLowerCase() === "thefeedbuzz.store@gmail.com" ? "admin" : "user",
            isBanned: false,
            createdAt: new Date(),
          });
        }
      } else {
        setCurrentUser(null);
        // Switch view away from protected admin/favorites back to home
        if (currentView === "admin" || currentView === "favorites") {
          setView("home");
        }
      }
    });

    // Listen to lists database
    const unsubLists = onSnapshot(collection(db, "lists"), (snap) => {
      const items: CustomCollectionList[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as CustomCollectionList);
      });
      setCommunityLists(items);
    }, (error) => {
      try {
        setFirebaseRulesWarningHappened(true);
        handleFirestoreError(error, OperationType.LIST, "lists");
      } catch (err) {
        console.warn("Lists snapshot listener permission bypassed:", err);
      }
    });

    // Handle Admin direct links trigger
    if (window.location.pathname === "/admin-login") {
      setAuthInitialAdmin(true);
      setAuthModalOpen(true);
    }

    return () => {
      unsub();
      unsubLists();
    };
  }, [currentView]);

  // Synchronize incoming deep link parameters on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");
      const gameParam = params.get("game");

      if (viewParam) {
        setView(viewParam);
      }
      if (gameParam) {
        const found = curatedGames.find((cg) => cg.id === gameParam);
        if (found) {
          setSelectedGame(found);
        } else if (gameParam.startsWith("freetogame-")) {
          // Dynamic skeleton for game from free directory until live details fetched in modal
          setSelectedGame({
            id: gameParam,
            title: gameParam.replace("freetogame-", "").replace(/-/g, " ").toUpperCase(),
            description: "Live Free-to-Play dynamic title catalog node. Accessing detailed parameters from database net...",
            rating: 8.5,
            releaseDate: "Active",
            genres: ["Free to Play"],
            developers: ["Live Service Studio"],
            publishers: ["Live Service Publishers"],
            platforms: ["PC", "Browser"],
            imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
            trailerKeyword: "",
          });
        }
      }
    } catch (e) {
      console.warn("Deep link parser warning:", e);
    }
  }, []);

  // Update URL parameters dynamically when active view or selected game shifts
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      if (selectedGame) {
        params.set("game", selectedGame.id);
      } else if (currentView && currentView !== "home") {
        params.set("view", currentView);
      }
      
      const newSearch = params.toString();
      const currentSearch = window.location.search.replace(/^\?/, "");
      if (newSearch !== currentSearch) {
        const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
        window.history.pushState(null, "", newUrl);
      }
    } catch (e) {
      console.warn("History pushState warning:", e);
    }
  }, [currentView, selectedGame]);

  // Smooth scroll to top of window whenever navigation view shifts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentView]);

  // Prevent background scroll bleeding when modal is actively engaged
  useEffect(() => {
    if (selectedGame || authModalOpen || createListOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedGame, authModalOpen, createListOpen]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setView("home");
    } catch (error) {
      console.error("SignOut failure:", error);
    }
  };

  // Compile active list of games (Curated + dynamic AI generated + Live FreeToGame)
  const allAvailableGames = useMemo(() => {
    const uniqueMap = new Map<string, Game>();
    curatedGames.forEach(g => uniqueMap.set(g.id, g));
    dynamicAIGames.forEach(g => uniqueMap.set(g.id, g));
    freeGames.forEach(g => uniqueMap.set(g.id, g));
    return Array.from(uniqueMap.values());
  }, [dynamicAIGames, freeGames]);

  // Filters application
  const filteredGames = useMemo(() => {
    return allAvailableGames.filter((g) => {
      const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.genres.some((genre) => genre.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesGenre = genreFilter === "all" || g.genres.includes(genreFilter);
      const matchesPlatform = platformFilter === "all" || g.platforms.includes(platformFilter);

      return matchesSearch && matchesGenre && matchesPlatform;
    }).sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      return a.title.localeCompare(b.title);
    });
  }, [allAvailableGames, searchQuery, genreFilter, platformFilter, sortBy]);

  // Build play list submission
  const handleCreateListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!createListName.trim()) return;

    setListSubmitLoading(true);
    try {
      const payload = {
        userId: currentUser.uid,
        username: currentUser.username,
        title: createListName.trim(),
        description: createListDesc.trim(),
        games: [],
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "lists"), payload);
      setCreateListName("");
      setCreateListDesc("");
      setCreateListOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setListSubmitLoading(false);
    }
  };

  // AI-powered gaming matrix generator - searches AI descriptions if standard filters returned empty
  const handleAISearchSynthesis = async () => {
    if (!searchQuery.trim()) return;
    setAiSearchLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/gemini/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Save game in list if not already there
      const alreadyExists = allAvailableGames.some((g) => g.id === data.id);
      if (!alreadyExists) {
        setDynamicAIGames((prev) => [data, ...prev]);
        setSelectedGame(data);
      } else {
        const found = allAvailableGames.find((g) => g.id === data.id);
        if (found) setSelectedGame(found);
      }
    } catch (err: any) {
      console.error(err);
      setAiError("Oracle matrix offline. Try a classic keyword search.");
    } finally {
      setAiSearchLoading(false);
    }
  };

  // AI intelligence matrix report calibration handler
  const handleGenerateAIReport = async () => {
    setAiReportLoading(true);
    setAiReportError("");
    try {
      // Find top games to use as favorites base
      const favoritesList = curatedGames.slice(0, 4).map(g => ({
        title: g.title,
        genres: g.genres,
        rating: g.rating,
        description: g.description
      }));

      // Direct custom feedback comments
      const commentsInput = aiReportVibeInput.trim() 
        ? [{ userId: currentUser?.uid || "anonymous", username: currentUser?.username || "Guest Gamer", content: aiReportVibeInput }]
        : [];

      const response = await fetch("/api/gemini/analytics-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favorites: favoritesList,
          comments: commentsInput,
          customVibes: aiReportVibeInput
        })
      });

      if (!response.ok) {
        throw new Error("AI intelligence service was unable to calibrate gaming matrix.");
      }

      const report = await response.json();
      setAiReport(report);
    } catch (err: any) {
      console.error(err);
      setAiReportError(err.message || "Failed to finalize dynamic analytics report.");
    } finally {
      setAiReportLoading(false);
    }
  };

  // Hero Featured Game card (Cyberpunk)
  const heroGame = curatedGames[1] || curatedGames[0];

  return (
    <div className="min-h-screen bg-[#050508] text-gray-100 font-sans flex flex-col relative overflow-x-hidden selection:bg-cyan-500 selection:text-[#050508]">
      {/* Background Atmosphere */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-cyan-500/15 rounded-full blur-[130px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[10%] right-[-10%] w-[55%] h-[55%] bg-purple-600/15 rounded-full blur-[130px] pointer-events-none z-0"></div>
      
      {/* Navbar segment */}
      <Navbar
        userProfile={currentUser}
        onOpenAuth={() => {
          setAuthInitialAdmin(false);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        currentView={currentView}
        setView={setView}
        onOpenCreateList={() => setCreateListOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-grow w-full">
        {/* Firebase Custom Integration Guide Panel */}
        {firebaseRulesWarningHappened && !firebaseWarningDismissed && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
            <div className="relative overflow-hidden rounded-3xl border border-amber-550/30 bg-amber-950/15 p-6 backdrop-blur-md shadow-2xl animate-in zoom-in-95 duration-300">
              {/* Subtle top amber glow line */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 to-yellow-500 blur-[2px]"></div>
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400 flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                
                <div className="flex-grow space-y-4">
                  <div className="pr-4">
                    <h3 className="text-sm font-bold font-display uppercase tracking-widest text-amber-400 flex items-center gap-2">
                      ⚡ Action Required: Personal Firebase Project Integration Setup
                    </h3>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed max-w-4xl">
                      Since you configured your personal Firebase project (<strong className="text-white font-mono">aikennet</strong>), automatic database rules deployment is restricted by Google Cloud permissions. To make user profiles, custom collections, and game discussions fully operational on your end, please complete these two minor configuration updates:
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Task 1: Domain Auth */}
                    <div className="p-4 rounded-2xl border border-white/5 bg-white/5 space-y-2 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold tracking-wider block mb-1">01. Authorize Domains in Auth Settings</span>
                        <p className="text-xs text-gray-400 leading-normal mb-2.5">
                          To enable Google Sign-In popups from our preview slots, add these development and shared domains to your trusted domains list under Auth &gt; Settings:
                        </p>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 font-mono text-[9px] text-[#00ffff] select-all space-y-1">
                          <div className="break-all">ais-dev-cfwkn6a2ul4zyk7kta3jux-780663003234.europe-west2.run.app</div>
                          <div className="break-all">ais-pre-cfwkn6a2ul4zyk7kta3jux-780663003234.europe-west2.run.app</div>
                        </div>
                      </div>
                      <div className="pt-2">
                        <a 
                          href="https://console.firebase.google.com/project/aikennet/authentication/settings"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-450 hover:text-cyan-400 hover:underline hover:scale-102 transition-transform"
                        >
                          Open Firebase Auth console ↗
                        </a>
                      </div>
                    </div>
                    
                    {/* Task 2: Copy Rules */}
                    <div className="p-4 rounded-2xl border border-white/5 bg-white/5 space-y-2 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold tracking-wider block mb-1">02. Copy &amp; Publish Database Security Rules</span>
                        <p className="text-xs text-gray-400 leading-normal">
                          Paste our production-hardened Firestore security rules directly into your database rules editor to grant read/write access:
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2.5 pt-2 items-center">
                        <button
                          onClick={async () => {
                            const { RAW_FIRESTORE_RULES } = await import("./data/rules_raw");
                            navigator.clipboard.writeText(RAW_FIRESTORE_RULES);
                            setCopiedRules(true);
                            setTimeout(() => setCopiedRules(false), 2000);
                          }}
                          className="px-4 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono text-xs rounded-lg border border-amber-500/30 hover:border-amber-500/50 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                        >
                          {copiedRules ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-400" /> Compiled to Clipboard!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy Firestore Rules
                            </>
                          )}
                        </button>
                        <a 
                          href="https://console.firebase.google.com/project/aikennet/firestore/rules"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-450 hover:text-cyan-400 hover:underline"
                        >
                          Open Rules Console ↗
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        setFirebaseWarningDismissed(true);
                        localStorage.setItem("firebase_rules_warning_dismissed", "true");
                      }}
                      className="px-5 py-2 bg-white/5 hover:bg-white/10 text-gray-450 hover:text-white font-mono text-xs rounded-full border border-white/10 transition-colors cursor-pointer"
                    >
                      Hide Notice (Keep Bypassed)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === "admin" && currentUser?.role === "admin" ? (
          <React.Suspense fallback={<div className="p-12 text-center text-cyan-400 font-mono text-xs">Accessing Admin Control Console...</div>}>
            <AdminDashboard currentUser={currentUser} />
          </React.Suspense>
        ) : currentView === "favorites" ? (
          /* Favorites View Grid */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in">
            <h2 className="text-3xl font-extrabold font-display uppercase tracking-wider text-white mb-2 flex items-center gap-2">
              <Heart className="w-8 h-8 text-red-500 fill-current animate-pulse" /> My Favorited Grid
            </h2>
            <p className="text-xs font-mono text-gray-400 mb-8 uppercase tracking-widest border-b border-[#1f2833]/40 pb-4">
              Synchronized saves indexed in database
            </p>

            {filteredGames.filter(g => dynamicAIGames.some(da => da.id === g.id)).length === 0 && curatedGames.length > 0 && (
              <p className="text-sm font-mono text-[#00ffff] block bg-cyan-950/20 p-4 border border-[#00ffff]/20 rounded-xl max-w-lg mb-6 leading-relaxed">
                Tip: Click on games matching, test details, and hit 'Add to Favorites' to display items on this private grid!
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredGames.slice(0, 8).map((game) => (
                <div
                  key={game.id}
                  onClick={() => setSelectedGame(game)}
                  className="glass-panel rounded-2xl overflow-hidden cursor-pointer glass-panel-hover flex flex-col group h-full"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                    <img src={game.imageUrl} alt={`${game.title} card visual link`} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-lg border border-[#00ffff]/20 text-xs font-mono font-bold text-[#00ffff]">
                      ⭐ {game.rating}
                    </div>
                  </div>
                  <div className="p-4 flex flex-col justify-between flex-grow">
                    <div>
                      <h4 className="font-bold text-base font-display text-white line-clamp-1 group-hover:text-[#00ffff] transition-colors uppercase">{game.title}</h4>
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1 font-sans">{game.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {game.genres.map(tag => (
                        <span key={tag} className="text-[10px] font-mono text-[#00ffff] bg-cyan-950/40 px-2 py-0.5 rounded border border-[#00ffff]/10 uppercase">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : currentView === "free-games" ? (
          /* Real-time FreeToGame directory */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/10 pb-6">
              <div>
                <span className="text-[10px] font-mono uppercase bg-cyan-950/40 text-[#00ffff] border border-[#00ffff]/20 px-3 py-1 rounded-full tracking-widest leading-none mb-1.5 inline-block">LIVE DIGITAL DATABASE</span>
                <h2 className="text-3xl font-extrabold font-display uppercase tracking-wider text-white">Free-to-Play Grid</h2>
                <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mt-1">Real-time MMO, Shooter, and RPG titles fetched live</p>
              </div>

              {/* Live search input specifically for FreeToGame listed items */}
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Locate free titles..."
                  value={freeSearchQuery}
                  onChange={(e) => setFreeSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
                <Search className="w-4 h-4 text-[#00ffff] absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Live Filter selections wrapper */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Category selector */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="free-category-select" className="text-[10px] uppercase font-mono text-gray-400">Genre / Category Code</label>
                <select
                  id="free-category-select"
                  value={freeCategory}
                  onChange={(e) => setFreeCategory(e.target.value)}
                  aria-label="Filter free games by genre or category"
                  className="w-full bg-slate-950 hover:bg-slate-900 text-gray-200 border border-white/10 px-3 py-2.5 rounded-xl text-xs font-semibold uppercase font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="all">All Genres</option>
                  <option value="mmorpg">MMORPG</option>
                  <option value="shooter">Shooter</option>
                  <option value="anime">Anime</option>
                  <option value="battle-royale">Battle Royale</option>
                  <option value="moba">MOBA</option>
                  <option value="strategy">Strategy</option>
                  <option value="sports">Sports</option>
                  <option value="racing">Racing</option>
                  <option value="card">Card Games</option>
                  <option value="social">Social Space</option>
                </select>
              </div>

              {/* Platform selector */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="free-platform-select" className="text-[10px] uppercase font-mono text-gray-400">Hardware Interface</label>
                <select
                  id="free-platform-select"
                  value={freePlatform}
                  onChange={(e) => setFreePlatform(e.target.value)}
                  aria-label="Filter free games by platform"
                  className="w-full bg-slate-950 hover:bg-slate-900 text-gray-200 border border-white/10 px-3 py-2.5 rounded-xl text-xs font-semibold uppercase font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="all">All Platforms</option>
                  <option value="pc">PC (Windows)</option>
                  <option value="browser">Web Browser</option>
                </select>
              </div>

              {/* Sort by selector */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="free-sort-select" className="text-[10px] uppercase font-mono text-gray-400">Sorting Registry</label>
                <select
                  id="free-sort-select"
                  value={freeSortBy}
                  onChange={(e) => setFreeSortBy(e.target.value)}
                  aria-label="Sort free games list"
                  className="w-full bg-slate-950 hover:bg-slate-900 text-gray-200 border border-[#1f2833]/30 px-3 py-2.5 rounded-xl text-xs font-semibold uppercase font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="popularity">Popularity Index</option>
                  <option value="release-date">Release Date</option>
                  <option value="alphabetical">Alphabetical Order</option>
                </select>
              </div>
            </div>

            {/* Results Grid block */}
            {freeLoading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest animate-pulse">Syncing gaming streams from server node...</p>
              </div>
            ) : (
              <>
                {/* Apply client-side search query query over server-returned 40 items */}
                {(() => {
                  const itemsToShow = freeGames.filter(g =>
                    g.title.toLowerCase().includes(freeSearchQuery.toLowerCase()) ||
                    g.description.toLowerCase().includes(freeSearchQuery.toLowerCase()) ||
                    g.genres.some(tg => tg.toLowerCase().includes(freeSearchQuery.toLowerCase()))
                  );

                  if (itemsToShow.length === 0) {
                    return (
                      <div className="py-20 border border-dashed border-white/10 rounded-3xl text-center bg-slate-950/20 max-w-xl mx-auto">
                        <Gamepad2 className="w-10 h-10 text-gray-500 mx-auto mb-3 animate-pulse" />
                        <h4 className="text-sm uppercase font-mono text-cyan-400 font-bold mb-1">No Free Games Found</h4>
                        <p className="text-xs text-gray-500">Try broad filters or search codes inside our server parameters.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {itemsToShow.map((game) => (
                        <div
                          key={game.id}
                          onClick={() => setSelectedGame(game)}
                          className="glass-panel rounded-2xl overflow-hidden cursor-pointer glass-panel-hover flex flex-col group h-full"
                        >
                          <div className="relative aspect-video w-full overflow-hidden bg-slate-900 border-b border-white/5">
                            <img src={game.imageUrl} alt={`${game.title} cover preview artwork`} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" referrerPolicy="no-referrer" />
                            <div className="absolute top-2 right-2 bg-black/75 px-2 py-1 rounded-lg border border-cyan-400/20 text-xs font-mono font-bold text-[#00ffff]">
                              ⭐ {game.rating}
                            </div>
                            <span className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded text-[9px] font-mono uppercase bg-emerald-950 border border-emerald-400/20 text-emerald-400">
                              Free To Play
                            </span>
                          </div>
                          <div className="p-4 flex flex-col justify-between flex-grow">
                            <div>
                              <h4 className="font-bold text-base font-display text-white line-clamp-1 group-hover:text-[#00ffff] transition-colors uppercase leading-tight">{game.title}</h4>
                              <p className="text-xs text-gray-400 line-clamp-2 mt-1.5 font-sans leading-relaxed">{game.description}</p>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-3.5">
                              {game.genres.map(tag => (
                                <span key={tag} className="text-[10px] font-mono text-[#00ffff] bg-cyan-950/40 px-2 py-0.5 rounded border border-[#00ffff]/15 uppercase">{tag}</span>
                              ))}
                              {game.platforms.map(p => (
                                <span key={p} className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase">{p}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        ) : currentView === "deals" ? (
          /* Live CheapShark Discount Deals directory */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/10 pb-6">
              <div>
                <span className="text-[10px] font-mono uppercase bg-emerald-950/40 text-emerald-400 border border-emerald-400/20 px-3 py-1 rounded-full tracking-widest leading-none mb-1.5 inline-block">LIVE TRANSACTIONS MATRIX</span>
                <h2 className="text-3xl font-extrabold font-display uppercase tracking-wider text-white">Active Storefront Deals</h2>
                <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mt-1">Real-time discount streams & price drops synced live from GOG, Steam & Epic Games</p>
              </div>

              {/* Deal titles live query filtering */}
              <div className="relative w-full md:w-80">
                <input
                  id="deals-title-search"
                  type="text"
                  placeholder="Locate discounted titles..."
                  value={dealsSearchQuery}
                  onChange={(e) => setDealsSearchQuery(e.target.value)}
                  aria-label="Locate discounted game titles"
                  className="w-full pl-10 pr-4 py-2 bg-slate-900/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Price ceiling and store controllers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Deal Store Filter */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="deals-store-select" className="text-[10px] uppercase font-mono text-gray-400">Merchant Storefront Channel</label>
                <select
                  id="deals-store-select"
                  value={dealsStoreID}
                  onChange={(e) => setDealsStoreID(e.target.value)}
                  aria-label="Select merchant storefront channel"
                  className="w-full bg-slate-950 hover:bg-slate-900 text-gray-200 border border-white/10 px-3 py-2.5 rounded-xl text-xs font-semibold uppercase font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">All Digital Stores</option>
                  <option value="1">Steam</option>
                  <option value="7">GOG (Good Old Games)</option>
                  <option value="25">Epic Games Store</option>
                </select>
              </div>

              {/* Price Ceiling */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="deals-price-range" className="text-[10px] uppercase font-mono text-gray-400 flex justify-between">
                  <span>Price Cap protocol</span>
                  <span className="text-[#00ffc8] font-bold">${dealsMaxPrice} USD</span>
                </label>
                <input
                  id="deals-price-range"
                  type="range"
                  min="5"
                  max="80"
                  step="5"
                  value={dealsMaxPrice}
                  onChange={(e) => setDealsMaxPrice(e.target.value)}
                  aria-label="Filter by maximum price cap"
                  className="w-full accent-emerald-400 bg-slate-950 border border-white/10 rounded-xl cursor-pointer py-2 px-1 focus:outline-none"
                />
              </div>

              {/* Deal sorting algorithm */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="deals-sort-select" className="text-[10px] uppercase font-mono text-gray-400">Sorting Registry</label>
                <select
                  id="deals-sort-select"
                  value={dealsSortBy}
                  onChange={(e) => setDealsSortBy(e.target.value)}
                  aria-label="Sort active deals registry list"
                  className="w-full bg-slate-950 hover:bg-slate-900 text-gray-200 border border-white/10 px-3 py-2.5 rounded-xl text-xs font-semibold uppercase font-mono cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Savings">Savings Percent</option>
                  <option value="Price">Price (Ascending)</option>
                  <option value="Reviews">Steam Review Ratio</option>
                  <option value="Title">Alphabetical Title</option>
                </select>
              </div>
            </div>

            {/* Live Deals Streams Panel */}
            {dealsLoading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest animate-pulse">Syncing storefront streams from CheapShark node...</p>
              </div>
            ) : deals.length === 0 ? (
              <div className="py-20 border border-dashed border-white/10 rounded-3xl text-center bg-slate-950/20 max-w-xl mx-auto">
                <Gamepad2 className="w-10 h-10 text-gray-500 mx-auto mb-3 animate-pulse" />
                <h4 className="text-sm uppercase font-mono text-emerald-400 font-bold mb-1">No Active Deals Found</h4>
                <p className="text-xs text-gray-500">Adjust your price cap protocols or search queries to discover live promotions.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {deals.map((deal: any) => {
                  const savedPct = Math.round(parseFloat(deal.savings));
                  const getStoreName = (id: string) => {
                    switch (id) {
                      case "1": return "Steam";
                      case "7": return "GOG";
                      case "25": return "Epic Games";
                      default: return "Digital Store";
                    }
                  };
                  const getStoreColor = (id: string) => {
                    switch (id) {
                      case "1": return "bg-sky-500/10 text-sky-400 border-sky-500/20";
                      case "7": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
                      case "25": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                      default: return "bg-gray-500/10 text-gray-400 border-gray-500/20";
                    }
                  };
                  return (
                    <div
                      key={deal.dealID}
                      className="glass-panel rounded-2xl overflow-hidden glass-panel-hover flex flex-col group h-full relative"
                    >
                      {/* Deal Pct Absolute Badging */}
                      {savedPct > 0 && (
                        <div className="absolute top-3 left-3 bg-red-600/95 font-black text-[11px] font-mono p-1 px-2.5 rounded border border-red-500/20 text-white z-10 uppercase tracking-wider shadow">
                          -{savedPct}% SAVED
                        </div>
                      )}

                      <div className="relative aspect-video w-full overflow-hidden bg-slate-900 border-b border-white/5">
                        <img
                          src={deal.thumb}
                          alt={`${deal.title} storefront deal thumbnail`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2 right-2 bg-black/75 px-2 py-1 rounded border border-emerald-400/20 text-xs font-mono font-bold text-emerald-400">
                          ⭐ Deal Rating: {parseFloat(deal.dealRating).toFixed(1)}/10
                        </div>
                      </div>

                      <div className="p-4 flex flex-grow flex-col justify-between">
                        <div>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase inline-block mb-2 font-bold ${getStoreColor(deal.storeID)}`}>
                            {getStoreName(deal.storeID)}
                          </span>
                          <h4 className="font-bold text-base font-display text-white line-clamp-1 group-hover:text-emerald-400 transition-colors uppercase leading-tight">
                            {deal.title}
                          </h4>
                          
                          <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-lg font-black text-[#00ffdd] font-mono">
                              ${parseFloat(deal.salePrice).toFixed(2)}
                            </span>
                            <span className="text-xs text-gray-500 line-through font-mono">
                              ${parseFloat(deal.normalPrice).toFixed(2)}
                            </span>
                          </div>

                          {deal.steamRatingText && (
                            <p className="text-[10px] text-gray-400 mt-2 font-mono flex items-center gap-1">
                              <span>Steam:</span>
                              <span className="text-amber-400 font-bold">{deal.steamRatingText}</span>
                              <span>({deal.steamRatingPercent}%)</span>
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5">
                          <a
                            href={`https://www.cheapshark.com/redirect?dealID=${deal.dealID}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black font-mono font-bold text-[10px] rounded-xl border border-emerald-500/30 transition-all uppercase cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Acquire Deal Stream
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : currentView === "ai-report" ? (
          /* Live Gemini AI dynamic insights compiler */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in">
            <div className="mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono uppercase bg-cyan-950/40 text-[#00ffff] border border-[#00ffff]/20 px-3 py-1 rounded-full tracking-widest leading-none mb-1.5 inline-block">SECURE BACKEND AI AGENT</span>
                <h2 className="text-3xl font-extrabold font-display uppercase tracking-wider text-white flex items-center gap-2">
                  <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse animate-duration-1000" />
                  Core Gaming Analytics Oracle
                </h2>
                <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mt-1">Calibrating gameplay preferences, analyzing text vibes, and generating personalized lore reports via Gemini AI</p>
              </div>
              <button
                id="generate-ai-report"
                disabled={aiReportLoading}
                onClick={handleGenerateAIReport}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 hover:from-cyan-500 hover:to-purple-600 text-black font-black font-mono uppercase text-xs tracking-wider transition-all cursor-pointer shadow-lg hover:shadow-cyan-500/10 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                <Bot className="w-4 h-4 text-black" />
                {aiReportLoading ? "Synthesizing Core Analyzer..." : "Compute Analytics Report"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column Controls */}
              <div className="lg:col-span-5 space-y-6">
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2.5 opacity-10">
                    <Settings className="w-12 h-12 text-cyan-400" />
                  </div>
                  <h3 className="text-sm font-extrabold uppercase font-mono tracking-widest text-[#00ffff] mb-4">Input Gamer Comments & Feedback Vibe</h3>
                  <p className="text-xs text-gray-400 mb-4 font-sans leading-relaxed">
                    Type your gameplay vibes, feedback on favorite releases, developer likes, or gaming habits here. The Oracle will analyze your text alongside your favorites matrix.
                  </p>
                  <textarea
                    rows={4}
                    value={aiReportVibeInput}
                    onChange={(e) => setAiReportVibeInput(e.target.value)}
                    placeholder="e.g. I absolutely crave deeply atmospheric dark fantasy RPGs. I want extremely complex build customization, intricate plot choices, but hate tedious grinding loops. Visual immersion must be phenomenal..."
                    className="w-full bg-slate-950/60 hover:bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white uppercase placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono resize-none"
                  />
                </div>

                <div className="glass-panel p-6 rounded-2xl">
                  <h3 className="text-sm font-extrabold uppercase font-mono tracking-widest text-cyan-400 mb-4">Targeting Vector (Active Favorites Feed)</h3>
                  <p className="text-xs text-gray-400 mb-4 font-sans leading-relaxed">
                    These top curated database items automatically feed into the Gemini processor mapping algorithms:
                  </p>
                  <div className="space-y-3">
                    {curatedGames.slice(0, 4).map((bgGame) => (
                      <div key={bgGame.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
                        <img src={bgGame.imageUrl} alt={`${bgGame.title} mini-artwork`} loading="lazy" decoding="async" className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                        <div className="min-w-0 flex-grow">
                          <h4 className="text-xs font-bold text-white uppercase truncate">{bgGame.title}</h4>
                          <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider">{bgGame.genres.slice(0, 2).join(" | ")}</span>
                        </div>
                        <span className="text-[10px] font-mono text-yellow-400 font-bold pr-2">⭐ {bgGame.rating}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column Core Analyzer Output */}
              <div className="lg:col-span-7">
                {aiReportLoading ? (
                  <div className="glass-panel h-full min-h-[400px] flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    <div>
                      <h4 className="text-sm font-bold uppercase font-display text-white mb-1">Synthesizing AI Intelligence Matrix</h4>
                      <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest animate-pulse max-w-xs leading-relaxed">Evaluating feedback sentiment, clustering themes, and rendering predictive conceptual match rates...</p>
                    </div>
                  </div>
                ) : aiReportError ? (
                  <div className="glass-panel h-full min-h-[400px] p-8 border-red-500/20 text-center flex flex-col items-center justify-center gap-3">
                    <AlertTriangle className="w-10 h-10 text-red-500 animate-pulse" />
                    <h4 className="text-base font-bold text-white uppercase">Calibration Protocol Interrupted</h4>
                    <p className="text-xs font-mono text-red-400 max-w-sm">{aiReportError}</p>
                    <button
                      onClick={handleGenerateAIReport}
                      className="mt-4 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono text-xs uppercase tracking-wider border border-red-500/30"
                    >
                      Re-Initialize Synthesizer
                    </button>
                  </div>
                ) : aiReport ? (
                  <div className="glass-panel p-6 rounded-3xl space-y-6 animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
                    {/* Glowing side border */}
                    <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-cyan-400 to-purple-500"></div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                      <div>
                        <span className="text-[9px] font-mono uppercase text-cyan-400 tracking-widest block mb-1">COMPUTED GAMER ARCHETYPE</span>
                        <h3 className="text-2xl font-black font-display uppercase tracking-wide text-white">{aiReport.gamerTitle}</h3>
                      </div>
                      
                      <div className="bg-gradient-to-tr from-cyan-500/10 to-purple-500/10 border border-cyan-400/20 rounded-2xl p-3 pr-4 flex items-center gap-2 flex-shrink-0">
                        <Flame className="w-6 h-6 text-[#00ffc8] fill-emerald-500/10" />
                        <div>
                          <p className="text-[9px] font-mono uppercase text-gray-400 leading-none">ORACLE COMPATIBILITY MATCH</p>
                          <p className="text-xl font-black font-mono text-[#00ffff] mt-1">{aiReport.syntheticScore}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs uppercase font-mono tracking-widest text-[#00ffc8] mb-1.5 font-bold">Vibration Vibe Summary</h4>
                        <p className="text-sm font-sans text-gray-300 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5">{aiReport.vibeVibeSummary}</p>
                      </div>

                      <div>
                        <h4 className="text-xs uppercase font-mono tracking-widest text-[#00ffc8] mb-1.5 font-bold">Gameplay Themes & Mechanics Cluster</h4>
                        <p className="text-xs font-mono text-gray-400 leading-relaxed bg-black/40 p-4 rounded-2xl border border-white/5 whitespace-pre-line">{aiReport.mechanicsAnalysis}</p>
                      </div>

                      <div>
                        <h4 className="text-xs uppercase font-mono tracking-widest text-purple-400 mb-1.5 font-bold">Feedback Sentiment Evaluation</h4>
                        <p className="text-xs font-sans text-gray-300 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5">{aiReport.feedbackInsight || "Direct qualitative comments analyzer complete."}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                      <h4 className="text-xs uppercase font-mono tracking-widest text-[#00ffc8] mb-4 font-bold flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        Custom Synthesized Recommendations
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        {aiReport.aiRecommendations && aiReport.aiRecommendations.map((rec: any) => (
                          <div key={rec.id} className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-[#090b11] border border-white/5 hover:border-cyan-500/20 transition-all">
                            <img src={rec.imageUrl} alt={`${rec.title} curation cover`} loading="lazy" decoding="async" className="w-full sm:w-28 h-24 rounded-xl object-cover border border-white/10 flex-shrink-0" />
                            <div className="flex-grow min-w-0">
                              <div className="flex justify-between items-start gap-2 mb-1.5">
                                <h5 className="font-bold text-sm text-white uppercase truncate">{rec.title}</h5>
                                <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-400/25 flex-shrink-0">
                                  {rec.estimatedRating} Match
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{rec.matchReason}</p>
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {rec.tags && rec.tags.map((t: string) => (
                                  <span key={t} className="text-[9px] font-mono text-gray-500 bg-white/5 border border-white/5 px-2 py-0.5 rounded uppercase">{t}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center gap-4">
                    <div className="p-4 bg-cyan-500/10 rounded-full border border-cyan-500/20 text-cyan-400">
                      <Bot className="w-8 h-8 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold uppercase text-white mb-1.5">Oracle Decryption Ready</h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                        Specify extra design or narrative comments, then trigger the backend computation matrix to receive your comprehensive technical analyzer!
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateAIReport}
                      className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-400 text-xs font-mono uppercase tracking-wider transition-all"
                    >
                      Initialize Decryption Probe
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : currentView === "lists" ? (
          /* Curated lists view */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-[#1f2833]/40 pb-4">
              <div>
                <h2 className="text-3xl font-extrabold font-display uppercase tracking-wider text-white">Curated Playlists</h2>
                <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mt-1">Gamer builds lists and custom collections</p>
              </div>
              <button
                onClick={() => {
                  if (!currentUser) setAuthModalOpen(true);
                  else setCreateListOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00ffff] to-[#7f00ff] text-slate-950 text-xs font-bold uppercase cursor-pointer"
              >
                + New Playlist
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {communityLists.length === 0 ? (
                <div className="md:col-span-2 py-16 border border-dashed border-[#1f2833]/60 rounded-2xl flex flex-col items-center justify-center">
                  <Layers className="w-10 h-10 text-gray-500 mb-3" />
                  <p className="text-sm font-mono text-gray-400">No community playlists build yet. Start one now!</p>
                </div>
              ) : (
                communityLists.map((list) => (
                  <div key={list.id} className="glass-panel p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xl font-bold font-display text-[#00ffff] uppercase tracking-wide leading-tight">{list.title}</h4>
                        <span className="text-[10px] font-mono text-gray-500 mt-1 block">Curator: {list.username}</span>
                      </div>
                      <span className="bg-[#111] border border-[#222] text-[10px] px-2 py-1 rounded-lg font-mono text-gray-400">
                        {list.games?.length || 0} Games
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 font-sans leading-relaxed line-clamp-2">{list.description}</p>
                    
                    {/* Small grid displays of games in list */}
                    {list.games && list.games.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1f2833]/40">
                        {list.games.slice(0, 3).map((item) => {
                          const originalGame = allAvailableGames.find(g => g.id === item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => originalGame && setSelectedGame(originalGame)}
                              className="relative aspect-video rounded-lg overflow-hidden group/mini cursor-pointer border border-[#1f2833]/40"
                              title={item.title}
                            >
                              <img src={item.imageUrl} alt={`${item.title} list thumbnail`} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover/mini:scale-110 transition-transform" />
                              <div className="absolute inset-0 bg-black/40 group-hover/mini:bg-black/10 transition-colors flex items-end p-1.5Packed">
                                <span className="text-[9px] font-bold text-white uppercase truncate block w-full leading-none">{item.title}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* DEFAULT VIEW: CINEMATIC HOMEPAGE */
          <div className="space-y-12">
            
             {/* Cinematic Hero Segment */}
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 relative z-10">
               <div className="relative rounded-[32px] overflow-hidden border border-white/10 shadow-2xl group bg-white/5 backdrop-blur-md p-8 sm:p-12">
                 
                 {/* Wallpaper Backdrop */}
                 <div className="absolute inset-0 overflow-hidden z-0">
                   <img src={heroGame.imageUrl} alt="" loading="eager" decoding="async" className="w-full h-full object-cover opacity-25 select-none pointer-events-none filter blur-[1px]" />
                   <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-[#050508]/10"></div>
                   <div className="absolute inset-0 bg-gradient-to-r from-[#050508]/90 via-[#050508]/35 to-transparent"></div>
                 </div>

                 {/* Showcase Banner Column */}
                 <div className="relative z-10">
                   <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
                     <div className="lg:col-span-3 space-y-6">
                       <div className="flex items-center gap-2">
                         <Flame className="w-4 h-4 text-cyan-400 animate-bounce" />
                         <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-400 text-[10px] font-black rounded border border-cyan-500/30 uppercase tracking-wider">
                           Featured
                         </span>
                         <span className="px-2.5 py-1 bg-white/10 text-white text-[10px] font-black rounded border border-white/20 uppercase tracking-wider">
                           Interactive Arena
                         </span>
                       </div>
                       <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-white uppercase italic leading-none">
                         {heroGame.title}
                       </h1>
                       <p className="max-w-md text-gray-300 text-sm sm:text-base leading-relaxed">
                         {heroGame.description}
                       </p>
                       <div className="flex items-center gap-4 pt-2">
                         <button
                           onClick={() => setSelectedGame(heroGame)}
                           className="px-8 py-3 bg-white text-[#050508] font-black rounded-full hover:bg-cyan-400 hover:text-black transition-colors uppercase tracking-wider text-xs cursor-pointer shadow-lg active:scale-95"
                         >
                           LAUNCH INTERACTION
                         </button>
                         <div className="flex flex-col ml-4">
                           <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">gamesbody Score</span>
                           <span className="text-xl font-black text-cyan-400 italic">⭐ {heroGame.rating}/10</span>
                         </div>
                       </div>
                     </div>
                     <div className="lg:col-span-2 hidden lg:block aspect-video rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative">
                       <img src={heroGame.imageUrl} alt={`${heroGame.title} cover billboard`} loading="eager" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                     </div>
                   </div>
                 </div>
               </div>
             </div>

            {/* Games Discovery filter and grid block */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-16">
              
              {/* Search, Filter buttons and options toolbar */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-xl z-10 relative">
                
                {/* Search query box */}
                <div className="relative w-full md:w-96">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    id="catalog-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search titles, descriptions, genres..."
                    aria-label="Search catalog games"
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 hover:bg-white/10 transition-all font-mono"
                  />
                </div>

                {/* Genre Platform choices */}
                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto text-xs font-mono">
                  
                  {/* Select genre */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="catalog-genre-select" className="text-gray-400 uppercase text-[10px] font-bold tracking-wider">Genre:</label>
                    <select
                      id="catalog-genre-select"
                      value={genreFilter}
                      onChange={(e) => setGenreFilter(e.target.value)}
                      aria-label="Filter games by genre"
                      className="bg-[#050508] border border-white/10 rounded-lg text-white py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                    >
                      <option value="all">ALL</option>
                      <option value="Action">ACTION</option>
                      <option value="RPG">RPG</option>
                      <option value="Rogue-like">ROGUE-LIKE</option>
                      <option value="Turn-Based">TURN-BASED</option>
                      <option value="Adventure">ADVENTURE</option>
                      <option value="Fantasy">FANTASY</option>
                    </select>
                  </div>

                  {/* Select Platform */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="catalog-platform-select" className="text-gray-400 uppercase text-[10px] font-bold tracking-wider">Platform:</label>
                    <select
                      id="catalog-platform-select"
                      value={platformFilter}
                      onChange={(e) => setPlatformFilter(e.target.value)}
                      aria-label="Filter games by platform"
                      className="bg-[#050508] border border-white/10 rounded-lg text-white py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                    >
                      <option value="all">ALL</option>
                      <option value="PC">PC (STEAM)</option>
                      <option value="PS5">PLAYSTATION 5</option>
                      <option value="Xbox Series X">XBOX SERIES X</option>
                      <option value="Switch">NINTENDO SWITCH</option>
                    </select>
                  </div>

                  {/* Rating or Alphabetical order */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="catalog-sort-select" className="text-gray-400 uppercase text-[10px] font-bold tracking-wider">Sort:</label>
                    <select
                      id="catalog-sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      aria-label="Sort games list"
                      className="bg-[#050508] border border-white/10 rounded-lg text-white py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                    >
                      <option value="rating">RATING</option>
                      <option value="alphabetical">TITLE</option>
                    </select>
                  </div>

                </div>

              </div>

              {/* Dynamic AI searching suggestions block */}
              {searchQuery.trim().length > 0 && filteredGames.length === 0 && (
                <div className="p-8 rounded-2xl border border-[#00ffff]/20 bg-[#0d1723]/60 text-center animate-in zoom-in-95 max-w-xl mx-auto space-y-5">
                  <Bot className="w-12 h-12 text-[#00ffff] mx-auto animate-pulse" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg text-white uppercase tracking-wide">Synthesise Custom AI Game Parameters?</h4>
                    <p className="text-xs text-gray-400 font-sans leading-relaxed">
                      We found 0 local matches for "{searchQuery}". Engage gamesbody AI to scan the neural gaming universe and generate details, lore, and gameplay links!
                    </p>
                  </div>
                  
                  {aiError && (
                    <p className="text-[10px] font-mono text-xs text-red-400">{aiError}</p>
                  )}

                  <button
                    onClick={handleAISearchSynthesis}
                    disabled={aiSearchLoading}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#00ffff] to-[#7f00ff] text-slate-900 font-bold rounded-xl text-xs uppercase hover:brightness-110 active:scale-95 tracking-wide flex items-center justify-center gap-2 mx-auto cursor-pointer"
                  >
                    {aiSearchLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                        Synthesising...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> ACTIVATE AI GENERATOR
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Discovery Main Grid */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold font-display text-white uppercase tracking-wider flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-[#00ffff]" /> Matrix catalog ({filteredGames.length} indexed)
                </h3>

                {filteredGames.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredGames.map((game) => (
                      <div
                        key={game.id}
                        onClick={() => setSelectedGame(game)}
                        className="glass-panel rounded-2xl overflow-hidden cursor-pointer glass-panel-hover flex flex-col group h-full relative"
                      >
                        {/* Rating Overlay badge */}
                        <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-[#00ffff]/20 text-xs font-mono font-bold text-[#00ffff] z-10 shadow-lg">
                          ⭐ {game.rating}
                        </div>

                        <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                          <img src={game.imageUrl} alt={`${game.title} cover preview thumbnail`} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#07090e]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                            <span className="text-xs font-bold font-mono text-[#00ffff] uppercase tracking-wider">Inspect parameters →</span>
                          </div>
                        </div>

                        <div className="p-4 flex flex-col justify-between flex-grow">
                          <div>
                            <h4 className="font-bold text-base font-display text-white line-clamp-1 group-hover:text-[#00ffff] transition-colors uppercase">
                              {game.title}
                            </h4>
                            <p className="text-xs text-gray-400 line-clamp-2 mt-1 font-sans">
                              {game.description}
                            </p>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mt-3">
                            {game.genres.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[9px] font-mono text-[#45f3ff] bg-[#111] px-2 py-0.5 rounded-lg border border-[#1f2833]/60 uppercase"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-[#040609] border-t border-[#1f2833]/45 py-10 mt-12 text-center text-xs font-mono text-gray-500">
        <p>© 2026 GAMESBODY Inc. All systems and digital streams synchronized.</p>
        <p className="mt-2 text-[10px] text-gray-600">This platform aligns with extreme zero-trust attribute verification.</p>
      </footer>

      {/* Auth Gate modal */}
      {authModalOpen && (
        <React.Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 font-mono text-cyan-400 text-xs">Opening Authentication Terminal...</div>}>
          <AuthModal
            onClose={() => setAuthModalOpen(false)}
            onSuccess={() => setAuthModalOpen(false)}
            initialAdminView={authInitialAdmin}
          />
        </React.Suspense>
      )}

      {/* Game Details Overlay Modal */}
      {selectedGame && (
        <React.Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 font-mono text-cyan-400 text-xs text-center">Launching Neural Interactive Environment...</div>}>
          <GameDetailsModal
            game={selectedGame}
            onClose={() => setSelectedGame(null)}
            currentUser={currentUser}
            onOpenAuth={() => setAuthModalOpen(true)}
            userLists={currentUser ? communityLists.filter(l => l.userId === currentUser.uid) : []}
            onRefreshLists={() => {}}
          />
        </React.Suspense>
      )}

      {/* Playlists Creation Popup */}
      {createListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 bg-[#0c1017] border border-[#1f2833] rounded-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-[#1f2833]/40">
              <h3 className="text-lg font-bold font-display text-white uppercase tracking-wider">Initialize Playlist</h3>
              <button onClick={() => setCreateListOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateListSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5">Playlist Name</label>
                <input
                  type="text"
                  required
                  value={createListName}
                  onChange={(e) => setCreateListName(e.target.value)}
                  placeholder="e.g. Best RPG of 2026"
                  className="w-full px-4 py-2 bg-[#121824] border border-[#1f2833] rounded-xl text-white text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5">Description</label>
                <textarea
                  required
                  value={createListDesc}
                  onChange={(e) => setCreateListDesc(e.target.value)}
                  placeholder="Insert notes about this game list..."
                  className="w-full px-4 py-3 bg-[#121824] border border-[#1f2833] rounded-xl text-white text-xs focus:outline-none h-24"
                />
              </div>

              <button
                type="submit"
                disabled={listSubmitLoading}
                className="w-full py-2.5 bg-[#00ffff] text-slate-950 text-xs font-bold uppercase rounded-xl tracking-wide flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {listSubmitLoading ? "Synthesising..." : "BUILD PLAYLIST"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
