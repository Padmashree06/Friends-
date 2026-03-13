"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Bot, User, Sparkles, LayoutGrid, MessageSquare,
  X, Trash2, ChevronLeft, ChevronRight, Bell, GraduationCap, Plus
} from "lucide-react";
import { useRouter } from "next/navigation";

// Typewriter effect for AI messages
const TypewriterMessage = ({ text, messageId, isNew }) => {
  const [displayedText, setDisplayedText] = useState(isNew ? "" : text);
  const [showCursor, setShowCursor] = useState(isNew);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!isNew) {
      setDisplayedText(text);
      setShowCursor(false);
      return;
    }

    let currentIndex = 0;
    setDisplayedText("");
    setShowCursor(true);

    const typeNext = () => {
      if (currentIndex < text.length) {
        let nextIndex = currentIndex;
        const remainingText = text.slice(currentIndex);
        const spaceIndex = remainingText.indexOf(" ");
        const newlineIndex = remainingText.indexOf("\n");

        if (spaceIndex === 0 || newlineIndex === 0) {
          nextIndex = currentIndex + 1;
        } else if (spaceIndex > 0 && spaceIndex <= 8) {
          nextIndex = currentIndex + spaceIndex + 1;
        } else if (newlineIndex > 0 && newlineIndex <= 8) {
          nextIndex = currentIndex + newlineIndex + 1;
        } else {
          nextIndex = currentIndex + Math.floor(Math.random() * 3 + 2);
        }

        nextIndex = Math.min(nextIndex, text.length);
        setDisplayedText(text.slice(0, nextIndex));
        currentIndex = nextIndex;

        const delay =
          currentIndex < text.length &&
          (text[currentIndex - 1] === " " || text[currentIndex - 1] === "\n")
            ? 20
            : 30;
        timeoutRef.current = setTimeout(typeNext, delay);
      } else {
        setShowCursor(false);
      }
    };

    timeoutRef.current = setTimeout(typeNext, 50);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, messageId, isNew]);

  return (
    <span>
      {displayedText}
      {showCursor && (
        <span className="inline-block w-[2px] h-4 bg-violet-400 ml-0.5 animate-pulse" />
      )}
    </span>
  );
};

