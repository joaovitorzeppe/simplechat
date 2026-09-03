import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const CALL_ICONS_SIZE = 24

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
    <svg {...base(props)} width={CALL_ICONS_SIZE} height={CALL_ICONS_SIZE}>
      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export const MicOffIcon = (props: IconProps) => {
  return (
    <svg {...base(props)} width={CALL_ICONS_SIZE} height={CALL_ICONS_SIZE}>
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
    <svg {...base(props)} width={CALL_ICONS_SIZE} height={CALL_ICONS_SIZE}>
      <path d="M16 8H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z" />
      <path d="M18 11l4-2v7l-4-2" />
    </svg>
  );
}

export const CameraOffIcon = (props: IconProps) => {
  return (
    <svg {...base(props)} width={CALL_ICONS_SIZE} height={CALL_ICONS_SIZE}>
      <path d="M16 8H8" />
      <path d="M3 8.5v8.5a2 2 0 0 0 2 2h10" />
      <path d="M18 11l4-2v7l-4-2" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export const ScreenIcon = (props: IconProps) => {
  return (
    <svg {...base(props)} width={CALL_ICONS_SIZE} height={CALL_ICONS_SIZE}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  );
}

export const PhoneOffIcon = (props: IconProps) => {
  return (
    <svg
      {...base(props)}
      width={CALL_ICONS_SIZE}
      height={CALL_ICONS_SIZE}
      stroke="none"
      fill="currentColor"
    >
      <path d="M18.59 11.0903C19.64 11.6003 20.63 12.2403 21.55 13.0003L20.48 14.0703C19.9 13.6003 19.27 13.1803 18.6 12.8003V11.0903M5.4 11.0903V12.7903C4.75 13.1603 4.12 13.5803 3.53 14.0603L2.46 12.9903C3.37 12.2403 4.36 11.6103 5.4 11.0903ZM12 7.57031C7.46 7.57031 3.34 9.35031 0.29 12.2403C0.11 12.4203 0 12.6703 0 12.9503C0 13.2303 0.11 13.4803 0.29 13.6503L2.77 16.1303C2.95 16.3103 3.2 16.4203 3.48 16.4203C3.75 16.4203 4 16.3203 4.18 16.1403C4.97 15.4103 5.86 14.7803 6.84 14.2903C7.17 14.1303 7.4 13.7803 7.4 13.3903V10.2903C8.85 9.82031 10.4 9.57031 12 9.57031C13.6 9.57031 15.15 9.82031 16.59 10.3003V13.4003C16.59 13.8003 16.82 14.1403 17.15 14.3003C18.13 14.7903 19.03 15.4103 19.82 16.1503C20 16.3203 20.25 16.4303 20.52 16.4303C20.8 16.4303 21.05 16.3203 21.23 16.1403L23.71 13.6603C23.89 13.4803 24 13.2303 24 12.9503C24 12.6703 23.89 12.4203 23.71 12.2403C20.66 9.35031 16.54 7.57031 12 7.57031Z" />
    </svg>
  );
};

export const ChatIcon = (props: IconProps) => {
  return (
    <svg {...base(props)} width={CALL_ICONS_SIZE} height={CALL_ICONS_SIZE}>
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

export const UserRemoveIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M15 20v-1a5 5 0 0 0-5-5H7a5 5 0 0 0-5 5v1" />
      <circle cx="8.5" cy="7" r="3.5" />
      <path d="M17 10h5" />
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

export const GlobeIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M3 12h16" />
      <path d="M12 4a14 14 0 0 1 4 8 14 14 0 0 1-4 8 14 14 0 0 1-4-8 14 14 0 0 1 4-8Z" />
    </svg>
  );
}

export const CloseIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
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

export const PaperclipIcon = (props: IconProps) => {
  return (
    <svg {...base(props)}>
      <path d="M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5l9.9-9.9a4 4 0 0 1 5.7 5.7l-9.9 9.9a2 2 0 1 1-2.8-2.8l8.5-8.5" />
    </svg>
  );
}
