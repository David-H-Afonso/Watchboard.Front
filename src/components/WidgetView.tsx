import { ArrowDownRight, ArrowUpRight, Check, ExternalLink } from 'lucide-react';
import type { Dashboard } from '../types';
import { widgetItems } from '../lib/tracking';
import { relativeTime, safeLink } from '../lib/format';

export default function WidgetView({ data, embedded = false }: { data: Dashboard; embedded?: boolean }) {
  const items = widgetItems(data);
  return <section className={`panel widget-panel ${embedded ? 'embedded' : ''}`} aria-label="Vista de widget">
    {!embedded && <div className="section-bar"><h1>Widget</h1></div>}
    {!items.length ? <div className="widget-empty"><Check size={23} /><strong>Sin avisos</strong><span>Con tus filtros actuales no hay nada pendiente.</span></div> : <div className="widget-list">{items.map(item => <article className="widget-item" key={item.id}>
      <span className={`widget-symbol ${item.kind === 'version' ? 'amber' : 'teal'}`}>{item.kind === 'version' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}</span>
      <div><h3>{item.title}</h3><span>{item.detail}</span></div><div className="widget-value"><strong>{item.value}</strong><small>{relativeTime(item.observedAt)}</small></div>
      <a className="icon-button" href={safeLink(item.sourceUrl)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir fuente de ${item.title}`}><ExternalLink size={16} /></a>
    </article>)}</div>}
  </section>;
}
