"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles, BookOpen, ExternalLink, Video, FileText, CheckCircle2, Clock } from "lucide-react";
import ActivityGrid from "../components/ActivityGrid";
import AppSidebar from "../components/AppSidebar";

const A = "oklch(64.6% 0.222 41.116)";

export default function Dashboard() {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [userId, setUserId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) {
      router.push("/Login");
      return;
    }
    setUserId(storedUserId);
    loadDashboardData(storedUserId);
  }, [router]);

  const loadDashboardData = async (uid) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/dashboard/${uid}`);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuizSubmit = () => {
    if (selected === null) return;
    setQuizSubmitted(true);
    // Optional: Send answer to backend to record daily quiz completion
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="flex gap-1.5">
          {[0, 0.15, 0.3].map((d, i) => (
            <span key={i} className={`w-2.5 h-2.5 bg-[#FF5500] rounded-full animate-bounce`} style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const timetable = dashboardData?.timetable || [];
  const resources = dashboardData?.resources || [];
  const dailyQuiz = dashboardData?.daily_quiz;
  const progress = dashboardData?.progress || { courses_completed: { completed: 0, total: 0 }, quizzes_passed: { passed: 0, total: 0 } };
  const activityData = dashboardData?.activity || [];

  return (
    <div className="min-h-screen text-white flex bg-black">
      <AppSidebar />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 sticky top-0 z-10 bg-[#0c0c0c]/90 border-b border-white/[0.07] backdrop-blur-xl">
          <span className="text-lg font-bold text-white">Dashboard</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <h1 className="text-4xl font-black mb-8 text-white">Dashboard</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Timetable */}
            <div className="rounded-xl p-6" style={{ background: "oklch(10% 0 0)", border: "1px solid oklch(18% 0 0)" }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Upcoming Timetable</h3>
                <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400 border border-white/10">{timetable.length} Scheduled</span>
              </div>
              
              {timetable.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm flex flex-col items-center">
                  <Clock className="w-8 h-8 mb-3 opacity-20" />
                  <p>No upcoming schedules.</p>
                  <p className="text-xs mt-1">Set reminders in your chats.</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {timetable.map((item, i, arr) => {
                    const dateObj = new Date(item.scheduled_time);
                    const dateStr = dateObj.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
                    const timeStr = dateObj.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' });
                    
                    return (
                      <div key={item.id} className="flex gap-3 items-start"
                        style={{ paddingBottom: i < arr.length - 1 ? "16px" : 0, borderBottom: i < arr.length - 1 ? "1px solid oklch(18% 0 0)" : "none", paddingTop: i > 0 ? "16px" : 0 }}>
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                          style={{ background: `oklch(57.7% 0.245 27.325 / 0.12)` }}>
                          <Clock className="w-4 h-4 text-[oklch(64.6%_0.222_41.116)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate text-left">{item.topic || "Study Session"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs" style={{ color: "oklch(50% 0 0)" }}>{dateStr} at {timeStr}</span>
                          </div>
                        </div>
                        <button onClick={() => router.push("/chat")} className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 transition shrink-0">
                          Open
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent Resources */}
            <div className="rounded-xl p-6" style={{ background: "oklch(10% 0 0)", border: "1px solid oklch(18% 0 0)" }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Recent Resources</h3>
                <BookOpen className="w-5 h-5 text-gray-500" />
              </div>
              
              {resources.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm flex flex-col items-center">
                  <BookOpen className="w-8 h-8 mb-3 opacity-20" />
                  <p>No resources found.</p>
                  <p className="text-xs mt-1">Chat to generate study materials.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {resources.map((res, i) => {
                    const type = (res.resource_type || res.type || "").toLowerCase();
                    const IconObj = type.includes("video") ? Video :
                                    type.includes("doc") ? FileText :
                                    ExternalLink;
                    const title = res.resource_title || res.title || "Resource";
                    const url = res.resource_url || res.url || "#";
                    
                    return (
                      <a key={res.id || i} href={url} target="_blank" rel="noopener noreferrer" 
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition group border border-transparent hover:border-white/5">
                        <div className="mt-0.5 p-1.5 rounded-lg bg-white/5 text-gray-400 group-hover:text-white transition shrink-0">
                          <IconObj className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-200 group-hover:text-white transition line-clamp-1 text-left">{title}</p>
                          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1 block text-left truncate">{type || "resource"}</span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quiz */}
            <div className="rounded-xl p-6 flex flex-col" style={{ background: "oklch(10% 0 0)", border: "1px solid oklch(18% 0 0)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Daily Quiz</h3>
                <Sparkles className="w-5 h-5 text-[oklch(64.6%_0.222_41.116)]" />
              </div>
              
              {!dailyQuiz ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-gray-500 text-sm">
                  <CheckCircle2 className="w-8 h-8 mb-3 opacity-20 text-green-500" />
                  <p>You're all caught up!</p>
                  <p className="text-xs mt-1">Start a new quiz from the learning section.</p>
                </div>
              ) : quizSubmitted ? (
                 <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-white">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-semibold mb-1 text-lg">Answer Recorded!</h4>
                  <p className="text-sm text-gray-400">Great job staying consistent.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm mb-5 text-gray-300 leading-relaxed text-left">
                    {dailyQuiz.question}
                  </p>
                  <div className="space-y-2 mb-5 flex-1 text-left">
                    {(() => {
                      let options = [];
                      try { options = JSON.parse(dailyQuiz.options || "[]"); } catch (e) { options = [dailyQuiz.answer]; }
                      return options.map((text, idx) => (
                        <label key={idx} onClick={() => setSelected(idx)}
                          className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-white/5"
                          style={{ borderColor: selected === idx ? A : "oklch(20% 0 0)", background: selected === idx ? `oklch(57.7% 0.245 27.325 / 0.08)` : "transparent" }}>
                          <input type="radio" name="quiz-option" readOnly checked={selected === idx} className="accent-[oklch(57.7%_0.245_27.325)]" />
                          <span className="text-sm text-white">{text}</span>
                        </label>
                      ));
                    })()}
                  </div>
                  <button onClick={handleQuizSubmit} disabled={selected === null}
                    className="w-full py-3 rounded-xl font-medium text-sm text-white transition disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
                    style={{ background: A }}>
                    Submit Answer
                  </button>
                </>
              )}
            </div>

            {/* Progress */}
            <div className="rounded-xl p-6" style={{ background: "oklch(10% 0 0)", border: "1px solid oklch(18% 0 0)" }}>
              <h3 className="text-lg font-bold mb-5 text-white">My Progress</h3>
              <div className="space-y-5 mb-8">
                {[
                  { 
                    label: "Quizzes Attempted", 
                    value: `${progress.courses_completed.completed}`, 
                    pct: progress.courses_completed.total > 0 ? Math.round((progress.courses_completed.completed / progress.courses_completed.total) * 100) : 0 
                  },
                  { 
                    label: "Quizzes Passed (80%+)", 
                    value: `${progress.quizzes_passed.passed}`, 
                    pct: progress.quizzes_passed.total > 0 ? Math.round((progress.quizzes_passed.passed / progress.quizzes_passed.total) * 100) : 0 
                  }
                ].map(({ label, value, pct }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-300">{label}</span>
                      <span className="text-sm font-semibold text-white">{value} <span className="text-gray-500 font-normal ml-1">({pct}%)</span></span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, background: A }} />
                    </div>
                  </div>
                ))}
              </div>
              <ActivityGrid data={activityData} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
