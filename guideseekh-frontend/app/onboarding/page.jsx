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
    if (!userId) {
      setError("User ID not found. Please sign in again.");
      setLoading(false);
      return;
    }

    // Transform form data to backend format
    const questions = [
      {
        question_number: 1,
        question: "How do you prefer to learn? Arrange by priority",
        answer: Array.isArray(formData.learningPreference)
          ? formData.learningPreference.join(", ")
          : String(formData.learningPreference),
      },
      {
        question_number: 2,
        question: "What are your preferred hours and time?",
        answer: String(formData.preferredHours || ""),
      },
      {
        question_number: 3,
        question: "How often would you like to be reminded?",
        answer: String(formData.reminderFrequency || ""),
      },
      {
        question_number: 4,
        question: "Would you like facts notifications about your topic?",
        answer: String(formData.factsNotifications || ""),
      },
    ];

    const payload = {
      id: parseInt(userId, 10),
      answers: questions,
    };

    try {
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";
      const res = await fetch(`${apiBaseUrl}/userinterest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save answers");
      }

      // Navigate to the chat page after successful submission
      router.push("/chat");
    } catch (err) {
      setError(err.message || "Failed to save answers");
      console.error("Onboarding save error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg">
          {error}
        </div>
      )}
      {loading && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-500/90 text-white px-6 py-3 rounded-lg shadow-lg">
          Saving your answers...
        </div>
      )}
      <OnboardingFlow onComplete={handleComplete} />
    </>
  );
}
