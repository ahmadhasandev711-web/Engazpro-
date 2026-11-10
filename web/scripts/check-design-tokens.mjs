import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(webRoot, 'src');
const baselineFile = path.resolve(__dirname, 'design-tokens-baseline.json');
const isUpdateMode = process.argv.includes('--update');

const RAW_COLOR_NAMES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'emerald', 'green', 'teal',
  'red', 'amber', 'yellow',
  'blue', 'indigo', 'violet', 'purple',
  'rose', 'orange', 'sky', 'cyan', 'lime', 'pink', 'fuchsia'
];
const COLOR_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const PREFIXES = [
  'bg', 'text', 'border', 'ring', 'divide', 'outline',
  'fill', 'stroke', 'from', 'via', 'to', 'shadow',
  'placeholder', 'accent', 'caret', 'decoration'
];

const RAW_PALETTE_REGEX = new RegExp(
  `(?:^|[\\s"'` + '`' + `])!?(?:[a-z0-9_-]+:)*!?(?:${PREFIXES.join('|')})-(?:${RAW_COLOR_NAMES.join('|')})-(?:${COLOR_SHADES.join('|')})(?:\\/[0-9]+)?(?=[\\s"'` + '`' + `]|$|[?,;:])`,
  'g'
);

const RAW_WHITE_BLACK_REGEX = new RegExp(
  `(?:^|[\\s"'` + '`' + `])!?(?:[a-z0-9_-]+:)*!?(?:${PREFIXES.join('|')})-(?:white|black)(?:\\/[0-9]+)?(?=[\\s"'` + '`' + `]|$|[?,;:])`,
  'g'
);

const ARBITRARY_COLOR_REGEX = new RegExp(
  `(?:^|[\\s"'` + '`' + `])!?(?:[a-z0-9_-]+:)*!?(?:${PREFIXES.join('|')})-\\[(?:#[0-9a-fA-F]{3,8}|rgba?\\([^)]+\\)|hsla?\\([^)]+\\))\\](?=[\\s"'` + '`' + `]|$|[?,;:])`,
  'g'
);

const HEX_REGEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

const EXCLUDED_FILES = new Set([
  path.normalize('src/styles/tokens.css'),
  path.normalize('src/styles/landing.css'),
]);

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (/\.(tsx?|jsx?|css)$/.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  const paletteMatches = content.match(RAW_PALETTE_REGEX) || [];
  const whiteBlackMatches = content.match(RAW_WHITE_BLACK_REGEX) || [];
  const arbitraryMatches = content.match(ARBITRARY_COLOR_REGEX) || [];
  const rawClassesCount = paletteMatches.length + whiteBlackMatches.length + arbitraryMatches.length;

  const hexMatches = content.match(HEX_REGEX) || [];
  const hexCount = hexMatches.length;

  return {
    rawClassesCount,
    hexCount,
  };
}

function run() {
  const allFiles = getAllFiles(srcDir);
  const currentCounts = {};
  let totalRaw = 0;
  let totalHex = 0;

  for (const file of allFiles) {
    const relativePath = path.normalize(path.relative(webRoot, file)).replace(/\\/g, '/');
    const normalizedKey = relativePath.startsWith('src/') ? relativePath : `src/${relativePath}`;

    if (EXCLUDED_FILES.has(path.normalize(normalizedKey))) {
      continue;
    }

    const { rawClassesCount, hexCount } = analyzeFile(file);
    if (rawClassesCount > 0 || hexCount > 0) {
      currentCounts[normalizedKey] = {
        raw: rawClassesCount,
        hex: hexCount,
      };
      totalRaw += rawClassesCount;
      totalHex += hexCount;
    }
  }

  const baselineExists = fs.existsSync(baselineFile);
  let baseline = {};
  if (baselineExists) {
    try {
      baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    } catch {
      baseline = {};
    }
  }

  // Handle --update mode
  if (isUpdateMode) {
    if (baselineExists) {
      // Check if any file increased before allowing update
      const regressions = [];
      for (const [file, current] of Object.entries(currentCounts)) {
        const base = baseline[file] || { raw: 0, hex: 0 };
        if (current.raw > base.raw || current.hex > base.hex) {
          regressions.push(
            `  ❌ ${file}: RAW ${base.raw} -> ${current.raw}, HEX ${base.hex} -> ${current.hex}`
          );
        }
      }
      if (regressions.length > 0) {
        console.error('❌ Cannot update baseline: regressions detected!');
        console.error(regressions.join('\n'));
        process.exit(1);
      }
    }

    fs.writeFileSync(baselineFile, JSON.stringify(currentCounts, null, 2) + '\n', 'utf8');
    console.log(`✅ Baseline successfully updated (${Object.keys(currentCounts).length} files, ${totalRaw} raw classes, ${totalHex} hex).`);
    process.exit(0);
  }

  if (!baselineExists) {
    console.error('❌ Baseline file not found: ' + baselineFile);
    console.error('Run with --update to generate initial baseline.');
    process.exit(1);
  }

  const errors = [];
  const ratchetDrops = [];

  // Check 1: Strict zero tolerance for components/ui/
  for (const [file, current] of Object.entries(currentCounts)) {
    if (file.includes('src/presentation/components/ui/')) {
      if (current.raw > 0 || current.hex > 0) {
        errors.push(`  ❌ [ZERO TOLERANCE] ${file} must have 0 design tokens violations! Found: ${current.raw} raw classes, ${current.hex} hex colors.`);
      }
    }
  }

  // Check 2: Check for increases (regressions) or new files with raw colors
  for (const [file, current] of Object.entries(currentCounts)) {
    const base = baseline[file];
    if (!base) {
      errors.push(`  ❌ [NEW VIOLATION] ${file} is not in baseline and contains ${current.raw} raw classes, ${current.hex} hex colors.`);
    } else {
      if (current.raw > base.raw) {
        errors.push(`  ❌ [REGRESSION] ${file}: raw classes increased from ${base.raw} to ${current.raw}.`);
      }
      if (current.hex > base.hex) {
        errors.push(`  ❌ [REGRESSION] ${file}: hex colors increased from ${base.hex} to ${current.hex}.`);
      }
      if (current.raw < base.raw || current.hex < base.hex) {
        ratchetDrops.push(`  📉 ${file}: raw ${base.raw}->${current.raw}, hex ${base.hex}->${current.hex}`);
      }
    }
  }

  // Check 3: Check files completely removed from currentCounts (meaning they reached 0)
  for (const [file, base] of Object.entries(baseline)) {
    if (!currentCounts[file] && (base.raw > 0 || base.hex > 0)) {
      ratchetDrops.push(`  📉 ${file}: cleaned completely to 0! (was raw ${base.raw}, hex ${base.hex})`);
    }
  }

  if (errors.length > 0) {
    console.error('\n🚨 Design Tokens Linter Failed with errors:\n');
    console.error(errors.join('\n'));
    console.error('\nRaw Tailwind colors and hardcoded hex values are forbidden in new/modified code.\n');
    process.exit(1);
  }

  if (ratchetDrops.length > 0) {
    console.error('\n⚠️ Ratchet warning: Design token violations were reduced in the following files:');
    console.error(ratchetDrops.join('\n'));
    console.error('\nPlease update the baseline using: node scripts/check-design-tokens.mjs --update\n');
    process.exit(1);
  }

  console.log(`✅ Design Tokens Check Passed! (${Object.keys(baseline).length} files monitored, total ${totalRaw} raw classes, ${totalHex} hex colors).`);
  process.exit(0);
}

run();
