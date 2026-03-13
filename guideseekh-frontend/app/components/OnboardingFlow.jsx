"use client";
import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const A = "oklch(64.6% 0.222 41.116)";

export default function OnboardingFlow({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState({
    learningPreference: ['Videos', 'Documents', 'Conversations with the AI'],
    preferredHours: '',
    reminderFrequency: '',
    factsNotifications: '',
  });

  const selectCls = "w-full rounded-lg bg-white/5 text-white border border-white/10 outline-none px-4 py-3 transition";

  const steps = useMemo(() => ([
    {
      key: 'learningPreference',
      label: 'How do you prefer to learn? Arrange by priority',
      render: (value, onChange) => {
        const items = Array.isArray(value) && value.length ? value : ['Videos', 'Documents', 'Conversations with the AI'];
        function move(from, to) {
          if (to < 0 || to >= items.length) return;
          const next = [...items];
          const [m] = next.splice(from, 1);
          next.splice(to, 0, m);
          onChange(next);
        }
        return (
          <div className="space-y-3">
            {items.map((opt, idx) => (
              <div key={opt} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 flex items-center justify-center rounded-md text-white/80 text-sm font-bold"
                    style={{ background: `oklch(57.7% 0.245 27.325 / 0.2)`, border: `1px solid oklch(57.7% 0.245 27.325 / 0.4)` }}>
                    {idx + 1}
                  </div>
                  <span className="text-sm text-white">{opt}</span>
                </div>
                <div className="flex gap-2">
                  {[{fn: () => move(idx, idx - 1), disabled: idx === 0, label: '↑'}, {fn: () => move(idx, idx + 1), disabled: idx === items.length - 1, label: '↓'}].map(({fn, disabled, label}) => (
                    <button key={label} type="button" onClick={fn} disabled={disabled}
                      className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm transition">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'preferredHours',
      label: 'What are your preferred hours and time?',
      render: (value, onChange) => (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., evenings 6–7"
          className="w-full rounded-lg bg-white/5 text-white placeholder-white/40 border border-white/10 outline-none px-4 py-3 transition"
          onFocus={(e) => e.target.style.borderColor = A} onBlur={(e) => e.target.style.borderColor = 'oklch(20% 0 0)'} />
      ),
    },
    {
      key: 'reminderFrequency',
      label: 'How often would you like to be reminded?',
      render: (value, onChange) => (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}
          onFocus={(e) => e.target.style.borderColor = A} onBlur={(e) => e.target.style.borderColor = 'oklch(20% 0 0)'}>
          <option value="" className="bg-black">Select one</option>
          <option value="Daily" className="bg-black">Daily</option>
          <option value="3x/week" className="bg-black">3 times a week</option>
          <option value="Weekly" className="bg-black">Weekly</option>
          <option value="Never" className="bg-black">Never</option>
        </select>
      ),
    },
    {
      key: 'factsNotifications',
      label: 'Would you like facts notifications about your topic?',
      render: (value, onChange) => (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}
          onFocus={(e) => e.target.style.borderColor = A} onBlur={(e) => e.target.style.borderColor = 'oklch(20% 0 0)'}>
          <option value="" className="bg-black">Select one</option>
          <option value="Yes" className="bg-black">Yes</option>
          <option value="No" className="bg-black">No</option>
        </select>
      ),
    },
  ]), []);

  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;
  const currentValue = formData[currentStep.key] ?? '';

  function updateField(nextValue) { setFormData((prev) => ({ ...prev, [currentStep.key]: nextValue })); }
  function handleNext() { if (stepIndex < totalSteps - 1) { setStepIndex((i) => i + 1); } else { if (typeof onComplete === 'function') onComplete(formData); } }
  function handleBack() { if (stepIndex > 0) setStepIndex((i) => i - 1); }

  const canProceed = Array.isArray(currentValue) ? currentValue.length > 0 : String(currentValue).trim().length > 0;

  return (
    <div className="min-h-screen w-full text-white flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "oklch(6% 0 0)" }}>

      <div className="w-full max-w-lg relative z-10">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === stepIndex ? '24px' : '8px', background: i <= stepIndex ? A : 'oklch(25% 0 0)' }} />
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep.key}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative rounded-2xl p-6 sm:p-8"
            style={{ background: "oklch(10% 0 0)", border: "1px solid oklch(20% 0 0)" }}
          >
            {/* Top accent */}
            <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl"
              style={{ background: `linear-gradient(90deg, transparent, ${A}, transparent)` }} />

            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">{currentStep.label}</h2>
            </div>

            <div className="mb-6">{currentStep.render(currentValue, updateField)}</div>

            <div className="flex items-center justify-between gap-3">
              <button onClick={handleBack} disabled={stepIndex === 0}
                className="px-5 py-2.5 rounded-lg text-sm font-medium border transition disabled:opacity-40"
                style={{ borderColor: 'oklch(25% 0 0)', color: 'oklch(70% 0 0)', background: 'transparent' }}>
                ← Back
              </button>
              <motion.button onClick={handleNext} disabled={!canProceed}
                whileHover={{ scale: 1.03, boxShadow: `0 0 20px -4px ${A}` }} whileTap={{ scale: 0.97 }}
                className="px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-40 transition text-white"
                style={{ background: canProceed ? A : 'oklch(30% 0.1 27.325)' }}>
                {stepIndex === totalSteps - 1 ? 'Finish →' : 'Next →'}
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="text-center mt-4 text-xs" style={{ color: 'oklch(45% 0 0)' }}>
          Step {stepIndex + 1} of {totalSteps}
        </p>
      </div>
    </div>
  );
}
