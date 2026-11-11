import { ExternalLink, Eye, EyeOff, Info, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { GameWatch, PricePoint } from '../types';
import { exactTime, money, relativeTime, safeLink, shortDate } from '../lib/format';
import { deliveryLabel, freshPrice, languageLabel, offerLabel, onSale, paymentLabel, platformLabel, sourceLabel } from '../lib/tracking';
import type { WatchModal } from './WatchDialog';
import PriceChart from './PriceChart';

interface Props {
  name: string; watch: GameWatch; watches: GameWatch[]; recommended: GameWatch; asOf: string; disabled: boolean;
  selectSource: (id: string) => void; openModal: (modal: WatchModal) => void;
  onInclude?: (watch: GameWatch, included: boolean) => void;
}
function periodLow(watch: GameWatch, days: number, asOf: string) {
  if (days === 730) return { cents: watch.twoYearLowCents, at: watch.twoYearLowObservedAt, platform: watch.twoYearLowActivationPlatform,
    delivery: watch.twoYearLowDeliveryType, language: watch.twoYearLowLanguageRestriction };
  const end = Date.parse(asOf);
  const points = watch.history.filter(point => Date.parse(point.observedAt) >= end - days * 86_400_000 && Date.parse(point.observedAt) <= end);
  const low = points.reduce<PricePoint | null>((best, point) => !best || point.priceCents < best.priceCents ? point : best, null);
  return { cents: low?.priceCents ?? null, at: low?.observedAt ?? null, platform: low?.activationPlatform ?? null,
    delivery: low?.deliveryType ?? null, language: low?.languageRestriction ?? null };
}
export default function PriceDetail({ name, watch, watches, recommended, asOf, disabled, selectSource, openModal, onInclude }: Props) {
  const [days, setDays] = useState(730);
  const [showHistory, setShowHistory] = useState(false);
  const point = watch.current;
  const market = watch.provider === 'allkeyshop';
  const low = periodLow(watch, days, asOf);
  const differentMinimum = market && low.cents !== null && (low.platform !== point?.activationPlatform || low.delivery !== point?.deliveryType || low.language !== point?.languageRestriction);
  const linked = watches.some(item => item.provider === 'steam') && watches.some(item => item.provider === 'allkeyshop');
  const region = point?.region === 'GLOBAL' ? 'Global' : point?.region === 'EUROPE' ? 'Europa' : point?.region;
  return <section id="game-price-detail" className="panel game-detail lean-detail" aria-labelledby="game-detail-title">
    <div className="detail-heading"><div><h2 id="game-detail-title">{name}</h2><span>{watch.edition !== 'Standard' ? `${watch.edition} · ` : ''}{market && point ? `${platformLabel(point.activationPlatform)} · ${deliveryLabel(point.deliveryType)}` : sourceLabel(watch)}{region ? ` · ${region}` : ''}</span></div>
      <div className="detail-actions"><button className="icon-button" disabled={disabled} aria-label={`Editar juego ${watch.name}`} title={`Editar ${sourceLabel(watch)}`} onClick={() => openModal({ kind: 'edit-game', game: watch })}><Pencil size={18} /></button>
        <button className="icon-button" disabled={disabled} onClick={() => onInclude?.(watch, !watch.includeInWidget)} aria-pressed={watch.includeInWidget} aria-label={`${watch.includeInWidget ? 'Ocultar' : 'Mostrar'} ${watch.name} en el widget`}>{watch.includeInWidget ? <Eye size={18} /> : <EyeOff size={18} />}</button>
        <button className="icon-button delete-button" disabled={disabled} aria-label={`Eliminar fuente ${sourceLabel(watch)} de ${watch.name}`} onClick={() => openModal({ kind: 'delete-game', game: watch })}><Trash2 size={18} /></button></div></div>
    <div className="source-selector" aria-label="Fuente del histórico">{watches.map(item => <button key={item.id} className={item.id === watch.id ? 'active' : ''} onClick={() => selectSource(item.id)} aria-pressed={item.id === watch.id}><span>{sourceLabel(item)}{item.provider === 'allkeyshop' && watches.filter(source => source.provider === 'allkeyshop').length > 1 && <small>{item.edition !== 'Standard' ? `${item.edition} · ` : ''}{item.region === 'global' ? 'Global' : 'Europa + Global'} · {paymentLabel(item.payment)}</small>}</span></button>)}
      {!linked && <button className="add-source" disabled={disabled} onClick={() => openModal({ kind: 'counterpart', game: watch })}><Plus size={15} />{market ? 'Buscar Steam' : 'Buscar AllKeyShop'}</button>}</div>
    {watch.id !== recommended.id && freshPrice(recommended) && <button className="return-recommendation text-button" onClick={() => selectSource(recommended.id)}>Oferta principal: {sourceLabel(recommended)} · {money(recommended.current?.priceCents)}</button>}
    {point?.languageRestriction && <p className="language-restriction"><Info size={15} />{languageLabel(point.languageRestriction)}</p>}
    <div className="detail-metrics offer-metrics"><div><span>{point && !freshPrice(watch) ? 'Último precio' : market ? 'Total estimado' : 'Precio'}</span><strong>{money(point?.priceCents)}</strong>
      {watch.provider === 'steam' && point?.originalPriceCents != null && point.originalPriceCents > point.priceCents && <del>{money(point.originalPriceCents)}</del>}
      {watch.targetReached ? <span className="badge success">Objetivo alcanzado</span> : onSale(watch) ? <span className="badge teal">−{point?.discountPercent}%</span> : point && !freshPrice(watch) ? <span className="badge muted">Antiguo</span> : null}</div>
      <div><span>Mínimo · {days === 730 ? '2 años' : `${days} días`}</span><strong>{money(low.cents)}</strong><small title={low.at ? exactTime(low.at) : undefined}>{low.at ? shortDate(low.at) : 'Sin lecturas'}</small>{differentMinimum && <small>{[platformLabel(low.platform), deliveryLabel(low.delivery), languageLabel(low.language)].filter(Boolean).join(' · ')}</small>}</div>
      <button className="goal-editor" disabled={disabled} onClick={() => openModal({ kind: 'target', game: watch })}><Target size={17} /><span>Objetivo<strong>{watch.targetCents === null ? 'Fijar' : `≤ ${money(watch.targetCents)}`}</strong></span></button></div>
    <div className="offer-actions"><div className="offer-merchant"><strong>{point?.merchant ?? sourceLabel(watch)}</strong><span title={exactTime(point?.observedAt ?? watch.lastAttemptAt)}>{relativeTime(point?.observedAt ?? watch.lastAttemptAt)}</span></div>
      <a className="button primary" href={safeLink(point?.offerUrl ?? watch.sourceUrl)} target="_blank" rel="noopener noreferrer">{watch.provider === 'steam' ? 'Ver en Steam' : 'Ver oferta'}<ExternalLink size={15} /></a></div>
    {point?.coupon && <p className="offer-coupon">Cupón <code>{point.coupon}</code></p>}
    {watch.error && <details className="source-issue"><summary>{point ? 'Error al actualizar' : 'Sin precio disponible'}</summary><p>{watch.error}</p></details>}
    {market && point && <details className="price-disclosure"><summary><Info size={15} />Desglose del precio</summary><div className="price-disclosure-body"><p>{offerLabel(point)} · {paymentLabel(point.paymentMethod)}</p><dl><div><dt>Base</dt><dd>{money(point.basePriceCents)}</dd></div><div><dt>Comisiones</dt><dd>{money(point.feeCents)}</dd></div><div><dt>Total publicado</dt><dd>{money(point.priceCents)}</dd></div></dl><p>{point.feeBasis === 'included' ? 'Comisiones incluidas; estimación publicada por AllKeyShop.' : 'La fuente no publica un desglose de comisiones verificable.'}</p></div></details>}
    <div className="chart-toolbar"><h3>Histórico</h3><div className="segmented" aria-label="Periodo del histórico">{[7,30,90,730].map(period => <button key={period} className={days === period ? 'active' : ''} aria-pressed={days === period} onClick={() => setDays(period)}>{period === 730 ? '2 años' : `${period} días`}</button>)}</div></div>
    <PriceChart history={watch.history} target={watch.targetCents} days={days} name={name} asOf={asOf} />
    <details className="price-disclosure coverage-disclosure"><summary><Info size={15} />Datos del histórico</summary><div className="price-disclosure-body"><p>{watch.historyCoverage.oldestObservedAt ? `Lecturas guardadas desde ${shortDate(watch.historyCoverage.oldestObservedAt)}.` : 'Todavía no hay lecturas guardadas.'} {watch.historyCoverage.status === 'complete' ? 'Periodo cubierto por lecturas locales.' : 'Cobertura parcial; no se han recuperado los precios anteriores.'}</p>
      {watch.lowestCents !== null && (watch.lowestCents !== watch.twoYearLowCents || watch.lowestObservedAt !== watch.twoYearLowObservedAt) && <p>Mínimo de todo el seguimiento: {money(watch.lowestCents)} · {shortDate(watch.lowestObservedAt)}{watch.lowestActivationPlatform ? ` · ${platformLabel(watch.lowestActivationPlatform)}` : ''}.</p>}
      {watch.history.length >= 2160 && <p>Gráfico limitado a las últimas2160 lecturas; mínimos calculados sobre todos los registros.</p>}</div></details>
    {watch.provider === 'steam' && watch.salePeriods.length > 0 && <details className="price-disclosure"><summary>Rebajas observadas</summary><div className="price-disclosure-body">{watch.salePeriods.slice(-5).reverse().map(period => <div className="sale-row" key={period.firstObservedAt}><span>{shortDate(period.firstObservedAt)} → {period.endedObservedAt ? shortDate(period.endedObservedAt) : 'en curso'}</span><strong>{money(period.lowestPriceCents)}</strong></div>)}</div></details>}
    <div className="observation-history"><button className="history-toggle" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Ocultar lecturas' : `Ver lecturas (${watch.history.length})`}</button>
      {showHistory && <div className="history-table-wrap" tabIndex={0} role="region" aria-label="Lecturas guardadas"><table><caption className="sr-only">Últimas50 lecturas de {name}, {sourceLabel(watch)}</caption><thead><tr><th>Fecha</th><th>Total</th><th>Plataforma</th><th>Entrega</th><th>Pago</th><th>Tienda</th></tr></thead><tbody>{watch.history.slice(-50).reverse().map(reading => <tr key={reading.id}><td>{exactTime(reading.observedAt)}</td><td>{money(reading.priceCents)}</td><td>{platformLabel(reading.activationPlatform)}{reading.languageRestriction ? ` · ${languageLabel(reading.languageRestriction)}` : ''}</td><td>{deliveryLabel(reading.deliveryType)}</td><td>{watch.provider === 'steam' ? '—' : paymentLabel(reading.paymentMethod)}</td><td>{reading.merchant}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
