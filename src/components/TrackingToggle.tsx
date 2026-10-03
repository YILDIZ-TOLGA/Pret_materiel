"use client";
import { useEffect, useState } from "react";
import { NO_TRACK, trackingRefused } from "./Tracker";

export function TrackingToggle() {
  const [refused, setRefused] = useState<boolean | null>(null);
  useEffect(() => setRefused(trackingRefused()), []);

  function toggle(on: boolean) {
    try {
      if (on) localStorage.removeItem(NO_TRACK);
      else { localStorage.setItem(NO_TRACK, "1"); localStorage.removeItem("vid"); }
    } catch {}
    setRefused(trackingRefused());
  }

  if (refused === null) return null;
  return (
    <div className="box">
      <label className="check">
        <input type="checkbox" checked={!refused} onChange={(e) => toggle(e.target.checked)} />
        <span><strong>Mesure d&apos;audience</strong> — {refused ? "désactivée sur cet appareil et ce navigateur." : "activée. Décochez pour vous y opposer."}</span>
      </label>
    </div>
  );
}
