import React from "react";

interface IconProps {
  size?: number;
  sw?: number;
  style?: React.CSSProperties;
  fill?: string;
}

const Icon: React.FC<
  IconProps & {
    d?: string;
    viewBox?: string;
    children?: React.ReactNode;
  }
> = ({ d, size = 14, fill = "none", sw = 1.6, children, viewBox = "0 0 24 24", style }) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

export const IconChevronR = (p: IconProps) => <Icon {...p} d="M9 6l6 6-6 6" />;
export const IconChevronD = (p: IconProps) => <Icon {...p} d="M6 9l6 6 6-6" />;
export const IconChevronL = (p: IconProps) => <Icon {...p} d="M15 6l-6 6 6 6" />;
export const IconPlus     = (p: IconProps) => <Icon {...p} d="M12 5v14M5 12h14" />;
export const IconCheck    = (p: IconProps) => <Icon {...p} d="M5 12.5l4 4 10-10" />;
export const IconX        = (p: IconProps) => <Icon {...p} d="M6 6l12 12M6 18L18 6" />;
export const IconWarn     = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5" />
    <circle cx="12" cy="18" r=".4" fill="currentColor" />
  </Icon>
);
export const IconInfo     = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.4" />
  </Icon>
);
export const IconErr      = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Icon>
);
export const IconSearch   = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M16 16l4 4" />
  </Icon>
);
export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
);
export const IconBook     = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 0 2 2h13" />
  </Icon>
);
export const IconFolder   = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Icon>
);
export const IconFile     = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </Icon>
);
export const IconText     = (p: IconProps) => <Icon {...p} d="M5 6h14M5 12h10M5 18h14" />;
export const IconHeading  = (p: IconProps) => <Icon {...p} d="M6 4v16M18 4v16M6 12h12" />;
export const IconImage    = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="M3 17l5-5 4 4 3-3 6 6" />
  </Icon>
);
export const IconTable    = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M3 10h18M3 16h18M9 4v16M15 4v16" />
  </Icon>
);
export const IconSigma    = (p: IconProps) => <Icon {...p} d="M18 5H6l6 7-6 7h12" />;
export const IconList     = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="6" r=".7" fill="currentColor" />
    <circle cx="5" cy="12" r=".7" fill="currentColor" />
    <circle cx="5" cy="18" r=".7" fill="currentColor" />
    <path d="M9 6h11M9 12h11M9 18h11" />
  </Icon>
);
export const IconCode     = (p: IconProps) => <Icon {...p} d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />;
export const IconPlay     = (p: IconProps) => <Icon {...p} d="M6 4l14 8-14 8z" fill="currentColor" />;
export const IconCheckCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l3 3 5-6" />
  </Icon>
);
export const IconClock    = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
export const IconDoc      = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M8 13h8M8 17h6" />
  </Icon>
);
export const IconUpload   = (p: IconProps) => <Icon {...p} d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3" />;
export const IconDownload = (p: IconProps) => <Icon {...p} d="M12 4v12M7 11l5 5 5-5M4 17v3h16v-3" />;
export const IconBuild    = (p: IconProps) => <Icon {...p} d="M5 3v18M5 8h6a3 3 0 0 1 0 6H5M5 14h8a3 3 0 0 1 0 6H5" />;
export const IconEye      = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const IconDrag     = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9"  cy="6"  r=".9" fill="currentColor" />
    <circle cx="15" cy="6"  r=".9" fill="currentColor" />
    <circle cx="9"  cy="12" r=".9" fill="currentColor" />
    <circle cx="15" cy="12" r=".9" fill="currentColor" />
    <circle cx="9"  cy="18" r=".9" fill="currentColor" />
    <circle cx="15" cy="18" r=".9" fill="currentColor" />
  </Icon>
);
export const IconMore     = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6"  cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="18" cy="12" r="1" fill="currentColor" />
  </Icon>
);
export const IconMoon     = (p: IconProps) => <Icon {...p} d="M21 13a8 8 0 1 1-9.5-9.7A6 6 0 0 0 21 13z" />;
export const IconSun      = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </Icon>
);
export const IconStar     = (p: IconProps) => <Icon {...p} d="M12 3l2.6 5.5 6 .9-4.4 4.2 1 6L12 16.8 6.7 19.6l1-6L3.4 9.4l6-.9z" />;
export const IconTrash    = (p: IconProps) => <Icon {...p} d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />;
export const IconEdit     = (p: IconProps) => <Icon {...p} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />;
export const IconRefresh  = (p: IconProps) => <Icon {...p} d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
export const IconGlobe    = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c-2.6 3.5-4 7.5-4 9s1.4 5.5 4 9M12 3c2.6 3.5 4 7.5 4 9s-1.4 5.5-4 9" />
  </Icon>
);
export const IconGrid     = (p: IconProps) => (
  <Icon {...p} fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Icon>
);
export const IconLayers   = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 10l10-5 10 5-10 5z" />
    <path d="M2 16l10-5 10 5" />
  </Icon>
);
export const IconMap      = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7l6-3 6 3 6-3v14l-6 3-6-3-6 3z" />
    <path d="M9 4v14M15 7v14" />
  </Icon>
);
export const IconBuilding = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 21h18M4 21V7l8-4 8 4v14" />
    <rect x="9" y="13" width="2" height="4" />
    <rect x="13" y="13" width="2" height="4" />
    <rect x="9" y="8" width="2" height="3" />
    <rect x="13" y="8" width="2" height="3" />
  </Icon>
);
// ── Posgrado ─────────────────────────────────────────────────────
export const IconAlgorithm = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 8h9M8 12h6M8 16h8" />
    <circle cx="5.5" cy="8"  r=".7" fill="currentColor" stroke="none" />
    <circle cx="5.5" cy="12" r=".7" fill="currentColor" stroke="none" />
    <circle cx="5.5" cy="16" r=".7" fill="currentColor" stroke="none" />
  </Icon>
);
export const IconTheorem = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4H4v16h1M19 4h1v16h-1M9 12h6" />
  </Icon>
);
export const IconAcronym = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 17L8 7l4 10M6 13.5h4" />
    <path d="M15 17V7M15 7h3a2 2 0 0 1 0 4h-3v0h3a2.5 2.5 0 0 1 0 5h-3" />
  </Icon>
);
export const IconGlossaryEntry = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h10v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 0 2 2h10" />
    <path d="M9 8h5M9 12h7M9 16h4" />
  </Icon>
);

export const IconQuote    = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
  </Icon>
);;
