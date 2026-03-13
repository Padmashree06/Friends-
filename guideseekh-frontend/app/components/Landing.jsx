"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRef, useEffect } from "react";

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const C = {
  accent:      "oklch(64.6% 0.222 41.116)",
  accentDim:   "oklch(40% 0.18 27.325)",
  accentGlow:  "oklch(57.7% 0.245 27.325 / 0.25)",
  bg:          "oklch(6% 0 0)",
  surface:     "oklch(10% 0 0)",
  border:      "oklch(20% 0 0)",
  borderHover: "oklch(57.7% 0.245 27.325 / 0.5)",
  fg:          "oklch(97% 0 0)",
  muted:       "oklch(55% 0 0)",
  white:       "oklch(98% 0 0)",
  black:       "oklch(0% 0 0)",
};

/* ─── Interactive Background ─────────────────────────────────────────────── */
function LandingBackground() {
  const canvasRef = useRef(null);
  const mouse     = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, W, H;

    // Warm orange / amber / red palette
    const PALETTE = [
      [255, 120, 20],
      [255,  80, 10],
      [220,  60,  5],
      [255, 160, 40],
      [180,  40,  5],
      [255, 200, 60],
    ];

    const N = 52;
    let particles = [];

    const mkParticle = () => {
      const col = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      return {
        x:     Math.random() * W,
        y:     Math.random() * H,
        vx:    (Math.random() - 0.5) * 0.4,
        vy:    (Math.random() - 0.5) * 0.4,
        r:     20 + Math.random() * 60,
        col,
        alpha: 0.07 + Math.random() * 0.11,
        phase: Math.random() * Math.PI * 2,
        speed: 0.008 + Math.random() * 0.012,
      };
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      particles = Array.from({ length: N }, mkParticle);
    };

    const onMouse = (e) => { mouse.current.x = e.clientX; mouse.current.y = e.clientY; };
    const onTouch = (e) => { mouse.current.x = e.touches[0].clientX; mouse.current.y = e.touches[0].clientY; };

    const draw = () => {
      // Translucent fill → smooth trail / smear
      ctx.fillStyle = "rgba(8,8,8,0.20)";
      ctx.fillRect(0, 0, W, H);

      const mx = mouse.current.x;
      const my = mouse.current.y;

      for (const p of particles) {
        // Breathe
        p.phase += p.speed;
        const radius = p.r * (1 + 0.18 * Math.sin(p.phase));

        // Mouse physics
        const dx   = mx - p.x;
        const dy   = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < 220) {
          // repel
          const f = ((220 - dist) / 220) * 0.85;
          p.vx -= (dx / dist) * f;
          p.vy -= (dy / dist) * f;
        } else if (dist > 520 && dist < 920) {
          // soft long-range drift toward cursor
          const f = ((dist - 520) / 400) * 0.055;
          p.vx += (dx / dist) * f;
          p.vy += (dy / dist) * f;
        }

        // Damping + organic noise
        p.vx = p.vx * 0.97 + (Math.random() - 0.5) * 0.06;
        p.vy = p.vy * 0.97 + (Math.random() - 0.5) * 0.06;

        // Speed cap
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 3) { p.vx = (p.vx / spd) * 3; p.vy = (p.vy / spd) * 3; }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < -radius)       p.x = W + radius;
        if (p.x > W + radius)    p.x = -radius;
        if (p.y < -radius)       p.y = H + radius;
        if (p.y > H + radius)    p.y = -radius;

        // Soft radial glow orb
        const [r, g, b] = p.col;
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grd.addColorStop(0,   `rgba(${r},${g},${b},${p.alpha * 1.7})`);
        grd.addColorStop(0.4, `rgba(${r},${g},${b},${p.alpha})`);
        grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // Subtle mesh lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            const op = (1 - d / 130) * 0.055;
            ctx.strokeStyle = `rgba(255,110,20,${op})`;
            ctx.lineWidth   = 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize",    resize);
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize",    resize);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none" />;
}

