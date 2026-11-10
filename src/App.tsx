import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, Gamepad2, GitBranch, LayoutDashboard, LoaderCircle, LogOut, Monitor, PanelsTopLeft, Plus,
  Radar, RefreshCw, Settings2, Target, Unplug, X } from 'lucide-react';
import { api, ownedApi, HttpError } from './services/api';
import { clearCache, isUser } from './services/dashboard';
import type { AuthSession, Dashboard, RefreshResult, User } from './types';
import useDashboard from './hooks/useDashboard';
import { groupGames, hasSoftwareUpdate } from './lib/tracking';
import Prices from './components/Prices';
import Versions from './components/Versions';
import WatchDialog, { type Mutate, type WatchModal } from './components/WatchDialog';
import AuthScreen from './components/AuthScreen';
import WidgetView from './components/WidgetView';
import Settings from './components/Settings';

type View = 'overview' | 'versions' | 'prices' | 'widget' | 'settings';
const navigation = [
  { id: 'overview' as const, label: 'Resumen', icon: LayoutDashboard },
  { id: 'versions' as const, label: 'Versiones', icon: GitBranch },
  { id: 'prices' as const, label: 'Precios', icon: Gamepad2 },
  { id: 'widget' as const, label: 'Widget', icon: PanelsTopLeft },
  { id: 'settings' as const, label: 'Configuración', icon: Settings2 },
];
const titles: Record<View,string> = { overview: 'Resumen', versions: 'Versiones', prices: 'Precios de juegos', widget: 'Widget', settings: 'Configuración' };
function currentView(): View {
  const value = new URLSearchParams(location.search).get('view');
  return navigation.some(item => item.id === value) ? value as View : 'overview';
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api.session().then(result => {
      if (typeof result.setupRequired !== 'boolean' || result.user && !isUser(result.user)) throw new Error('No se reconoce la sesión del servidor.');
      if (active) { setSession(result); setError(null); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se puede conectar al panel.'); });
    return () => { active = false; };
  }, [attempt]);

  async function logout(user: User) {
    try { await ownedApi(user.id).logout(); }
    finally { clearCache(user.id); setSession({ setupRequired: false, user: null }); }
  }
  if (!session) return <main className="auth-page"><section className="auth-card startup-state"><div className="auth-brand"><Radar size={28} /><span>watchboard</span></div>
    {error ? <><h1>No se puede conectar</h1><p role="alert">{error}</p><button className="button primary" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17} />Reintentar</button></> : <><LoaderCircle className="spinning" size={28} /><p>Cargando…</p></>}</section></main>;
  if (!session.user) return <AuthScreen setup={session.setupRequired} onSignedIn={user => setSession({ setupRequired: false, user })} />;
  return <Workspace key={session.user.id} user={session.user} onSessionLost={() => setSession({ setupRequired: false, user: null })} logout={() => logout(session.user!)} />;
}

