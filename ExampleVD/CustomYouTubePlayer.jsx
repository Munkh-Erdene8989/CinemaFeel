/**
 * CustomYouTubePlayer
 * ---------------------------------------------------------------------------
 * YouTube-ийн видеог НУУЦ iframe-ээр (controls хаасан) оруулаад, дээр нь
 * өөрийн гар бүтээлийн удирдлага (play/pause, seek, volume, fullscreen,
 * episode navigation) болон SRT хадмал зурдаг drop-in React компонент.
 *
 * ШААРДЛАГА
 *  - React 17+ (hooks ашигладаг)
 *  - Гадаад сан (npm пакет) шаардахгүй — зөвхөн YouTube-ийн
 *    https://www.youtube.com/iframe_api script-ийг динамикаар ачаална.
 *
 * ЗАГВАР АШИГЛАЛТ
 *   import CustomYouTubePlayer from './CustomYouTubePlayer';
 *
 *   <CustomYouTubePlayer
 *     videoId="M7lc1UVf-VE"
 *     subtitleUrl="/subs/episode-34.srt"
 *   />
 *
 *   <CustomYouTubePlayer
 *     videoId="e_N2NWHOTwQ"
 *     startAt={125}
 *     subtitleText={srtRaw}
 *     subtitleOffsetMs={0}
 *   />
 */

import { useEffect, useRef, useState } from "react";

