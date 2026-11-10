import { ExternalLink, Eye, EyeOff, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Location, SoftwareWatch } from '../types';
import { exactTime, groupName, relativeTime, safeLink } from '../lib/format';
import type { WatchModal } from './WatchDialog';
import { hasSoftwareUpdate } from '../lib/tracking';

export function SoftwareStatus({ watch }: { watch: SoftwareWatch }) {
  const status = watch.error ? ['error', 'Error'] : watch.detectionError ? ['muted', 'Detección pendiente'] : watch.stale && watch.latestVersion ? ['muted', 'Antigua'] :
    !watch.latestVersion ? ['muted', 'Pendiente'] : !watch.installedVersion ? ['muted', 'Sin indicar'] :
      ({ update: ['warning', 'Actualización'], current: ['success', 'Al día'], ahead: ['info', 'Más reciente'], unknown: ['muted', 'No comparable'] })[watch.comparison];
  return <span className={`badge ${status[0]}`} title={watch.error ?? watch.detectionError ?? undefined}>{status[1]}</span>;
}

interface Props {
  software: SoftwareWatch[]; locations?: Location[]; disabled: boolean; openModal: (modal: WatchModal) => void; overview?: boolean;
  onInclude?: (watch: SoftwareWatch, included: boolean) => void; onViewAll?: () => void;
}
export default function Versions({ software, locations = [], disabled, openModal, overview = false, onInclude, onViewAll }: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [updatesOnly, setUpdatesOnly] = useState(false);
  const [location, setLocation] = useState('all');
  const visible = software.filter(watch => (group === 'all' || watch.group === group) &&
    (location === 'all' || location === 'unassigned' && watch.locationId === null || watch.locationId === location) &&
    (!updatesOnly || hasSoftwareUpdate(watch)) && `${watch.name} ${watch.source} ${groupName(watch.group)} ${watch.locationName ?? ''}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
  const rows = overview ? visible.slice(0, 10) : visible;
  return <section className={`panel versions-panel ${overview ? 'overview-versions' : ''}`} aria-label="Versiones vigiladas">
    {overview ? <div className="section-bar"><h2>Versiones <span className="counter">{software.length}</span></h2><button className="text-button" onClick={onViewAll}>Ver todas</button></div> :
      <div className="list-toolbar"><label className="search-input"><Search size={17} /><span className="sr-only">Buscar versiones</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar versión o proyecto" /></label>
        <label><span className="sr-only">Filtrar por ubicación</span><select value={location} onChange={event => setLocation(event.target.value)}><option value="all">Todas las ubicaciones</option>{locations.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}<option value="unassigned">Sin ubicación</option></select></label>
        <label><span className="sr-only">Filtrar por categoría</span><select value={group} onChange={event => setGroup(event.target.value)}><option value="all">Todas las categorías</option><option value="pc">Equipo</option><option value="server">Servidor</option><option value="project">Proyectos</option></select></label>
        <button className={`filter-button ${updatesOnly ? 'active' : ''}`} onClick={() => setUpdatesOnly(!updatesOnly)} aria-pressed={updatesOnly}>Actualizaciones</button></div>}
    <div className="version-list" role="list" aria-label="Lista de versiones">
      <div className="version-list-header" aria-hidden="true"><span>Proyecto</span><span>Instalada</span><span>Publicada</span><span>Estado</span>{!overview && <><span>Widget</span><span /></>}</div>
      {rows.map(watch => <article className="version-row" role="listitem" key={watch.id}>
        <div className="version-identity"><h3>{watch.name}</h3>{!overview && <span>{watch.locationName ?? 'Sin ubicación'} · {groupName(watch.group)}</span>}</div>
        <div className="version-cell"><span className="mobile-label">Instalada</span><button className="version-edit" aria-label={`${watch.installedVersion ?? 'Indicar'}: versión instalada de ${watch.name}`} onClick={() => openModal({ kind: 'installed', watch })} disabled={disabled}>{watch.installedVersion ?? 'Indicar'}</button>
          {!overview && watch.installedMethod && <small title={`${exactTime(watch.installedCheckedAt)}${watch.installedOn ? ` · ${watch.installedOn}` : ''}`}>{watch.installedMethod === 'detected' ? `Detectada en ${watch.installedOn ?? 'el equipo del panel'}` : 'Manual'}</small>}</div>
        <div className="version-cell"><span className="mobile-label">Publicada</span>{watch.latestVersion ? <a className="version-latest" href={safeLink(watch.releaseUrl ?? watch.sourceUrl)} target="_blank" rel="noopener noreferrer" title={exactTime(watch.releasePublishedAt ?? watch.lastSuccessAt)}>{watch.latestVersion}<ExternalLink size={12} /></a> : <span>—</span>}
          {!overview && <small title={exactTime(watch.lastSuccessAt)}>{relativeTime(watch.lastSuccessAt)}</small>}</div>
        <div className="version-state"><SoftwareStatus watch={watch} /></div>
        {!overview && <button className="icon-button" disabled={disabled} onClick={() => onInclude?.(watch, !watch.includeInWidget)} aria-label={`${watch.includeInWidget ? 'Ocultar' : 'Mostrar'} ${watch.name} en el widget`} aria-pressed={watch.includeInWidget}>{watch.includeInWidget ? <Eye size={17} /> : <EyeOff size={17} />}</button>}
        {!overview && <button className="icon-button delete-button" aria-label={`Eliminar versión ${watch.name}`} disabled={disabled} onClick={() => openModal({ kind: 'delete-software', watch })}><Trash2 size={16} /></button>}
      </article>)}
      {!rows.length && <div className="empty-state"><h3>{software.length ? 'Sin coincidencias' : 'Sin versiones todavía'}</h3><p>{software.length ? 'Cambia los filtros para ver más.' : 'Añade un enlace de GitHub o un paquete npm.'}</p></div>}
    </div>
  </section>;
}
