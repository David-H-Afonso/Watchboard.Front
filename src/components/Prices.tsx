import { Search } from 'lucide-react';
import { useState } from 'react';
import type { GameWatch } from '../types';
import { money } from '../lib/format';
import { freshPrice, groupGames, offerLabel, onSale, recommendedWatch, sourceLabel, type GameGroup } from '../lib/tracking';
import type { WatchModal } from './WatchDialog';
import PriceDetail from './PriceDetail';

interface Props {
  games: GameWatch[]; disabled: boolean; openModal: (modal: WatchModal) => void; asOf: string;
  selectedId: string | null; onSelect: (id: string) => void; overview?: boolean; onViewAll?: () => void;
  onInclude?: (watch: GameWatch, included: boolean) => void;
}
export default function Prices({ games, disabled, openModal, asOf, selectedId, onSelect, overview = false, onViewAll, onInclude }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sourceOverride, setSourceOverride] = useState<{ group: string; id: string } | null>(null);
  const matches = (game: GameWatch) => game.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')) &&
    (filter === 'all' || filter === 'market' && game.provider === 'allkeyshop' || filter === 'steam' && game.provider === 'steam' || filter === 'target' && game.targetReached || filter === 'sale' && onSale(game));
  const groups = groupGames(games).filter(group => group.watches.some(matches));
  const selectedGroup = groups.find(group => group.watches.some(watch => watch.id === selectedId)) ?? groups[0];
  const recommended = selectedGroup ? recommendedWatch(selectedGroup.watches) : undefined;
  const selected = sourceOverride?.group === selectedGroup?.key && sourceOverride?.id === selectedId
    ? selectedGroup.watches.find(watch => watch.id === sourceOverride.id) ?? recommended : recommended;

  function choose(group: GameGroup) {
    const watch = recommendedWatch(group.watches);
    if (!watch) return;
    setSourceOverride(null); onSelect(watch.id);
    if (!overview && window.innerWidth <= 1200) window.requestAnimationFrame?.(() => document.getElementById('game-price-detail')?.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  }
  return <div className={`prices-content ${overview ? 'overview-prices' : 'prices-layout'}`}>
    <section className="panel price-watchlist" aria-label="Juegos en seguimiento">
      {overview ? <div className="section-bar"><h2>Juegos <span className="counter">{groups.length}</span></h2><button className="text-button" onClick={onViewAll}>Ver precios</button></div> :
        <div className="list-toolbar"><label className="search-input"><Search size={17} /><span className="sr-only">Buscar juegos</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar juego" /></label>
          <label><span className="sr-only">Filtrar precios</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Todos los juegos</option><option value="market">Con AllKeyShop</option><option value="steam">Con Steam oficial</option><option value="target">Objetivo alcanzado</option><option value="sale">Steam en rebaja</option></select></label></div>}
      <div className="game-list-header" aria-hidden="true"><span>Juego</span><span>Mejor precio</span><span>Objetivo</span></div>
      {(overview ? groups.slice(0,8) : groups).map(group => {
        const best = recommendedWatch(group.watches)!;
        return <article className={`game-list-row ${selectedGroup?.key === group.key && !overview ? 'active' : ''}`} key={group.key}>
          <button className="game-name-button" onClick={() => choose(group)} aria-current={selectedGroup?.key === group.key && !overview ? 'true' : undefined}><strong>{group.name}</strong><small>{best.current ? best.provider === 'steam' ? 'Steam oficial' : offerLabel(best.current) : 'Sin precio'}{group.watches[0].edition !== 'Standard' ? ` · ${group.watches[0].edition}` : ''}</small></button>
          <button className="price-cell-button" onClick={() => choose(group)}><span className="sr-only">Mejor precio de {group.name}: </span><strong>{money(best.current?.priceCents)}</strong><small>{best.current && !freshPrice(best) ? 'Antiguo' : best.current?.merchant ?? 'Pendiente'}</small></button>
          <div className="group-targets">{group.watches.filter(game => game.targetCents !== null).map(game => <button key={game.id} disabled={disabled} className={`goal-pill ${game.targetReached ? 'reached' : ''}`} onClick={() => openModal({ kind: 'target', game })} title={sourceLabel(game)}>{game.provider === 'steam' ? 'Steam' : 'AKS'} ≤ {money(game.targetCents)}</button>)}
            {overview && !group.watches.some(game => game.targetCents !== null) && <button className="text-button" disabled={disabled} onClick={() => openModal({ kind: 'target', game: best })}>Fijar meta</button>}</div>
        </article>;
      })}
      {!groups.length && <div className="empty-state"><h3>{games.length ? 'Sin coincidencias' : 'Sin juegos todavía'}</h3>{games.length ? <p>Prueba otro filtro.</p> : null}</div>}
    </section>
    {!overview && selected && selectedGroup && recommended && <PriceDetail name={selectedGroup.name} watch={selected} watches={selectedGroup.watches} recommended={recommended} asOf={asOf} disabled={disabled} openModal={openModal} onInclude={onInclude}
      selectSource={id => { setSourceOverride({ group: selectedGroup.key, id }); onSelect(id); }} />}
  </div>;
}