export default function ChatPage() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [topic, setTopic] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [chatList, setChatList] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newBotMessages, setNewBotMessages] = useState(new Set());
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("daily");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderTimeEnd, setReminderTimeEnd] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  const [creatingReminder, setCreatingReminder] = useState(false);

  const messagesEndRef = useRef(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";

  // Desktop: sidebar open by default
  useEffect(() => {
    const check = () => { if (window.innerWidth >= 1024) setSidebarOpen(true); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load user + chats on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) { router.push("/Login"); return; }
    const uid = parseInt(storedUserId, 10);
    setUserId(uid);

    // Restore last selected chat from session
    const storedChatId = sessionStorage.getItem("chatId");
    const storedTopic = sessionStorage.getItem("chatTopic");
    if (storedChatId) {
      setChatId(storedChatId);
      setTopic(storedTopic || "");
      loadChatHistory(storedChatId);
    }
    loadUserChats(uid);
  }, [router]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadUserChats = async (uid) => {
    if (!uid) return;
    setLoadingChats(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/user/${uid}`);
      if (res.ok) {
        const chats = await res.json();
        setChatList(chats || []);
        // Keep topic in sync if current chat is in the list
        if (chatId) {
          const current = (chats || []).find((c) => c.id === chatId);
          if (current && current.topic) setTopic(current.topic);
        }
      }
    } catch (err) {
      console.error("Failed to load chats:", err);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadChatHistory = async (id) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/${id}`);
      if (res.ok) {
        const history = await res.json();
        setMessages(history || []);
        setNewBotMessages(new Set());
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  // Create a brand-new empty chat (no topic — backend sets it from first message)
  const createNewChat = async () => {
    if (!userId) return;
    setStartingChat(true);
    setError("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create chat");

      setChatId(data.chat_id);
      setTopic("");
      setMessages([]);
      setNewBotMessages(new Set());
      sessionStorage.setItem("chatId", data.chat_id);
      sessionStorage.removeItem("chatTopic");

      await loadUserChats(userId);
      if (window.innerWidth < 1024) setSidebarOpen(false);
    } catch (err) {
      setError(err.message || "Failed to create chat");
    } finally {
      setStartingChat(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !chatId || !userId) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setLoading(true);
    setError("");

    // Optimistically add user message
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: userMessage, created_at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, chat_id: chatId, message: userMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (res.status === 409) {
          setError(`Off-topic: This chat is about "${topic}". Start a new chat for a different topic.`);
        } else {
          setError(data?.error || "Failed to send message");
        }
        return;
      }

      const botId = `bot-${Date.now()}`;
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempId);
        return [
          ...filtered,
          { id: `user-${Date.now()}`, role: "user", content: userMessage, created_at: new Date().toISOString() },
          { id: botId, role: "bot", content: data.reply, created_at: new Date().toISOString() },
        ];
      });
      setNewBotMessages((prev) => new Set([...prev, botId]));

      // Refresh chat list — this updates the topic in sidebar (backend set it from first message)
      const chats = await fetch(`${apiBaseUrl}/api/chat/user/${userId}`).then((r) => r.json()).catch(() => []);
      setChatList(chats || []);
      const updated = (chats || []).find((c) => c.id === chatId);
      if (updated?.topic) {
        setTopic(updated.topic);
        sessionStorage.setItem("chatTopic", updated.topic);
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) sendMessage();
    }
  };

  const loadChat = async (selectedChatId, selectedTopic) => {
    setChatId(selectedChatId);
    setTopic(selectedTopic || "");
    setError("");
    sessionStorage.setItem("chatId", selectedChatId);
    sessionStorage.setItem("chatTopic", selectedTopic || "");
    await loadChatHistory(selectedChatId);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const deleteChat = async (chatIdToDelete, chatTopicToDelete, e) => {
    e.stopPropagation();
    if (!userId || !chatIdToDelete) return;
    if (!confirm(`Delete chat about "${chatTopicToDelete || "Untitled"}"?`)) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/${chatIdToDelete}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Failed to delete");
      }
      await loadUserChats(userId);
      if (chatId === chatIdToDelete) {
        setChatId(null);
        setTopic("");
        setMessages([]);
        setNewBotMessages(new Set());
        sessionStorage.removeItem("chatId");
        sessionStorage.removeItem("chatTopic");
      }
    } catch (err) {
      setError(err.message || "Failed to delete chat");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(Math.abs(now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const createReminder = async () => {
    if (!chatId || !userId) { setError("Missing required information"); return; }
    if (recurrenceType === "once" && !reminderDateTime) { setError("Please select date & time"); return; }
    if (recurrenceType !== "once" && !reminderTime) { setError("Please select reminder time"); return; }
    if (recurrenceType === "weekly" && selectedDays.length === 0) { setError("Please select days"); return; }

    setCreatingReminder(true);
    setError("");
    try {
      const body = { user_id: userId, chat_id: chatId, recurrence_type: recurrenceType };
      if (recurrenceType === "once") {
        const dt = new Date(reminderDateTime);
        body.scheduled_time = dt.toISOString();
        body.reminder_time = dt.toTimeString().slice(0, 5);
      } else {
        body.reminder_time = reminderTime;
        if (reminderTimeEnd) body.reminder_time_end = reminderTimeEnd;
        if (recurrenceType === "weekly") body.days_of_week = selectedDays.sort((a, b) => a - b).join(",");
      }
      const res = await fetch(`${apiBaseUrl}/api/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create reminder");
      setShowReminderModal(false);
      setReminderDateTime(""); setReminderTime(""); setReminderTimeEnd(""); setSelectedDays([]); setRecurrenceType("daily");
      alert("Reminder created!");
    } catch (err) {
      setError(err.message || "Failed to create reminder");
    } finally {
      setCreatingReminder(false);
    }
  };

  // Loading state
  if (loadingChats && !chatId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0014] to-[#1a0033] text-white">
        <div className="flex gap-1">
          {[0, 0.1, 0.2].map((d, i) => (
            <span key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // No chat selected and no chats exist — empty state
  if (!chatId && !loadingChats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0014] to-[#1a0033] text-white p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative bg-gray-900/60 backdrop-blur-lg rounded-2xl shadow-[0_0_40px_rgba(0,0,0)] p-10 w-full max-w-md border border-white/10 text-center"
        >
          <Sparkles className="w-14 h-14 text-violet-400 mx-auto mb-4" />
          <h2 className="text-3xl font-extrabold mb-2 bg-gradient-to-r from-violet-50 to-violet-100 bg-clip-text text-transparent">
            Start Learning
          </h2>
          <p className="text-gray-400 mb-8 text-sm">
            Click the button below to open a new chat. Just start typing — the AI will automatically detect your topic from your first message.
          </p>
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              {error}
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={createNewChat}
            disabled={startingChat}
            className="w-full py-3 font-semibold rounded-full bg-gradient-to-r from-violet-700 via-violet-600 to-indigo-600 hover:shadow-[0_0_24px_-4px_rgba(217,70,239,0.8)] disabled:opacity-60 transition text-white"
          >
            {startingChat ? "Creating..." : "+ New Chat"}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0014] to-[#1a0033] text-white flex relative">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
        />
      )}

      {/* Sidebar toggle button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-1/2 -translate-y-1/2 bg-gray-900/90 backdrop-blur-lg border border-white/20 border-l-0 rounded-r-lg p-2.5 z-40 hover:bg-gray-800/90 shadow-lg transition-all duration-300"
        animate={{ left: sidebarOpen ? "280px" : "0px" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </motion.button>

      {/* Reminder Modal */}
      {showReminderModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setShowReminderModal(false); setReminderDateTime(""); setReminderTime(""); setReminderTimeEnd(""); setSelectedDays([]); setRecurrenceType("daily"); setError(""); }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gray-900/90 backdrop-blur-lg rounded-2xl shadow-[0_0_40px_rgba(0,0,0)] p-8 w-full max-w-md border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Bell className="w-7 h-7 text-violet-400" />
                  <h2 className="text-xl font-extrabold text-white">Set Reminder</h2>
                </div>
                <button onClick={() => { setShowReminderModal(false); setError(""); }} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-400 text-sm mb-5">Schedule a reminder for this chat{topic ? ` about "${topic}"` : ""}</p>

              <div className="space-y-4">
                {/* Frequency */}
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Frequency</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["daily", "weekly", "once"].map((t) => (
                      <button key={t} onClick={() => { setRecurrenceType(t); if (t !== "once") setReminderDateTime(""); }}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium capitalize transition ${recurrenceType === t ? "bg-violet-700/30 border-violet-500 text-white" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"}`}
                        disabled={creatingReminder}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {recurrenceType === "once" && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Date & Time</label>
                    <input type="datetime-local" value={reminderDateTime} onChange={(e) => setReminderDateTime(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)} disabled={creatingReminder}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-100" />
                  </div>
                )}

                {recurrenceType !== "once" && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Time</label>
                    <div className="flex gap-3">
                      <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} disabled={creatingReminder}
                        className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-violet-500 focus:outline-none text-gray-100" />
                      <span className="text-gray-400 text-sm self-center">to</span>
                      <input type="time" value={reminderTimeEnd} onChange={(e) => setReminderTimeEnd(e.target.value)} disabled={creatingReminder} placeholder="Optional"
                        className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-violet-500 focus:outline-none text-gray-100" />
                    </div>
                  </div>
                )}

                {recurrenceType === "weekly" && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Days</label>
                    <div className="grid grid-cols-7 gap-1">
                      {[{d:0,l:"Su"},{d:1,l:"Mo"},{d:2,l:"Tu"},{d:3,l:"We"},{d:4,l:"Th"},{d:5,l:"Fr"},{d:6,l:"Sa"}].map(({d, l}) => (
                        <button key={d} type="button" disabled={creatingReminder}
                          onClick={() => setSelectedDays(selectedDays.includes(d) ? selectedDays.filter((x) => x !== d) : [...selectedDays, d])}
                          className={`py-2 rounded-lg border text-xs font-medium transition ${selectedDays.includes(d) ? "bg-violet-700/30 border-violet-500 text-white" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>}

                <div className="flex gap-3">
                  <button onClick={() => { setShowReminderModal(false); setError(""); }} disabled={creatingReminder}
                    className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-sm transition">
                    Cancel
                  </button>
                  <button onClick={createReminder} disabled={creatingReminder || (recurrenceType === "once" && !reminderDateTime) || (recurrenceType !== "once" && !reminderTime) || (recurrenceType === "weekly" && selectedDays.length === 0)}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-violet-700 to-indigo-600 font-semibold disabled:opacity-60 transition text-white">
                    {creatingReminder ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? "280px" : "0px" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed left-0 top-0 h-screen bg-gray-900/60 backdrop-blur-lg border-r border-white/10 flex-shrink-0 overflow-hidden z-30"
      >
        <div className={`flex flex-col h-full w-[280px] transition-opacity duration-300 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
          {/* Sidebar header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">KHOJ</h2>
            </div>

            {/* Nav buttons */}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/Dashboard")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-violet-700/20 hover:bg-violet-700/30 border border-violet-500/20 text-white transition mb-2">
              <LayoutGrid className="w-5 h-5" />
              <span className="font-medium">Dashboard</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/quiz")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-violet-700/20 hover:bg-violet-700/30 border border-violet-500/20 text-white transition mb-4">
              <GraduationCap className="w-5 h-5" />
              <span className="font-medium">Quiz</span>
            </motion.button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Chats</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => userId && loadUserChats(userId)} disabled={loadingChats}
                  className="text-violet-400 hover:text-violet-300 text-xs disabled:opacity-50" title="Refresh">↻</button>
                {/* + New chat button in sidebar */}
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={createNewChat} disabled={startingChat}
                  className="flex items-center gap-1 text-violet-400 hover:text-violet-300 text-xs disabled:opacity-50"
                  title="New chat">
                  <Plus className="w-4 h-4" /> New
                </motion.button>
              </div>
            </div>

            {loadingChats ? (
              <div className="flex justify-center py-8">
                <div className="flex gap-1">
                  {[0, 0.1, 0.2].map((d, i) => (
                    <span key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            ) : chatList.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No chats yet</p>
                <p className="text-xs mt-1">Click + New to begin</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatList.map((chat) => (
                  <div key={chat.id}
                    className={`group relative w-full p-3 rounded-lg transition ${chatId === chat.id ? "bg-violet-700/30 border border-violet-500/30" : "bg-white/5 hover:bg-white/10 border border-white/10"}`}>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => loadChat(chat.id, chat.topic)}
                      className="w-full text-left flex items-start gap-2">
                      <MessageSquare className={`w-4 h-4 mt-1 flex-shrink-0 ${chatId === chat.id ? "text-violet-400" : "text-gray-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${chatId === chat.id ? "text-white" : "text-gray-300"}`}>
                          {chat.topic || <span className="italic text-gray-500">New chat</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(chat.updated_at || chat.created_at)}</p>
                      </div>
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={(e) => deleteChat(chat.id, chat.topic, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 text-red-400" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? "lg:ml-[280px]" : ""}`}>
        {/* Header */}
        <div className="border-b border-white/10 bg-gray-900/40 backdrop-blur-sm">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-6 h-6 text-violet-400" />
              <div>
                <h1 className="text-lg font-semibold">
                  {topic ? `Chat: ${topic}` : "New Chat"}
                </h1>
                <p className="text-xs text-gray-400">
                  {topic ? "Topic locked — stay on topic" : "Send your first message to set the topic"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => { setShowReminderModal(true); setError(""); }}
                disabled={!chatId}
                className="px-3 py-2 rounded-lg bg-violet-700/20 hover:bg-violet-700/30 border border-violet-500/20 text-sm transition disabled:opacity-50 flex items-center gap-2">
                <Bell className="w-4 h-4" /> Reminder
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={createNewChat} disabled={startingChat}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-sm transition flex items-center gap-2 disabled:opacity-50">
                <Plus className="w-4 h-4" /> New Chat
              </motion.button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <AnimatePresence>
              {messages.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-gray-400">
                  <Bot className="w-16 h-16 mx-auto mb-4 text-violet-400/50" />
                  <p className="text-lg mb-1">What do you want to learn today?</p>
                  <p className="text-sm text-gray-500">
                    Just start typing — your topic will be detected automatically.
                  </p>
                </motion.div>
              ) : (
                messages.map((message, index) => (
                  <motion.div key={message.id || index}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "bot" && (
                      <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-5 h-5 text-violet-400" />
                      </div>
                    )}
                    <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-gradient-to-r from-violet-700 to-indigo-700 text-white" : "bg-gray-800/60 backdrop-blur-sm border border-white/10 text-gray-100"}`}>
                      <p className="whitespace-pre-wrap break-words">
                        {message.role === "bot" ? (
                          <TypewriterMessage text={message.content} messageId={message.id} isNew={newBotMessages.has(message.id)} />
                        ) : message.content}
                      </p>
                      {message.created_at && (
                        <p className="text-xs mt-2 opacity-60">
                          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-indigo-400" />
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-violet-400" />
                </div>
                <div className="bg-gray-800/60 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 0.1, 0.2].map((d, i) => (
                      <span key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4">
            <div className="max-w-4xl mx-auto mb-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 ml-4"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-white/10 bg-gray-900/40 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-4 flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={topic ? `Ask about ${topic}...` : "Start typing to begin (your first message sets the topic)..."}
              disabled={loading || !chatId}
              className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-100 placeholder-gray-500 disabled:opacity-50"
            />
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={sendMessage}
              disabled={loading || !inputMessage.trim() || !chatId}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_24px_-4px_rgba(217,70,239,0.8)] transition flex items-center gap-2">
              <Send className="w-5 h-5" />
              {loading ? "..." : "Send"}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
