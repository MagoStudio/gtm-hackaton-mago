/** Deterministic color for company verticals — hue derived from string hash */

const KNOWN_VERTICALS: Record<string, { bg: string; text: string; border: string }> = {
  'VFX': { bg: 'bg-[hsl(280,45%,92%)] dark:bg-[hsl(280,40%,22%)]', text: 'text-[hsl(280,55%,40%)] dark:text-[hsl(280,60%,75%)]', border: 'border-[hsl(280,40%,80%)] dark:border-[hsl(280,35%,35%)]' },
  'Animation': { bg: 'bg-[hsl(200,50%,92%)] dark:bg-[hsl(200,40%,22%)]', text: 'text-[hsl(200,60%,35%)] dark:text-[hsl(200,55%,70%)]', border: 'border-[hsl(200,40%,80%)] dark:border-[hsl(200,35%,35%)]' },
  'Gaming': { bg: 'bg-[hsl(142,40%,92%)] dark:bg-[hsl(142,35%,20%)]', text: 'text-[hsl(142,50%,32%)] dark:text-[hsl(142,50%,65%)]', border: 'border-[hsl(142,35%,78%)] dark:border-[hsl(142,30%,32%)]' },
  'Film': { bg: 'bg-[hsl(38,50%,92%)] dark:bg-[hsl(38,40%,20%)]', text: 'text-[hsl(38,60%,35%)] dark:text-[hsl(38,55%,65%)]', border: 'border-[hsl(38,40%,80%)] dark:border-[hsl(38,35%,32%)]' },
  'Broadcast': { bg: 'bg-[hsl(340,45%,93%)] dark:bg-[hsl(340,35%,22%)]', text: 'text-[hsl(340,50%,40%)] dark:text-[hsl(340,50%,70%)]', border: 'border-[hsl(340,35%,82%)] dark:border-[hsl(340,30%,35%)]' },
  'Advertising': { bg: 'bg-[hsl(15,50%,93%)] dark:bg-[hsl(15,40%,22%)]', text: 'text-[hsl(15,55%,38%)] dark:text-[hsl(15,50%,68%)]', border: 'border-[hsl(15,40%,82%)] dark:border-[hsl(15,35%,34%)]' },
  'Architecture': { bg: 'bg-[hsl(175,40%,92%)] dark:bg-[hsl(175,35%,20%)]', text: 'text-[hsl(175,50%,30%)] dark:text-[hsl(175,45%,62%)]', border: 'border-[hsl(175,35%,78%)] dark:border-[hsl(175,30%,32%)]' },
  'Education': { bg: 'bg-[hsl(250,40%,93%)] dark:bg-[hsl(250,35%,22%)]', text: 'text-[hsl(250,45%,42%)] dark:text-[hsl(250,45%,72%)]', border: 'border-[hsl(250,30%,82%)] dark:border-[hsl(250,28%,35%)]' },
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getVerticalColors(vertical: string): { bg: string; text: string; border: string } {
  const upper = vertical.trim();
  // Check known first (case-insensitive)
  for (const [key, val] of Object.entries(KNOWN_VERTICALS)) {
    if (upper.toLowerCase() === key.toLowerCase()) return val;
  }
  // Fallback: deterministic hue
  const hue = hashStr(upper) % 360;
  return {
    bg: `bg-[hsl(${hue},40%,92%)] dark:bg-[hsl(${hue},35%,22%)]`,
    text: `text-[hsl(${hue},50%,38%)] dark:text-[hsl(${hue},50%,68%)]`,
    border: `border-[hsl(${hue},35%,80%)] dark:border-[hsl(${hue},30%,34%)]`,
  };
}
