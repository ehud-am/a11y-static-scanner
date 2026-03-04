import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { discoverReactFiles } from '../src/discovery/file-discoverer.js';

let tmpRoot: string;

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'a11y-static-scanner-test-'));

  // Create tree:
  // tmpRoot/
  //   src/
  //     App.tsx          ← React (explicit extension)
  //     utils.ts         ← Not React (no JSX)
  //     helper.js        ← React (JSX heuristic)
  //     plain.js         ← Not React
  //   components/
  //     Button.jsx       ← React (explicit)
  //     Icon.svg         ← Not a JS file, should be ignored
  //   node_modules/
  //     some-pkg/
  //       index.tsx      ← Should be excluded
  //   build/
  //     output.jsx       ← Should be excluded

  await fs.mkdir(path.join(tmpRoot, 'src'), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, 'components'), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, 'node_modules', 'some-pkg'), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, 'build'), { recursive: true });

  await fs.writeFile(
    path.join(tmpRoot, 'src', 'App.tsx'),
    `import React from 'react';\nexport const App = () => <div>Hello</div>;`,
  );
  await fs.writeFile(
    path.join(tmpRoot, 'src', 'utils.ts'),
    `export function add(a: number, b: number) { return a + b; }`,
  );
  await fs.writeFile(
    path.join(tmpRoot, 'src', 'helper.js'),
    `import React from 'react';\nconst Foo = () => <MyComponent />;`,
  );
  await fs.writeFile(
    path.join(tmpRoot, 'src', 'plain.js'),
    `module.exports = { foo: 1 };`,
  );
  await fs.writeFile(
    path.join(tmpRoot, 'components', 'Button.jsx'),
    `export function Button() { return <button>OK</button>; }`,
  );
  await fs.writeFile(path.join(tmpRoot, 'components', 'Icon.svg'), `<svg/>`);
  await fs.writeFile(
    path.join(tmpRoot, 'node_modules', 'some-pkg', 'index.tsx'),
    `import React from 'react'; export default () => <div/>;`,
  );
  await fs.writeFile(
    path.join(tmpRoot, 'build', 'output.jsx'),
    `export const Out = () => <div/>;`,
  );
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('discoverReactFiles', () => {
  it('finds all .tsx and .jsx files in non-excluded directories', async () => {
    const files = await discoverReactFiles(tmpRoot);
    const names = files.map((f) => path.basename(f));
    expect(names).toContain('App.tsx');
    expect(names).toContain('Button.jsx');
  });

  it('detects React in .js files via heuristics', async () => {
    const files = await discoverReactFiles(tmpRoot);
    const names = files.map((f) => path.basename(f));
    expect(names).toContain('helper.js');
  });

  it('excludes non-React .js files', async () => {
    const files = await discoverReactFiles(tmpRoot);
    const names = files.map((f) => path.basename(f));
    expect(names).not.toContain('plain.js');
  });

  it('excludes non-React .ts files', async () => {
    const files = await discoverReactFiles(tmpRoot);
    const names = files.map((f) => path.basename(f));
    expect(names).not.toContain('utils.ts');
  });

  it('excludes node_modules', async () => {
    const files = await discoverReactFiles(tmpRoot);
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
  });

  it('excludes build directory', async () => {
    const files = await discoverReactFiles(tmpRoot);
    expect(files.some((f) => f.includes(path.join(tmpRoot, 'build')))).toBe(false);
  });

  it('returns absolute paths', async () => {
    const files = await discoverReactFiles(tmpRoot);
    for (const f of files) {
      expect(path.isAbsolute(f)).toBe(true);
    }
  });

  it('returns a sorted, deduplicated list', async () => {
    const files = await discoverReactFiles(tmpRoot);
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
    expect(new Set(files).size).toBe(files.length);
  });

  it('respects pathFilter to restrict results', async () => {
    const files = await discoverReactFiles(tmpRoot, 'src/**/*.{jsx,tsx}');
    const names = files.map((f) => path.basename(f));
    expect(names).toContain('App.tsx');
    expect(names).not.toContain('Button.jsx');
  });

  it('works in a directory with no React files', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'a11y-empty-'));
    try {
      await fs.writeFile(path.join(emptyDir, 'index.html'), '<html></html>');
      const files = await discoverReactFiles(emptyDir);
      expect(files).toEqual([]);
    } finally {
      await fs.rm(emptyDir, { recursive: true, force: true });
    }
  });
});
