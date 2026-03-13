"use client";
import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Hash, LogOut, Shield } from "lucide-react";
import { motion } from "framer-motion";
import AppSidebar from "../components/AppSidebar";

const A = "oklch(64.6% 0.222 41.116)";
const ACCENT = "#FF5500";

export default function ProfilePage() {
  const router = useRouter();

  // Read localStorage synchronously to avoid flash
  const [username]  = useState(() => (typeof window !== "undefined" ? localStorage.getItem("username")  || "" : ""));
  const [userEmail] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("userEmail") || "" : ""));
  const [userId]    = useState(() => (typeof window !== "undefined" ? localStorage.getItem("userId")    || "" : ""));

  const initials = username ? username.charAt(0).toUpperCase() : "K";

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    router.push("/");
  };

  return (
    <div className="min-h-screen text-white flex bg-black">
      <AppSidebar />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 sticky top-0 z-10 bg-[#0c0c0c]/90 border-b border-white/[0.07] backdrop-blur-xl">
          <span className="text-lg font-bold text-white">Profile</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-2xl">
          <h1 className="text-4xl font-black mb-8 text-white">Profile</h1>

          {/* Avatar card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="rounded-2xl p-6 mb-6 flex items-center gap-5"
            style={{ background: "oklch(10% 0 0)", border: "1px solid oklch(18% 0 0)" }}
          >
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-xl"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, oklch(50% 0.15 30))` }}>
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{username || "User"}</h2>
              <p className="text-sm mt-0.5" style={{ color: "oklch(55% 0 0)" }}>{userEmail || "No email set"}</p>
              <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: `oklch(57.7% 0.245 27.325 / 0.12)`, color: A }}>
                <Shield className="w-3 h-3" /> Active account
              </span>
            </div>
          </motion.div>

          {/* Info fields */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "oklch(10% 0 0)", border: "1px solid oklch(18% 0 0)" }}
          >
            <div className="px-6 py-4" style={{ borderBottom: "1px solid oklch(15% 0 0)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "oklch(60% 0 0)" }}>Account Details</h3>
            </div>

            {[
              { icon: <User className="w-4 h-4" />,  label: "Username", value: username || "—" },
              { icon: <Mail className="w-4 h-4" />,  label: "Email",    value: userEmail || "—" },
              { icon: <Hash className="w-4 h-4" />,  label: "User ID",  value: userId    || "—" },
            ].map(({ icon, label, value }, i, arr) => (
              <div key={label}
                className="flex items-center gap-4 px-6 py-4"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid oklch(15% 0 0)" : "none" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `oklch(57.7% 0.245 27.325 / 0.1)`, color: A }}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-0.5" style={{ color: "oklch(50% 0 0)" }}>{label}</p>
                  <p className="text-sm font-medium text-white truncate">{value}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Logout */}
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.16 }}
            onClick={handleLogout}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="mt-6 w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl text-sm font-medium transition-all"
            style={{ background: "oklch(10% 0 0)", border: "1px solid oklch(18% 0 0)", color: "oklch(65% 0.18 25)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(57.7% 0.245 27.325 / 0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "oklch(10% 0 0)"; }}
          >
            <LogOut className="w-4 h-4" />
            Log out
          </motion.button>
        </main>
      </div>
    </div>
  );
}
