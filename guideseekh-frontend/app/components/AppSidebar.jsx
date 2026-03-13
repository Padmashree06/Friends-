"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, MessageSquare, GraduationCap, User, LogOut, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ACCENT = "#FF5500";

const NAV = [
  { href: "/Dashboard", label: "Dashboard",  Icon: LayoutGrid,    matchPath: "/dashboard" },
  { href: "/chat",      label: "Chat",        Icon: MessageSquare, matchPath: "/chat" },
  { href: "/quiz",      label: "Quiz",        Icon: GraduationCap, matchPath: "/quiz" },
  { href: "/Profile",   label: "Profile",     Icon: User,          matchPath: "/profile" },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  // Read localStorage synchronously on first render (safe — this is a Client Component)
  const [username]  = useState(() => (typeof window !== "undefined" ? localStorage.getItem("username")  || "" : ""));
  const [userEmail] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("userEmail") || "" : ""));
  const [showProfile, setShowProfile] = useState(false);

  const initials = username ? username.charAt(0).toUpperCase() : "K";

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    router.push("/");
  };

  return (
    <aside className="hidden md:flex w-[260px] flex-col h-screen sticky top-0 flex-shrink-0 bg-[#0c0c0c] border-r border-white/[0.07] shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
      <div className="flex flex-col h-full">

        {/* Top nav */}
        <div className="p-3 flex flex-col gap-0.5">
          {NAV.map(({ href, label, Icon, matchPath }) => {
            const active = matchPath ? pathname?.toLowerCase().startsWith(matchPath) : false;
            return (
              <Link key={label} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border border-transparent ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200 hover:border-white/5"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-[#FF5500]" : ""}`} />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Profile popover */}
        <div className="relative">
          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute bottom-full left-3 right-3 mb-2 bg-[#141414] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Info */}
                <div className="px-4 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                      style={{ background: `linear-gradient(135deg, ${ACCENT}, oklch(50% 0.15 30))` }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{username || "User"}</p>
                      <p className="text-xs text-gray-500 truncate">{userEmail || "No email"}</p>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="p-2">
                  <button onClick={() => { setShowProfile(false); router.push("/Profile"); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:bg-white/5 hover:text-white transition text-left">
                    <User className="w-4 h-4" /> View Profile
                  </button>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-left">
                    <LogOut className="w-4 h-4" /> Log out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trigger */}
          <button onClick={() => setShowProfile(p => !p)}
            className="w-full p-4 border-t border-white/[0.06] flex items-center gap-3 hover:bg-white/[0.03] transition">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, oklch(50% 0.15 30))` }}>
              {initials}
            </div>
            <span className="flex-1 text-sm font-medium text-gray-200 text-left truncate">{username || "Account"}</span>
            <ChevronUp className={`w-4 h-4 text-gray-500 transition-transform ${showProfile ? "" : "rotate-180"}`} />
          </button>
        </div>

      </div>
    </aside>
  );
}
