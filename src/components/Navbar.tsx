import React, { useState } from "react";
import { Gamepad2, User, LogOut, Bell, Shield, Menu, X, PlusCircle } from "lucide-react";
import { UserProfile } from "../types";

interface NavbarProps {
  userProfile: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  currentView: string;
  setView: (view: string) => void;
  onOpenCreateList: () => void;
}

export default function Navbar({
  userProfile,
  onOpenAuth,
  onLogout,
  currentView,
  setView,
  onOpenCreateList,
}: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // High fidelity notifications log stored in local memory or simulated
  const notifications = [
    { id: 1, text: "Welcome to gamesbody. Start exploring game worlds!", time: "Just now" },
    { id: 2, text: "System Update: Dark Space and Cyberware channels online.", time: "1 hour ago" },
    { id: 3, text: "Become an admin? Log in using: thefeedbuzz.store@gmail.com", time: "System Notice" }
  ];

  return (
    <nav className="sticky top-0 z-40 w-full bg-[#050508]/60 border-b border-white/10 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => setView("home")}>
            <div className="relative p-2 bg-gradient-to-tr from-cyan-400 to-purple-500 rounded-lg text-black shadow-lg">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-400 block leading-none font-sans uppercase">
                GAMESBODY
              </span>
              <p className="text-[8px] font-mono tracking-widest text-cyan-400 uppercase mt-0.5">GAMER PORTAL</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-3.5 lg:gap-5 xl:gap-6">
            <a
              id="nav-home"
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setView("home");
              }}
              className={`text-xs xl:text-sm font-bold tracking-wide transition-all cursor-pointer pb-1 ${
                currentView === "home" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-gray-400 hover:text-white"
              }`}
            >
              Discover
            </a>
            <a
              id="nav-favorites"
              href="/?view=favorites"
              onClick={(e) => {
                e.preventDefault();
                if (!userProfile) {
                  onOpenAuth();
                } else {
                  setView("favorites");
                }
              }}
              className={`text-xs xl:text-sm font-bold tracking-wide transition-all cursor-pointer pb-1 ${
                currentView === "favorites" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-gray-400 hover:text-white"
              }`}
            >
              Favorites
            </a>
            <a
              id="nav-lists"
              href="/?view=lists"
              onClick={(e) => {
                e.preventDefault();
                setView("lists");
              }}
              className={`text-xs xl:text-sm font-bold tracking-wide transition-all cursor-pointer pb-1 ${
                currentView === "lists" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-gray-400 hover:text-white"
              }`}
            >
              Playlists
            </a>
            <a
              id="nav-free-games"
              href="/?view=free-games"
              onClick={(e) => {
                e.preventDefault();
                setView("free-games");
              }}
              className={`text-xs xl:text-sm font-bold tracking-wide transition-all cursor-pointer pb-1 sm:block ${
                currentView === "free-games" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-gray-400 hover:text-white"
              }`}
            >
              Free Games
            </a>
            <a
              id="nav-deals"
              href="/?view=deals"
              onClick={(e) => {
                e.preventDefault();
                setView("deals");
              }}
              className={`text-xs xl:text-sm font-bold tracking-wide transition-all cursor-pointer pb-1 sm:block ${
                currentView === "deals" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-gray-400 hover:text-white"
              }`}
            >
              Deals
            </a>
            <a
              id="nav-ai-report"
              href="/?view=ai-report"
              onClick={(e) => {
                e.preventDefault();
                setView("ai-report");
              }}
              className={`text-xs xl:text-sm font-bold tracking-wide transition-all cursor-pointer pb-1 sm:block ${
                currentView === "ai-report" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-gray-400 hover:text-white"
              }`}
            >
              AI Analyzer
            </a>
            {userProfile && (
              <button
                id="create-collection-btn"
                onClick={onOpenCreateList}
                className="flex items-center gap-1.5 px-3 py-1.5 xl:px-3.5 xl:py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                Build List
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {/* Admin Quick Entry */}
            {userProfile?.role === "admin" && (
              <button
                id="admin-dashboard-btn"
                onClick={() => setView("admin")}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 font-mono text-xs hover:bg-red-500/20 transition-all uppercase tracking-wider animate-pulse cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-red-400" />
                SYSTEM DASHBOARD
              </button>
            )}

            {/* Notifications Button */}
            <div className="relative">
              <button
                id="notifications-toggle"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-cyan-400 hover:bg-white/10 transition-all cursor-pointer"
                aria-label="Toggle notifications menu"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-[#050508]"></span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl bg-[#050508]/90 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-3">
                  <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <span className="text-xs font-bold uppercase tracking-wider text-white font-display">Neural Notifications</span>
                    <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-white" aria-label="Close notifications">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-3.5 hover:bg-white/5 transition-colors">
                        <p className="text-xs text-gray-300 line-clamp-2">{n.text}</p>
                        <span className="text-[10px] font-mono text-cyan-400 mt-1 block">{n.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Authentication Profiles */}
            {userProfile ? (
              <div className="flex items-center gap-3 pl-3 border-l border-white/15">
                <img
                  src={userProfile.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                  alt={userProfile.username}
                  className="w-10 h-10 rounded-xl border border-white/10 object-cover shadow-md"
                />
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-bold text-gray-200 leading-tight">{userProfile.username}</p>
                  <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{userProfile.role}</p>
                </div>
                <button
                  id="navbar-logout-btn"
                  onClick={onLogout}
                  className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/25 transition-all cursor-pointer"
                  title="Logout Core"
                  aria-label="Log out user profile session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="navbar-signin-btn"
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-black hover:bg-cyan-400 transition-colors tracking-wide text-xs cursor-pointer shadow-lg active:scale-95 uppercase"
              >
                <User className="w-4 h-4" />
                Access Terminal
              </button>
            )}
          </div>

          {/* Mobile Menu Toggler */}
          <div className="flex md:hidden items-center gap-3">
            {userProfile?.role === "admin" && (
              <button
                onClick={() => setView("admin")}
                className="p-2 rounded-lg border border-red-500/30 text-red-500 animate-pulse"
                aria-label="Open administration dashboard console"
              >
                <Shield className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg border border-[#1f2833]/60 bg-[#0e1219] text-gray-400 hover:text-white"
              aria-label="Toggle responsive navigation controls"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#050508]/90 border-b border-white/10 backdrop-blur-xl py-4 px-4 space-y-3 relative z-50">
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); setView("home"); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold ${
              currentView === "home" ? "bg-white/10 text-cyan-400" : "text-gray-300 hover:bg-white/5"
            }`}
          >
            Discover Games
          </a>
          <a
            href="/?view=favorites"
            onClick={(e) => {
              e.preventDefault();
              setMobileMenuOpen(false);
              if (!userProfile) onOpenAuth();
              else setView("favorites");
            }}
            className={`block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold ${
              currentView === "favorites" ? "bg-white/10 text-cyan-400" : "text-gray-300 hover:bg-white/5"
            }`}
          >
            My Favorites
          </a>
          <a
            href="/?view=lists"
            onClick={(e) => { e.preventDefault(); setView("lists"); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold ${
              currentView === "lists" ? "bg-white/10 text-cyan-400" : "text-gray-300 hover:bg-white/5"
            }`}
          >
            Curated Lists
          </a>
          <a
            href="/?view=free-games"
            onClick={(e) => { e.preventDefault(); setView("free-games"); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold ${
              currentView === "free-games" ? "bg-white/10 text-cyan-400" : "text-gray-300 hover:bg-white/5"
            }`}
          >
            Free Live Games
          </a>
          <a
            href="/?view=deals"
            onClick={(e) => { e.preventDefault(); setView("deals"); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold ${
              currentView === "deals" ? "bg-white/10 text-cyan-400" : "text-gray-300 hover:bg-white/5"
            }`}
          >
            Game Deals & Discounts
          </a>
          <a
            href="/?view=ai-report"
            onClick={(e) => { e.preventDefault(); setView("ai-report"); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold ${
              currentView === "ai-report" ? "bg-white/10 text-cyan-400" : "text-gray-300 hover:bg-white/5"
            }`}
          >
            AI Analytics Report
          </a>
          
          {userProfile && (
            <button
              onClick={() => { onOpenCreateList(); setMobileMenuOpen(false); }}
              className="flex items-center gap-2 w-full py-2 px-3 rounded-lg text-sm font-semibold text-white bg-white/10 border border-white/10"
            >
              <PlusCircle className="w-4 h-4 text-cyan-400" />
              Build Collection List
            </button>
          )}

          <div className="pt-4 border-t border-white/10">
            {userProfile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.username}
                    className="w-10 h-10 rounded-lg object-cover border border-white/10"
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-200 leading-tight">{userProfile.username}</p>
                    <p className="text-[10px] font-mono text-gray-400 capitalize">{userProfile.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => { onOpenAuth(); setMobileMenuOpen(false); }}
                className="w-full text-center py-2.5 rounded-lg bg-white text-black font-black text-sm uppercase"
              >
                Access Terminal
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
