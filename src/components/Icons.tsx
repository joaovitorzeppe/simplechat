import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: 20,
    height: 20,
    ...props,
  };
}

export const MicIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export const MicOffIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M9 9v3a3 3 0 0 0 5.1 2.1" />
      <path d="M12 3a3 3 0 0 1 3 3v3" />
      <path d="M19 11a7 7 0 0 1-1.2 3.9" />
      <path d="M5 11a7 7 0 0 0 11 4.5" />
      <path d="M12 18v3" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export const CameraIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M16 8H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z" />
      <path d="M18 11l4-2v7l-4-2" />
    </svg>
  );
}

export const CameraOffIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M16 8H8" />
      <path d="M3 8.5v8.5a2 2 0 0 0 2 2h10" />
      <path d="M18 11l4-2v7l-4-2" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export const ScreenIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  );
}

export const PhoneOffIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M10.7 6.5c.7-.2 1.5-.3 2.3-.3 4.4 0 8 3.6 8 8 0 .8-.1 1.6-.3 2.3" />
      <path d="M4 4l16 16" />
      <path d="M6.5 10.7C5.3 13.2 5 16 6.2 18.2c.3.6 1 1 1.7 1h2c.6 0 1.1-.4 1.2-1l.4-1.5a1.3 1.3 0 0 0-.7-1.5l-1.3-.6a10 10 0 0 1-.4-1.3" />
    </svg>
  );
}

export const ChatIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export const CopyIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export const CheckIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M5 12.5 9.5 17 19 7.5" />
    </svg>
  );
}

export const HistoryIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export const ExpandIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M9 3H4v5" />
      <path d="M15 3h5v5" />
      <path d="M21 15v5h-5" />
      <path d="M3 15v5h5" />
    </svg>
  );
}

export const ArrowLeftIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

export const GlobeIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M3 12h16" />
      <path d="M12 4a14 14 0 0 1 4 8 14 14 0 0 1-4 8 14 14 0 0 1-4-8 14 14 0 0 1 4-8Z" />
    </svg>
  );
}

export const DownloadIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}
