"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { animate, type JSAnimation } from "animejs";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useOverlayMotion(onClose?: () => void) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    const animations: JSAnimation[] = [];
    if (backdrop) animations.push(animate(backdrop, { opacity: [0, 1], duration: 280, ease: "outQuad" }));
    if (panel) {
      animations.push(animate(panel, { opacity: [0, 1], scale: [0.96, 1], y: [18, 0], duration: 460, ease: "outCubic" }));
    }
    return () => animations.forEach((item) => item.cancel());
  }, []);

  const requestClose = () => {
    if (!onClose || closing.current) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (prefersReducedMotion() || !panel) {
      onClose();
      return;
    }
    closing.current = true;
    if (backdrop) animate(backdrop, { opacity: 0, duration: 180, ease: "inQuad", composition: "replace" });
    animate(panel, {
      opacity: 0,
      scale: 0.98,
      y: 10,
      duration: 180,
      ease: "inQuad",
      composition: "replace",
      onComplete: () => onClose(),
    });
  };

  return { backdropRef, panelRef, requestClose };
}

export function StepMotion({ stepKey, className, children }: { stepKey: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      return;
    }
    if (prefersReducedMotion()) return;
    const anim = animate(el, {
      opacity: [0, 1],
      y: [14, 0],
      duration: 380,
      ease: "outCubic",
      onComplete: () => {
        el.style.opacity = "";
        el.style.transform = "";
      },
    });
    return () => {
      anim.cancel();
    };
  }, [stepKey]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function usePulse(active: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || prefersReducedMotion()) return;
    const anim = animate(el, { opacity: [0.4, 1], duration: 800, loop: true, alternate: true, ease: "inOutSine" });
    return () => {
      anim.cancel();
      el.style.opacity = "";
    };
  }, [active, ref]);
}

function pressTarget(event: Event) {
  const node = event.target;
  if (!(node instanceof Element)) return null;
  const target = node.closest("button, a");
  if (!(target instanceof HTMLElement)) return null;
  if (target.closest("[data-no-press]")) return null;
  if (target.dataset.press === "off") return null;
  return target;
}

export function PageMotion() {
  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-site-root]");
    if (!root) return;
    const active = new Map<HTMLElement, gsap.core.Tween>();
    let frame = 0;

    const release = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      const items = node.matches("[data-rise]") ? [node] : [];
      node.querySelectorAll<HTMLElement>("[data-rise]").forEach((el) => items.push(el));
      items.forEach((el) => {
        const tween = active.get(el);
        if (!tween) return;
        tween.scrollTrigger?.kill();
        tween.kill();
        active.delete(el);
      });
    };

    const scan = () => {
      const reduced = prefersReducedMotion();
      let created = false;
      root.querySelectorAll<HTMLElement>("[data-rise]").forEach((el) => {
        if (active.has(el)) return;
        created = true;
        if (reduced) {
          active.set(el, gsap.set(el, {}) as gsap.core.Tween);
          return;
        }
        const tween = gsap.from(el, {
          y: 28,
          opacity: 0,
          duration: 0.75,
          delay: Number(el.dataset.delay || 0),
          ease: "power3.out",
          clearProps: "transform,opacity",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
        active.set(el, tween);
      });
      if (created) ScrollTrigger.refresh();
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };

    schedule();
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.removedNodes.forEach(release));
      schedule();
    });
    observer.observe(root, { childList: true, subtree: true });

    const onDown = (event: PointerEvent) => {
      if (prefersReducedMotion()) return;
      const target = pressTarget(event);
      if (!target) return;
      animate(target, { scale: 0.97, duration: 90, ease: "outQuad", composition: "replace" });
    };
    const onUp = (event: PointerEvent) => {
      if (prefersReducedMotion()) return;
      const target = pressTarget(event);
      if (!target) return;
      animate(target, { scale: 1, duration: 180, ease: "outCubic", composition: "replace" });
    };
    const onLoad = () => ScrollTrigger.refresh();
    root.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    if (document.readyState === "complete") ScrollTrigger.refresh();
    else window.addEventListener("load", onLoad);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("load", onLoad);
      active.forEach((tween) => {
        tween.scrollTrigger?.kill();
        tween.kill();
      });
      active.clear();
    };
  }, []);

  return null;
}

export function useChromeMotion(scope: RefObject<HTMLElement | null>) {
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const bar = scope.current?.querySelector("[data-chrome='bar']");
    if (!bar) return;
    gsap.from("[data-chrome='bar']", { y: -72, duration: 0.7, ease: "power3.out", clearProps: "transform" });
    gsap.from("[data-chrome='logo']", { opacity: 0, x: -14, duration: 0.55, delay: 0.15, ease: "power3.out", clearProps: "transform,opacity" });
    gsap.from("[data-chrome='link']", { opacity: 0, y: -8, duration: 0.4, stagger: 0.06, delay: 0.22, ease: "power2.out", clearProps: "transform,opacity" });
    gsap.from("[data-chrome='action']", { opacity: 0, y: -8, duration: 0.4, stagger: 0.05, delay: 0.28, ease: "power2.out", clearProps: "transform,opacity" });
    gsap.from("[data-chrome='dock'] > a", { opacity: 0, y: 12, duration: 0.4, stagger: 0.06, delay: 0.3, ease: "power2.out", clearProps: "transform,opacity" });
  }, { scope });
}