/* ─── Hero ──────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6">

      {/* Ambient glow blob */}
      <div className="absolute inset-x-0 top-1/3 -translate-y-1/2 h-[500px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse 55% 45% at 50% 50%, ${C.accentGlow} 0%, transparent 70%)` }} />

      {/* Eyebrow pill */}
      <motion.span
        initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-6 inline-flex items-center gap-2 rounded-full border px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.15em]"
        style={{ borderColor: C.accentDim, color: C.accent, background: "oklch(57.7% 0.245 27.325 / 0.08)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.accent }} />
        AI-powered learning
      </motion.span>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}
        className="text-[clamp(4.5rem,16vw,11rem)] font-black leading-none tracking-tight select-none"
        style={{
          color: C.white,
          textShadow: `0 0 80px ${C.accentGlow}, 0 0 160px ${C.accentGlow}`,
        }}
      >
        Khoj
      </motion.h1>

      {/* Divider line with accent dots */}
      <motion.div
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: 0.25 }}
        className="my-6 flex items-center gap-3"
      >
        <span className="h-px w-16 opacity-30" style={{ background: C.white }} />
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.accent }} />
        <span className="h-px w-16 opacity-30" style={{ background: C.white }} />
      </motion.div>

      {/* Sub-text */}
      <motion.p
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
        className="max-w-sm text-xl font-light mb-10"
        style={{ color: C.muted }}
      >
        A structured way to tunnel your curiosity.
      </motion.p>

      {/* CTA buttons */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.32 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        {/* Primary — solid accent */}
        <Link href="/Login">
          <motion.button
            whileHover={{ scale: 1.06, boxShadow: `0 0 32px -4px ${C.accent}` }}
            whileTap={{ scale: 0.96 }}
            className="px-10 py-4 rounded-full font-bold text-base transition-all"
            style={{ background: C.accent, color: C.white }}
          >
            Login
          </motion.button>
        </Link>

        {/* Ghost — border only */}
        <Link href="/SignUp">
          <motion.button
            whileHover={{ scale: 1.06, borderColor: C.accent, color: C.accent }}
            whileTap={{ scale: 0.96 }}
            className="px-10 py-4 rounded-full font-bold text-base border transition-all"
            style={{ borderColor: C.border, color: C.fg, background: "transparent" }}
          >
            Sign Up
          </motion.button>
        </Link>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{ color: C.muted }}
      >
        <span className="text-xs uppercase tracking-widest">Scroll</span>
        <div className="w-px h-8 animate-pulse" style={{ background: `linear-gradient(to bottom, ${C.accent}, transparent)` }} />
      </motion.div>
    </section>
  );
}

/* ─── Features ──────────────────────────────────────────────────────────── */
const FEATURES = [
  { src: "/calendar(3).png", title: "Personalized Schedule", desc: "Smart timetables that adapt to your goals, pace, and daily routine." },
  { src: "/books.png",       title: "Curated Resources",     desc: "Hand-picked courses, videos, and articles tailored to your interests." },
  { src: "/progress.png",    title: "Progress Tracker",      desc: "Track your learning, evaluate results, and stay motivated." },
  { src: "/bell.png",        title: "Custom Reminders",      desc: "Reminders via Email or WhatsApp at your chosen frequency." },
  { src: "/cross.png",       title: "Smart Quizzes",         desc: "Test your knowledge, find weak spots, and reinforce retention." },
  { src: "/bot.png",         title: "All-in-one Platform",   desc: "Stay curious, persistent, and motivated — in one place." },
];

function Features() {
  return (
    <section className="relative z-10 py-28 px-6">
      <motion.h2
        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }}
        className="text-center text-4xl sm:text-5xl font-black mb-4 tracking-tight"
        style={{ color: C.white }}
      >
        Our Features
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.55, delay: 0.1 }}
        className="text-center mb-16 text-sm uppercase tracking-widest"
        style={{ color: C.accent }}
      >
        Everything you need to learn better
      </motion.p>

      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: i * 0.07 }}
            whileHover={{ y: -6, borderColor: C.borderHover }}
            className="group relative rounded-2xl p-7 overflow-hidden transition-all duration-300 cursor-default"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            {/* Accent glow on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(ellipse 80% 55% at 50% 110%, oklch(57.7% 0.245 27.325 / 0.12) 0%, transparent 70%)` }} />
            {/* Top edge accent line */}
            <div className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)` }} />

            {/* Icon */}
            <div className="mb-5 inline-flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-300"
              style={{ background: "oklch(57.7% 0.245 27.325 / 0.12)", border: `1px solid oklch(57.7% 0.245 27.325 / 0.25)` }}>
              <Image src={f.src} alt={f.title} width={24} height={24} className="object-contain" />
            </div>

            <h3 className="text-base font-semibold mb-2 transition-colors duration-300"
              style={{ color: C.fg }}>
              {f.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
              {f.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="relative z-10 border-t py-8 text-center text-xs uppercase tracking-widest"
      style={{ borderColor: C.border, color: C.muted }}>
      © {new Date().getFullYear()} Khoj — All rights reserved
    </footer>
  );
}

/* ─── Export ──────────────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <div style={{ background: "#080808", color: C.fg, minHeight: "100vh" }}>
      <LandingBackground />
      <Hero />
      <Features />
      <Footer />
    </div>
  );
}
