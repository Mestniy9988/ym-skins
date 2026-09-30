export function coverPalette(samples) {
  if (!Array.isArray(samples) || samples.length === 0 || samples.length > 64) {
    return { ok: false, reason: 'samples' };
  }
  const colors = [];
  for (const sample of samples) {
    const color = readColor(sample);
    if (!color) return { ok: false, reason: 'samples' };
    colors.push(color);
  }
  const background = average(colors);
  let accent = colors[0];
  let best = -1;
  for (const color of colors) {
    const distance = dist(color, background);
    if (distance >= best) {
      best = distance;
      accent = color;
    }
  }
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  const blackContrast = contrast(background, black);
  const whiteContrast = contrast(background, white);
  const text = whiteContrast >= blackContrast ? white : black;
  const textContrast = Math.max(blackContrast, whiteContrast);
  return {
    ok: true,
    background: rgb(background),
    accent: rgb(accent),
    text: rgb(text),
    textReadable: textContrast >= 4.5,
  };
}

function readColor(sample) {
  if (sample == null || typeof sample !== 'object') return null;
  const { r, g, b } = sample;
  if (!byte(r) || !byte(g) || !byte(b)) return null;
  return { r, g, b };
}

function byte(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function average(colors) {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const color of colors) {
    r += color.r;
    g += color.g;
    b += color.b;
  }
  return {
    r: Math.round(r / colors.length),
    g: Math.round(g / colors.length),
    b: Math.round(b / colors.length),
  };
}

function dist(left, right) {
  const dr = left.r - right.r;
  const dg = left.g - right.g;
  const db = left.b - right.b;
  return dr * dr + dg * dg + db * db;
}

function rgb(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function contrast(left, right) {
  const light = Math.max(luminance(left), luminance(right));
  const dark = Math.min(luminance(left), luminance(right));
  return (light + 0.05) / (dark + 0.05);
}

function luminance(color) {
  const r = channel(color.r);
  const g = channel(color.g);
  const b = channel(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function channel(value) {
  const scaled = value / 255;
  if (scaled <= 0.04045) return scaled / 12.92;
  return ((scaled + 0.055) / 1.055) ** 2.4;
}
