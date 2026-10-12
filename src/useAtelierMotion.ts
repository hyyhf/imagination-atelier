import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useAtelierMotion(root: RefObject<HTMLElement | null>, layoutKey: string) {
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.from('.hero-copy > *', { y: 18, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out' });
        gsap.from('.hero-exhibit', { y: 28, opacity: 0, duration: 0.75, delay: 0.12, ease: 'power3.out' });
        gsap.to('.exhibit-art', {
          y: -12, ease: 'none',
          scrollTrigger: { trigger: '.hero-layout', start: 'top top', end: 'bottom top', scrub: true },
        });
        gsap.utils.toArray<HTMLElement>('.section-heading').forEach(heading => {
          gsap.from(heading, { y: 18, duration: 0.65, ease: 'power3.out', scrollTrigger: { trigger: heading, start: 'top 94%', once: true } });
        });
        gsap.from('.step', { y: 18, duration: 0.45, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.steps', start: 'top 88%', once: true } });
        gsap.from('.starter-panel', { y: 16, scale: 0.98, duration: 0.45, ease: 'power3.out', scrollTrigger: { trigger: '.starter-panel', start: 'top 90%', once: true } });
        gsap.from('.download-card', { y: 16, duration: 0.45, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: '.download-grid', start: 'top 90%', once: true } });
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, [root]);

  // Filters, the expanded catalog and instruction preview change section positions.
  // Refresh existing triggers without replaying the entrance animations.
  useLayoutEffect(() => { ScrollTrigger.refresh(); }, [layoutKey]);
}
