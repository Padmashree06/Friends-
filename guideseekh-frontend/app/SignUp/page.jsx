"use client";
import { motion } from "framer-motion";
import { Bricolage_Grotesque } from "next/font/google";
import { useRouter } from "next/navigation";
import { useState } from "react";


const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700"],
});

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name || !email || !phoneNumber || !password) {
      setError("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";
      const res = await fetch(`${apiBaseUrl}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, email, phone: phoneNumber, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Signup failed");
      }
      if (data?.token) {
        localStorage.setItem("authToken", data.token);
      }
      if (data?.user?.id) {
        localStorage.setItem("userId", data.user.id.toString());
      }
      if (data?.user?.username) {
        localStorage.setItem("username", data.user.username);
      }
      if (data?.user?.email) {
        localStorage.setItem("userEmail", data.user.email);
      }
      router.push("/onboarding");
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className= {`${bricolageGrotesque.className} min-h-screen flex items-center justify-center bg-black text-white`}>
      {/* Outer container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative bg-gray-900/60 backdrop-blur-lg rounded-2xl shadow-[0_0_40px_rgba(0,0,0)] p-10 w-[90%] max-w-md border border-white/10"
      >
        {/* Subtle glowing border effect */}
        <div className="absolute -inset-0.5 bg-linear-to-r from-violet-900 to-neutral-600 rounded-2xl opacity-0 blur-lg"></div>

        {/* Inner content */}
        <div className="relative z-10">
          <h2 className="text-4xl font-extrabold text-center mb-8 bg-linear-to-r from-violet-50 to-violet-100 bg-clip-text text-transparent">
            Sign-Up
          </h2>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Name */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-100 placeholder-gray-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-100 placeholder-gray-500"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Phone Number</label>
              <input
                type="tel"
                placeholder="Enter your phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-100 placeholder-gray-500"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-100 placeholder-gray-500"
              />
            </div>

           
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              className="relative w-full py-3 mt-4 font-semibold rounded-full overflow-hidden disabled:opacity-60"
            >
              <div className="absolute inset-0 bg-violet-900"></div>
              <div className="absolute inset-0 bg-linear-to-r from-violet-600 to-cyan-800 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity"></div>
              <span className="relative z-10 text-white">{loading ? "Signing Up..." : "Sign Up"}</span>
            </motion.button>
          </form>

          {error && (
            <p className="mt-4 text-center text-sm text-red-400">{error}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
