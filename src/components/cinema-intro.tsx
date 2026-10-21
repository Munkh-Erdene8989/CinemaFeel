"use client";

import { useEffect, useState, type AnimationEvent } from "react";

const EXIT = "cinema-intro-exit";

export function CinemaIntro() {
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    const backup = window.setTimeout(() => setDone(true), 5200);
    return () => {
      root.style.overflow = previous;
      window.clearTimeout(backup);
    };
  }, [done]);

  const finish = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.animationName !== EXIT) return;
    setDone(true);
  };

  if (done) return null;

  return (
    <div className={leaving ? "cinema-intro cinema-intro--leave" : "cinema-intro"} role="dialog" aria-modal="true" aria-label="CinemaFeel" onAnimationEnd={finish}>
      <div className="cinema-intro__grain" aria-hidden="true" />
      <div className="cinema-intro__glow" aria-hidden="true" />
      <div className="cinema-intro__beam" aria-hidden="true" />
      <div className="cinema-intro__frame" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="cinema-intro__content">
        <img className="cinema-intro__logo" src="/cinema-feel-header.png" alt="CinemaFeel" fetchPriority="high" />
        <p className="cinema-intro__tagline">
          Контентоо бүтээ.
          <br />
          Орлогоо нэм.
        </p>
      </div>
      <button type="button" className="cinema-intro__skip" onClick={() => setLeaving(true)}>
        Алгасах
      </button>
    </div>
  );
}
