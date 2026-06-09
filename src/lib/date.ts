/**
 * Converte uma string de data vinda do backend para um Date no fuso LOCAL do
 * dispositivo. Timestamps sem marcador de fuso (naive, ex.: "2026-06-09T12:00:00")
 * são tratados como UTC — senão o JS os interpretaria como hora local e exibiria
 * deslocado (ex.: GMT+0 em vez de GMT-3).
 */
export function parseServerDate(value?: string | null): Date | null {
  if (!value) return null;
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
  const d = new Date(hasTz ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
