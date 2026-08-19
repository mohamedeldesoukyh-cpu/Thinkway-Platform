export function IconIg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 14l3-3 3 3 4-5" />
    </svg>
  );
}

export function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11Z" />
    </svg>
  );
}

export function IconCat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

export function LogoMark() {
  return (
    <svg className="mark" viewBox="0 0 100 100">
      <rect x="3" y="3" width="94" height="94" rx="27" fill="#060810" />
      <circle cx="40" cy="39" r="15" fill="#fff" />
      <circle cx="64" cy="63" r="9" fill="#0057FF" />
    </svg>
  );
}

export function KpiIcon({
  name,
}: {
  name: "reach" | "engage" | "trend" | "cpe" | "cpm" | "money" | "people";
}) {
  if (name === "reach") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (name === "engage") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
      </svg>
    );
  }
  if (name === "trend") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M17 7h4v4" />
      </svg>
    );
  }
  if (name === "cpe") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" />
      </svg>
    );
  }
  if (name === "cpm") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 4v16" />
      </svg>
    );
  }
  if (name === "people") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 5.5a3 3 0 0 1 0 5.8M21.5 20a6 6 0 0 0-4-5.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export function CategoryGlyph({ family }: { family: string }) {
  if (family === "photography") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    );
  }
  if (family === "fitness") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 9v6M17 9v6M4 10v4M20 10v4M7 12h10" />
      </svg>
    );
  }
  if (family === "health") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11Z" />
      </svg>
    );
  }
  if (family === "food") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 3v8M6 3v5M10 3v5M8 11v10M16 11c2 0 3 1.5 3 4v6h-6v-6c0-2.5 1-4 3-4Z" />
      </svg>
    );
  }
  if (family === "fashion") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 4h6l3 5-6 2-6-2 3-5Z" />
        <path d="M8 11v9h8v-9" />
      </svg>
    );
  }
  if (family === "beauty") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3c2 4 6 6 6 10a6 6 0 1 1-12 0c0-4 4-6 6-10Z" />
      </svg>
    );
  }
  if (family === "travel") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12h8l9-6-3 9 3 3H3" />
      </svg>
    );
  }
  if (family === "tech") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="5" width="16" height="12" rx="2" />
        <path d="M8 21h8" />
      </svg>
    );
  }
  if (family === "gaming") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9h12a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8Z" />
        <path d="M9 12v3M7.5 13.5h3" />
        <circle cx="16" cy="12.5" r=".8" fill="currentColor" />
        <circle cx="18" cy="14.5" r=".8" fill="currentColor" />
      </svg>
    );
  }
  if (family === "sports") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4c2 3 2 13 0 16M4 12h16" />
      </svg>
    );
  }
  if (family === "family") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8" cy="8" r="2.2" />
        <circle cx="16" cy="8" r="2.2" />
        <path d="M4 19c.5-3 2.5-4.5 4-4.5S11.5 16 12 19M12 19c.5-3 2.5-4.5 4-4.5S19.5 16 20 19" />
      </svg>
    );
  }
  if (family === "auto") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 14h16l-2-5H6l-2 5Z" />
        <circle cx="7.5" cy="16.5" r="1.5" />
        <circle cx="16.5" cy="16.5" r="1.5" />
      </svg>
    );
  }
  if (family === "music") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18V6l10-2v12" />
        <circle cx="7" cy="18" r="2.5" />
        <circle cx="17" cy="16" r="2.5" />
      </svg>
    );
  }
  if (family === "art") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3a9 9 0 1 0 0 18 3 3 0 0 0 0-6 3 3 0 0 1 0-6 9 9 0 0 0 0-6Z" />
      </svg>
    );
  }
  if (family === "entertainment") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 8h16v10H4V8Z" />
        <path d="M8 8 6 4M16 8l2-4" />
      </svg>
    );
  }
  if (family === "education") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 10 12 5l9 5-9 5-9-5Z" />
        <path d="M7 12v5c2 1.5 8 1.5 10 0v-5" />
      </svg>
    );
  }
  if (family === "business") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 7V5h8v2" />
        <rect x="4" y="7" width="16" height="13" rx="2" />
      </svg>
    );
  }
  if (family === "pets") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8" cy="9" r="1.6" />
        <circle cx="16" cy="9" r="1.6" />
        <circle cx="6" cy="13" r="1.4" />
        <circle cx="18" cy="13" r="1.4" />
        <ellipse cx="12" cy="16" rx="3.2" ry="2.4" />
      </svg>
    );
  }
  if (family === "lifestyle") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4 14.5 9.5 20 12l-5.5 2.5L12 20l-2.5-5.5L4 12l5.5-2.5Z" />
    </svg>
  );
}

