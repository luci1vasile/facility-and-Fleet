import React from 'react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

/**
 * Custom Icon with Office Building + Adjustable Wrench + Automobile
 * ("iconita cu o cladire de birouri, o cheie reglabila si un autoturism")
 */
export const AppEmblem: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={`shrink-0 ${className}`}
      aria-label="Facility and Fleet Maintanance Icon - Office Building, Adjustable Wrench, and Car"
    >
      <defs>
        <linearGradient id="ffmBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="55%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="112" fill="url(#ffmBgGrad)" />
      <rect
        x="16"
        y="16"
        width="480"
        height="480"
        rx="96"
        fill="none"
        stroke="#38bdf8"
        strokeOpacity="0.35"
        strokeWidth="6"
      />

      {/* Office Building (Left/Center-Back) */}
      <g transform="translate(82, 82)">
        <rect
          x="0"
          y="0"
          width="164"
          height="268"
          rx="12"
          fill="#f8fafc"
          stroke="#0f172a"
          strokeWidth="10"
        />
        <rect x="20" y="-22" width="124" height="26" rx="6" fill="#38bdf8" />
        {/* Windows */}
        <rect x="24" y="24" width="28" height="28" rx="4" fill="#1e3a8a" />
        <rect x="68" y="24" width="28" height="28" rx="4" fill="#0284c7" />
        <rect x="112" y="24" width="28" height="28" rx="4" fill="#1e3a8a" />

        <rect x="24" y="68" width="28" height="28" rx="4" fill="#0284c7" />
        <rect x="68" y="68" width="28" height="28" rx="4" fill="#1e3a8a" />
        <rect x="112" y="68" width="28" height="28" rx="4" fill="#38bdf8" />

        <rect x="24" y="112" width="28" height="28" rx="4" fill="#1e3a8a" />
        <rect x="68" y="112" width="28" height="28" rx="4" fill="#38bdf8" />
        <rect x="112" y="112" width="28" height="28" rx="4" fill="#1e3a8a" />

        <rect x="24" y="156" width="28" height="28" rx="4" fill="#38bdf8" />
        <rect x="68" y="156" width="28" height="28" rx="4" fill="#1e3a8a" />
        <rect x="112" y="156" width="28" height="28" rx="4" fill="#0284c7" />

        <rect x="58" y="204" width="48" height="64" rx="6" fill="#0f172a" />
      </g>

      {/* Adjustable Wrench / Cheie Reglabila (Right) */}
      <g transform="translate(334, 185) rotate(-34)">
        <rect
          x="-22"
          y="-10"
          width="44"
          height="175"
          rx="18"
          fill="#e2e8f0"
          stroke="#0f172a"
          strokeWidth="10"
        />
        <rect x="-10" y="20" width="20" height="95" rx="6" fill="#94a3b8" />
        <circle cx="0" cy="140" r="9" fill="#0f172a" />
        <rect
          x="-26"
          y="-26"
          width="52"
          height="22"
          rx="6"
          fill="#38bdf8"
          stroke="#0f172a"
          strokeWidth="8"
        />
        <path
          d="M-46,-26 C-56,-70 -30,-108 0,-112 L0,-68 L-18,-56 L-18,-36 L18,-36 L18,-56 L38,-72 C52,-46 46,-26 30,-26 Z"
          fill="#f8fafc"
          stroke="#0f172a"
          strokeWidth="10"
          strokeLinejoin="round"
        />
      </g>

      {/* Automobile / Autoturism (Bottom Foreground) */}
      <g transform="translate(96, 286)">
        <ellipse
          cx="160"
          cy="138"
          rx="156"
          ry="16"
          fill="#090d16"
          fillOpacity="0.45"
        />
        <path
          d="M52,58 L92,10 C100,2 112,-2 126,-2 L202,-2 C216,-2 228,4 238,14 L274,58 Z"
          fill="#38bdf8"
          stroke="#0f172a"
          strokeWidth="10"
          strokeLinejoin="round"
        />
        <path d="M72,54 L102,14 L158,14 L158,54 Z" fill="#0f172a" />
        <path d="M170,54 L170,14 L216,14 L250,54 Z" fill="#0f172a" />
        <rect
          x="8"
          y="54"
          width="308"
          height="62"
          rx="24"
          fill="#f8fafc"
          stroke="#0f172a"
          strokeWidth="10"
        />
        <rect
          x="284"
          y="68"
          width="24"
          height="16"
          rx="6"
          fill="#facc15"
          stroke="#0f172a"
          strokeWidth="5"
        />
        <rect
          x="14"
          y="68"
          width="18"
          height="16"
          rx="5"
          fill="#ef4444"
          stroke="#0f172a"
          strokeWidth="5"
        />
        <g transform="translate(74, 116)">
          <circle
            cx="0"
            cy="0"
            r="32"
            fill="#1e293b"
            stroke="#0f172a"
            strokeWidth="10"
          />
          <circle cx="0" cy="0" r="14" fill="#38bdf8" />
        </g>
        <g transform="translate(248, 116)">
          <circle
            cx="0"
            cy="0"
            r="32"
            fill="#1e293b"
            stroke="#0f172a"
            strokeWidth="10"
          />
          <circle cx="0" cy="0" r="14" fill="#38bdf8" />
        </g>
      </g>
    </svg>
  );
};

export const GoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ onClick, disabled, label = 'Sign in with Google' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="gsi-material-button disabled:opacity-50"
    >
      <div className="gsi-material-button-state"></div>
      <div className="gsi-material-button-content-wrapper">
        <div className="gsi-material-button-icon">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            style={{ display: 'block' }}
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            ></path>
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            ></path>
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            ></path>
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            ></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
          </svg>
        </div>
        <span className="gsi-material-button-contents">{label}</span>
        <span style={{ display: 'none' }}>{label}</span>
      </div>
    </button>
  );
};

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = React.useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition whitespace-nowrap"
      >
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        <span>Instalare App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
        >
          Instalare pe iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl text-slate-900">
              <h3 className="text-lg font-semibold">
                Instalare pe iPhone / iPad
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                1. Apăsați butonul <strong>Share</strong> din bara Safari.
                <br />
                2. Selectați <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Închide
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      Mod Offline — Datele salvate local sunt active.
    </div>
  );
};
