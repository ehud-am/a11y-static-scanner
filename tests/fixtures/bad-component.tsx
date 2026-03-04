import React from 'react';

// Intentionally inaccessible component — should trigger many issues

interface Props {
  imageUrl: string;
  onClick: () => void;
}

export function BadComponent({ imageUrl, onClick }: Props) {
  return (
    <div>
      {/* 1.1.1 — Missing alt text */}
      <img src={imageUrl} />

      {/* 1.1.1 — SVG with no accessible name */}
      <svg viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      </svg>

      {/* 2.1.1 — onClick on div without keyboard handler */}
      <div onClick={onClick}>
        Click me (keyboard inaccessible)
      </div>

      {/* 4.1.2 — role="button" without keyboard handler or tabIndex */}
      <span role="button" onClick={onClick}>
        Fake button
      </span>

      {/* 2.4.7 — outline removed via inline style */}
      <button
        type="button"
        style={{ outline: 'none' }}
        onClick={onClick}
      >
        No focus ring
      </button>

      {/* 1.3.1 — Label with no associated control */}
      <label>First Name</label>

      {/* 1.3.1 — Input with no label */}
      <input type="text" placeholder="Name" />

      {/* 1.3.1 — Table with no caption or aria-label */}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Alice</td>
            <td>95</td>
          </tr>
        </tbody>
      </table>

      {/* 4.1.2 — iframe without title */}
      <iframe src="https://example.com" />

      {/* 2.4.4 — Empty anchor */}
      <a href="https://example.com"></a>

      {/* 2.4.3 — Positive tabIndex disrupts focus order */}
      <button type="button" tabIndex={5} onClick={onClick}>
        Bad tabIndex
      </button>

      {/* 3.1.1 — html without lang (would appear in page-level component) */}
    </div>
  );
}
