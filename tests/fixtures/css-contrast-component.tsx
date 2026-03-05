import React from 'react';

/**
 * Fixture for testing CSS class-based contrast detection.
 * Imports test-styles.css (same fixtures directory).
 */
export function CssContrastComponent() {
  return (
    <div>
      {/* FAIL: .low-contrast-text has color:#aaa on implicit white bg (2.32:1) */}
      <p className="low-contrast-text">This text has low contrast via CSS class.</p>

      {/* FAIL: .pale-on-white is #ccc on #fff (1.61:1) */}
      <span className="pale-on-white">Barely visible text.</span>

      {/* PASS: .high-contrast-text is #000 on #fff (21:1) */}
      <p className="high-contrast-text">Good contrast text.</p>

      {/* PASS: .dark-grey-text is #333 on white (12.63:1) */}
      <p className="dark-grey-text">Dark grey text passes.</p>

      {/* PASS: .navy-text uses named colour navy on white (15.28:1) */}
      <p className="navy-text">Navy text passes.</p>

      {/* PASS (skipped): CSS variable cannot be resolved statically */}
      <p className="var-color-text">Variable colour — not checkable.</p>
    </div>
  );
}
