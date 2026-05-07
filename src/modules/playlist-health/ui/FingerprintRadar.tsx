import type { Fingerprint } from "../types";

function pointsFor(fingerprint: Fingerprint, radius: number): string {
  const values = [
    fingerprint.energy,
    fingerprint.valence,
    fingerprint.danceability,
    fingerprint.acousticness,
    fingerprint.instrumentalness,
    fingerprint.liveness,
    fingerprint.tempoNormalized
  ];

  return values
    .map((value, index) => {
      const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
      const scaled = value * radius;
      return `${50 + Math.cos(angle) * scaled},${50 + Math.sin(angle) * scaled}`;
    })
    .join(" ");
}

export function FingerprintRadar({ core, recent }: { core: Fingerprint; recent: Fingerprint }) {
  return (
    <svg className="h-40 w-40 shrink-0 self-center" viewBox="0 0 100 100" role="img" aria-label="Playlist fingerprint radar">
      <circle cx="50" cy="50" r="36" fill="none" stroke="var(--ambient-edge)" strokeWidth="0.75" />
      <circle cx="50" cy="50" r="22" fill="none" stroke="var(--ambient-edge)" strokeWidth="0.75" />
      <polygon points={pointsFor(core, 36)} fill="var(--ambient-accent)" fillOpacity="0.16" stroke="var(--ambient-accent)" strokeWidth="1.4" />
      <polygon points={pointsFor(recent, 36)} fill="var(--ambient-muted)" fillOpacity="0.12" stroke="var(--ambient-muted)" strokeWidth="1.2" />
    </svg>
  );
}
