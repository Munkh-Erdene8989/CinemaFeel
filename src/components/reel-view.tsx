"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { REEL_YOUTUBE_SECONDS, reelSpan, type ReelClip } from "@/lib/reels";
import { MediaImage } from "./media-image";
import { Icon } from "./icons";
import { prefersReducedMotion } from "./motion";

const MuxVideo = dynamic(() => import("@mux/mux-video-react"), { ssr: false });

type ReelPayload = { seconds?: number; clips?: ReelClip[] };

type YTPlayer = {
  destroy?: () => void;
  mute?: () => void;
  unMute?: () => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  getPlayerState?: () => number;
  unloadModule?: (name: string) => void;
  setOption?: (module: string, option: string, value: unknown) => void;
};

function silenceYoutubeCaptions(player: YTPlayer) {
  try {
    player.unloadModule?.("captions");
  } catch {
    /* captions module may already be unloaded */
  }
  try {
    player.setOption?.("captions", "track", {});
  } catch {
    /* captions option is unavailable until the module exists */
  }
}

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer;
      PlayerState?: { UNSTARTED?: number; ENDED?: number; PLAYING?: number; PAUSED?: number; BUFFERING?: number; CUED?: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApi: Promise<NonNullable<Window["YT"]>> | null = null;

function loadYouTube() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApi) return youtubeApi;
  youtubeApi = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      if (window.YT) resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return youtubeApi;
}

