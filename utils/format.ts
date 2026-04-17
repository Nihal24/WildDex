export const formatLabel = (label: string): string =>
  label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(ts).toLocaleDateString();
};
