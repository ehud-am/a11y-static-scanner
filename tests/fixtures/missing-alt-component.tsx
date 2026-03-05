import React from 'react';

/**
 * Fixture for testing the missing-alt fallback check in the AST pass.
 * Contains an <img> with no alt attribute at all.
 */
export function MissingAltComponent() {
  return (
    <div>
      {/* FAIL: no alt attribute at all */}
      <img src="https://picsum.photos/seed/hero/1200/400" className="hero-img" />

      {/* PASS: empty alt is valid for decorative images */}
      <img src="https://picsum.photos/seed/deco/200/200" alt="" />

      {/* PASS: descriptive alt text */}
      <img src="https://picsum.photos/seed/product/400/300" alt="A red ceramic mug on a wooden table" />
    </div>
  );
}
