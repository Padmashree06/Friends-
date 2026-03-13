"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, MessageSquare, X } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import AppSidebar from "../components/AppSidebar";

const A = "oklch(64.6% 0.222 41.116)";
const BG = "oklch(6% 0 0)";
const SURFACE = "oklch(10% 0 0)";
const BORDER = "oklch(18% 0 0)";

export default function QuizPage() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) { router.push("/Login"); return; }
    const uid = parseInt(storedUserId, 10);
    setUserId(uid);
    loadUserChats(uid);
  }, [router]);

  const loadUserChats = async (uid) => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/user/${uid}`);
      if (res.ok) setChats((await res.json()) || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const topicStats = chats.reduce((acc, chat) => {
    const topic = chat.topic || "Untitled";
    if (!acc[topic]) acc[topic] = { topic, count: 0, lastActivity: null, chatIds: [] };
    acc[topic].count += 1;
    acc[topic].chatIds.push(chat.id);
    const d = new Date(chat.updated_at || chat.created_at);
    if (!acc[topic].lastActivity || d > acc[topic].lastActivity) acc[topic].lastActivity = d;
    return acc;
  }, {});

  const topics = Object.values(topicStats).sort((a, b) =>
    b.lastActivity && a.lastActivity ? b.lastActivity - a.lastActivity : b.count - a.count
  );
  const maxCount = Math.max(...topics.map(t => t.count), 1);

  const formatDate = (date) => {
    if (!date) return "Never";
    const diff = Math.floor(Math.abs(new Date() - date) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleTopicClick = (topicData) => {
    const recent = chats.filter(c => c.topic === topicData.topic).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];
    if (recent) { sessionStorage.setItem("chatId", recent.id); sessionStorage.setItem("chatTopic", recent.topic); }
    router.push("/chat");
  };

  const startQuiz = async (duration) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/quiz/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, chat_id: selectedChat.id, topic: selectedTopic.topic, duration }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { alert("Failed to parse response"); return; }
      if ((res.ok || res.status === 409) && data.quiz_id) {
        setShowDurationModal(false); setSelectedTopic(null); setSelectedChat(null);
        router.push(`/quiz/take?id=${data.quiz_id}`);
      } else {
        alert(data?.error || "Failed to start quiz");
      }
    } catch (err) { alert("Failed to start quiz: " + err.message); }
  };

  const Dot = ({ delay }) => (
    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: A, animationDelay: `${delay}s` }} />
  );

  return (
    <div className="min-h-screen text-white flex bg-black">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 sticky top-0 z-10 bg-[#0c0c0c]/90 border-b border-white/[0.07] backdrop-blur-xl">
          <span className="text-lg font-bold text-white">Quiz</span>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-7 h-7" style={{ color: A }} />
              <div>
                <h1 className="text-2xl font-bold text-white">Quiz &amp; Topics</h1>
                <p className="text-xs" style={{ color: "oklch(50% 0 0)" }}>Your learning topics and progress</p>
              </div>
            </div>
            <Link href="/chat"
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
              style={{ background: "oklch(57.7% 0.245 27.325 / 0.12)", border: `1px solid oklch(57.7% 0.245 27.325 / 0.3)`, color: A }}>
              <MessageSquare className="w-4 h-4" /> Chat
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-24 gap-1">
              <Dot delay={0} /><Dot delay={0.1} /><Dot delay={0.2} />
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-24">
              <GraduationCap className="w-14 h-14 mx-auto mb-4 opacity-30" style={{ color: A }} />
              <p className="text-lg text-white mb-1">No topics yet</p>
              <p className="text-sm mb-5" style={{ color: "oklch(50% 0 0)" }}>Start a chat to begin learning!</p>
              <Link href="/chat" className="inline-block px-6 py-3 rounded-lg font-semibold text-white transition" style={{ background: A }}>
                Start Chatting
              </Link>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl">
              {/* Topics list */}
              <div className="rounded-xl p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" style={{ color: A }} /> Topics Overview
                </h2>
                <div className="space-y-3">
                  {topics.map((topicData, index) => {
                    const pct = (topicData.count / maxCount) * 100;
                    const recent = chats.filter(c => c.topic === topicData.topic).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];
                    return (
                      <motion.div key={topicData.topic}
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }}
                        className="group rounded-lg p-4 transition-all"
                        style={{ background: "oklch(12% 0 0)", border: `1px solid ${BORDER}` }}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleTopicClick(topicData)}>
                            <h3 className="text-base font-semibold text-white truncate transition-colors"
                              onMouseEnter={(e) => e.currentTarget.style.color = A}
                              onMouseLeave={(e) => e.currentTarget.style.color = "white"}>
                              {topicData.topic}
                            </h3>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs" style={{ color: "oklch(50% 0 0)" }}>{topicData.count} {topicData.count === 1 ? "chat" : "chats"}</span>
                              <span className="text-xs" style={{ color: "oklch(42% 0 0)" }}>Last: {formatDate(topicData.lastActivity)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <div className="text-right">
                              <span className="text-xl font-bold" style={{ color: A }}>{topicData.count}</span>
                              <p className="text-xs" style={{ color: "oklch(45% 0 0)" }}>chats</p>
                            </div>
                            {recent && (
                              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={(e) => { e.stopPropagation(); setSelectedTopic(topicData); setSelectedChat(recent); setShowDurationModal(true); }}
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 text-white transition"
                                style={{ background: A }}>
                                <GraduationCap className="w-4 h-4" /> Quiz
                              </motion.button>
                            )}
                          </div>
                        </div>
                        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "oklch(18% 0 0)" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: index * 0.08 + 0.2, duration: 0.5 }}
                            className="h-full rounded-full" style={{ background: A }} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[{ label: "Total Topics", value: topics.length }, { label: "Total Chats", value: chats.length }, { label: "Most Active", value: topics[0]?.topic || "None", small: true }]
                  .map(({ label, value, small }) => (
                    <div key={label} className="rounded-xl p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                      <p className="text-xs mb-1" style={{ color: "oklch(50% 0 0)" }}>{label}</p>
                      <p className={`font-bold ${small ? "text-base text-white truncate" : "text-3xl"}`} style={small ? {} : { color: A }}>{value}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Duration Modal */}
      {showDurationModal && selectedTopic && selectedChat && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl p-6 max-w-sm w-full relative" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="absolute inset-x-0 top-0 h-px rounded-t-xl" style={{ background: `linear-gradient(90deg, transparent, ${A}, transparent)` }} />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">Select Quiz Duration</h3>
              <button onClick={() => { setShowDurationModal(false); setSelectedTopic(null); setSelectedChat(null); }}
                className="text-gray-500 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm mb-5" style={{ color: "oklch(55% 0 0)" }}>
              Quiz on <span className="font-semibold" style={{ color: A }}>{selectedTopic.topic}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[5, 10, 15, 30].map((dur) => (
                <motion.button key={dur} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => startQuiz(dur)}
                  className="py-3 rounded-lg text-sm font-medium transition border"
                  style={{ background: "oklch(57.7% 0.245 27.325 / 0.1)", borderColor: "oklch(57.7% 0.245 27.325 / 0.3)", color: "white" }}>
                  <div className="font-bold">{dur} min</div>
                  <div className="text-xs mt-0.5" style={{ color: "oklch(55% 0 0)" }}>~{Math.max(1, Math.floor(dur / 3))} questions</div>
                </motion.button>
              ))}
            </div>
            <button onClick={() => { setShowDurationModal(false); setSelectedTopic(null); setSelectedChat(null); }}
              className="w-full py-2 rounded-lg text-sm transition" style={{ background: "oklch(14% 0 0)", color: "oklch(60% 0 0)" }}>
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
