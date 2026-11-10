import type { Comparison } from '../types';

export const money = (cents: number | null | undefined) => cents == null ? '—' :
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);

export function relativeTime(value: string | null): string {
  if (!value) return 'Sin comprobar';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
  return `Hace ${Math.floor(minutes / 1440)} días`;
}

export const exactTime = (value: string | null) => value ? new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value)) : 'Sin comprobar';
export const shortDate = (value: string | null) => value ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Sin fecha';

export const groupName = (group: string) => ({ pc: 'Equipo del panel', server: 'Servidor', project: 'Proyecto' })[group] ?? group;

export function safeLink(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function parseTarget(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Escribe un precio con un máximo de dos decimales.');
  const cents = Math.round(Number(normalized) * 100);
  if (cents > 1_000_000) throw new Error('El objetivo máximo es 10.000 €.');
  return cents;
}

// Matches the API's numeric / semver comparison, including Git for Windows and four-part tags.
export function compareVersions(installed: string | null, latest: string | null): Comparison {
  const dateTag = (value: string | null) => {
    if (!value || value.length > 100) return null;
    const match = value.trim().match(/^fulldex-(\d{4})-(\d{2})-(\d{2})(?:(?:[-.](?:r|rev)?(\d+))|([a-z]))?$/i);
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const stamp = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
    const date = new Date(stamp);
    if (year < 1 || !Number.isFinite(stamp) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    const revision = match[5] ? match[5].toLowerCase().charCodeAt(0) - 96 : Number(match[4] ?? 0);
    if (!Number.isSafeInteger(revision) || revision > 2_147_483_647) return null;
    return { stamp, revision, kind: match[5] ? 'a' : match[4] ? 'n' : 'b' };
  };
  const leftDate = dateTag(installed);
  const rightDate = dateTag(latest);
  if (leftDate || rightDate) {
    if (!leftDate || !rightDate) return 'unknown';
    if (leftDate.stamp === rightDate.stamp && leftDate.revision > 0 && rightDate.revision > 0 && leftDate.kind !== rightDate.kind) return 'unknown';
    const compared = leftDate.stamp - rightDate.stamp || leftDate.revision - rightDate.revision;
    return compared < 0 ? 'update' : compared > 0 ? 'ahead' : 'current';
  }
  const parse = (value: string | null) => {
    const normalized = value?.trim().replace(/\.windows\.(\d+)$/i, '.$1');
    const match = normalized?.match(/^[vV]?(\d+\.\d+(?:\.\d+){0,2})(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/);
    if (!match || normalized!.length > 100) return null;
    const core = match[1].split('.').map(Number);
    if (core.some(x => !Number.isSafeInteger(x) || x > 2_147_483_647)) return null;
    while (core.length < 4) core.push(0);
    return { core, pre: match[2]?.split('.') ?? [] };
  };
  const a = parse(installed);
  const b = parse(latest);
  if (!a || !b) return 'unknown';
  const status = (result: number): Comparison => result < 0 ? 'update' : result > 0 ? 'ahead' : 'current';
  for (let i = 0; i < 4; i++) if (a.core[i] !== b.core[i]) return status(a.core[i] - b.core[i]);
  if (!a.pre.length || !b.pre.length) return status(Number(!a.pre.length) - Number(!b.pre.length));
  for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    const result = xn && yn ? (x.length - y.length || (x < y ? -1 : x > y ? 1 : 0))
      : xn !== yn ? (xn ? -1 : 1) : x < y ? -1 : x > y ? 1 : 0;
    if (result) return status(result);
  }
  return status(a.pre.length - b.pre.length);
}
