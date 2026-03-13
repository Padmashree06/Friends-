"use client";
import React, { useState } from "react";
import OnboardingFlow from "../components/OnboardingFlow";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleComplete(formData) {
    setError("");
    setLoading(true);
    const userId = localStorage.getItem("userId");
    if (!userId) { setError("User ID not found. Please sign in again."); setLoading(false); return; }

    const questions = [
      { question_number: 1, question: "How do you prefer to learn? Arrange by priority", answer: Array.isArray(formData.learningPreference) ? formData.learningPreference.join(", ") : String(formData.learningPreference) },
      { question_number: 2, question: "What are your preferred hours and time?", answer: String(formData.preferredHours || "") },
      { question_number: 3, question: "How often would you like to be reminded?", answer: String(formData.reminderFrequency || "") },
      { question_number: 4, question: "Would you like facts notifications about your topic?", answer: String(formData.factsNotifications || "") },
    ];

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";
      const res = await fetch(`${apiBaseUrl}/userinterest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: parseInt(userId, 10), answers: questions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save answers");
      router.push("/chat");
    } catch (err) {
      setError(err.message || "Failed to save answers");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg text-white text-sm shadow-lg"
          style={{ background: "oklch(40% 0.2 27.325)" }}>
          {error}
        </div>
      )}
      {loading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg text-white text-sm shadow-lg"
          style={{ background: "oklch(57.7% 0.245 27.325 / 0.9)" }}>
          Saving your answers…
        </div>
      )}
      <OnboardingFlow onComplete={handleComplete} />
    </>
  );
}
