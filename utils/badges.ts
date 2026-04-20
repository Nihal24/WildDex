import { TaxonomyClass } from './taxonomy';

export const BADGE_NOTIFIED_KEY = 'wilddex_notified_badge_ids';

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  threshold: number;
  color: string;
  type: 'species' | 'category';
  category?: TaxonomyClass;
}

export const BADGES: Badge[] = [
  // ── Species count (total unique species discovered) ──
  { id: 'sprout', type: 'species',  emoji: '🌿', label: 'Sprout',  description: '1 species',         threshold: 1,   color: '#4CAF50' },
  { id: 'spark',  type: 'species',  emoji: '⚡', label: 'Spark',   description: '10 species',        threshold: 10,  color: '#FFC107' },
  { id: 'blaze',  type: 'species',  emoji: '🔥', label: 'Blaze',   description: '50 species',        threshold: 50,  color: '#FF5722' },
  { id: 'summit', type: 'species',  emoji: '🏔️', label: 'Summit',  description: '100 species',       threshold: 100, color: '#FFD700' },

  // ── Category (unique species per taxonomic class) ──
  { id: 'wing',  type: 'category', emoji: '🦅', label: 'Wing',  description: '5 bird species',    threshold: 5, color: '#29B6F6', category: 'bird' },
  { id: 'roar',  type: 'category', emoji: '🦁', label: 'Roar',  description: '5 mammal species',  threshold: 5, color: '#FF8F00', category: 'mammal' },
  { id: 'scale', type: 'category', emoji: '🦎', label: 'Scale', description: '5 reptile species', threshold: 5, color: '#66BB6A', category: 'reptile' },
  { id: 'wave',  type: 'category', emoji: '🌊', label: 'Wave',  description: '5 aquatic species', threshold: 5, color: '#0288D1', category: 'aquatic' },
];

export type BadgeCounts = {
  species: number;
  byCategory: Partial<Record<TaxonomyClass, number>>;
};

export function isBadgeEarned(badge: Badge, counts: BadgeCounts): boolean {
  if (badge.type === 'species') return counts.species >= badge.threshold;
  return (counts.byCategory[badge.category!] ?? 0) >= badge.threshold;
}

export function getEarnedBadges(counts: BadgeCounts): Badge[] {
  return BADGES.filter((b) => isBadgeEarned(b, counts));
}

export function getNextBadge(counts: BadgeCounts): Badge | null {
  return BADGES.find((b) => !isBadgeEarned(b, counts)) ?? null;
}
