import { useEffect, type RefObject } from 'react';

/** Morph the header without rerendering the page or changing its layout height. */
export function useGlassHeader(header: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let progress = Math.min(Math.max(window.scrollY / 220, 0), 1);
    let target = progress;
    const paint = () => {
      element.style.setProperty('--header-progress', progress.toFixed(4));
    };
    const animate = () => {
      progress += (target - progress) * 0.12;
      if (Math.abs(target - progress) < 0.0005) progress = target;
      paint();
      frame = progress === target ? 0 : requestAnimationFrame(animate);
    };
    const update = () => {
      target = Math.min(Math.max(window.scrollY / 220, 0), 1);
      if (reducedMotion.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        progress = target;
        paint();
      } else if (!frame && progress !== target) {
        frame = requestAnimationFrame(animate);
      }
    };
    paint();
    addEventListener('scroll', update, { passive: true });
    reducedMotion.addEventListener('change', update);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', update);
      reducedMotion.removeEventListener('change', update);
    };
  }, [header]);
}
