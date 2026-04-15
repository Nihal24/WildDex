export const DAILY_ANIMALS = [
  { label: 'bald_eagle', emoji: '🦅' },
  { label: 'red_fox', emoji: '🦊' },
  { label: 'white_tailed_deer', emoji: '🦌' },
  { label: 'monarch_butterfly', emoji: '🦋' },
  { label: 'american_robin', emoji: '🐦' },
  { label: 'eastern_gray_squirrel', emoji: '🐿️' },
  { label: 'great_blue_heron', emoji: '🪶' },
  { label: 'raccoon', emoji: '🦝' },
  { label: 'painted_turtle', emoji: '🐢' },
  { label: 'peregrine_falcon', emoji: '🦅' },
  { label: 'river_otter', emoji: '🦦' },
  { label: 'black_bear', emoji: '🐻' },
  { label: 'canada_goose', emoji: '🪿' },
  { label: 'firefly', emoji: '✨' },
  { label: 'american_alligator', emoji: '🐊' },
  { label: 'hummingbird', emoji: '🌸' },
  { label: 'coyote', emoji: '🐺' },
  { label: 'osprey', emoji: '🦅' },
  { label: 'luna_moth', emoji: '🦋' },
  { label: 'groundhog', emoji: '🦫' },
  { label: 'snapping_turtle', emoji: '🐢' },
  { label: 'blue_jay', emoji: '🐦' },
  { label: 'bobcat', emoji: '🐱' },
  { label: 'dragonfly', emoji: '🪲' },
  { label: 'pileated_woodpecker', emoji: '🐦' },
  { label: 'striped_skunk', emoji: '🦨' },
  { label: 'bullfrog', emoji: '🐸' },
  { label: 'red_tailed_hawk', emoji: '🦅' },
  { label: 'white_pelican', emoji: '🦢' },
  { label: 'nine_banded_armadillo', emoji: '🦔' },
];

export function getDailyAnimal(offsetDays = 0): { label: string; emoji: string } {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000) + offsetDays;
  return DAILY_ANIMALS[daysSinceEpoch % DAILY_ANIMALS.length];
}

export const AOTD_SEEN_KEY = 'wilddex_aotd_date';
