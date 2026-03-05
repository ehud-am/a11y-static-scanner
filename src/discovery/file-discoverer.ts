import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import _ignore from 'ignore';
import type { Ignore, Options as IgnoreOptions } from 'ignore';

// Same CJS/NodeNext interop issue as @babel/traverse – cast to the callable shape.
const ignore = _ignore as unknown as (options?: IgnoreOptions) => Ignore;
import fg from 'fast-glob';

const EXCLUDE_DIRS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/__tests__/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.stories.*',
];

const JSX_HEURISTICS: RegExp[] = [
  /import\s+React/,
  /from\s+['"]react['"]/,
  /from\s+['"]react-dom['"]/,
  /require\s*\(\s*['"]react['"]\s*\)/,
  /JSX\.Element/,
  /ReactElement/,
  /ReactNode/,
  /React\.FC\b/,
  /React\.Component\b/,
  /React\.memo\b/,
  /React\.createContext\b/,
  /React\.forwardRef\b/,
  /createRoot\s*\(/,
  /<[A-Z][A-Za-z0-9]*/,
];

async function loadGitignore(rootPath: string): Promise<Ignore> {
  const ig = ignore();
  try {
    const content = await fs.readFile(path.join(rootPath, '.gitignore'), 'utf8');
    ig.add(content);
  } catch {
    // No .gitignore — continue without it
  }
  return ig;
}

async function containsJsx(filePath: string): Promise<boolean> {
  try {
    const fd = await fs.open(filePath, 'r');
    try {
      // Read up to 8 KB — enough to cover all import statements in virtually any file
      const bufSize = 8192;
      const buffer = Buffer.alloc(bufSize);
      const { bytesRead } = await fd.read(buffer, 0, bufSize, 0);
      const snippet = buffer.subarray(0, bytesRead).toString('utf8');
      return JSX_HEURISTICS.some((re) => re.test(snippet));
    } finally {
      await fd.close();
    }
  } catch {
    return false;
  }
}

/**
 * Build glob patterns that always include all React-relevant file extensions,
 * optionally scoped to a user-provided path filter.
 *
 * The pathFilter may be a directory glob ("src/components/**"), a partial path
 * ("src/components"), or an extension-specific glob ("src/**\/*.tsx"). In every
 * case we expand to cover ALL supported extensions so that .jsx files (and other
 * variants) are never silently skipped.
 */
function buildGlobPatterns(pathFilter: string | undefined): {
  jsxPatterns: string[];
  jstsPatterns: string[];
} {
  // Extensions that are always React/JSX (no heuristic needed)
  const jsxExts = 'jsx,tsx,mdx';
  // Extensions that may or may not contain React (require heuristic check)
  const jstsExts = 'js,ts,mjs,mts,cjs,cts';

  if (!pathFilter) {
    return {
      jsxPatterns: [`**/*.{${jsxExts}}`],
      jstsPatterns: [`**/*.{${jstsExts}}`],
    };
  }

  // Derive a clean directory base by removing any trailing file-extension glob.
  // Handles: "src/**/*.tsx", "src/**/*.{jsx,tsx}", "src/**", "src/components"
  const base = pathFilter
    // Remove trailing extension wildcard: *.ext  OR  *.{ext1,ext2,...}
    .replace(/\/?\*\.(\w+|\{[^}]+\})$/, '')
    // Remove any remaining trailing wildcard segments: /** or /*
    .replace(/\/\*+$/, '')
    // Remove trailing slashes
    .replace(/\/$/, '');

  // Reconstruct patterns that always cover all supported extensions
  const prefix = base ? `${base}/**` : '**';
  return {
    jsxPatterns: [`${prefix}/*.{${jsxExts}}`],
    jstsPatterns: [`${prefix}/*.{${jstsExts}}`],
  };
}

/**
 * Find all plain CSS files in the project (excluding build output and
 * dependency directories).  SCSS/LESS/Sass are intentionally excluded because
 * they require compilation before colour values can be resolved statically.
 */
export async function discoverCssFiles(rootPath: string): Promise<string[]> {
  const files = await fg(['**/*.css'], {
    cwd: rootPath,
    absolute: true,
    ignore: EXCLUDE_DIRS,
    followSymbolicLinks: false,
    onlyFiles: true,
  });
  return files.sort();
}

/**
 * Find all HTML files in the project root (index.html, public/index.html, etc.)
 * that are not inside build output or dependency directories.
 */
export async function discoverHtmlFiles(rootPath: string): Promise<string[]> {
  const files = await fg(['**/*.html', '**/*.htm'], {
    cwd: rootPath,
    absolute: true,
    ignore: EXCLUDE_DIRS,
    followSymbolicLinks: false,
    onlyFiles: true,
  });
  return files.sort();
}

export async function discoverReactFiles(
  rootPath: string,
  pathFilter?: string,
): Promise<string[]> {
  const ig = await loadGitignore(rootPath);

  const globOpts: fg.Options = {
    cwd: rootPath,
    absolute: true,
    ignore: EXCLUDE_DIRS,
    followSymbolicLinks: false,
    onlyFiles: true,
  };

  const { jsxPatterns, jstsPatterns } = buildGlobPatterns(pathFilter);

  const [definiteFiles, maybeFiles] = await Promise.all([
    fg(jsxPatterns, { ...globOpts }),
    fg(jstsPatterns, globOpts),
  ]);

  function isIgnored(absolutePath: string): boolean {
    const relative = path.relative(rootPath, absolutePath);
    return ig.ignores(relative);
  }

  const confirmedJsx = definiteFiles.filter((f) => !isIgnored(f));

  const jstsResults = await Promise.all(
    maybeFiles
      .filter((f) => !isIgnored(f))
      .map(async (f) => ({ file: f, isReact: await containsJsx(f) })),
  );

  const inferredReact = jstsResults.filter((r) => r.isReact).map((r) => r.file);

  return Array.from(new Set([...confirmedJsx, ...inferredReact])).sort();
}
