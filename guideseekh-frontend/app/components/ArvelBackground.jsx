/**
 * ArvelBackground — flowing orange wave arcs on pitch-black canvas.
 * Sharp glowing crests sweep diagonally from top-left and bottom-right.
 * The vast majority of the canvas stays deep black.
 */
export default function ArvelBackground() {
  return (
    <div
      className="arvel-bg pointer-events-none"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        background: "#080808",
      }}
    >
      {/* ── TOP WAVE ─────────────────────────────────────────────────── */}
      <svg
        viewBox="0 0 1440 500"
        preserveAspectRatio="xMidYMin slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "clamp(300px, 42vw, 520px)",
        }}
      >
        <defs>
          {/* Bloom — only near the top-left corner */}
          <radialGradient id="tBloom" cx="28%" cy="0%" r="45%">
            <stop offset="0%"   stopColor="#FF6800" stopOpacity="0.60" />
            <stop offset="45%"  stopColor="#6B1800" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0"    />
          </radialGradient>

          {/* Body fill — only near the wave, fades to black fast */}
          <linearGradient id="tFill" x1="0%" y1="0%" x2="60%" y2="100%">
            <stop offset="0%"   stopColor="#AA3300" stopOpacity="0.55" />
            <stop offset="30%"  stopColor="#300800" stopOpacity="0.18" />
            <stop offset="60%"  stopColor="#000000" stopOpacity="0"    />
          </linearGradient>

          {/* Bright crest strip */}
          <linearGradient id="tCrest" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#FFD080" stopOpacity="1.0" />
            <stop offset="20%"  stopColor="#FF7200" stopOpacity="0.9" />
            <stop offset="55%"  stopColor="#CC3300" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0"   />
          </linearGradient>
        </defs>

        {/* Bloom ellipse — top-left */}
        <ellipse cx="300" cy="-80" rx="480" ry="240" fill="url(#tBloom)" />

        {/* Wave body — thin band, stays near the top */}
        <path
          d="M-20,0 L1460,0 L1460,130
             Q1120,250 780,195
             Q500,148 260,280
             Q110,340 -20,310 Z"
          fill="url(#tFill)"
        />

        {/* Sharp bright crest line */}
        <path
          d="M-20,308 Q110,338 260,278 Q500,145 780,192 Q1120,247 1460,127 L1460,142 Q1120,262 780,208 Q500,161 260,294 Q110,353 -20,322 Z"
          fill="url(#tCrest)"
          opacity="0.95"
        />
      </svg>

      {/* ── BOTTOM WAVE ──────────────────────────────────────────────── */}
      <svg
        viewBox="0 0 1440 400"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "clamp(240px, 34vw, 420px)",
        }}
      >
        <defs>
          <radialGradient id="bBloom" cx="72%" cy="100%" r="42%">
            <stop offset="0%"   stopColor="#FF6500" stopOpacity="0.58" />
            <stop offset="45%"  stopColor="#5A1500" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0"    />
          </radialGradient>

          <linearGradient id="bFill" x1="100%" y1="100%" x2="40%" y2="0%">
            <stop offset="0%"   stopColor="#992800" stopOpacity="0.52" />
            <stop offset="32%"  stopColor="#280600" stopOpacity="0.15" />
            <stop offset="60%"  stopColor="#000000" stopOpacity="0"    />
          </linearGradient>

          <linearGradient id="bCrest" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%"   stopColor="#FFD060" stopOpacity="1.0" />
            <stop offset="20%"  stopColor="#FF6E00" stopOpacity="0.9" />
            <stop offset="55%"  stopColor="#991E00" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0"   />
          </linearGradient>
        </defs>

        {/* Bloom ellipse — bottom-right */}
        <ellipse cx="1140" cy="480" rx="560" ry="260" fill="url(#bBloom)" />

        {/* Wave body — thin band near bottom */}
        <path
          d="M1460,400 L-20,400 L-20,280
             Q260,138 580,198
             Q860,248 1120,128
             Q1290,62 1460,80 Z"
          fill="url(#bFill)"
        />

        {/* Sharp bright crest line */}
        <path
          d="M1460,78 Q1290,60 1120,126 Q860,246 580,196 Q260,135 -20,278 L-20,294 Q260,153 580,212 Q860,262 1120,142 Q1290,76 1460,94 Z"
          fill="url(#bCrest)"
          opacity="0.90"
        />
      </svg>
    </div>
  );
}
