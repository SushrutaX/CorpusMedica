/**
 * Parameter-specific icons for lab markers.
 * Dark-theme medical dashboard style: blood drops (hemoglobin), lipid, kidney, etc.
 */

import type { ComponentType } from "react";

const SIZE = 36;
const fillNormal = "#22c55e";
const fillAbnormal = "#ef4444";
const fillMuted = "#6b7280";

function BloodDrops({ isNormal }: { isNormal?: boolean }) {
  const fill = isNormal === undefined ? fillMuted : isNormal ? fillNormal : fillAbnormal;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" fill="none" aria-hidden>
      <path d="M18 6c0 0-4 6-4 10a4 4 0 108 0c0-4-4-10-4-10z" fill={fill} opacity={0.9} />
      <path d="M12 16c0 0-2 4-2 6a2 2 0 104 0c0-2-2-6-2-6z" fill={fill} opacity={0.75} />
      <path d="M24 16c0 0-2 4-2 6a2 2 0 104 0c0-2-2-6-2-6z" fill={fill} opacity={0.75} />
    </svg>
  );
}

function GlucoseDroplet({ isNormal }: { isNormal?: boolean }) {
  const fill = isNormal === undefined ? fillMuted : isNormal ? fillNormal : fillAbnormal;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" fill="none" aria-hidden>
      <path d="M18 4c0 0-8 10-8 16a8 8 0 1016 0c0-6-8-16-8-16z" fill={fill} />
    </svg>
  );
}

function LipidMolecule({ isNormal }: { isNormal?: boolean }) {
  const fill = isNormal === undefined ? fillMuted : isNormal ? fillNormal : fillAbnormal;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" fill="none" aria-hidden>
      <ellipse cx="18" cy="12" rx="10" ry="6" fill={fill} opacity={0.9} />
      <ellipse cx="18" cy="22" rx="10" ry="6" fill={fill} opacity={0.7} />
      <circle cx="18" cy="12" r="4" fill={fill} />
      <circle cx="18" cy="22" r="4" fill={fill} />
    </svg>
  );
}

function Kidney({ isNormal }: { isNormal?: boolean }) {
  const fill = isNormal === undefined ? fillMuted : isNormal ? fillNormal : fillAbnormal;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" fill="none" aria-hidden>
      <path
        d="M24 10c2 2 4 6 4 10s-2 8-4 10c-2 2-6 4-10 4-4 0-8-2-10-4-2-2-4-6-4-10s2-8 4-10c2-2 6-4 10-4 4 0 8 2 10 4z"
        fill={fill}
      />
    </svg>
  );
}

function Liver({ isNormal }: { isNormal?: boolean }) {
  const fill = isNormal === undefined ? fillMuted : isNormal ? fillNormal : fillAbnormal;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" fill="none" aria-hidden>
      <rect x="6" y="8" width="24" height="20" rx="6" fill={fill} />
    </svg>
  );
}

function Thyroid({ isNormal }: { isNormal?: boolean }) {
  const fill = isNormal === undefined ? fillMuted : isNormal ? fillNormal : fillAbnormal;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" fill="none" aria-hidden>
      <ellipse cx="12" cy="18" rx="8" ry="10" fill={fill} />
      <ellipse cx="24" cy="18" rx="8" ry="10" fill={fill} />
      <rect x="16" y="14" width="4" height="8" rx="1" fill={fill} opacity={0.8} />
    </svg>
  );
}

function VitaminD({ isNormal }: { isNormal?: boolean }) {
  const fill = isNormal === undefined ? fillMuted : isNormal ? fillNormal : fillAbnormal;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" fill="none" aria-hidden>
      <circle cx="18" cy="14" r="8" fill={fill} />
      <path d="M10 22h16l-8 10-8-10z" fill={fill} opacity={0.85} />
    </svg>
  );
}

function DefaultFlask({ isNormal }: { isNormal?: boolean }) {
  const fill = isNormal === undefined ? fillMuted : isNormal ? fillNormal : fillAbnormal;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" fill="none" aria-hidden>
      <path d="M14 4h8v6l6 12v8H8v-8l6-12V4z" fill={fill} opacity={0.9} />
      <rect x="15" y="6" width="6" height="4" rx="1" fill={fill} opacity={0.6} />
    </svg>
  );
}

const MARKER_ICONS: Record<string, ComponentType<{ isNormal?: boolean }>> = {
  hemoglobin: BloodDrops,
  glucose: GlucoseDroplet,
  hba1c: GlucoseDroplet,
  cholesterol: LipidMolecule,
  ldl: LipidMolecule,
  hdl: LipidMolecule,
  triglycerides: LipidMolecule,
  creatinine: Kidney,
  alt: Liver,
  ast: Liver,
  tsh: Thyroid,
  vitamin_d: VitaminD,
};

export function LabMarkerIcon({
  marker,
  isNormal,
}: {
  marker: string;
  isNormal?: boolean;
}) {
  const key = marker.toLowerCase().replace(/\s+/g, "_");
  const Icon = MARKER_ICONS[key] ?? Object.entries(MARKER_ICONS).find(([k]) => key.includes(k) || k.includes(key))?.[1];
  const C = Icon ?? DefaultFlask;
  return <C isNormal={isNormal} />;
}
