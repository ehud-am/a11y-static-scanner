import React from 'react';

// A fully accessible component — should produce zero issues

interface Props {
  imageUrl: string;
  onSubmit: (value: string) => void;
}

export function GoodForm({ imageUrl, onSubmit }: Props) {
  const [value, setValue] = React.useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onSubmit(value);
    }
  };

  return (
    <main>
      <h1>Accessible Form</h1>

      {/* Image with alt text */}
      <img src={imageUrl} alt="A descriptive caption for the image" />

      {/* SVG with aria-label */}
      <svg aria-label="Settings icon" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      </svg>

      {/* Form with associated label */}
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}>
        <label htmlFor="name-input">Your name</label>
        <input
          id="name-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="name"
        />
        <button type="submit">Submit</button>
      </form>

      {/* Interactive div with keyboard support */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSubmit(value)}
        onKeyDown={handleKeyDown}
        style={{ padding: '8px', border: '1px solid #ccc' }}
      >
        Custom button
      </div>

      {/* Table with caption */}
      <table>
        <caption>Summary of results</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Alice</td>
            <td>95</td>
          </tr>
        </tbody>
      </table>

      {/* iframe with title */}
      <iframe src="https://example.com" title="Example embed" />

      {/* Anchor with descriptive text */}
      <a href="https://example.com">Visit the documentation site</a>

      {/* Button element — no extra work needed */}
      <button type="button" onClick={() => onSubmit(value)}>
        Click me
      </button>
    </main>
  );
}
