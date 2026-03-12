import sharp from 'sharp';

const SIZE = 1024;

const svg = `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background: black -->
  <rect width="1024" height="1024" fill="#1A1A1A"/>

  <!-- Red accent bar at top -->
  <rect x="0" y="0" width="1024" height="16" fill="#E3350D"/>

  <!-- Red accent bar at bottom -->
  <rect x="0" y="1008" width="1024" height="16" fill="#E3350D"/>

  <!-- "Wild" in white -->
  <text
    x="512" y="490"
    font-family="Arial Black, Arial, sans-serif"
    font-weight="900"
    font-size="260"
    text-anchor="middle"
    fill="#FFFFFF">Wild</text>

  <!-- "Dex" in red -->
  <text
    x="512" y="740"
    font-family="Arial Black, Arial, sans-serif"
    font-weight="900"
    font-size="260"
    text-anchor="middle"
    fill="#E3350D">Dex</text>
</svg>
`;

await sharp(Buffer.from(svg))
  .resize(1024, 1024)
  .flatten({ background: '#1A1A1A' })  // remove alpha, fill transparent pixels
  .png()
  .toFile('assets/icon.png');

console.log('Icon saved to assets/icon.png');

await sharp(Buffer.from(svg))
  .resize(1024, 1024)
  .flatten({ background: '#1A1A1A' })
  .png()
  .toFile('assets/adaptive-icon.png');

console.log('Adaptive icon saved to assets/adaptive-icon.png');
