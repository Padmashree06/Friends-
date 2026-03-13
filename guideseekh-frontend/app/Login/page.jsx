"use client";
import { motion } from "framer-motion";
import { Bricolage_Grotesque } from "next/font/google";
import { useState } from "react";
import { useRouter } from "next/navigation";


const bricolageGrotesque = Bricolage_Grotesque({ subsets: ["latin"], weight: ["700"] });

const A = "oklch(64.6% 0.222 41.116)";
const inputCls = "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-100 placeholder-gray-600 outline-none transition-all";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please enter email and password"); return; }
    setLoading(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";
      const res = await fetch(`${apiBaseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Login failed");
      if (data?.token)         localStorage.setItem("authToken", data.token);
      if (data?.user?.id)      localStorage.setItem("userId", data.user.id.toString());
      if (data?.user?.username) localStorage.setItem("username", data.user.username);
      if (data?.user?.email)   localStorage.setItem("userEmail", data.user.email);
      router.push(data?.hasCompletedOnboarding ? "/chat" : "/onboarding");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`${bricolageGrotesque.className} min-h-screen flex items-center justify-center text-white`}
      style={{
        background: "url('/image.png') center/cover no-repeat",
        position: "relative",
      }}
    >
      {/* Dark overlay for readability */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 0 }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="relative w-[90%] max-w-md rounded-2xl p-10 z-10"
        style={{ background: "oklch(10% 0 0)", border: "1px solid oklch(20% 0 0)" }}
      >
        {/* Top accent line */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, transparent, ${A}, transparent)` }} />

        <h2 className="text-4xl font-extrabold text-center mb-8" style={{ color: "oklch(97% 0 0)" }}>
          Login
        </h2>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm mb-2" style={{ color: "oklch(60% 0 0)" }}>Email</label>
            <input
              type="email" placeholder="Enter your email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              style={{ "--tw-ring-color": A }}
              onFocus={(e) => e.target.style.borderColor = A}
              onBlur={(e)  => e.target.style.borderColor = "oklch(20% 0 0)"}
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: "oklch(60% 0 0)" }}>Password</label>
            <input
              type="password" placeholder="Enter your password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              onFocus={(e) => e.target.style.borderColor = A}
              onBlur={(e)  => e.target.style.borderColor = "oklch(20% 0 0)"}
            />
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <motion.button
            whileHover={{ scale: 1.03, boxShadow: `0 0 28px -4px ${A}` }}
            whileTap={{ scale: 0.97 }}
            type="submit" disabled={loading}
            className="w-full py-3 mt-2 font-bold rounded-full disabled:opacity-60 transition-all"
            style={{ background: A, color: "oklch(97% 0 0)" }}
          >
            {loading ? "Logging in…" : "Login"}
          </motion.button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "oklch(55% 0 0)" }}>
          Don&apos;t have an account?{" "}
          <a href="/SignUp" className="font-semibold transition-colors" style={{ color: A }}>
            Sign up
          </a>
        </p>
      </motion.div>
    </div>
  );
}