function Workspace({ user, onSessionLost, logout }: { user: User; onSessionLost: () => void; logout: () => Promise<void> }) {
  const board = useDashboard(user, onSessionLost);
  const client = useMemo(() => ownedApi(user.id), [user.id]);
  const [view, setView] = useState<View>(currentView);
  const [modal, setModal] = useState<WatchModal | null>(null);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<string | null>(null);
  const [quickLink, setQuickLink] = useState('');
  const data = board.load?.data;
  const online = board.load?.mode === 'panel';

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => { document.title = `${titles[view]} · Watchboard`; }, [view]);
  useEffect(() => {
    const pop = () => setView(currentView());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  function navigate(next: View) {
    setView(next);
    const url = new URL(location.href);
    if (next === 'overview') url.searchParams.delete('view'); else url.searchParams.set('view', next);
    history.pushState(null, '', url);
  }
  const mutate: Mutate = async (action, message, context, reconcile) => {
    const result = await board.mutate(action, reconcile);
    if (context?.selectCreatedGame && result.value && typeof result.value === 'object' && 'id' in result.value && typeof result.value.id === 'string') {
      setSelectedPrice(result.value.id); setQuickLink(''); navigate('prices');
    }
    if (context?.removeGame === selectedPrice) setSelectedPrice(null);
    setToast({ message: result.reloaded ? message : `${message} Pendiente de recargar la vista.` });
  };
  async function checkSources() {
    if (checking) return;
    setChecking(true); setActionError(null);
    try {
      const { value } = await board.mutate(() => client.refresh({ force: true, scope: view === 'prices' ? 'prices' : view === 'versions' ? 'versions' : 'all' }));
      const result = value as RefreshResult;
      setToast({ message: result.busy ? 'Ya se están comprobando las fuentes.' : result.checked === 0 ? 'Sin cambios nuevos.' : `${result.succeeded}/${result.checked} fuentes comprobadas.` });
    } catch (reason) { if (reason instanceof HttpError && reason.status === 409) setToast({ message: 'Ya se están comprobando las fuentes.' });
      else setActionError(reason instanceof Error ? reason.message : 'No se pudieron comprobar las fuentes.'); }
    finally { setChecking(false); }
  }
  async function detectHost() {
    setDetecting(true); setActionError(null);
    try { const result = await board.mutate(client.detect); setToast({ message: `${result.value.succeeded}/${result.value.checked} versiones detectadas.` }); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : 'No se pudo detectar el equipo.'); }
    finally { setDetecting(false); }
  }
  function include(kind: 'software'|'game', id: string, value: boolean) {
    void mutate(() => kind === 'software' ? client.includeSoftware(id,value) : client.includeGame(id,value), value ? 'Incluido en el widget.' : 'Oculto en el widget.')
      .catch(reason => setActionError(reason instanceof Error ? reason.message : 'No se pudo cambiar el widget.'));
  }
  function selectPrice(id: string) { setSelectedPrice(id); if (view === 'overview') navigate('prices'); }
  function addFromLink(event: FormEvent) { event.preventDefault(); setModal({ kind: 'game', link: quickLink.trim() }); }

  const updates = data?.software.filter(hasSoftwareUpdate).length ?? 0;
  const goals = data?.games.filter(game => game.targetReached).length ?? 0;
  const priceProps = data ? { games: data.games, disabled: !online, openModal: setModal, asOf: data.generatedAt,
    selectedId: selectedPrice, onSelect: selectPrice, onInclude: (game: Dashboard['games'][number], value: boolean) => include('game',game.id,value) } : null;

  const content = <>
    {view !== 'widget' && <header className="page-heading"><h1>{titles[view]}</h1><div className="page-actions">
      {view === 'versions' && user.isAdmin && <button className="button secondary" onClick={() => void detectHost()} disabled={!online || detecting} title={`Detectar en ${data?.host ?? 'el equipo del panel'}`}>{detecting ? <LoaderCircle size={17} className="spinning" /> : <Monitor size={17} />}Detectar equipo</button>}
      {view === 'versions' && <button className="button primary" disabled={!online} onClick={() => setModal({ kind: 'software' })}><Plus size={17} />Añadir versión</button>}
      {['overview','versions','prices'].includes(view) && <button className="button secondary" onClick={() => online ? void checkSources() : void board.read()} disabled={checking}>{checking ? <LoaderCircle size={17} className="spinning" /> : <RefreshCw size={17} />}Actualizar</button>}
    </div></header>}
    {(board.error || actionError) && <div className="banner error-banner" role="alert"><span>{actionError ?? board.error}</span><button className="icon-button" aria-label="Cerrar error" onClick={() => { setActionError(null); board.dismissError(); }}><X size={17} /></button></div>}
    {board.load && !online && <div className="offline-notice" role="status"><Unplug size={16} /><span>Sin panel: {board.load.mode === 'direct' ? 'versiones consultadas directamente; precios guardados' : 'copia local con fecha'}. Las metas no se confirman con precios antiguos.</span></div>}
    {!data && <div className="panel startup-state"><LoaderCircle size={24} className="spinning" /><p>Cargando seguimientos…</p></div>}
    {data && view === 'overview' && <>
      <div className="summary-strip" aria-label="Resumen de seguimiento"><button onClick={() => navigate('versions')}><ArrowUpRight size={20} /><strong>{updates}</strong><span>actualizaciones</span></button><button onClick={() => navigate('prices')}><Target size={20} /><strong>{goals}</strong><span>metas alcanzadas</span></button><button onClick={() => navigate('prices')}><Gamepad2 size={20} /><strong>{groupGames(data.games).length}</strong><span>juegos</span></button><button onClick={() => navigate('versions')}><GitBranch size={20} /><strong>{data.software.length}</strong><span>versiones</span></button></div>
      <div className="overview-grid"><Versions software={data.software} disabled={!online} openModal={setModal} overview onViewAll={() => navigate('versions')} />{priceProps && <Prices {...priceProps} overview onViewAll={() => navigate('prices')} />}</div>
    </>}
    {data && view === 'versions' && <Versions software={data.software} locations={data.locations} disabled={!online} openModal={setModal} onInclude={(watch,value) => include('software',watch.id,value)} />}
    {data && view === 'prices' && <><form className="quick-add" onSubmit={addFromLink}><label><span className="sr-only">Enlace para añadir un juego</span><input value={quickLink} onChange={event => setQuickLink(event.target.value)} placeholder="Pega un enlace de AllKeyShop o Steam" inputMode="url" maxLength={500} autoCapitalize="off" /></label><button className="button primary" disabled={!online}><Plus size={17} />Añadir juego</button></form>{priceProps && <Prices {...priceProps} />}</>}
    {data && view === 'settings' && <Settings data={data} disabled={!online} mutate={mutate} openWidget={() => navigate('widget')} />}
    {data && view === 'widget' && <><div className="widget-app-bar"><button className="brand" onClick={() => navigate('overview')}><Radar size={22} />watchboard</button><button className="text-button" onClick={() => navigate('settings')}><Settings2 size={17} />Configurar</button></div><WidgetView data={data} /></>}
  </>;

  return <div className={view === 'widget' ? 'standalone-widget' : 'app-shell'}>
    <a className="skip-link" href="#main">Saltar al contenido</a>
    {view !== 'widget' && <aside className="sidebar"><button className="brand" onClick={() => navigate('overview')} aria-label="watchboard · Resumen"><Radar size={24} /><span>watchboard</span></button><nav aria-label="Navegación principal">{navigation.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)} aria-current={view === item.id ? 'page' : undefined} aria-label={item.label} title={item.label}><item.icon size={19} /><span>{item.label}</span></button>)}</nav>
      <div className="account-bar"><button className="account-link" onClick={() => navigate('settings')} title="Tu configuración"><span className="avatar">{user.displayName.slice(0,1).toUpperCase() || user.username.slice(0,1).toUpperCase()}</span><span>{user.displayName || user.username}<small>{user.isAdmin ? 'Administrador' : user.username}</small></span></button><button className="icon-button" aria-label="Cerrar sesión" onClick={() => { void logout().catch(() => undefined); }}><LogOut size={18} /></button></div>
    </aside>}
    <main id="main" className="main-content" tabIndex={-1}>{content}</main>
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast.message}</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => setToast(null)}><X size={16} /></button></div>}
    {modal && data && <WatchDialog key={modal.kind + ('watch' in modal ? modal.watch.id : 'game' in modal ? modal.game.id : '')} modal={modal} data={data} onClose={() => setModal(null)} mutate={mutate} />}
  </div>;
}
