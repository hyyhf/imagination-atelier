import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Check, Compass, Download, Hand, Layers, Menu, Plus, Search, X } from 'lucide-react';

const icons = { arrow: ArrowRight, up: ArrowUp, down: ArrowDown, external: ArrowUpRight, download: Download, search: Search, close: X, menu: Menu, check: Check, plus: Plus, compass: Compass, layers: Layers, hand: Hand };
type IconName = keyof typeof icons;

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const LucideIcon = icons[name];
  return <LucideIcon className={`icon ${className}`} size={20} strokeWidth={1.6} aria-hidden="true" />;
}
