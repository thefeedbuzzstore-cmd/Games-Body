import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import {
  X,
  Star,
  Plus,
  Heart,
  ExternalLink,
  MessageSquare,
  ThumbsUp,
  AlertOctagon,
  Bot,
  Gamepad2,
  Share2,
  TrendingUp,
  Shield,
} from "lucide-react";
import { db, handleFirestoreError, OperationType, auth } from "../firebase";
import { Game, UserProfile, Comment, AffiliateLink, CustomCollectionList } from "../types";
import { curatedGames } from "../data/games";

interface GameDetailsModalProps {
  game: Game;
  onClose: () => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  userLists: CustomCollectionList[];
  onRefreshLists: () => void;
}

export default function GameDetailsModal({
  game,
  onClose,
  currentUser,
  onOpenAuth,
  userLists,
  onRefreshLists,
}: GameDetailsModalProps) {
  // Favorites and Ratings
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteId, setFavoriteId] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [ratingId, setRatingId] = useState("");
  const [averageScore, setAverageScore] = useState(game.rating);
  const [totalRatingsCount, setTotalRatingsCount] = useState(1);

  // Comments / Reviews list
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyInput, setReplyInput] = useState("");
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);

  // Affiliate purchase links
  const [affiliates, setAffiliates] = useState<AffiliateLink[]>([]);
  const [globalAffiliates, setGlobalAffiliates] = useState<AffiliateLink[]>([]);

  // AI Gaming Oracle Chat Widget
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: "user" | "oracle"; text: string }[]>([
    { sender: "oracle", text: `Greetings, Traveler. I am the gamesbody Oracle. Ask me about the lore, build strategies, or secrets of '${game.title}'.` },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Collection target mapping dropdown
  const [showListSelector, setShowListSelector] = useState(false);
  const [listSelectMsg, setListSelectMsg] = useState("");

  // FreeToGame premium specifications log states
  const [freetoplayDetails, setFreetoplayDetails] = useState<{
    playUrl?: string;
    screenshots?: string[];
    systemRequirements?: {
      os?: string;
      processor?: string;
      memory?: string;
      graphics?: string;
      storage?: string;
    } | null;
  } | null>(null);
  const [ftpLoading, setFtpLoading] = useState(false);

  useEffect(() => {
    loadGameSpecificDB();
    const unsubscribe = listenToComments();
    return () => {
      unsubscribe && unsubscribe();
    };
  }, [game, currentUser]);

  useEffect(() => {
    const fetchFreeGameDetails = async () => {
      if (!game.id.startsWith("freetogame-")) {
        setFreetoplayDetails(null);
        return;
      }
      setFtpLoading(true);
      try {
        const res = await fetch(`/api/freetogame/game/${game.id}`);
        if (res.ok) {
          const data = await res.json();
          setFreetoplayDetails({
            playUrl: data.playUrl,
            screenshots: data.screenshots,
            systemRequirements: data.systemRequirements,
          });
          // Dynamically enrich game description with full detailed description
          if (data.description) {
            game.description = data.description;
          }
        }
      } catch (err) {
        console.warn("Soft warning mapping FreeToGame detailed feeds:", err);
      } finally {
        setFtpLoading(false);
      }
    };
    fetchFreeGameDetails();
  }, [game]);

  const loadGameSpecificDB = async () => {
    try {
      // 1. Check if user has favorited
      if (currentUser) {
        const favQuery = query(
          collection(db, "favorites"),
          where("userId", "==", currentUser.uid),
          where("gameId", "==", game.id)
        );
        const favSnap = await getDocs(favQuery);
        if (!favSnap.empty) {
          setIsFavorited(true);
          setFavoriteId(favSnap.docs[0].id);
        } else {
          setIsFavorited(false);
          setFavoriteId("");
        }

        // 2. Check if user rated
        const rateQuery = query(
          collection(db, "ratings"),
          where("userId", "==", currentUser.uid),
          where("gameId", "==", game.id)
        );
        const rateSnap = await getDocs(rateQuery);
        if (!rateSnap.empty) {
          setSelectedRating(rateSnap.docs[0].data().rating);
          setRatingId(rateSnap.docs[0].id);
        } else {
          setSelectedRating(null);
          setRatingId("");
        }
      }

      // 3. Compute public ratings average
      const allRatingsQuery = query(collection(db, "ratings"), where("gameId", "==", game.id));
      const allRatingsSnap = await getDocs(allRatingsQuery);
      if (!allRatingsSnap.empty) {
        let sum = 0;
        allRatingsSnap.forEach((r) => {
          sum += r.data().rating;
        });
        const calculatedAvg = Number((sum / allRatingsSnap.size).toFixed(1));
        setAverageScore(calculatedAvg);
        setTotalRatingsCount(allRatingsSnap.size);
      } else {
        setAverageScore(game.rating);
        setTotalRatingsCount(1);
      }

      // 4. Fetch Affiliate links
      const affQuery = query(collection(db, "affiliate_links"), where("gameId", "==", game.id));
      const globalQuery = query(collection(db, "affiliate_links"), where("gameId", "==", "ALL_GAMES"));
      
      const [affSnap, globalSnap] = await Promise.all([
        getDocs(affQuery),
        getDocs(globalQuery)
      ]);

      const affData: AffiliateLink[] = [];
      affSnap.forEach((d) => {
        affData.push({ id: d.id, ...d.data() } as AffiliateLink);
      });
      setAffiliates(affData);

      const globalData: AffiliateLink[] = [];
      globalSnap.forEach((d) => {
        globalData.push({ id: d.id, ...d.data() } as AffiliateLink);
      });
      setGlobalAffiliates(globalData);

    } catch (err: any) {
      console.warn("Soft warning reading dependencies:", err);
    }
  };

  const resolvedPlayUrl = useMemo(() => {
    if (affiliates.length > 0) {
      return affiliates[0].affiliateUrl;
    }
    if (globalAffiliates.length > 0) {
      return globalAffiliates[0].affiliateUrl;
    }
    return freetoplayDetails?.playUrl || null;
  }, [affiliates, globalAffiliates, freetoplayDetails]);

  const matchedAffiliate = useMemo(() => {
    if (affiliates.length > 0) {
      return affiliates[0];
    }
    if (globalAffiliates.length > 0) {
      return globalAffiliates[0];
    }
    return null;
  }, [affiliates, globalAffiliates]);

  const playButtonText = useMemo(() => {
    if (affiliates.length > 0) {
      const platformName = affiliates[0].platform.toUpperCase();
      return `PLAY NOW ON ${platformName}`;
    }
    if (globalAffiliates.length > 0) {
      const platformName = globalAffiliates[0].platform.toUpperCase();
      return `PLAY NOW (via ${platformName})`;
    }
    return "PLAY 100% FREE NOW";
  }, [affiliates, globalAffiliates]);

  // Real-time comments listener
  const listenToComments = () => {
    const q = query(collection(db, "comments"), where("gameId", "==", game.id));
    return onSnapshot(
      q,
      (snapshot) => {
        const items: Comment[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as Comment);
        });
        // Sort by dates descending
        items.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setComments(items);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, "comments");
        } catch (error) {
          console.warn("Comments snapshot subscription softly bypassed:", error);
        }
      }
    );
  };

  // Switch Favorites toggle
  const handleToggleFavorite = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    if (isFavorited) {
      // Remove
      try {
        await deleteDoc(doc(db, "favorites", favoriteId));
        setIsFavorited(false);
        setFavoriteId("");
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `favorites/${favoriteId}`);
      }
    } else {
      // Save
      const newFavId = `${currentUser.uid}_${game.id}`;
      try {
        await setDoc(doc(db, "favorites", newFavId), {
          userId: currentUser.uid,
          gameId: game.id,
          title: game.title,
          image: game.imageUrl,
          createdAt: serverTimestamp(),
        });
        setIsFavorited(true);
        setFavoriteId(newFavId);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `favorites/${newFavId}`);
      }
    }
  };

  // Handle rating submits
  const handleRateSubmit = async (score: number) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    const docId = ratingId || `${currentUser.uid}_${game.id}`;
    const payload = {
      userId: currentUser.uid,
      gameId: game.id,
      rating: score,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "ratings", docId), payload);
      setSelectedRating(score);
      setRatingId(docId);
      loadGameSpecificDB(); // Recalculate average
    } catch (err) {
      handleFirestoreError(err, ratingId ? OperationType.UPDATE : OperationType.CREATE, `ratings/${docId}`);
    }
  };

  // Write new general comments
  const handleWriteComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!commentInput.trim()) return;

    setCommentLoading(true);
    const commentId = `comment_${Date.now()}_${currentUser.uid.slice(0, 5)}`;
    try {
      const payload: Comment = {
        userId: currentUser.uid,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
        gameId: game.id,
        content: commentInput.trim(),
        likes: 0,
        likedBy: [],
        isReported: false,
        reportsCount: 0,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "comments", commentId), payload);
      setCommentInput("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `comments/${commentId}`);
    } finally {
      setCommentLoading(false);
    }
  };

  // Nested Replies submission
  const handleWriteReply = async (parentId: string) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!replyInput.trim()) return;

    setCommentLoading(true);
    const replyId = `reply_${Date.now()}_${currentUser.uid.slice(0, 5)}`;
    try {
      const payload: Comment = {
        userId: currentUser.uid,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
        gameId: game.id,
        parentId,
        content: replyInput.trim(),
        likes: 0,
        likedBy: [],
        isReported: false,
        reportsCount: 0,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "comments", replyId), payload);
      setReplyInput("");
      setActiveReplyId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `comments/${replyId}`);
    } finally {
      setCommentLoading(false);
    }
  };

  // Like comment with sets checks
  const handleLikeToggle = async (comment: Comment) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!comment.id) return;

    const liked = comment.likedBy.includes(currentUser.uid);
    let updatedLikes = comment.likes;
    let updatedLikedBy = [...comment.likedBy];

    if (liked) {
      updatedLikes = Math.max(0, updatedLikes - 1);
      updatedLikedBy = updatedLikedBy.filter((uid) => uid !== currentUser.uid);
    } else {
      updatedLikes += 1;
      updatedLikedBy.push(currentUser.uid);
    }

    try {
      await updateDoc(doc(db, "comments", comment.id), {
        likes: updatedLikes,
        likedBy: updatedLikedBy,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `comments/${comment.id}`);
    }
  };

  // Report/flag comment for moderation
  const handleReportComment = async (comment: Comment) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!comment.id) return;

    try {
      await updateDoc(doc(db, "comments", comment.id), {
        isReported: true,
        reportsCount: (comment.reportsCount || 0) + 1,
      });
      alert("Comment reported for system moderation analysis.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `comments/${comment.id}`);
    }
  };

  // Track clicks on affiliate link redirect
  const handleTrackAffiliateClick = async (link: AffiliateLink) => {
    try {
      // 1. Increment link count in affiliate_links
      if (link.id) {
        await updateDoc(doc(db, "affiliate_links", link.id), {
          clicks: increment(1),
        });
      }

      // 2. Add an click audit index in affiliate_clicks
      const clickId = `click_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await setDoc(doc(db, "affiliate_clicks", clickId), {
        userId: currentUser?.uid || "anonymous",
        gameId: game.id,
        platform: link.platform,
        clickedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn("Non-blocking analytics audit bypass:", error);
    }
  };

  // Add game to user custom list
  const handleAddToList = async (list: CustomCollectionList) => {
    if (!list.id) return;

    // Guard if game already added
    const alreadyExists = list.games.some((g) => g.id === game.id);
    if (alreadyExists) {
      setListSelectMsg("Game is already in this curated list.");
      return;
    }

    const updatedGamesList = [
      ...list.games,
      {
        id: game.id,
        title: game.title,
        imageUrl: game.imageUrl,
        rating: game.rating,
      },
    ];

    try {
      await updateDoc(doc(db, "lists", list.id), {
        games: updatedGamesList,
      });
      setListSelectMsg("Successfully synced to curated list.");
      onRefreshLists();
      setTimeout(() => setShowListSelector(false), 1500);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `lists/${list.id}`);
    }
  };

  // AI Chat Oracle execution
  const handleSendOracleMessage = async () => {
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const historyLog = chatMessages.slice(-6).map((m) => ({
        role: m.sender === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          gameTitle: game.title,
          history: historyLog,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setChatMessages((prev) => [...prev, { sender: "oracle", text: data.text }]);
    } catch (err: any) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        { sender: "oracle", text: "Oracle system link severed. Verify process key credentials." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050508]/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-6xl h-[92vh] sm:h-[85vh] max-h-[92vh] sm:max-h-[85vh] rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col my-4">
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-purple-500 opacity-80 z-20"></div>

        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b border-white/10 bg-white/5 sticky top-0 z-30 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-cyan-400 animate-pulse" />
            <h2 className="text-lg sm:text-2xl font-bold font-display tracking-tight text-white uppercase leading-none italic">
              {game.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 px-3 text-xs font-bold rounded-full bg-red-500/10 text-red-400 border border-red-500/20 hover:border-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" /> CLOSE
          </button>
        </div>

        {/* Sub grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/10 min-h-0 overflow-y-auto flex-1">
          
          {/* LEFT 2 COLS: cinematic media & forums */}
          <div className="lg:col-span-2 p-5 sm:p-6 space-y-6">
            
            {/* Cinematic Hero backdrop and Video trailer */}
            <div className="rounded-[24px] border border-white/10 overflow-hidden relative group/hero aspect-video w-full bg-[#050508]">
              {game.trailerUrl ? (
                <iframe
                  src={game.trailerUrl}
                  title={`${game.title} Trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0 absolute"
                ></iframe>
              ) : (
                <img
                  src={game.imageUrl}
                  alt={game.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover/hero:scale-105 transition-transform duration-700"
                />
              )}
            </div>

            {/* General Descriptions */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">Neural Description</h3>
              <p className="text-sm sm:text-base text-gray-300 leading-relaxed font-sans">{game.description}</p>
            </div>

            {/* Specifications Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl border border-white/10 bg-white/5">
              <div>
                <span className="block text-[10px] uppercase font-mono text-gray-400">Release Date</span>
                <span className="text-xs font-semibold text-gray-200">{game.releaseDate}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-mono text-gray-400">Developers</span>
                <span className="text-xs font-semibold text-cyan-400">{game.developers.join(", ")}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-mono text-gray-400">Publishers</span>
                <span className="text-xs font-semibold text-gray-200">{game.publishers.join(", ")}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-mono text-gray-400">Platforms</span>
                <span className="text-xs font-semibold text-gray-200">{game.platforms.join(", ")}</span>
              </div>
            </div>

            {/* FreeToGame Screenshots Feed */}
            {freetoplayDetails?.screenshots && freetoplayDetails.screenshots.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">Neural Live Feed Screenshots ({freetoplayDetails.screenshots.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {freetoplayDetails.screenshots.slice(0, 3).map((src, idx) => (
                    <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 group bg-slate-950 shadow-lg">
                      <img src={src} alt="Live Gameplay feed" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FreeToGame Target System specs */}
            {freetoplayDetails?.systemRequirements && (
              <div className="p-5 rounded-[24px] border border-white/10 bg-white/5 space-y-4">
                <h4 className="text-xs uppercase font-mono text-cyan-400 font-bold tracking-widest flex items-center gap-1.5 leading-none italic">
                  <Shield className="w-4 h-4 text-cyan-400" /> SYSTEM HARDWARE INDEX PROTOCOLS
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs font-mono">
                  {freetoplayDetails.systemRequirements.os && (
                    <div>
                      <span className="text-gray-500 uppercase block text-[9px] mb-0.5">Operating System</span>
                      <span className="text-gray-300 font-bold">{freetoplayDetails.systemRequirements.os}</span>
                    </div>
                  )}
                  {freetoplayDetails.systemRequirements.processor && (
                    <div>
                      <span className="text-gray-500 uppercase block text-[9px] mb-0.5">Processor CPU</span>
                      <span className="text-gray-300 font-bold">{freetoplayDetails.systemRequirements.processor}</span>
                    </div>
                  )}
                  {freetoplayDetails.systemRequirements.memory && (
                    <div>
                      <span className="text-gray-500 uppercase block text-[9px] mb-0.5">Memory RAM</span>
                      <span className="text-gray-300 font-bold">{freetoplayDetails.systemRequirements.memory}</span>
                    </div>
                  )}
                  {freetoplayDetails.systemRequirements.graphics && (
                    <div>
                      <span className="text-gray-500 uppercase block text-[9px] mb-0.5">Graphics GPU</span>
                      <span className="text-cyan-400 font-bold">{freetoplayDetails.systemRequirements.graphics}</span>
                    </div>
                  )}
                  {freetoplayDetails.systemRequirements.storage && (
                    <div>
                      <span className="text-gray-500 uppercase block text-[9px] mb-0.5">Storage Space Required</span>
                      <span className="text-gray-300 font-bold">{freetoplayDetails.systemRequirements.storage}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Forums boards */}
            <div className="space-y-4">
              <h3 className="text-base font-bold font-display text-white uppercase tracking-wider flex items-center gap-2 italic">
                <MessageSquare className="w-5 h-5 text-cyan-400" /> Core discussion board ({comments.length})
              </h3>

              {/* Add comment Form */}
              {currentUser ? (
                <form onSubmit={handleWriteComment} className="flex gap-2">
                  <input
                    id="modal-discussion-input"
                    type="text"
                    required
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    aria-label="Enter discussion post or game review text"
                    placeholder="Enter discussion post or game review..."
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-full text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans placeholder-gray-500"
                  />
                  <button
                    type="submit"
                    disabled={commentLoading}
                    className="px-6 py-2.5 rounded-full bg-white text-black font-extrabold text-xs uppercase hover:bg-cyan-400 active:scale-95 transition-all cursor-pointer shadow-md"
                  >
                    Submit
                  </button>
                </form>
              ) : (
                <div className="p-4 rounded-2xl border border-white/10 bg-white/5 flex justify-between items-center">
                  <span className="text-xs text-gray-400 font-mono">Sign in to add a review, like posts, or post replies!</span>
                  <button
                    onClick={onOpenAuth}
                    className="px-5 py-2 bg-white text-black font-black text-xs rounded-full uppercase cursor-pointer hover:bg-cyan-400 transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Lists of comments and responses */}
              <div className="space-y-4 overflow-y-auto max-h-96 pr-2">
                {comments.filter((c) => !c.parentId).length === 0 ? (
                  <p className="text-xs text-gray-500 italic font-mono py-4 text-center">No discussions catalogued here. Start the logs!</p>
                ) : (
                  comments
                    .filter((c) => !c.parentId) // Only parent comments
                    .map((comment) => {
                      const commentReplies = comments.filter((r) => r.parentId === comment.id);
                      return (
                        <div key={comment.id} className="p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition-all space-y-3">
                          
                           {/* User Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={comment.avatarUrl}
                                alt={`${comment.username || 'User'}'s character avatar`}
                                loading="lazy"
                                decoding="async"
                                className="w-7 h-7 rounded-lg object-cover border border-white/10"
                                referrerPolicy="no-referrer"
                              />
                              <span className="font-bold text-xs text-gray-200">{comment.username}</span>
                            </div>
                            <span className="text-[9px] font-mono text-gray-500">
                              {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleDateString() : "Database synchronized"}
                            </span>
                          </div>

                          {/* Content */}
                          <p className="text-sm font-sans text-gray-300 leading-relaxed pl-1">{comment.content}</p>

                          {/* Comment toolbar interface */}
                          <div className="flex items-center gap-4 text-xs font-mono text-gray-400 pl-1">
                            <button
                              onClick={() => handleLikeToggle(comment)}
                              aria-label="Toggle helpful support like vote"
                              className={`flex items-center gap-1 transition-colors hover:text-cyan-400 cursor-pointer ${
                                comment.likedBy.includes(currentUser?.uid || "") ? "text-cyan-400" : ""
                              }`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              {comment.likes || 0}
                            </button>

                            <button
                              onClick={() => {
                                if (!currentUser) onOpenAuth();
                                else setActiveReplyId(comment.id || null);
                              }}
                              aria-label="Reply to comment write dialogue"
                              className="hover:text-white transition-colors cursor-pointer"
                            >
                              Reply
                            </button>

                            <button
                              onClick={() => handleReportComment(comment)}
                              className="text-red-500/40 hover:text-red-500 transition-colors cursor-pointer flex items-center gap-0.5"
                              title="Flag comment as spam"
                              aria-label="Flag comment containing spam content"
                            >
                              <AlertOctagon className="w-3 h-3" />
                              Report
                            </button>
                          </div>

                          {/* Reply submission box */}
                          {activeReplyId === comment.id && (
                            <div className="flex gap-2 pl-4 border-l border-white/10 pt-2">
                              <input
                                type="text"
                                required
                                value={replyInput}
                                onChange={(e) => setReplyInput(e.target.value)}
                                aria-label="Write a direct nested comment response"
                                placeholder="Enter reply..."
                                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-full text-xs text-white focus:outline-none"
                              />
                              <button
                                onClick={() => comment.id && handleWriteReply(comment.id)}
                                className="px-4 py-1.5 bg-cyan-950/20 text-cyan-400 border border-cyan-400/30 rounded-full text-xs font-extrabold hover:bg-cyan-400 hover:text-black transition-colors"
                              >
                                Post
                              </button>
                            </div>
                          )}

                          {/* List of Replies */}
                          {commentReplies.map((reply) => (
                            <div key={reply.id} className="pl-6 border-l border-white/10 pt-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={reply.avatarUrl}
                                    alt={`${reply.username || 'User'}'s reply avatar`}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-5 h-5 rounded-md object-cover border border-white/5"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="font-bold text-[11px] text-gray-300">{reply.username}</span>
                                </div>
                                <span className="text-[8px] font-mono text-gray-500">
                                  {reply.createdAt?.toDate ? reply.createdAt.toDate().toLocaleDateString() : ""}
                                </span>
                              </div>
                              <p className="text-xs font-sans text-gray-400">{reply.content}</p>
                            </div>
                          ))}

                        </div>
                      );
                    })
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COL: custom ratings, favorites, affiliate buy links, chatbot */}
          <div className="p-5 sm:p-6 space-y-6">
            
            {/* Quick Action Favorites & Collections */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleToggleFavorite}
                className={`w-full py-3.5 rounded-full border font-bold text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isFavorited
                    ? "bg-red-500/10 border-red-500/30 text-red-500"
                    : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />
                {isFavorited ? "Favorited in Matrix" : "Add to Favorites"}
              </button>

              <div className="relative">
                <button
                  onClick={() => {
                    if (!currentUser) onOpenAuth();
                    else setShowListSelector(!showListSelector);
                  }}
                  className="w-full py-2.5 rounded-full border border-white/10 bg-white/5 text-xs font-semibold uppercase text-gray-300 hover:bg-white/10 cursor-pointer"
                >
                  Modify Lists / Curate List
                </button>

                {showListSelector && (
                  <div className="absolute top-12 left-0 right-0 p-3 bg-[#0c0d12] border border-white/10 rounded-2xl z-40 shadow-2xl space-y-2 max-h-48 overflow-y-auto backdrop-blur-xl">
                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest border-b border-white/10 pb-1.5 mb-2">My Playlists</p>
                    
                    {listSelectMsg && (
                      <p className="text-[10px] font-mono bg-cyan-950/40 p-1.5 rounded border border-cyan-400/20 text-cyan-400">{listSelectMsg}</p>
                    )}

                    {userLists.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No custom list found. Back out of parameters to build list.</p>
                    ) : (
                      userLists.map((list) => {
                        const inList = list.games.some((g) => g.id === game.id);
                        return (
                          <button
                            key={list.id}
                            onClick={() => handleAddToList(list)}
                            disabled={inList}
                            className={`w-full text-left p-1.5 rounded-lg text-xs font-semibold block truncate cursor-pointer ${
                              inList ? "text-gray-500" : "text-gray-200 hover:bg-white/5"
                            }`}
                          >
                            + {list.title} {inList ? "(synced)" : ""}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Ratings Sliders & distribution analytics */}
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-sm font-bold uppercase tracking-wider font-display text-white italic">Citizen Ratings</span>
                <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                  <Star className="w-4 h-4 text-amber-500 fill-current" />
                  <span className="font-mono text-sm font-extrabold text-cyan-400">{averageScore}</span>
                  <span className="text-[10px] text-gray-500 font-mono">({totalRatingsCount})</span>
                </div>
              </div>

              {/* Slider / Numbers row */}
              <div>
                <p className="text-[10px] uppercase font-mono text-gray-400 mb-2">Assign Score Rating (1 - 10)</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <button
                      key={score}
                      onClick={() => handleRateSubmit(score)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                        selectedRating === score
                          ? "bg-white border-white text-black shadow-md"
                          : "bg-white/5 border-white/10 text-gray-400 hover:border-cyan-400/40 hover:text-white"
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Merchant custom links list */}
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4">
              <h4 className="text-xs uppercase font-mono tracking-wider text-gray-400 pb-2 border-b border-white/10 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Affiliate Checkout Outlets
              </h4>

               <div className="space-y-2">
                {resolvedPlayUrl && (
                  <a
                    href={resolvedPlayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => matchedAffiliate && handleTrackAffiliateClick(matchedAffiliate)}
                    className="flex items-center justify-between p-4.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-purple-500 font-black text-black text-xs uppercase hover:scale-[1.02] transition-transform shadow-lg cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 font-display text-black font-extrabold tracking-tight">
                      <Gamepad2 className="w-4 h-4 animate-bounce" /> {playButtonText}
                    </span>
                    <ExternalLink className="w-4 h-4 text-black font-extrabold" />
                  </a>
                )}

                {affiliates.length === 0 && globalAffiliates.length === 0 ? (
                  <div className="text-center py-4 border border-dashed border-white/10 rounded-2xl bg-white/5">
                    <p className="text-[10px] font-mono text-gray-500 select-none">No active affiliate linkages synced.</p>
                  </div>
                ) : (
                  <>
                    {affiliates.map((aff) => (
                      <a
                        key={aff.id}
                        href={aff.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleTrackAffiliateClick(aff)}
                        className="flex items-center justify-between p-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 hover:bg-cyan-400/10 transition-all cursor-pointer"
                      >
                        <span className="text-xs font-bold text-white uppercase font-display leading-none">
                          Buy/Play on {aff.platform} (Direct Outlet)
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                      </a>
                    ))}
                    {globalAffiliates.map((aff) => {
                      // Avoid showing duplicate platforms if a specific one already exists to keep UI pristine
                      const hasSpecificDuplicate = affiliates.some((a) => a.platform === aff.platform);
                      if (hasSpecificDuplicate) return null;

                      return (
                        <a
                          key={aff.id}
                          href={aff.affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleTrackAffiliateClick(aff)}
                          className="flex items-center justify-between p-3 rounded-2xl border border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 transition-all cursor-pointer"
                        >
                          <span className="text-xs font-bold text-white uppercase font-display leading-none text-teal-300">
                            Buy/Play on {aff.platform} (Universal Outlet)
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
                        </a>
                      );
                    })}
                  </>
                )}
                
                {/* Free Static fallbacks if no admin provided affiliate url to guarantee buys buttons */}
                <a
                  href="https://store.steampowered.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-xs font-mono text-gray-400"
                >
                  <span>Search Steam Marketplace</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Smart Oracle chatbot drawer */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-lg">
              <button
                onClick={() => setAiChatOpen(!aiChatOpen)}
                className="w-full p-4 bg-white/5 flex justify-between items-center border-b border-white/10 outline-none text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <div>
                    <span className="text-xs font-mono text-gray-400 block tracking-widest leading-none">gamesbody AI</span>
                    <span className="text-sm font-bold font-display uppercase tracking-wide text-white">Gaming Lore Oracle</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-cyan-400 uppercase bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                  {aiChatOpen ? "MINIMIZE" : "ENGAGE AI"}
                </span>
              </button>

              {aiChatOpen && (
                <div className="p-4 bg-[#050508]/80 backdrop-blur-xl flex flex-col gap-3 h-96">
                  
                  {/* Message stack */}
                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl line-clamp-none break-words leading-relaxed max-w-[90%] font-sans ${
                          msg.sender === "user"
                            ? "bg-white/10 rounded-tr-none border border-white/10 ml-auto text-cyan-100"
                            : "bg-white/5 rounded-tl-none border border-white/5 text-gray-300"
                        }`}
                      >
                        <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="p-3.5 rounded-2xl bg-[#050508]/60 font-mono text-[10px] text-cyan-400 animate-pulse flex items-center gap-1.5 h-10 border border-white/10">
                        <span className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
                        Channeling cosmic lore vectors...
                      </div>
                    )}
                  </div>

                  {/* Input controls */}
                  <div className="flex gap-2 mt-2 border-t border-white/10 pt-3">
                    <input
                      id="modal-oracle-chat-input"
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendOracleMessage()}
                      aria-label="Ask oracle helper chat input query"
                      placeholder="Ask oracle helper..."
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs text-white focus:outline-none"
                    />
                    <button
                      onClick={handleSendOracleMessage}
                      disabled={chatLoading}
                      className="px-4 py-2 bg-white text-black hover:bg-cyan-400 hover:text-black transition-all rounded-full text-xs font-extrabold font-display uppercase cursor-pointer"
                    >
                      Query
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
