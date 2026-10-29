/**
 * Zero-dependency High-Resolution Vector Code 128 SVG Barcode Generator.
 * Implements standard Code 128B / Code 128 specification for crisp laser and thermal printing.
 */

// Code 128 pattern table: each number is a sequence of bar and space widths (6 widths per symbol, Stop has 7).
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (106 is STOP)
];

const START_B = 104;
const STOP = 106;

export interface BarcodeRenderOptions {
  width?: number;         // Total SVG width in px (or viewbox scale)
  height?: number;        // Total SVG height in px
  barHeight?: number;     // Height of the barcode bars
  includeText?: boolean;  // Render human-readable text under barcode
  fontSize?: number;      // Text font size in pt / px
  quietZone?: number;     // Side margins (modules)
}

/**
 * Encodes text into Code 128 symbol indices and calculates checksum.
 */
function encodeCode128B(text: string): number[] {
  const indices: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // ASCII 32 (space) to 126 (~) maps to index charCode - 32
    let codeIndex = charCode - 32;
    if (codeIndex < 0 || codeIndex > 94) {
      codeIndex = 0; // Fallback to space for unsupported chars
    }
    indices.push(codeIndex);
    checksum += codeIndex * (i + 1);
  }

  const checkDigit = checksum % 103;
  indices.push(checkDigit);
  indices.push(STOP);

  return indices;
}

/**
 * Safely escapes characters that have special meaning in XML/SVG.
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renders an SVG string for the given barcode text.
 */
export function renderBarcodeSvg(text: string, options: BarcodeRenderOptions = {}): string {
  const cleanText = (text || '').trim();
  if (!cleanText) return '';

  const quietZone = options.quietZone ?? 10;
  const barHeight = options.barHeight ?? 45;
  const includeText = options.includeText ?? true;
  const fontSize = options.fontSize ?? 11;
  const textHeight = includeText ? fontSize + 4 : 0;
  const totalHeight = barHeight + textHeight + 4;

  const symbolIndices = encodeCode128B(cleanText);

  // Build binary sequence of bars (1) and spaces (0)
  const modules: number[] = [];
  for (const symIndex of symbolIndices) {
    const pattern = CODE128_PATTERNS[symIndex];
    if (!pattern) continue;

    let isBar = true;
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10);
      for (let w = 0; w < width; w++) {
        modules.push(isBar ? 1 : 0);
      }
      isBar = !isBar;
    }
  }

  const barcodeWidth = modules.length;
  const totalWidth = barcodeWidth + quietZone * 2;

  // Convert binary modules into SVG rect path for maximum rendering speed and crispness
  let pathData = '';
  let currentBarStart = -1;

  for (let x = 0; x < modules.length; x++) {
    const isBar = modules[x] === 1;
    if (isBar && currentBarStart === -1) {
      currentBarStart = x;
    } else if (!isBar && currentBarStart !== -1) {
      const barWidth = x - currentBarStart;
      pathData += `M${quietZone + currentBarStart},0h${barWidth}v${barHeight}h-${barWidth}Z `;
      currentBarStart = -1;
    }
  }

  if (currentBarStart !== -1) {
    const barWidth = modules.length - currentBarStart;
    pathData += `M${quietZone + currentBarStart},0h${barWidth}v${barHeight}h-${barWidth}Z `;
  }

  const textElement = includeText
    ? `<text x="${totalWidth / 2}" y="${barHeight + fontSize + 2}" text-anchor="middle" font-family="monospace, Courier, sans-serif" font-size="${fontSize}px" font-weight="bold" fill="#000000" letter-spacing="1px">${escapeXml(cleanText)}</text>`
    : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">
      <rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff"/>
      <path d="${pathData}" fill="#000000"/>
      ${textElement}
    </svg>
  `.trim();
}
