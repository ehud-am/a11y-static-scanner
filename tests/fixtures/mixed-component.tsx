import React from 'react';

// Partially accessible — passes some checks, fails others

interface Props {
  logoUrl: string;
  onSearch: (q: string) => void;
}

export function MixedComponent({ logoUrl, onSearch }: Props) {
  const [query, setQuery] = React.useState('');

  return (
    <section aria-label="Search section">
      {/* Good: alt text present */}
      <img src={logoUrl} alt="Company logo" />

      {/* Bad: onClick div without keyboard */}
      <div onClick={() => onSearch(query)}>
        Search trigger (not keyboard accessible)
      </div>

      {/* Good: label associated with input */}
      <label htmlFor="search">Search</label>
      <input
        id="search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Bad: SVG without accessible name */}
      <svg viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="8" />
      </svg>

      {/* Good: button element with content */}
      <button type="button" onClick={() => onSearch(query)}>
        Search
      </button>

      {/* Bad: anchor with no text */}
      <a href="/about"></a>

      {/* Good: table with caption */}
      <table>
        <caption>Recent searches</caption>
        <tbody>
          <tr><td>react</td></tr>
        </tbody>
      </table>
    </section>
  );
}
