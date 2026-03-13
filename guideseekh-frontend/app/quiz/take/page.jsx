"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, ArrowLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";

const A = "oklch(64.6% 0.222 41.116)";
const BG = "oklch(6% 0 0)";
const SURFACE = "oklch(10% 0 0)";
const BORDER = "oklch(18% 0 0)";

const Dots = () => (
  <div className="flex gap-1.5">
    {[0, 0.1, 0.2].map((d, i) => <span key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: A, animationDelay: `${d}s` }} />)}
  </div>
);

function TakeQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get("id");

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [startTime] = useState(Date.now());
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";

  useEffect(() => { if (!quizId) { router.push("/quiz"); return; } loadQuiz(); }, [quizId]);
  useEffect(() => { const t = setInterval(() => setTimeElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000); return () => clearInterval(t); }, [startTime]);

  const loadQuiz = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/quiz/${quizId}`);
      if (!res.ok) { const t = await res.text(); let m = "Unknown error"; try { m = JSON.parse(t).error || m; } catch { m = t || `HTTP ${res.status}`; } alert("Failed to load quiz: " + m); router.push("/quiz"); return; }
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { alert("Failed to parse quiz data"); router.push("/quiz"); return; }
      if (data.quiz && data.questions) { setQuiz(data.quiz); setQuestions(data.questions); } else { alert("Invalid quiz data"); router.push("/quiz"); }
    } catch (err) { alert("Failed to load quiz: " + err.message); router.push("/quiz"); }
    finally { setLoading(false); }
  };

  const handleAnswerChange = (qId, optIdx) => setAnswers(prev => ({ ...prev, [qId]: ["A","B","C","D"][optIdx] }));
  const handleTextAnswerChange = (qId, text) => setAnswers(prev => ({ ...prev, [qId]: text }));

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      const unanswered = questions.filter(q => !answers[q.id]).length;
      if (unanswered > 0 && !confirm(`${unanswered} unanswered question(s). Submit anyway?`)) return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: parseInt(quizId), answers }),
      });
      const data = await res.json();
      if (res.ok) setResults(data); else alert("Failed to submit: " + (data.error || "Unknown error"));
    } catch (err) { alert("Failed to submit: " + err.message); }
    finally { setSubmitting(false); }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}><Dots /></div>
  );

  if (results) return (
    <div className="min-h-screen p-4" style={{ background: BG }}>
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-8" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          {/* Top accent */}
          <div className="absolute inset-x-0 top-0 h-px rounded-t-xl" style={{ background: `linear-gradient(90deg,transparent,${A},transparent)` }} />

          <div className="text-center mb-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
              style={{ background: results.percentage >= 70 ? "oklch(40% 0.15 145 / 0.2)" : results.percentage >= 50 ? "oklch(70% 0.15 85 / 0.2)" : "oklch(50% 0.2 25 / 0.2)" }}>
              <GraduationCap className="w-10 h-10" style={{ color: results.percentage >= 70 ? "oklch(70% 0.15 145)" : results.percentage >= 50 ? "oklch(80% 0.15 85)" : A }} />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">Quiz Completed!</h1>
            <div className="text-5xl font-black mb-1" style={{ color: A }}>{results.score}/{results.total_questions}</div>
            <div className="text-xl font-semibold text-gray-300">{results.percentage.toFixed(1)}%</div>
          </div>

          <div className="space-y-3 mb-8">
            {results.results.map((result, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.08 }}
                className="p-4 rounded-lg border"
                style={{ background: result.is_correct ? "oklch(40% 0.1 145 / 0.12)" : "oklch(50% 0.2 25 / 0.1)", borderColor: result.is_correct ? "oklch(55% 0.15 145 / 0.3)" : "oklch(50% 0.2 25 / 0.3)" }}>
                <div className="flex items-start gap-3 mb-2">
                  {result.is_correct
                    ? <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "oklch(70% 0.15 145)" }} />
                    : <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: A }} />}
                  <div className="flex-1">
                    <p className="text-white font-medium mb-2">{result.question}</p>
                    {result.options?.length > 0 ? (
                      <div className="space-y-1">
                        {result.options.map((opt, oi) => {
                          const label = ["A","B","C","D"][oi];
                          const isCorrect = result.correct_answer === label;
                          const isUser = result.user_answer === label;
                          return (
                            <div key={oi} className="px-3 py-1.5 rounded text-sm"
                              style={{ background: isCorrect ? "oklch(40% 0.1 145 / 0.25)" : isUser && !isCorrect ? "oklch(50% 0.2 25 / 0.2)" : "oklch(15% 0 0)", color: isCorrect ? "oklch(75% 0.15 145)" : isUser && !isCorrect ? A : "oklch(55% 0 0)" }}>
                              {label}. {opt}{isCorrect && " ✓"}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="px-3 py-2 rounded text-sm" style={{ background: "oklch(15% 0 0)" }}>
                          <span className="text-gray-500">Correct:</span>
                          <p style={{ color: "oklch(70% 0.15 145)" }}>{result.correct_answer}</p>
                        </div>
                        <div className="px-3 py-2 rounded text-sm" style={{ background: result.is_correct ? "oklch(40% 0.1 145 / 0.15)" : "oklch(50% 0.2 25 / 0.1)" }}>
                          <span className="text-gray-500">Your answer:</span>
                          <p style={{ color: result.is_correct ? "oklch(70% 0.15 145)" : A }}>{result.user_answer}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push("/quiz")} className="px-6 py-3 rounded-lg font-semibold text-white transition"
              style={{ background: A }}>
              Back to Topics
            </button>
            <button onClick={() => router.push("/chat")} className="px-6 py-3 rounded-lg text-white transition"
              style={{ background: "oklch(14% 0 0)", border: `1px solid ${BORDER}` }}>
              Back to Chat
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 backdrop-blur-lg" style={{ background: "oklch(8% 0 0 / 0.9)", borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/quiz")} className="p-2 rounded-lg transition"
              style={{ background: "oklch(14% 0 0)", border: `1px solid ${BORDER}` }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">{quiz?.topic}</h1>
              <p className="text-xs" style={{ color: "oklch(50% 0 0)" }}>
                {Object.keys(answers).length} / {questions.length} answered
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ color: A }}>
            <Clock className="w-4 h-4" />
            <span className="font-mono text-sm font-semibold">{formatTime(timeElapsed)}</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 w-full" style={{ background: BORDER }}>
          <div className="h-0.5 transition-all" style={{ width: `${questions.length ? (Object.keys(answers).length / questions.length) * 100 : 0}%`, background: A }} />
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-3xl mx-auto p-4 space-y-5 py-6">
        {questions.map((question, idx) => (
          <motion.div key={question.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }}
            className="rounded-xl p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: A }}>
                Question {idx + 1} of {questions.length}
              </span>
              <h3 className="text-base font-semibold text-white mt-1">{question.question}</h3>
            </div>

            {question.options?.length > 0 ? (
              <div className="space-y-2">
                {question.options.map((option, oi) => {
                  const label = ["A","B","C","D"][oi];
                  const isSelected = answers[question.id] === label;
                  return (
                    <label key={oi} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition border"
                      style={{
                        background: isSelected ? "oklch(57.7% 0.245 27.325 / 0.12)" : "oklch(13% 0 0)",
                        borderColor: isSelected ? A : BORDER,
                      }}>
                      <input type="radio" name={`q-${question.id}`} value={label} checked={isSelected}
                        onChange={() => handleAnswerChange(question.id, oi)}
                        className="w-4 h-4" style={{ accentColor: A }} />
                      <span className="text-sm font-semibold" style={{ color: isSelected ? A : "oklch(60% 0 0)" }}>{label}.</span>
                      <span className="text-sm flex-1" style={{ color: isSelected ? "white" : "oklch(75% 0 0)" }}>{option}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "oklch(55% 0 0)" }}>Your Answer:</label>
                <textarea value={answers[question.id] || ""} onChange={(e) => handleTextAnswerChange(question.id, e.target.value)}
                  placeholder="Type your answer here…"
                  className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-600 outline-none resize-y min-h-24 transition"
                  style={{ background: "oklch(13% 0 0)", border: `1px solid ${BORDER}` }}
                  onFocus={(e) => e.target.style.borderColor = A}
                  onBlur={(e) => e.target.style.borderColor = BORDER} />
                <p className="mt-1 text-xs" style={{ color: "oklch(45% 0 0)" }}>Your answer will be checked by AI</p>
              </div>
            )}
          </motion.div>
        ))}

        <div className="flex justify-center pb-8">
          <motion.button whileHover={{ scale: 1.05, boxShadow: `0 0 28px -4px ${A}` }} whileTap={{ scale: 0.95 }}
            onClick={handleSubmit} disabled={submitting}
            className="px-10 py-4 rounded-xl font-bold text-lg text-white disabled:opacity-50 flex items-center gap-2 transition"
            style={{ background: A }}>
            {submitting ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</> : <><GraduationCap className="w-5 h-5" /> Submit Quiz</>}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default function TakeQuizPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(6% 0 0)" }}><Dots /></div>}>
      <TakeQuizContent />
    </Suspense>
  );
}