export function ReelView() {
  const [clips, setClips] = useState<ReelClip[] | null>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  activeRef.current = active;

  useEffect(() => {
    let ignore = false;
    (async () => {
      const response = await fetch("/api/media/reels", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as ReelPayload;
      if (ignore) return;
      if (!response.ok || !Array.isArray(data.clips)) {
        setFailed(true);
        setClips([]);
        return;
      }
      setClips(data.clips);
    })().catch(() => {
      if (!ignore) {
        setFailed(true);
        setClips([]);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !clips?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const index = Number((visible?.target as HTMLElement | undefined)?.dataset.index);
        if (Number.isFinite(index)) setActive(index);
      },
      { root, threshold: [0.6, 0.8] },
    );
    Array.from(root.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [clips]);

  const go = (index: number) => {
    const count = clips?.length ?? 0;
    if (!count) return;
    const next = (index + count) % count;
    const node = scrollerRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`);
    node?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    setPaused(false);
  };

  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector("[role='dialog']")) return;
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        goRef.current(activeRef.current + 1);
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        goRef.current(activeRef.current - 1);
      } else if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!clips) {
    return <div className="grid h-dvh place-items-center bg-black text-sm font-bold text-zinc-400">Богино бичлэг бэлдэж байна...</div>;
  }

  if (!clips.length) {
    return (
      <div className="grid h-dvh place-items-center bg-black px-6 text-center">
        <div>
          <p className="text-lg font-black">{failed ? "Reel ачаалж чадсангүй" : "Reel-д орох кино алга"}</p>
          <a href="/" className="mt-5 inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-extrabold text-black">Нүүр лүү</a>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollerRef} className="h-dvh snap-y snap-mandatory overflow-y-auto bg-black">
      {clips.map((clip, index) => {
        return (
          <section key={`${clip.seriesId}-${clip.videoId}`} data-index={index} className="relative h-dvh snap-start overflow-hidden">
            {clip.image ? <MediaImage src={clip.image} alt="" fill sizes="100vw" className="object-cover opacity-50 blur-2xl" /> : <div className="absolute inset-0 bg-[#101014]" />}
            {index === active && clip.source === "file" ? (
              <ReelFilePlayer
                url={clip.url}
                muxPlaybackId={clip.muxPlaybackId}
                muxToken={clip.muxToken}
                seconds={clip.seconds || REEL_YOUTUBE_SECONDS}
                muted={muted}
                paused={paused}
                repeat={clips.length === 1}
                onProgress={setProgress}
                onPlaying={setPlaying}
                onSoundBlocked={() => setMuted(true)}
                onEnded={() => go(index + 1)}
              />
            ) : null}
            {index === active && clip.source !== "file" ? (
              <ReelPlayer
                videoId={clip.videoId}
                startAt={clip.startAt}
                seconds={clip.seconds || REEL_YOUTUBE_SECONDS}
                muted={muted}
                paused={paused}
                repeat={clips.length === 1}
                onProgress={setProgress}
                onPlaying={setPlaying}
                onSoundBlocked={() => setMuted(true)}
                onEnded={() => go(index + 1)}
              />
            ) : null}
            <div className="absolute inset-x-0 bottom-0 z-30 h-1 bg-white/20">
              <div className="h-full bg-[#ff3d56]" style={{ width: `${(index === active ? progress : 0) * 100}%` }} />
            </div>
            <button
              type="button"
              className="absolute inset-0 z-10"
              aria-label={playing && !paused ? "Түр зогсоох" : "Үргэлжлүүлэх"}
              onClick={() => {
                if (!playing) {
                  setPaused(false);
                  setMuted(false);
                  return;
                }
                setPaused((value) => !value);
              }}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
              <a href="/" className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md" aria-label="Нүүр">
                <Icon name="arrow" className="h-5 w-5 rotate-180" />
              </a>
              <button type="button" onClick={() => setMuted((value) => !value)} className="pointer-events-auto rounded-full bg-black/45 px-4 py-2 text-xs font-extrabold backdrop-blur-md" aria-label={muted ? "Дуу нээх" : "Дуу хаах"}>
                {muted ? "Дуу нээх" : "Дуутай"}
              </button>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-3 z-20 flex flex-col items-center justify-center gap-3">
              <button type="button" onClick={() => go(index - 1)} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/45 backdrop-blur-md" aria-label="Өмнөх бичлэг">
                <Icon name="arrow" className="h-5 w-5 -rotate-90" />
              </button>
              <button type="button" onClick={() => go(index + 1)} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/45 backdrop-blur-md" aria-label="Дараагийн бичлэг">
                <Icon name="arrow" className="h-5 w-5 rotate-90" />
              </button>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/55 to-transparent p-5 pb-8">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff6679]">Reel · {index + 1}/{clips.length}</p>
              <h1 className="mt-2 max-w-[18rem] text-3xl font-black tracking-tight">{clip.title}</h1>
              <p className="mt-2 text-xs font-semibold text-zinc-300">{[clip.genre, clip.year || "", clip.episodeLabel].filter(Boolean).join(" · ")}</p>
              {paused ? <p className="mt-3 text-xs font-bold text-white">Түр зогссон</p> : null}
              <a href={`/watch/${clip.seriesId}/1`} className="pointer-events-auto mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#ff3d56] px-5 text-sm font-extrabold text-white md:w-fit md:justify-start md:bg-white md:text-black">
                <Icon name="play" className="h-4 w-4" fill />
                Үзэх
              </a>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ReelPlayer({
  videoId,
  startAt,
  seconds,
  muted,
  paused,
  repeat,
  onProgress,
  onPlaying,
  onSoundBlocked,
  onEnded,
}: {
  videoId: string;
  startAt: number;
  seconds: number;
  muted: boolean;
  paused: boolean;
  repeat: boolean;
  onProgress: (value: number) => void;
  onPlaying: (value: boolean) => void;
  onSoundBlocked: () => void;
  onEnded: () => void;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const windowRef = useRef(reelSpan(startAt, seconds));
  const readyRef = useRef(false);
  const endedRef = useRef(false);
  const mutedRef = useRef(muted);
  const pausedRef = useRef(paused);
  const repeatRef = useRef(repeat);
  const onEndedRef = useRef(onEnded);
  const onProgressRef = useRef(onProgress);
  const onPlayingRef = useRef(onPlaying);
  const onSoundBlockedRef = useRef(onSoundBlocked);
  const loopingRef = useRef(false);
  const resumeRef = useRef(0);
  const soundTriedRef = useRef(false);
  mutedRef.current = muted;
  pausedRef.current = paused;
  repeatRef.current = repeat;
  onEndedRef.current = onEnded;
  onProgressRef.current = onProgress;
  onPlayingRef.current = onPlaying;
  onSoundBlockedRef.current = onSoundBlocked;

  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    endedRef.current = false;
    windowRef.current = reelSpan(startAt, seconds);
    loopingRef.current = false;
    resumeRef.current = 0;
    soundTriedRef.current = false;
    onProgressRef.current(0);
    onPlayingRef.current(false);

    loadYouTube().then((YT) => {
      if (cancelled || !slotRef.current) return;
      playerRef.current = new YT.Player(slotRef.current, {
        width: "100%",
        height: "100%",
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          mute: 1,
          start: Math.max(0, Math.floor(startAt)),
        },
        events: {
          onReady: (event: { target: YTPlayer }) => {
            silenceYoutubeCaptions(event.target);
            const duration = Number(event.target.getDuration?.() ?? 0);
            const span = reelSpan(startAt, seconds, duration);
            windowRef.current = span;
            readyRef.current = true;
            event.target.mute?.();
            event.target.seekTo?.(span.start, true);
            if (pausedRef.current) event.target.pauseVideo?.();
            else event.target.playVideo?.();
          },
          onStateChange: (event: { data?: number; target: YTPlayer }) => {
            silenceYoutubeCaptions(event.target);
            const state = window.YT?.PlayerState;
            if (event.data === state?.ENDED) finish(event.target);
            if (event.data === state?.PLAYING) {
              resumeRef.current = 0;
              onPlayingRef.current(true);
              if (!mutedRef.current && !soundTriedRef.current) {
                soundTriedRef.current = true;
                event.target.unMute?.();
                event.target.playVideo?.();
              }
              return;
            }
            if (event.data === state?.PAUSED && pausedRef.current) onPlayingRef.current(false);
            const stalled = event.data === state?.PAUSED || event.data === state?.CUED || event.data === state?.UNSTARTED || event.data === -1;
            if (stalled && !pausedRef.current && !endedRef.current && resumeRef.current < 8) {
              resumeRef.current += 1;
              if (soundTriedRef.current && !mutedRef.current) {
                event.target.mute?.();
                onSoundBlockedRef.current();
              }
              event.target.playVideo?.();
            }
          },
        },
      });
    }).catch(() => undefined);

    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!readyRef.current || !player?.getCurrentTime) return;
      const time = player.getCurrentTime();
      const span = windowRef.current;
      const ratio = span.end > span.start ? (time - span.start) / (span.end - span.start) : 0;
      onProgressRef.current(Math.min(1, Math.max(0, ratio)));
      if (time < span.end - 0.6) loopingRef.current = false;
      if (time >= span.end - 0.25) finish(player);
      const playerState = window.YT?.PlayerState;
      const current = player.getPlayerState?.();
      const moving = current === playerState?.PLAYING || current === playerState?.BUFFERING;
      if (!pausedRef.current && !endedRef.current && !moving && resumeRef.current < 8) {
        resumeRef.current += 1;
        if (soundTriedRef.current && !mutedRef.current) {
          player.mute?.();
          onSoundBlockedRef.current();
        }
        player.playVideo?.();
      }
    }, 200);

    return () => {
      cancelled = true;
      onPlayingRef.current(false);
      window.clearInterval(timer);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId, startAt, seconds]);

  useEffect(() => {
    const player = playerRef.current;
    if (!readyRef.current || !player) return;
    if (muted) player.mute?.();
    else {
      player.unMute?.();
      if (!paused) player.playVideo?.();
    }
  }, [muted, paused]);

  useEffect(() => {
    const player = playerRef.current;
    if (!readyRef.current || !player) return;
    if (paused) player.pauseVideo?.();
    else player.playVideo?.();
  }, [paused]);

  function finish(player: YTPlayer) {
    if (endedRef.current) return;
    if (repeatRef.current) {
      if (loopingRef.current) return;
      loopingRef.current = true;
      player.seekTo?.(windowRef.current.start, true);
      if (!pausedRef.current) player.playVideo?.();
      onProgressRef.current(0);
      return;
    }
    endedRef.current = true;
    onEndedRef.current();
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div className="absolute left-1/2 top-1/2 aspect-video h-[132%] min-w-[132%] -translate-x-1/2 -translate-y-1/2">
        <div ref={slotRef} className="h-full w-full [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full" />
      </div>
    </div>
  );
}

function ReelFilePlayer({
  url,
  muxPlaybackId,
  muxToken,
  seconds,
  muted,
  paused,
  repeat,
  onProgress,
  onPlaying,
  onSoundBlocked,
  onEnded,
}: {
  url: string;
  muxPlaybackId?: string;
  muxToken?: string;
  seconds: number;
  muted: boolean;
  paused: boolean;
  repeat: boolean;
  onProgress: (value: number) => void;
  onPlaying: (value: boolean) => void;
  onSoundBlocked: () => void;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muxFailed, setMuxFailed] = useState(false);
  const useMux = Boolean(muxPlaybackId && muxToken && !muxFailed);
  const endedRef = useRef(false);
  const repeatRef = useRef(repeat);
  const pausedRef = useRef(paused);
  const onEndedRef = useRef(onEnded);
  const onProgressRef = useRef(onProgress);
  const onPlayingRef = useRef(onPlaying);
  const onSoundBlockedRef = useRef(onSoundBlocked);
  const mutedRef = useRef(muted);
  const bootedRef = useRef(false);
  const urlRef = useRef(url);
  const [silent, setSilent] = useState(true);
  if (urlRef.current !== url) {
    urlRef.current = url;
    bootedRef.current = false;
  }
  repeatRef.current = repeat;
  pausedRef.current = paused;
  mutedRef.current = muted;
  onEndedRef.current = onEnded;
  onProgressRef.current = onProgress;
  onPlayingRef.current = onPlaying;
  onSoundBlockedRef.current = onSoundBlocked;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) {
      video.pause();
      return;
    }
    let cancelled = false;
    const boot = !bootedRef.current;
    if (boot) setSilent(true);
    else setSilent(muted);
    void video.play().then(() => {
      if (cancelled || pausedRef.current) return;
      bootedRef.current = true;
      if (!mutedRef.current) setSilent(false);
    }).catch(() => {
      if (cancelled) return;
      bootedRef.current = true;
      setSilent(true);
      if (!mutedRef.current) onSoundBlockedRef.current();
      void video.play().catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [muted, paused, url, useMux]);

  const finish = (video: HTMLVideoElement, limit: number) => {
    if (endedRef.current) return;
    if (repeatRef.current) {
      video.currentTime = 0;
      if (!pausedRef.current) void video.play().catch(() => undefined);
      onProgressRef.current(0);
      return;
    }
    endedRef.current = true;
    if (video.currentTime < limit) video.pause();
    onEndedRef.current();
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {useMux ? (
        <MuxVideo
          ref={videoRef}
          playbackId={muxPlaybackId}
          tokens={{ playback: muxToken }}
          maxResolution="1080p"
          autoPlay
          muted={silent}
          playsInline
          className="h-full w-full object-cover"
          onPlay={() => onPlayingRef.current(true)}
          onPause={(event) => {
            if (pausedRef.current || endedRef.current) {
              onPlayingRef.current(false);
              return;
            }
            if (mutedRef.current || silent) return;
            setSilent(true);
            onSoundBlockedRef.current();
            void event.currentTarget.play().catch(() => undefined);
          }}
          onLoadedMetadata={() => {
            endedRef.current = false;
            onProgressRef.current(0);
          }}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            const limit = Math.min(seconds, video.duration || seconds);
            const ratio = limit > 0 ? video.currentTime / limit : 0;
            onProgressRef.current(Math.min(1, Math.max(0, ratio)));
            if (video.currentTime >= limit - 0.25) finish(video, limit);
          }}
          onEnded={(event) => finish(event.currentTarget, seconds)}
          onError={() => setMuxFailed(true)}
        />
      ) : (
      <video
        ref={videoRef}
        src={url}
        autoPlay
        muted={silent}
        playsInline
        className="h-full w-full object-cover"
        onPlay={() => onPlayingRef.current(true)}
        onPause={(event) => {
          if (pausedRef.current || endedRef.current) {
            onPlayingRef.current(false);
            return;
          }
          if (mutedRef.current || silent) return;
          setSilent(true);
          onSoundBlockedRef.current();
          void event.currentTarget.play().catch(() => undefined);
        }}
        onLoadedMetadata={() => {
          endedRef.current = false;
          onProgressRef.current(0);
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          const limit = Math.min(seconds, video.duration || seconds);
          const ratio = limit > 0 ? video.currentTime / limit : 0;
          onProgressRef.current(Math.min(1, Math.max(0, ratio)));
          if (video.currentTime >= limit - 0.25) finish(video, limit);
        }}
        onEnded={(event) => finish(event.currentTarget, seconds)}
      />
      )}
    </div>
  );
}
