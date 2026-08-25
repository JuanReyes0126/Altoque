import type { SVGProps } from "react";

const P = {
  bolt: <path d="M13.5 2 5 14h5.5L9 22l8.5-12H12l1.5-8Z" />,
  wrench: <path d="M20.2 6.6a5 5 0 0 1-6.6 6.2L7 19.4a2.1 2.1 0 0 1-3-3l6.6-6.6a5 5 0 0 1 6.2-6.6L13.6 6.4l1 3 3 1 2.6-3.8Z" />,
  plug: (
    <>
      <path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0V8Z" />
      <path d="M12 16.5V21" />
    </>
  ),
  snow: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
      <path d="M12 3l-2 2.5M12 3l2 2.5M12 21l-2-2.5M12 21l2-2.5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4.2" />
      <path d="m11.2 11.8 8.3-8.3M17 6l2.5 2.5M14 9l2 2" />
    </>
  ),
  broom: (
    <>
      <path d="m19 4-6.5 6.5" />
      <path d="M12.5 10.5c1.8 1.8 2.4 4.6 1.6 7.5-3.4 1.6-6.8 1-9.6-1.6.9-3.6 3.4-5.9 8-5.9Z" />
      <path d="m8.5 14 2.2 2.2" />
    </>
  ),
  car: (
    <>
      <path d="M4 16v-3.5L6 7a2 2 0 0 1 1.9-1.4h8.2A2 2 0 0 1 18 7l2 5.5V16" />
      <path d="M3 12.5h18M6.5 16v2M17.5 16v2" />
      <circle cx="7.5" cy="14" r="0.6" fill="currentColor" />
      <circle cx="16.5" cy="14" r="0.6" fill="currentColor" />
    </>
  ),
  roller: (
    <>
      <path d="M4 5.5h13A2.5 2.5 0 0 1 19.5 8v1A2.5 2.5 0 0 1 17 11.5H4A1.5 1.5 0 0 1 2.5 10V7A1.5 1.5 0 0 1 4 5.5Z" />
      <path d="M19.5 8h1.5v4.5h-9V15" />
      <rect x="10.5" y="15" width="3" height="6.5" rx="1" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.6l1.6-2.5h6.6L16.9 7h2.6A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19C4 9 10 4 20 4c0 10-5 16-15 15Z" />
      <path d="M5 19c2.5-5 6-8.5 10-10.5" />
    </>
  ),
  drop: <path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3Z" />,
  shield: (
    <>
      <path d="M12 2.8 4.5 5.6v6c0 4.6 3 8 7.5 9.6 4.5-1.6 7.5-5 7.5-9.6v-6L12 2.8Z" />
      <path d="m8.8 11.6 2.3 2.3 4.1-4.6" />
    </>
  ),
  star: <path d="m12 3.2 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.4l5.9-.8L12 3.2Z" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  phone: <path d="M7.5 3h2.6l1.4 4.4-2 1.5a12.5 12.5 0 0 0 5.6 5.6l1.5-2 4.4 1.4v2.6A2.5 2.5 0 0 1 18.5 19 14.5 14.5 0 0 1 5 5.5 2.5 2.5 0 0 1 7.5 3Z" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </>
  ),
  chart: <path d="M4 20V4M4 20h16M8 16v-5M12 16V7.5M16 16v-3M20 16V5.5" />,
  alert: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 10v4M12 16.8v.2" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5ZM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5" />,
  db: (
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  flag: <path d="M5 21V4m0 1h13l-2.5 3.5L18 12H5" />,
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12 18.5 6" />
      <circle cx="15" cy="14.5" r="0.7" fill="currentColor" />
    </>
  ),
  spark: <path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5L10 13l-6.5-2L10 9l2-6.5Z" />,
  gift: (
    <>
      <rect x="4" y="9" width="16" height="4" />
      <path d="M5.5 13v7.5h13V13M12 9v11.5M12 9s-4.5.2-5.5-2C5.7 5 7.5 3.6 9 4.5c1.8 1 3 4.5 3 4.5Zm0 0s4.5.2 5.5-2c.8-2-1-3.4-2.5-2.5-1.8 1-3 4.5-3 4.5Z" />
    </>
  ),
  hammer: (
    <>
      <path d="m14 6.5 5.5 5.5-2 2L12 8.5" />
      <path d="M13.5 3.5 6 11l3 3 7.5-7.5a2.1 2.1 0 0 0-3-3Z" />
      <path d="m8 12.5-4.5 4.5a1.8 1.8 0 0 0 0 2.5l.5.5a1.8 1.8 0 0 0 2.5 0L11 15.5" />
    </>
  ),
  doc: (
    <>
      <path d="M6 2.5h8l4 4v15H6v-19Z" />
      <path d="M14 2.5v4h4M9 11h6M9 14.5h6M9 18h4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5" />
    </>
  ),
  home: <path d="M4 11 12 3.5 20 11v9.5a1 1 0 0 1-1 1h-4.5V15h-5v6.5H5a1 1 0 0 1-1-1V11Z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  heart: <path d="M12 20.5S4 15.5 4 9.8A4.3 4.3 0 0 1 8.3 5.5c1.6 0 3 .8 3.7 2.1.7-1.3 2.1-2.1 3.7-2.1A4.3 4.3 0 0 1 20 9.8c0 5.7-8 10.7-8 10.7Z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  chevl: <path d="M14.5 5 8 12l6.5 7" />,
  chevr: <path d="m9.5 5 6.5 7-6.5 7" />,
  chevd: <path d="m5 9.5 7 6.5 7-6.5" />,
  clip: (
    <>
      <rect x="5" y="4.5" width="14" height="17" rx="2.5" />
      <path d="M9 4.5V3h6v1.5M9 10.5h6M9 14h6M9 17.5h3.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M3 10h18M16.5 15h1" />
    </>
  ),
  logout: <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M10 12h10m0 0-3.5-3.5M20 12l-3.5 3.5" />,
  bell: (
    <>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  filter: <path d="M4 5.5h16M7 12h10M10 18.5h4" />,
  msg: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v9a2.5 2.5 0 0 1-2.5 2.5H12l-5 4v-4H6.5A2.5 2.5 0 0 1 4 14.5v-9Z" />,
  cam: (
    <>
      <rect x="3" y="6.5" width="13" height="12" rx="2.5" />
      <path d="m16 11 5-3v10l-5-3" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.8 1.7M9.5 3h5" />
    </>
  ),
  send: <path d="m4 11 16-7-4.5 16-4-6.5L4 11ZM11.5 13.5 20 4" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  moon: <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4 8.5 8.5 0 1 0 20 13.5Z" />,
  badge: (
    <>
      <path d="m12 2.5 2.2 1.9 2.9-.4 1 2.7 2.7 1-.4 2.9 1.9 2.2-1.9 2.2.4 2.9-2.7 1-1 2.7-2.9-.4-2.2 1.9-2.2-1.9-2.9.4-1-2.7-2.7-1 .4-2.9L1.7 12l1.9-2.2-.4-2.9 2.7-1 1-2.7 2.9.4L12 2.5Z" />
      <path d="m8.8 12.2 2.2 2.2 4.2-4.8" />
    </>
  ),
};

export type IconName = keyof typeof P;

export function Icon({ name, className = "w-5 h-5", strokeWidth = 1.7, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {P[name]}
    </svg>
  );
}

export const CAT_ICONS: Record<string, IconName> = {
  Plomería: "wrench",
  Electricidad: "plug",
  "Aire acondicionado": "snow",
  Cerrajería: "key",
  Limpieza: "broom",
  Mecánica: "car",
  Grúas: "car",
  Remodelación: "hammer",
  Fotografía: "camera",
  Pintura: "roller",
  Jardinería: "leaf",
  Neveras: "snow",
  Inversores: "plug",
  Cámaras: "camera",
  "Wi-Fi": "radar",
  Catering: "gift",
  DJ: "spark",
  Mudanzas: "layers",
  Ebanistería: "hammer",
  Fumigación: "leaf",
  Detailing: "spark",
  Arquitectura: "doc",
};
