'use client'
import { useState, useEffect, useMemo } from "react";

export default function ActivityGrid({ data = [] }) {
  const [timeframe, setTimeframe] = useState("Weekly");
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component only renders activity data on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getActivityData = () => {
    if (!data || data.length === 0) return [];
    
    // The data array contains 365 elements (daily counts for the past year)
    // We slice the end of the array to get the most recent data
    switch (timeframe) {
      case "Monthly":
        return data.slice(-30);
      case "Yearly":
        // For yearly, we should technically group by weeks (52), but for the sake of the dot grid aesthetic
        // let's just show 52 recent days or group them
        // Let's just slice 52 days for now to keep the UI shape the same
        return data.slice(-52);
      default:
        return data.slice(-7);
    }
  };

  const getOpacity = (level) => {
    switch (level) {
      case 0:
        return "bg-[oklch(64.6%_0.222_41.116/0.10)]";
      case 1:
        return "bg-[oklch(64.6%_0.222_41.116/0.25)]";
      case 2:
        return "bg-[oklch(64.6%_0.222_41.116/0.50)]";
      case 3:
        return "bg-[oklch(64.6%_0.222_41.116/0.75)]";
      case 4:
        return "bg-[oklch(64.6%_0.222_41.116/0.90)]";
      default:
        return "bg-[oklch(64.6%_0.222_41.116)]";
    }
  };

  // Only generate activity data on client side to avoid hydration mismatch
  const activityData = useMemo(() => {
    if (!isMounted) {
      return [];
    }
    return getActivityData();
  }, [timeframe, isMounted, data]);

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-white">Activity ({timeframe})</p>

        {/* Timeframe Buttons */}
        <div className="flex gap-2">
          {["Weekly", "Monthly", "Yearly"].map((label) => (
            <button
              key={label}
              onClick={() => setTimeframe(label)}
              className={`text-xs px-3 py-1 rounded transition-all ${
                timeframe === label
                  ? "bg-[oklch(64.6%_0.222_41.116)] text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div
        className={`grid gap-1 ${
          timeframe === "Weekly"
            ? "grid-cols-7"
            : timeframe === "Monthly"
            ? "grid-cols-10"
            : "grid-cols-13"
        }`}
      >
        {isMounted && activityData.length > 0 ? (
          activityData.map((level, index) => (
            <div
              key={index}
              className={`aspect-square rounded-sm ${getOpacity(level)} transition-all duration-300`}
            ></div>
          ))
        ) : (
          // Placeholder during SSR/initial render
          Array.from({ 
            length: timeframe === "Weekly" ? 7 : timeframe === "Monthly" ? 30 : 52 
          }).map((_, index) => (
            <div
              key={index}
              className="aspect-square rounded-sm bg-[oklch(64.6%_0.222_41.116/0.10)] transition-all duration-300"
            ></div>
          ))
        )}
      </div>
    </div>
  );
}
