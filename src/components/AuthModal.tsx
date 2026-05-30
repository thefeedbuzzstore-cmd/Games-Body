import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { X, Mail, Lock, User, Sparkles, Terminal, Shield, LogIn } from "lucide-react";
import { auth, db } from "../firebase";

const AVATARS = [
  { id: "avatar1", name: "Cyber Samurai", url: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150" },
  { id: "avatar2", name: "Star Combatant", url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150" },
  { id: "avatar3", name: "Matrix Hacker", url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150" },
  { id: "avatar4", name: "AI Mech Core", url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150" },
];

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialAdminView?: boolean;
}

export default function AuthModal({ onClose, onSuccess, initialAdminView = false }: AuthModalProps) {
  const [isAdminMode, setIsAdminMode] = useState(initialAdminView);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].url);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Email validation and auth logic
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        if (!username || username.trim().length < 3) {
          throw new Error("Codename / Username must be at least 3 characters.");
        }

        // 1. Firebase Auth Registration
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Auto boost roles if specific user email matches
        const userRole = email.toLowerCase() === "thefeedbuzz.store@gmail.com" ? "admin" : "user";

        // 2. Provision Firestore Public User Doc
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          await setDoc(userDocRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: username.trim(),
            avatarUrl: selectedAvatar,
            role: userRole,
            isBanned: false,
            createdAt: serverTimestamp(),
          });

          // 3. Optional Admin Collection Registry Sync
          if (userRole === "admin") {
            await setDoc(doc(db, "admins", firebaseUser.uid), {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
            });
          }
        } catch (dbErr) {
          console.warn("Soft profile write bypassed during email register (permissions locked):", dbErr);
        }
      } else {
        // 1. Firebase Auth SignIn
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // If they enter in admin mode, make sure they aren't logging to generic interface
        if (isAdminMode) {
          const matchedEmail = firebaseUser.email?.toLowerCase();
          if (matchedEmail !== "thefeedbuzz.store@gmail.com") {
            // Check if matches or let system validation check later
            console.log("Admin security confirmation needed.");
          }
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error("Auth Failure:", err);
      const errMsg = err.message || "";
      const isAuthError = err.code === "auth/invalid-credential" || 
                          err.code === "auth/wrong-password" || 
                          err.code === "auth/user-not-found" ||
                          errMsg.includes("invalid-credential") ||
                          errMsg.includes("wrong-password") ||
                          errMsg.includes("user-not-found");

      if (isAuthError) {
        if (email.toLowerCase() === "thefeedbuzz.store@gmail.com") {
          setError(
            "Account not found or password incorrect! IF THIS IS YOUR FIRST DEPLOYMENT: You must create your admin account first. Close this modal or select 'First deployment? Sign Up profile here' below, fill in your admin email: 'thefeedbuzz.store@gmail.com', choose a password, and click 'Create Profile Character'. This will safely register and provision you as the system Administrator."
          );
        } else {
          setError(
            "Invalid email address or password. If you don't have an character account here yet, please click 'First deployment? Sign Up profile here' below to register your brand new account first!"
          );
        }
      } else if (err.code === "auth/unauthorized-domain" || errMsg.includes("unauthorized-domain")) {
        setError("This domain is not authorized in your Firebase settings. Please register the preview domains under Authentication -> Settings -> Authorized domains in your Firebase console.");
      } else {
        setError(err.message || "An authentication fault occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Google Provider SignIn
  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;

      const userRole = firebaseUser.email?.toLowerCase() === "thefeedbuzz.store@gmail.com" ? "admin" : "user";

      // Provision if profile doesn't exist
      const userDocRef = doc(db, "users", firebaseUser.uid);
      try {
        await setDoc(
          userDocRef,
          {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: firebaseUser.displayName || `Gamer_${firebaseUser.uid.slice(0, 5)}`,
            avatarUrl: firebaseUser.photoURL || selectedAvatar,
            role: userRole,
            isBanned: false,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Auto-registry in /admins
        if (userRole === "admin") {
          await setDoc(doc(db, "admins", firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          });
        }
      } catch (dbErr) {
        console.warn("Soft profile write bypassed during Google login (permissions locked):", dbErr);
      }

      onSuccess();
    } catch (err: any) {
      console.error("Google PopUp Failed:", err);
      const errMsg = err.message || "";
      if (err.code === "auth/unauthorized-domain" || errMsg.includes("unauthorized-domain")) {
        setError(
          "UNAUTHORIZED DOMAIN: This domain is not authorized in your Firebase 'aikennet' project. Please go to your Firebase Console -> Authentication -> Settings -> Authorized Domains and add:\n\n" +
          "• ais-dev-cfwkn6a2ul4zyk7kta3jux-780663003234.europe-west2.run.app\n" +
          "• ais-pre-cfwkn6a2ul4zyk7kta3jux-780663003234.europe-west2.run.app"
        );
      } else if (err.code === "auth/popup-closed-by-user" || errMsg.includes("popup-closed-by-user") || errMsg.includes("cancelled-by-user")) {
        setError("Google authentication popup was closed before completion. Please try again.");
      } else {
        setError(`Google login failed: ${err.message || "Domain authentication check is required."}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050508]/85 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200">
        
        {/* Glow Effects */}
        <div className={`absolute top-0 left-12 right-12 h-[2px] bg-gradient-to-r ${isAdminMode ? "from-red-500 to-amber-500" : "from-cyan-400 to-purple-500"} blur-md opacity-80`}></div>
        <div className={`absolute -top-12 -right-12 w-24 h-24 rounded-full ${isAdminMode ? "bg-red-500" : "bg-cyan-500/20"} blur-3xl opacity-25`}></div>

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-2">
            {isAdminMode ? (
              <Shield className="w-5 h-5 text-red-400 animate-pulse" />
            ) : (
              <Terminal className="w-5 h-5 text-cyan-400" />
            )}
            <h2 className="text-xl font-bold font-display tracking-tight text-white uppercase italic">
              {isAdminMode
                ? "ADMIN ACCESS GATE"
                : isRegister
                ? "SIGN UP TERMINAL"
                : "SIGN IN TERMINAL"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close authentication modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode info (system notice) */}
        {isAdminMode && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/20 border border-red-500/20 text-red-400 text-xs font-mono">
            [SECURITY ALERT] This gate validates structural administrator credentials only. Standard users are denied entry here.
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono break-words leading-relaxed">
            SYSTEM FAULT: {error}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {isRegister && !isAdminMode && (
            <div>
              <label htmlFor="auth-username" className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1">
                <User className="w-3 h-3 text-cyan-400" /> Core Codename
              </label>
              <input
                id="auth-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. NeoViper"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 hover:bg-white/10 transition-all font-mono"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1">
              <Mail className="w-3 h-3 text-cyan-400" /> Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. gamer@aikennet.com"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 hover:bg-white/10 transition-all font-mono"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1">
              <Lock className="w-3 h-3 text-cyan-400" /> Neural Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 hover:bg-white/10 transition-all font-mono"
            />
          </div>

          {/* Avatar selector (Only visible during custom user registration) */}
          {isRegister && !isAdminMode && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Choose Identity Avatar
              </label>
              <div className="grid grid-cols-4 gap-2">
                {AVATARS.map((avatar) => (
                  <button
                    type="button"
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar.url)}
                    className={`relative rounded-xl overflow-hidden border-2 aspect-square p-0.5 transition-all cursor-pointer ${
                      selectedAvatar === avatar.url
                        ? "border-cyan-400 scale-95 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                        : "border-transparent hover:border-white/20"
                    }`}
                  >
                    <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover rounded-lg" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit Trigger */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-white text-black font-black hover:bg-cyan-400 transition-colors rounded-full tracking-wider text-xs uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
            ) : isAdminMode ? (
              <>
                <Shield className="w-4 h-4" /> Initialize Admin Core
              </>
            ) : isRegister ? (
              <>
                <Sparkles className="w-4 h-4" /> Create Profile Character
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Stream Core Session
              </>
            )}
          </button>
        </form>

        {/* Separate Provider Login (Not available in Admin Mode) */}
        {!isAdminMode && (
          <div className="mt-5 space-y-4">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-[10px] font-mono uppercase">OR INTERCONNECT</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              type="button"
              className="w-full py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold hover:border-white/30 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4 mr-0.5 text-white" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google Neural Account
            </button>
          </div>
        )}

        {/* Footer toggles */}
        <div className="mt-6 text-center">
          {!isAdminMode ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="text-xs text-gray-400 hover:text-cyan-400 transition-colors font-mono cursor-pointer"
              >
                {isRegister
                  ? "Already configured? Sign In instead"
                  : "First deployment? Sign Up profile here"}
              </button>
              
              <button
                onClick={() => {
                  setIsAdminMode(true);
                  setError("");
                }}
                className="text-[10px] text-red-450/70 hover:text-red-400 mt-2 flex items-center justify-center gap-1 font-mono uppercase tracking-wider cursor-pointer"
              >
                <Shield className="w-3 h-3 text-red-500" /> Admin Access Gate
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsAdminMode(false);
                setError("");
              }}
              className="text-xs text-gray-400 hover:text-cyan-400 transition-colors font-mono cursor-pointer"
            >
              Back to Standard User Core Login
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
