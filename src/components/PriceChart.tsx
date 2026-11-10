import { useId } from 'react';
import type { PricePoint } from '../types';
import { exactTime, money, shortDate } from '../lib/format';

interface Props { history: PricePoint[]; target: number | null; days: number; name: string; asOf: string }

export default function PriceChart({ history, target, days, name, asOf }: Props) {
  const id = useId();
  const cutoff = Date.parse(asOf) - days * 86_400_000;
  const end = Date.parse(asOf);
  const points = history.filter(point => Date.parse(point.observedAt) >= cutoff && Date.parse(point.observedAt) <= end);
  if (!points.length) return <div className="chart-summary"><span>{history.length ? 'Sin lecturas en este periodo' : 'Aún sin lecturas'}</span></div>;
  if (points.length === 1 || Date.parse(points.at(-1)!.observedAt) - Date.parse(points[0].observedAt) < 86_400_000)
    return <div className="chart-summary"><strong>{points.length} {points.length === 1 ? 'lectura' : 'lecturas'}</strong><span>{shortDate(points[0].observedAt)}</span></div>;
  const width = 660;
  const height = 220;
  const inset = { x: 16, y: 25 };
  const values = [...points.map(point => point.priceCents), ...(target === null ? [] : [target])];
  const min = Math.max(0, Math.min(...values) * 0.8);
  const max = Math.max(...values) * 1.15 || 100;
  const y = (value: number) => height - inset.y - ((value - min) / (max - min)) * (height - inset.y * 2);
  const x = (point: PricePoint) => inset.x + (Date.parse(point.observedAt) - cutoff) / (end - cutoff) * (width - inset.x * 2);
  // Missing daily observations stay gaps, not a fictional continuous price history.
  const segments: PricePoint[][] = [];
  for (const point of points) {
    const previous = segments.at(-1)?.at(-1);
    if (!previous || Date.parse(point.observedAt) - Date.parse(previous.observedAt) > 26 * 60 * 60_000 ||
        previous.activationPlatform !== point.activationPlatform || previous.deliveryType !== point.deliveryType || previous.languageRestriction !== point.languageRestriction) segments.push([point]);
    else segments.at(-1)!.push(point);
  }
  const last = points.at(-1)!;
  return <figure className="price-chart">
    <div className="chart-scale"><span>{money(Math.round(max))}</span><span>{money(Math.round((min + max) / 2))}</span><span>{money(Math.round(min))}</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>Histórico de precios de {name}</title>
      <desc id={`${id}-description`}>{points.length} observaciones reales en los últimos {days} días. Los huecos no tienen precios confirmados. Última: {money(last.priceCents)}, {exactTime(last.observedAt)}.{target === null ? '' : ` Objetivo: ${money(target)}.`}</desc>
      {[inset.y, height / 2, height - inset.y].map(position => <line key={position} x1={0} x2={width} y1={position} y2={position} className="chart-grid" />)}
      {target !== null && <line x1={0} x2={width} y1={y(target)} y2={y(target)} className="chart-target" />}
      {segments.filter(segment => segment.length > 1).map(segment => <path key={segment[0].id} d={segment.map((point, index) => `${index ? 'L' : 'M'} ${x(point)} ${y(point.priceCents)}`).join(' ')} className="chart-line" />)}
      {points.slice(0, -1).map(point => <circle key={point.id} cx={x(point)} cy={y(point.priceCents)} r="2.5" className="chart-point" />)}
      <circle cx={x(last)} cy={y(last.priceCents)} r="7" fill="#d5efec" stroke="#08717b" strokeWidth="3" />
    </svg>
    <figcaption className="chart-caption"><span>{shortDate(new Date(cutoff).toISOString())}</span>
      <span>{history.length === 1 ? 'Primera lectura' : `${points.length} lecturas`}</span>
      <span>{shortDate(asOf)}</span></figcaption>
    {target !== null && <span className="chart-legend"><i /> Objetivo actual {money(target)}</span>}
  </figure>;
}
