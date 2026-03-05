import React from 'react';

/**
 * Fixture for testing broken anchor link detection.
 * Contains href="#..." links that point to IDs that don't exist in this file
 * or in any other fixture.
 */
export function BrokenAnchorComponent() {
  return (
    <div>
      {/* FAIL: #nonexistent-section is defined nowhere */}
      <a href="#nonexistent-section">Jump to section</a>

      {/* FAIL: #missing-target is defined nowhere */}
      <a href="#missing-target">Another broken link</a>

      {/* PASS: #real-section has a matching id below */}
      <a href="#real-section">Jump to real section</a>

      <section id="real-section">
        <h2>Real Section</h2>
        <p>This section has a valid ID that anchors above can target.</p>
      </section>
    </div>
  );
}
