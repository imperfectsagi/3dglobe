export function formatMinutes(min: number): string {
  const rounded = Math.round(min);
  if (rounded < 60) return `${rounded}`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatKm(km: number): string {
  return km < 10 ? km.toFixed(1) : Math.round(km).toString();
}
