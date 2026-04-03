export interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  threshold: number;
  color: string;
}

export const BADGES: Badge[] = [
  { id: 'sprout',  emoji: '🌿', label: 'Sprout',  description: '1 species',   threshold: 1,   color: '#4CAF50' },
  { id: 'stone',   emoji: '🪨', label: 'Stone',   description: '5 species',   threshold: 5,   color: '#2196F3' },
  { id: 'spark',   emoji: '⚡', label: 'Spark',   description: '10 species',  threshold: 10,  color: '#FFC107' },
  { id: 'bloom',   emoji: '🌸', label: 'Bloom',   description: '25 species',  threshold: 25,  color: '#E91E63' },
  { id: 'wing',    emoji: '🦋', label: 'Wing',    description: '50 species',  threshold: 50,  color: '#9C27B0' },
  { id: 'wave',    emoji: '🌊', label: 'Wave',    description: '75 species',  threshold: 75,  color: '#00BCD4' },
  { id: 'blaze',   emoji: '🔥', label: 'Blaze',   description: '100 species', threshold: 100, color: '#FF5722' },
  { id: 'summit',  emoji: '🏔️', label: 'Summit',  description: '200 species', threshold: 200, color: '#FFD700' },
];

export function getEarnedBadges(speciesCount: number): Badge[] {
  return BADGES.filter((b) => speciesCount >= b.threshold);
}

export function getNextBadge(speciesCount: number): Badge | null {
  return BADGES.find((b) => speciesCount < b.threshold) ?? null;
}
