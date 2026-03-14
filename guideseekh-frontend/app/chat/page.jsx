"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Bot, User, Sparkles, LayoutGrid, MessageSquare,
  X, Trash2, ChevronLeft, ChevronRight, Bell, GraduationCap, Plus,
  BookOpen, FileText, Video, ExternalLink
} from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

// The brand accent color
const ACCENT = "#FF5500";

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

  // We append a simple block char for the typing cursor so it stays inline with formatted Markdown
  return (
    <div className="markdown-body w-full overflow-hidden prose prose-invert prose-p:my-3 prose-li:my-1 prose-headings:mt-5 prose-headings:mb-2 max-w-none break-words">
      <ReactMarkdown>
        {displayedText + (showCursor ? " ▌" : "")}
      </ReactMarkdown>
    </div>
  );
};

export default function ChatPage() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [topic, setTopic] = useState("");
  const [username, setUsername] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [chatList, setChatList] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newBotMessages, setNewBotMessages] = useState(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("daily");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderTimeEnd, setReminderTimeEnd] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  const [creatingReminder, setCreatingReminder] = useState(false);
  
  const [showResources, setShowResources] = useState(false);
  const [resources, setResources] = useState([]);
  const [isGeneratingResources, setIsGeneratingResources] = useState(false);
  const [resourceError, setResourceError] = useState(false);
  const resourcesLoadedForChatRef = useRef(null);
  const resourceDebounceRef = useRef(null);

  // We use this to snap to bottom on exact new message
  const messagesEndRef = useRef(null);
  // We use this to measure content
  const textAreaRef = useRef(null);

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
    setUsername(localStorage.getItem("username") || "");
    setUserEmail(localStorage.getItem("userEmail") || "");

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
  }, [messages, loading]);

  // Load resources from backend when a chat is active
  const loadResources = useCallback(async (id, forceRefresh = false) => {
    if (!id) return;
    setResourceError(false);
    setIsGeneratingResources(true);
    try {
      // If not forcing refresh, try to get already-cached resources from DB
      if (!forceRefresh) {
        const getRes = await fetch(`${apiBaseUrl}/api/chat/resources/${id}`);
        const getData = await getRes.json();
        if (getRes.ok && getData.resources && getData.resources.length > 0) {
          setResources(getData.resources);
          resourcesLoadedForChatRef.current = id;
          setIsGeneratingResources(false);
          return;
        }
      }

      // No cached resources or forcing refresh: ask backend to generate them via Groq
      const postRes = await fetch(`${apiBaseUrl}/api/chat/resources/${id}`, { method: "POST" });
      const postData = await postRes.json();
      if (postRes.ok && postData.resources && postData.resources.length > 0) {
        setResources(postData.resources);
        resourcesLoadedForChatRef.current = id;
      } else {
        console.warn("[Resources] Backend returned no resources:", postData);
        setResources([]);
        setResourceError(true);
      }
    } catch (err) {
      console.error("[Resources] Failed to load resources:", err);
      setResources([]);
      setResourceError(true);
    } finally {
      setIsGeneratingResources(false);
    }
  }, [apiBaseUrl]);

  // Debounced resource loading — waits 2s after messages stabilize
  useEffect(() => {
    if (resourceDebounceRef.current) clearTimeout(resourceDebounceRef.current);

    if (chatId && messages.length > 0) {
      // If switching chats, load immediately; otherwise debounce
      if (resourcesLoadedForChatRef.current !== chatId) {
        loadResources(chatId);
      } else {
        // Debounce re-generation for ongoing conversations
        resourceDebounceRef.current = setTimeout(() => {
          loadResources(chatId, true);
        }, 3000);
      }
    } else {
      setResources([]);
      setShowResources(false);
      setResourceError(false);
      resourcesLoadedForChatRef.current = null;
    }

    return () => {
      if (resourceDebounceRef.current) clearTimeout(resourceDebounceRef.current);
    };
  }, [chatId, messages.length, loadResources]);

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = Math.min(textAreaRef.current.scrollHeight, 200) + "px";
    }
  }, [inputMessage]);

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
        // If this was the first message, topic just transitioned from empty to something
        const isFirstMessage = !topic;
        
        setTopic(updated.topic);
        sessionStorage.setItem("chatTopic", updated.topic);

        // --- INTERRUPT LEVEL FEATURE ---
        // If this is a brand new chat (first message just sent), auto-popup the reminder 
        // modal after 60 seconds if they haven't explicitly set one already.
        if (isFirstMessage) {
          // Capture the exact chatId at this moment
          const currentChatId = chatId;
          setTimeout(() => {
            // Check if they haven't set a reminder yet AND are still on the exact same chat
            const hasReminder = localStorage.getItem(`reminder_set_${currentChatId}`);
            if (!hasReminder && sessionStorage.getItem("chatId") === currentChatId) {
              setShowReminderModal(true);
            }
          }, 60000); // 1 minute
        }
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

  const deleteChat = async (chatIdToDelete, e) => {
    e.stopPropagation();
    if (!userId || !chatIdToDelete) return;
    setConfirmDeleteId(null);
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
      
      // Mark reminder as set for this chat so it doesn't auto-popup later
      localStorage.setItem(`reminder_set_${chatId}`, "true");

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
      <div className="min-h-screen flex items-center justify-center bg-[#000000] text-white">
        <div className="flex gap-1.5">
          {[0, 0.15, 0.3].map((d, i) => (
            <span key={i} className={`w-2.5 h-2.5 bg-[${ACCENT}] rounded-full animate-bounce`} style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // No chat selected and no chats exist — empty state
  if (!chatId && !loadingChats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000000] text-white p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative max-w-md w-full text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
            <Sparkles className={`w-8 h-8 text-[${ACCENT}]`} />
          </div>
          <h2 className="text-3xl font-medium mb-3 text-white">
            What do you want to learn?
          </h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed max-w-sm mx-auto">
            Click below to open a new chat. Khoj will automatically detect your topic from your first message.
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
            className={`w-full py-3.5 font-medium rounded-2xl bg-[${ACCENT}] hover:brightness-110 disabled:opacity-60 transition text-white shadow-lg shadow-[${ACCENT}]/20`}
          >
            {startingChat ? "Creating..." : "Start a New Topic"}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white flex relative overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
        />
      )}

      {/* Sidebar toggle button (always visible) */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-1/2 -translate-y-1/2 bg-[#0f0f0f] border border-white/10 border-l-0 rounded-r-xl p-2 z-40 shadow-xl transition-all duration-300"
        animate={{ left: sidebarOpen ? "260px" : "0px" }}
      >
        {sidebarOpen ? <ChevronLeft className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </motion.button>

      {/* Reminder Modal */}
      {showReminderModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setShowReminderModal(false); setReminderDateTime(""); setReminderTime(""); setReminderTimeEnd(""); setSelectedDays([]); setRecurrenceType("daily"); setError(""); }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-[#0a0a0a] rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Bell className={`w-6 h-6 text-[${ACCENT}]`} />
                  <h2 className="text-xl font-medium text-white">Set Reminder</h2>
                </div>
                <button onClick={() => { setShowReminderModal(false); setError(""); }} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-400 text-sm mb-5">Schedule a reminder for this chat{topic ? ` about "${topic}"` : ""}</p>

              <div className="space-y-5">
                {/* Frequency */}
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Frequency</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["daily", "weekly", "once"].map((t) => (
                      <button key={t} onClick={() => { setRecurrenceType(t); if (t !== "once") setReminderDateTime(""); }}
                        className={`px-3 py-2.5 rounded-xl border text-sm capitalize transition ${recurrenceType === t ? `bg-[${ACCENT}]/10 border-[${ACCENT}]/50 text-white` : "bg-transparent border-white/10 text-gray-400 hover:bg-white/5"}`}
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
                      className={`w-full px-4 py-3 rounded-xl bg-black border border-white/10 focus:border-[${ACCENT}]/50 focus:outline-none focus:ring-1 focus:ring-[${ACCENT}]/50 text-gray-100 transition`} />
                  </div>
                )}

                {recurrenceType !== "once" && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Time</label>
                    <div className="flex gap-3">
                      <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} disabled={creatingReminder}
                        className={`flex-1 px-4 py-3 rounded-xl bg-black border border-white/10 focus:border-[${ACCENT}]/50 focus:outline-none focus:ring-1 focus:ring-[${ACCENT}]/50 text-gray-100 transition`} />
                      <span className="text-gray-500 text-sm self-center">to</span>
                      <input type="time" value={reminderTimeEnd} onChange={(e) => setReminderTimeEnd(e.target.value)} disabled={creatingReminder} placeholder="Optional"
                        className={`flex-1 px-4 py-3 rounded-xl bg-black border border-white/10 focus:border-[${ACCENT}]/50 focus:outline-none focus:ring-1 focus:ring-[${ACCENT}]/50 text-gray-100 transition`} />
                    </div>
                  </div>
                )}

                {recurrenceType === "weekly" && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Days</label>
                    <div className="grid grid-cols-7 gap-1.5">
                      {[{d:0,l:"Su"},{d:1,l:"Mo"},{d:2,l:"Tu"},{d:3,l:"We"},{d:4,l:"Th"},{d:5,l:"Fr"},{d:6,l:"Sa"}].map(({d, l}) => (
                        <button key={d} type="button" disabled={creatingReminder}
                          onClick={() => setSelectedDays(selectedDays.includes(d) ? selectedDays.filter((x) => x !== d) : [...selectedDays, d])}
                          className={`py-2.5 rounded-xl border text-xs font-medium transition ${selectedDays.includes(d) ? `bg-[${ACCENT}]/10 border-[${ACCENT}]/50 text-white` : "bg-transparent border-white/10 text-gray-400 hover:bg-white/5"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowReminderModal(false); setError(""); }} disabled={creatingReminder}
                    className="flex-1 px-4 py-3 rounded-xl bg-transparent hover:bg-white/5 border border-white/10 text-sm transition">
                    Cancel
                  </button>
                  <button onClick={createReminder} disabled={creatingReminder || (recurrenceType === "once" && !reminderDateTime) || (recurrenceType !== "once" && !reminderTime) || (recurrenceType === "weekly" && selectedDays.length === 0)}
                    className={`flex-1 px-4 py-3 rounded-xl bg-[${ACCENT}] font-medium disabled:opacity-60 transition text-white hover:brightness-110`}>
                    {creatingReminder ? "Creating..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Sidebar - ChatGPT Style */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? "260px" : "0px" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed left-0 top-0 h-screen bg-[#0c0c0c] border-r border-white/[0.07] flex-shrink-0 overflow-hidden z-30 shadow-[4px_0_24px_rgba(0,0,0,0.5)]"
      >
        <div className={`flex flex-col h-full w-[260px] transition-opacity duration-300 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
          
          {/* Top nav — same order as AppSidebar for smooth transitions */}
          <div className="p-3 flex flex-col gap-0.5">
            <button
              onClick={() => router.push("/Dashboard")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 text-sm font-medium transition hover:bg-white/5 hover:text-gray-200 border border-transparent hover:border-white/5">
              <LayoutGrid className="w-4 h-4" />
              Dashboard
            </button>
            {/* Chat — active */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium border border-transparent">
              <MessageSquare className={`w-4 h-4 text-[${ACCENT}]`} />
              Chat
            </div>
            <button
              onClick={() => router.push("/quiz")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 text-sm font-medium transition hover:bg-white/5 hover:text-gray-200 border border-transparent hover:border-white/5">
              <GraduationCap className="w-4 h-4" />
              Quiz
            </button>
            <button
              onClick={() => router.push("/Profile")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 text-sm font-medium transition hover:bg-white/5 hover:text-gray-200 border border-transparent hover:border-white/5">
              <User className="w-4 h-4" />
              Profile
            </button>
          </div>

          {/* New chat + History */}
          <div className="px-3 pt-3 pb-2 border-t border-white/[0.06] mt-1">
            <motion.button whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }} whileTap={{ scale: 0.98 }}
              onClick={createNewChat} disabled={startingChat}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition mb-3 text-white border border-white/[0.06] hover:border-white/10">
              <span className="font-medium text-sm">New chat</span>
              <Plus className="w-4 h-4 text-gray-400" />
            </motion.button>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-2 mb-2 flex items-center justify-between">
              History
              <button onClick={() => userId && loadUserChats(userId)} disabled={loadingChats}
                  className="text-gray-500 hover:text-white transition" title="Refresh">↻</button>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4">
            {loadingChats ? (
              <div className="flex justify-center py-6">
                <div className="flex gap-1.5">
                  {[0, 0.15, 0.3].map((d, i) => (
                    <span key={i} className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            ) : chatList.length === 0 ? (
              <div className="py-8 px-4 text-gray-600">
                <p className="text-xs">No previous chats</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {chatList.map((chat) => (
                  <div key={chat.id}
                    className={`group relative w-full px-2 py-2.5 rounded-xl transition ${chatId === chat.id ? "bg-white/10" : "hover:bg-[#111]"}`}>
                    {confirmDeleteId === chat.id ? (
                      /* Inline confirm row */
                      <div className="flex items-center gap-2 px-1">
                        <span className="flex-1 text-xs text-gray-400 truncate">Delete this chat?</span>
                        <button
                          onClick={(e) => deleteChat(chat.id, e)}
                          className="px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 text-xs font-medium transition"
                        >Yes</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 text-xs transition"
                        >No</button>
                      </div>
                    ) : (
                      <>
                        <motion.button whileTap={{ scale: 0.99 }}
                          onClick={() => loadChat(chat.id, chat.topic)}
                          className="w-full text-left flex items-center gap-0">
                          <div className="flex-1 min-w-0 pr-6">
                            <p className={`text-sm truncate ${chatId === chat.id ? "text-white font-medium" : "text-gray-400 group-hover:text-gray-200"}`}>
                              {chat.topic || "New chat"}
                            </p>
                          </div>
                        </motion.button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(chat.id); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 text-gray-500 hover:text-red-400" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Profile popover */}
          <div className="relative">
            <AnimatePresence>
              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute bottom-full left-3 right-3 mb-2 bg-[#141414] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                  {/* Profile header */}
                  <div className="px-4 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[oklch(64.6%_0.222_41.116)] to-[oklch(50%_0.15_30)] flex items-center justify-center shrink-0 shadow-lg text-white text-sm font-semibold">
                        {username ? username.charAt(0).toUpperCase() : "K"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{username || "User"}</p>
                        <p className="text-xs text-gray-500 truncate">{userEmail || "No email"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-2">
                    <button
                      onClick={() => { setShowProfileMenu(false); router.push("/Dashboard"); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:bg-white/5 hover:text-white transition text-left"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                      Dashboard
                    </button>
                    <button
                      onClick={() => {
                        localStorage.clear();
                        sessionStorage.clear();
                        router.push("/");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-left"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Log out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Trigger button */}
            <button
              onClick={() => setShowProfileMenu((p) => !p)}
              className="w-full p-4 border-t border-white/[0.06] flex items-center gap-3 hover:bg-white/[0.03] transition group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[oklch(64.6%_0.222_41.116)] to-[oklch(50%_0.15_30)] flex items-center justify-center shrink-0 shadow-lg text-white text-xs font-semibold">
                {username ? username.charAt(0).toUpperCase() : "K"}
              </div>
              <span className="flex-1 text-sm font-medium text-gray-200 text-left truncate">{username || "Khoj Account"}</span>
              <svg className={`w-4 h-4 text-gray-500 transition-transform ${showProfileMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
            </button>
          </div>
        </div>
      </motion.aside>

      <div className={`flex-1 flex flex-col min-w-0 relative transition-all duration-300 h-screen ${sidebarOpen ? "lg:ml-[260px]" : ""}`}>
        
        {/* Header - Transparent/Minimal */}
        <div className="absolute top-0 w-full z-10 bg-gradient-to-b from-[#000000]/80 via-[#000000]/50 to-transparent pt-3 pb-8 pl-12 lg:pl-4 pr-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <span className="text-gray-400 text-sm font-medium hover:text-gray-200 transition cursor-pointer flex items-center gap-1.5">
              Khoj <span className="opacity-50">/</span> {topic ? topic : "New topic"}
            </span>
            <div className="flex items-center">
              <button
                onClick={() => { setShowReminderModal(true); setError(""); }}
                disabled={!chatId}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30 tooltip-trigger">
                <Bell className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages Flow - ChatGPT Style */}
        <div className="flex-1 overflow-y-auto w-full pt-16">
          <AnimatePresence>
            {messages.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center px-4 max-w-2xl mx-auto mb-[20vh]">
                <div className="w-16 h-16 rounded-2xl overflow-hidden mb-6 shadow-xl shrink-0">
                  <img src="/logo.png" alt="Khoj" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-2xl font-medium mb-2 text-white">How can I help you learn?</h2>
                <p className="text-gray-400 text-sm">
                  Your knowledge journey is unique. Ask a question to begin.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 w-full max-w-xl">
                    {["Explain quantum computing", "How do Black holes form?", "Summarize WWII", "Best React hooks to know"].map((suggest, i) => (
                      <button key={i} className="text-left p-4 rounded-xl border border-white/5 bg-[#080808] hover:bg-[#111] text-gray-300 text-sm transition"
                        onClick={() => { setInputMessage(suggest); }}>
                        {suggest}
                      </button>
                    ))}
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col pb-44">
                {messages.map((message, index) => (
                  <motion.div key={message.id || index}
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className={`w-full py-5 px-4 md:px-0 flex flex-col items-center ${message.role === "bot" ? "bg-transparent" : "bg-transparent"}`}>
                    
                    <div className="max-w-3xl w-full flex gap-4 md:gap-5">
                      {/* Avatar */}
                      <div className="flex-shrink-0 mt-0.5 hidden sm:block">
                        {message.role === "bot" ? (
                          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 shadow-lg">
                            <img src="/logo.png" alt="Khoj" className="w-full h-full object-cover" />
                          </div>
                        ) : null}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 min-w-0 ${message.role === "user" ? "flex justify-end" : "pt-0.5"}`}>
                        {message.role === "bot" ? (
                          <div className="text-gray-100 text-[15px] leading-[1.9] w-full">
                             <div className="sm:hidden w-6 h-6 mb-2 rounded-full overflow-hidden shadow-lg">
                                <img src="/logo.png" alt="Khoj" className="w-full h-full object-cover" />
                              </div>
                            <TypewriterMessage text={message.content} messageId={message.id} isNew={newBotMessages.has(message.id)} />
                          </div>
                        ) : (
                          <div className="inline-block bg-[#151515] px-5 py-3 rounded-3xl text-gray-100 text-[15px] max-w-full break-words shadow-sm">
                            {message.content}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full py-5 px-4 md:px-0 flex flex-col items-center">
                    <div className="max-w-3xl w-full flex gap-4 md:gap-5">
                      <div className="flex-shrink-0 mt-0.5 hidden sm:block">
                        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 opacity-60">
                          <img src="/logo.png" alt="Khoj" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pt-[10px]">
                        <div className="flex gap-1.5">
                          {[0, 0.15, 0.3].map((d, i) => (
                            <span key={i} className="w-[5px] h-[5px] bg-[oklch(64.6%_0.222_41.116)] rounded-full animate-pulse" style={{ animationDelay: `${d}s`, opacity: 0.6 }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area - Floating fixed at bottom like ChatGPT */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#000000] via-[#000000] to-transparent pt-12 pb-[1.5rem]">
          {error && (
            <div className="max-w-3xl mx-auto px-4 mb-3 relative z-10">
              <div className="text-xs text-red-300 bg-red-900/30 border border-red-500/30 rounded-xl p-3 flex items-center justify-between backdrop-blur-md">
                <span>{error}</span>
                <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 ml-4 p-1"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}
          
          <div className="max-w-3xl mx-auto px-4 lg:px-0 relative z-10">
            <div className="relative flex items-end w-full bg-[#151515] border border-white/5 rounded-3xl shadow-2xl focus-within:bg-[#1a1a1a] focus-within:border-white/10 transition-colors">
              <textarea
                ref={textAreaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!loading) sendMessage();
                  }
                }}
                placeholder={topic ? `Ask anything about ${topic}...` : "Message Khoj..."}
                disabled={loading || !chatId}
                rows={1}
                className="w-full max-h-[200px] min-h-[56px] bg-transparent text-gray-100 placeholder-gray-500 px-5 py-4 resize-none focus:outline-none text-[15px] leading-relaxed rounded-3xl"
                style={{ overflowY: 'auto' }}
              />
              <motion.button 
                whileHover={inputMessage.trim() ? { scale: 1.05 } : {}} 
                whileTap={inputMessage.trim() ? { scale: 0.95 } : {}}
                onClick={sendMessage}
                disabled={loading || !inputMessage.trim() || !chatId}
                className={`absolute right-3 bottom-2 p-2 rounded-full transition-all duration-300 ${
                  inputMessage.trim() && !loading
                    ? `bg-white text-black shadow-md`
                    : "bg-white/5 text-gray-600"
                }`}>
                <Send className="w-4 h-4 ml-[1px]" />
              </motion.button>
            </div>
            
            <div className="text-center mt-3">
              <span className="text-[11px] text-gray-500 font-medium">Khoj can make mistakes. Consider verifying important information.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contextual Resources - Fixed on the right */}
      <AnimatePresence>
        {chatId && messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed right-6 top-24 z-40"
          >
            <div className="relative">
              {/* Resources Dropdown */}
              <AnimatePresence>
                {showResources && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={{ duration: 0.2 }}
                    style={{ transformOrigin: "top right" }}
                    className="absolute right-0 top-full mt-3 w-80 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
                  >
                    <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                      <h3 className="font-medium text-white flex items-center gap-2">
                        <BookOpen className={`w-4 h-4 text-[${ACCENT}]`} />
                        Contextual Resources
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 truncate">Topic: {topic || "Current Chat"}</p>
                    </div>
                    
                    <div className="p-2 max-h-[60vh] overflow-y-auto">
                      {isGeneratingResources ? (
                        <div className="py-8 flex flex-col items-center justify-center text-gray-500">
                          <Sparkles className={`w-6 h-6 mb-3 text-[${ACCENT}] animate-pulse`} />
                          <p className="text-sm">Finding relevant resources...</p>
                        </div>
                      ) : resources.length > 0 ? (
                        <div className="space-y-1">
                          {resources.map((res, i) => {
                            const type = (res.resource_type || res.type || "").toLowerCase();
                            const IconObj = type.includes("video") ? Video :
                                            type.includes("doc") ? FileText :
                                            ExternalLink;
                            const title = res.resource_title || res.title || "Resource";
                            const url = res.resource_url || res.url || "#";
                            const description = res.resource_description || res.description || "";
                            const explanation = res.llm_explanation || res.explanation || "";

                            return (
                              <a
                                key={res.id || i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition group"
                              >
                                <div className="mt-0.5 p-1.5 rounded-lg bg-white/5 text-gray-400 group-hover:text-white transition shrink-0">
                                  <IconObj className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-200 group-hover:text-white transition line-clamp-2">{title}</p>
                                  {(description || explanation) && (
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{description || explanation}</p>
                                  )}
                                  <span className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mt-1 block">{type || "resource"}</span>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-6 flex flex-col items-center justify-center text-gray-500 text-sm gap-3">
                          <p>{resourceError ? "Failed to load resources." : "No specific resources found."}</p>
                          <button
                            onClick={() => loadResources(chatId, true)}
                            className={`px-4 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition`}
                          >
                            ↻ Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Trigger Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowResources(!showResources)}
                className={`relative h-12 px-5 rounded-full shadow-2xl flex items-center justify-center gap-2.5 transition-colors font-medium text-sm ${
                  showResources ? `bg-[${ACCENT}] text-white shadow-[${ACCENT}]/20` : "bg-[#1a1a1a] border border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Resources
                
                {/* Notification dot if resources exist but panel is closed */}
                {!showResources && resources.length > 0 && !isGeneratingResources && (
                  <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 bg-[${ACCENT}] rounded-full border-2 border-[#1a1a1a]`} />
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