let ytApiPromise = null;
function loadYouTubeIframeAPI() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = (total % 60).toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${secs}`;
  return `${minutes}:${secs}`;
}

export function timestampToSeconds(value) {
  const match = /^(\d+):(\d{2}):(\d{2}),(\d{3})$/.exec(String(value).trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4]);
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

export function parseSrt(raw) {
  const text = String(raw).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const cues = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.trim().split("\n");
    if (!lines[0]) continue;
    let index = 0;
    if (/^\d+$/.test(lines[0].trim())) index += 1;
    const timing = lines[index];
    if (!timing || !timing.includes("-->")) continue;
    const parts = timing.split("-->");
    const start = timestampToSeconds(parts[0] || "");
    const end = timestampToSeconds((parts[1] || "").trim().split(/\s+/)[0] || "");
    if (start == null || end == null || end <= start) continue;
    const cueText = lines.slice(index + 1).join("\n").trim();
    if (!cueText) continue;
    cues.push({ start, end, text: cueText });
  }
  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return cues;
}

function findActiveCue(cues, time) {
  let low = 0;
  let high = cues.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (time < cue.start) high = mid - 1;
    else if (time >= cue.end) low = mid + 1;
    else return cue;
  }
  return null;
}

function silenceYoutubeCaptions(player) {
  if (!player) return;
  try {
    player.unloadModule("captions");
  } catch {
    /* captions module may already be unloaded */
  }
  try {
    player.setOption("captions", "track", {});
  } catch {
    /* captions option is unavailable until the module exists */
  }
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || null;
}

function requestFullscreen(element) {
  const method = element.requestFullscreen || element.webkitRequestFullscreen || element.mozRequestFullScreen || element.msRequestFullscreen;
  if (!method) return Promise.reject(new Error("unsupported"));
  try {
    const result = method.call(element);
    return result && typeof result.then === "function" ? result : Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}

function exitFullscreen() {
  const method = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (!method) return Promise.resolve();
  try {
    const result = method.call(document);
    return result && typeof result.then === "function" ? result : Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}

function relaxOverflow(element) {
  const changed = [];
  let node = element?.parentElement;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    if (style.overflow !== "visible" || style.overflowX !== "visible" || style.overflowY !== "visible") {
      changed.push([node, node.style.overflow, node.style.overflowX, node.style.overflowY]);
      node.style.overflow = "visible";
    }
    node = node.parentElement;
  }
  return () => {
    changed.forEach(([target, overflow, overflowX, overflowY]) => {
      target.style.overflow = overflow;
      target.style.overflowX = overflowX;
      target.style.overflowY = overflowY;
    });
  };
}

function injectStyles() {
  if (typeof document === "undefined") return;
  let style = document.querySelector("style[data-cyp-styles]");
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("data-cyp-styles", "true");
    document.head.appendChild(style);
  }
  style.textContent = `
    .cyp-container {
      position: relative;
      width: 100%;
      background: #000;
      color: #fff;
      overflow: hidden;
      border-radius: 12px;
      user-select: none;
      font-family: inherit;
    }
    .cyp-top {
      position: relative;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 52px;
      padding: 10px 14px;
    }
    .cyp-top-title {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      font-size: 14px;
      font-weight: 700;
    }
    .cyp-top-title span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cyp-top button,
    .cyp-row button {
      background: transparent;
      border: 0;
      color: #fff;
      cursor: pointer;
      line-height: 1;
    }
    .cyp-back {
      display: grid;
      width: 32px;
      height: 32px;
      place-items: center;
      font-size: 18px;
    }
    .cyp-episodes {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      border: 1px solid rgba(255,255,255,0.18) !important;
      border-radius: 999px;
      padding: 7px 12px !important;
      font-size: 13px;
      font-weight: 700;
    }
    .cyp-stage {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      overflow: hidden;
    }
    .cyp-iframe-slot,
    .cyp-iframe-slot iframe,
    .cyp-stage > iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      pointer-events: none;
    }
    .cyp-click-shield {
      position: absolute;
      inset: 0;
      z-index: 1;
      cursor: pointer;
      background: transparent;
    }
    .cyp-badge {
      position: absolute;
      top: 12px;
      left: 14px;
      z-index: 2;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      pointer-events: none;
    }
    .cyp-mark {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: grid;
      place-items: center;
      pointer-events: none;
      user-select: none;
    }
    .cyp-mark span {
      max-width: 78%;
      color: rgba(255, 255, 255, 0.1);
      font-size: clamp(13px, 2.1vw, 22px);
      font-weight: 700;
      letter-spacing: 0.04em;
      line-height: 1.45;
      position: absolute;
      left: 50%;
      top: 65%;
      text-align: center;
      white-space: pre-line;
      transform: translate(-50%, -50%);
      text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
    }
    .cyp-play {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 4;
      display: grid;
      width: 68px;
      height: 68px;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: rgba(255,255,255,0.92);
      color: #111;
      transform: translate(-50%, -50%);
      cursor: pointer;
    }
    .cyp-subs {
      position: absolute;
      left: 8%;
      right: 8%;
      bottom: 7%;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      pointer-events: none;
      text-align: center;
    }
    .cyp-subs span {
      color: #fff;
      font-size: clamp(16px, 2.5vw, 30px);
      font-weight: 700;
      line-height: 1.35;
      text-shadow: 0 1px 2px #000, 0 0 10px rgba(0,0,0,0.85);
    }
    .cyp-controls {
      padding: 8px 16px 14px;
      background: #000;
    }
    .cyp-seek-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .cyp-seek {
      -webkit-appearance: none;
      appearance: none;
      flex: 1;
      width: 100%;
      height: 4px;
      border-radius: 999px;
      background: linear-gradient(to right, #ff2a2a var(--progress, 0%), rgba(255,255,255,0.28) var(--progress, 0%));
      outline: none;
      cursor: pointer;
    }
    .cyp-seek::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #fff;
      cursor: pointer;
    }
    .cyp-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
    }
    .cyp-row button {
      display: grid;
      width: 36px;
      height: 36px;
      place-items: center;
      padding: 0;
    }
    .cyp-row button:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .cyp-row button.cyp-cc {
      width: auto;
      min-width: 36px;
      border: 1px solid rgba(255,255,255,0.45);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      opacity: 0.7;
    }
    .cyp-row button.cyp-cc.on {
      background: #fff;
      color: #111;
      opacity: 1;
    }
    .cyp-time {
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .cyp-spacer {
      flex: 1;
    }
    .cyp-volume {
      -webkit-appearance: none;
      appearance: none;
      width: 84px;
      height: 3px;
      margin-left: 4px;
      border-radius: 999px;
      background: linear-gradient(to right, #ff2a2a var(--volume, 100%), rgba(255,255,255,0.28) var(--volume, 100%));
      outline: none;
      cursor: pointer;
    }
    .cyp-volume::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #fff;
      cursor: pointer;
    }
    .cyp-container.cyp-fs-fallback {
      position: fixed !important;
      z-index: 200 !important;
      margin: 0 !important;
      border-radius: 0 !important;
      background: #000;
      display: flex;
      flex-direction: column;
    }
    @media (orientation: landscape) {
      .cyp-container.cyp-fs-fallback {
        inset: 0;
        width: 100%;
        height: 100%;
        height: 100dvh;
        padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
      }
    }
    @media (orientation: portrait) {
      .cyp-container.cyp-fs-fallback {
        top: 50%;
        left: 50%;
        width: 100vh;
        width: 100dvh;
        height: 100vw;
        height: 100dvw;
        transform: translate(-50%, -50%) rotate(90deg);
      }
    }
    .cyp-container.cyp-fs-fallback .cyp-stage {
      flex: 1 1 auto;
      width: 100%;
      min-height: 0;
      aspect-ratio: auto;
    }
    .cyp-container.cyp-fs-fallback .cyp-controls {
      flex: none;
    }
    .cyp-container.cyp-fs-fallback .cyp-row {
      overflow-x: auto;
    }
  `;
  document.head.appendChild(style);
}

/**
 * @param {{
 *   videoId: string,
 *   startAt?: number,
 *   autoplay?: boolean,
 *   title?: string,
 *   episodeLabel?: string,
 *   onBack?: () => void,
 *   onEpisodes?: () => void,
 *   onPrevEpisode?: () => void,
 *   onNextEpisode?: () => void,
 *   subtitleUrl?: string,
 *   subtitleText?: string,
 *   subtitleOffsetMs?: number,
 *   onTimeUpdate?: (seconds: number) => void,
 *   watermark?: string,
 * }} props
 */
export default function CustomYouTubePlayer({
  videoId,
  startAt = 0,
  autoplay = false,
  title,
  episodeLabel,
  onBack,
  onEpisodes,
  onPrevEpisode,
  onNextEpisode,
  subtitleUrl,
  subtitleText,
  subtitleOffsetMs = 0,
  onTimeUpdate,
  watermark = "",
}) {
  const containerRef = useRef(null);
  const playerSlotRef = useRef(null);
  const playerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(Math.max(0, startAt));
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [cues, setCues] = useState([]);
  const [subtitlesOn, setSubtitlesOn] = useState(true);

  const subtitlesAvailable = Boolean((subtitleText && subtitleText.trim()) || subtitleUrl);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const heading = [title, episodeLabel].filter(Boolean).join(" · ");

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const inline = subtitleText?.trim();
    if (inline) {
      setCues(parseSrt(inline));
      return () => {
        cancelled = true;
      };
    }
    if (!subtitleUrl) {
      setCues([]);
      return undefined;
    }
    fetch(subtitleUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`SRT ${response.status}`);
        return response.text();
      })
      .then((body) => {
        if (!cancelled) setCues(parseSrt(body));
      })
      .catch((error) => {
        console.warn("SRT татаж чадсангүй.", error);
        if (!cancelled) setCues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subtitleText, subtitleUrl]);

  useEffect(() => {
    let cancelled = false;
    setCurrentTime(Math.max(0, startAt));
    setIsPlaying(false);

    let started = false;
    let kickTimer = 0;
    loadYouTubeIframeAPI().then((YT) => {
      if (cancelled || !playerSlotRef.current) return;

      playerRef.current = new YT.Player(playerSlotRef.current, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          cc_lang_pref: "",
          start: Math.max(0, Math.floor(startAt)),
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            silenceYoutubeCaptions(event.target);
            setDuration(event.target.getDuration());
            setVolume(event.target.getVolume());
            const time = event.target.getCurrentTime?.() ?? startAt;
            setCurrentTime(time);
            if (!autoplay) return;
            try {
              event.target.playVideo();
            } catch {
              /* playback starts on the muted fallback */
            }
            kickTimer = window.setTimeout(() => {
              if (cancelled || started || !playerRef.current?.playVideo) return;
              const state = playerRef.current.getPlayerState?.();
              const playerState = window.YT?.PlayerState;
              if (state === playerState?.PLAYING || state === playerState?.BUFFERING) return;
              try {
                playerRef.current.mute();
                setMuted(true);
                playerRef.current.playVideo();
              } catch {
                /* the play button stays if the browser blocks both attempts */
              }
            }, 800);
          },
          onStateChange: (event) => {
            silenceYoutubeCaptions(event.target);
            const state = window.YT?.PlayerState;
            if (!state) return;
            if (event.data === state.PLAYING) {
              started = true;
              setIsPlaying(true);
              setDuration(event.target.getDuration());
            } else if (event.data === state.PAUSED || event.data === state.ENDED) {
              setIsPlaying(false);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(kickTimer);
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, startAt]);

  useEffect(() => {
    if (!isPlaying || isSeeking) return undefined;
    const id = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        silenceYoutubeCaptions(playerRef.current);
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);
        onTimeUpdateRef.current?.(time);
      }
    }, 250);
    return () => clearInterval(id);
  }, [isPlaying, isSeeking]);

  useEffect(() => {
    const onChange = () => {
      const active = Boolean(fullscreenElement());
      setIsFullscreen(active);
      if (active) setPseudoFs(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (!pseudoFs) return undefined;
    const restoreOverflow = relaxOverflow(containerRef.current);
    const scrollY = window.scrollY;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    const onKey = (event) => {
      if (event.key === "Escape") setPseudoFs(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      restoreOverflow();
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      window.scrollTo(0, scrollY);
      window.removeEventListener("keydown", onKey);
    };
  }, [pseudoFs]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };

  const seekTo = (seconds) => {
    if (!playerRef.current?.seekTo) return;
    setCurrentTime(seconds);
    onTimeUpdateRef.current?.(seconds);
    playerRef.current.seekTo(seconds, true);
  };

  const finishSeek = (value) => {
    setIsSeeking(false);
    const next = parseFloat(value);
    const limit = duration || next;
    seekTo(Math.min(Math.max(0, next), limit));
  };

  const skip = (delta) => {
    const limit = duration || currentTime + delta;
    seekTo(Math.min(Math.max(0, currentTime + delta), limit));
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (muted) {
      playerRef.current.unMute();
      setMuted(false);
    } else {
      playerRef.current.mute();
      setMuted(true);
    }
  };

  const changeVolume = (value) => {
    if (!playerRef.current) return;
    playerRef.current.setVolume(value);
    setVolume(value);
    if (value === 0) {
      playerRef.current.mute();
      setMuted(true);
    } else if (muted) {
      playerRef.current.unMute();
      setMuted(false);
    }
  };

  const toggleFullscreen = () => {
    if (pseudoFs) {
      setPseudoFs(false);
      return;
    }
    if (fullscreenElement()) {
      exitFullscreen();
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    requestFullscreen(el)
      .then(() => {
        window.setTimeout(() => {
          if (!fullscreenElement()) setPseudoFs(true);
        }, 350);
      })
      .catch(() => setPseudoFs(true));
  };

  const pct = duration ? (currentTime / duration) * 100 : 0;
  const active = subtitlesOn ? findActiveCue(cues, currentTime + subtitleOffsetMs / 1000) : null;
  const lines = active ? active.text.split("\n").map((line) => line.trim()).filter(Boolean) : [];

  const volumeLevel = muted ? 0 : volume;

  return (
    <div ref={containerRef} className={`cyp-container${pseudoFs ? " cyp-fs-fallback" : ""}`}>
      {(heading || onBack || onEpisodes) && (
        <div className="cyp-top">
          <div className="cyp-top-title">
            {onBack && (
              <button type="button" className="cyp-back" onClick={onBack} aria-label="Буцах">
                ←
              </button>
            )}
            {heading && <span>{heading}</span>}
          </div>
          {onEpisodes && (
            <button type="button" className="cyp-episodes" onClick={onEpisodes}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
              Ангиуд
            </button>
          )}
        </div>
      )}

      <div className="cyp-stage">
        <div ref={playerSlotRef} className="cyp-iframe-slot" />
        <div className="cyp-click-shield" onClick={togglePlay} />
        {watermark ? (
          <div className="cyp-mark" aria-hidden="true">
            <span>{watermark}</span>
          </div>
        ) : null}
        {episodeLabel && <div className="cyp-badge">{episodeLabel}</div>}
        {!isPlaying && (
          <button type="button" className="cyp-play" onClick={togglePlay} aria-label="Тоглуулах">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
        {lines.length > 0 && (
          <div className="cyp-subs">
            {lines.map((line, index) => (
              <span key={`${index}-${line}`}>{line}</span>
            ))}
          </div>
        )}
      </div>

      <div className="cyp-controls">
        <div className="cyp-seek-row">
          <span className="cyp-time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={duration ? Math.min(currentTime, duration) : 0}
            onPointerDown={() => setIsSeeking(true)}
            onChange={(event) => setCurrentTime(parseFloat(event.target.value))}
            onPointerUp={(event) => finishSeek(event.currentTarget.value)}
            onKeyUp={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
                finishSeek(event.currentTarget.value);
              }
            }}
            className="cyp-seek"
            style={{ "--progress": `${pct}%` }}
          />
          <span className="cyp-time">{formatTime(duration)}</span>
        </div>
        <div className="cyp-row">
          <button type="button" onClick={togglePlay} aria-label={isPlaying ? "Зогсоох" : "Тоглуулах"}>
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button type="button" onClick={() => skip(-10)} aria-label="10 секунд ухрах" title="10 секунд ухрах">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-4.3 2.5L6.2 8.2A7 7 0 1 0 12 5zm-1 4v5l4-2.5L11 9z" /></svg>
          </button>
          <button type="button" onClick={() => skip(10)} aria-label="10 секунд урагшлах" title="10 секунд урагшлах">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5V2l5 4-5 4V7a5 5 0 1 0 4.3 2.5l1.5-1.3A7 7 0 1 1 12 5zm-1 4v5l4-2.5L11 9z" /></svg>
          </button>
          <button type="button" onClick={toggleMute} aria-label={muted || volume === 0 ? "Дуу нээх" : "Дуу хаах"}>
            {muted || volume === 0 ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm13.5 3 2.2-2.2-1.4-1.4L16 10.6l-2.3-2.2-1.4 1.4L14.6 12l-2.3 2.2 1.4 1.4L16 13.4l2.3 2.2 1.4-1.4L17.4 12z" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm11.5 3a3.5 3.5 0 0 0-2-3.15v6.3A3.5 3.5 0 0 0 15.5 12z" /></svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volumeLevel}
            onChange={(event) => changeVolume(parseInt(event.target.value, 10))}
            className="cyp-volume"
            style={{ "--volume": `${volumeLevel}%` }}
          />
          <div className="cyp-spacer" />
          <button type="button" onClick={onPrevEpisode} disabled={!onPrevEpisode} title="Өмнөх анги" aria-label="Өмнөх анги">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
          </button>
          <button type="button" onClick={onNextEpisode} disabled={!onNextEpisode} title="Дараагийн анги" aria-label="Дараагийн анги">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6z" /></svg>
          </button>
          {onEpisodes && (
            <button type="button" onClick={onEpisodes} title="Ангиуд" aria-label="Ангиуд">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            </button>
          )}
          {subtitlesAvailable && (
            <button
              type="button"
              className={`cyp-cc ${subtitlesOn ? "on" : ""}`}
              aria-pressed={subtitlesOn}
              title="Хадмал"
              onClick={() => setSubtitlesOn((value) => !value)}
            >
              CC
            </button>
          )}
          <button type="button" onClick={toggleFullscreen} aria-label="Дэлгэц дүүргэх">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {isFullscreen || pseudoFs ? <path d="M9 9H5V5M15 9h4V5M9 15H5v4M15 15h4v4" /> : <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />}
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
