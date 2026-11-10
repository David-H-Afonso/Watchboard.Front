import { useMemo, useState, type FormEvent } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import type { Dashboard, GameWatch, ResolvedGame, SoftwareWatch } from '../types';
import { ownedApi, HttpError } from '../services/api';
import { money, parseTarget } from '../lib/format';
import { sourceLabel } from '../lib/tracking';
import { locationDisplayName, locationSuggestions, normalizedName } from '../lib/names';
import CreatableComboBox from './CreatableComboBox';
import Dialog from './Dialog';

export type WatchModal = { kind: 'software' } | { kind: 'game'; link?: string } | { kind: 'installed'; watch: SoftwareWatch } |
  { kind: 'target'; game: GameWatch } | { kind: 'counterpart'; game: GameWatch } | { kind: 'delete-software'; watch: SoftwareWatch } | { kind: 'delete-game'; game: GameWatch };
export type MutationContext = { selectCreatedGame?: boolean; removeGame?: string; removeSoftware?: string };
export type Mutate = (action: () => Promise<unknown>, message: string, context?: MutationContext, reconcile?: (data: Dashboard) => Dashboard) => Promise<void>;
const titles: Record<WatchModal['kind'], string> = {
  software: 'Añadir versión', game: 'Añadir juego', installed: 'Versión instalada',
  target: 'Precio objetivo', counterpart: 'Vincular otra fuente', 'delete-software': 'Eliminar seguimiento', 'delete-game': 'Eliminar fuente',
};

function steamUrl(value: string) {
  try { return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase() === 'store.steampowered.com'; }
  catch { return false; }
}
function softwareName(source: string) {
  try { return new URL(source).pathname.split('/').filter(Boolean)[1]?.replace(/\.git$/, '') ?? source; }
  catch { return source.split('/').at(-1) ?? source; }
}

export default function WatchDialog({ modal, data, onClose, mutate }: { modal: WatchModal; data: Dashboard; onClose: () => void; mutate: Mutate }) {
  const api = useMemo(() => ownedApi(data.user.id), [data.user.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState(modal.kind === 'game' ? modal.link ?? '' : '');
  const [resolved, setResolved] = useState<ResolvedGame | null>(null);
  const [provider, setProvider] = useState<'github' | 'npm'>('github');
  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState(modal.kind === 'installed' ? modal.watch.locationName ?? '' : '');
  const [resolving, setResolving] = useState(false);
  const deleting = modal.kind.startsWith('delete');
  const steam = steamUrl(sourceUrl);
  const locked = busy || resolving;
  const savedNames = data.software.map(watch => watch.name);

  async function locationId() {
    const name = locationDisplayName(location);
    if (!name) return null;
    return data.locations.find(item => normalizedName(locationDisplayName(item.name)) === normalizedName(name))?.id ?? (await api.addLocation(name)).id;
  }
  async function inspectLink() {
    if (!sourceUrl.trim()) return;
    setResolving(true); setError(null);
    try { setResolved(await api.resolveGame(sourceUrl.trim())); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo comprobar el enlace.'); }
    finally { setResolving(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      switch (modal.kind) {
        case 'software': {
          const source = value('source');
          const enteredName = value('name') || softwareName(source);
          const name = savedNames.find(saved => normalizedName(saved) === normalizedName(enteredName)) ?? enteredName;
          await mutate(async () => api.addSoftware({ name, group: value('group') as SoftwareWatch['group'],
            provider, source, installedVersion: value('installedVersion') || null, locationId: await locationId() }), 'Versión añadida.');
          break;
        }
        case 'game': {
          const targetCents = parseTarget(value('target'));
          await mutate(async () => {
            let info = resolved;
            if (!info) {
              try { info = await api.resolveGame(sourceUrl.trim()); }
              catch (reason) {
                if (!value('name') || !(reason instanceof HttpError) || reason.status !== 502) throw reason;
                // A manual name may save a temporarily unavailable source; no quote or metadata is invented.
                info = { provider: steam ? 'steam' : 'allkeyshop', sourceUrl: sourceUrl.trim(), name: value('name'), steamAppId: null, editions: ['Standard'],
                  steamUrl: steam ? sourceUrl.trim() : null, allKeyShopUrl: steam ? null : sourceUrl.trim(), matchStatus: 'not_found', matchNote: 'Fuente guardada sin poder verificar todavía la otra tienda.' };
              }
            }
            setResolved(info);
            return api.addGame({ name: value('name') || info.name, sourceUrl: info.sourceUrl,
              edition: info.provider === 'steam' ? 'Standard' : value('edition') || 'Standard',
              region: info.provider === 'steam' ? 'eu-global' : value('region') as GameWatch['region'],
              payment: info.provider === 'steam' ? 'card' : value('payment') as GameWatch['payment'],
              officialOnly: info.provider === 'steam' || form.get('officialOnly') === 'on', targetCents,
              includeCounterpart: form.get('includeCounterpart') === 'on' });
          }, 'Juego añadido.', { selectCreatedGame: true });
          break;
        }
        case 'installed':
          await mutate(async () => {
            const id = await locationId();
            const installedVersion = value('installedVersion') || null;
            const installedOn = value('installedOn') || null;
            // Reclassifying a watch must not turn a detected install into a new manual observation.
            if (installedVersion === modal.watch.installedVersion && installedOn === modal.watch.installedOn)
              return api.setLocation(modal.watch.id, id);
            return api.setInstalled(modal.watch.id, installedVersion, installedOn, id);
          }, 'Instalación guardada.');
          break;
        case 'counterpart':
          await mutate(async () => {
            const result = await api.pairGame(modal.game.id, value('counterpartUrl') || null);
            if (result.matchStatus !== 'verified') throw new Error(result.matchNote ?? 'No se ha podido verificar la misma edición. Revisa el enlace de la otra tienda.');
            return result;
          }, 'Fuentes vinculadas.');
          break;
        case 'target': {
          const target = parseTarget(value('target'));
          await mutate(() => api.setTarget(modal.game.id, target), target === null ? 'Objetivo eliminado.' : 'Objetivo guardado.');
          break;
        }
        case 'delete-software':
          await mutate(() => api.deleteSoftware(modal.watch.id), 'Seguimiento eliminado.', { removeSoftware: modal.watch.id },
            data => ({ ...data, software: data.software.filter(watch => watch.id !== modal.watch.id) }));
          break;
        case 'delete-game':
          await mutate(() => api.deleteGame(modal.game.id), 'Fuente eliminada.', { removeGame: modal.game.id },
            data => ({ ...data, games: data.games.filter(watch => watch.id !== modal.game.id) }));
          break;
      }
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron guardar los cambios.'); }
    finally { setBusy(false); }
  }

  return <Dialog title={titles[modal.kind]} onClose={onClose} busy={locked}>
    <form className="watch-form" onSubmit={submit}>
      <div className="dialog-body"><fieldset className="dialog-fields" disabled={locked}>
      {modal.kind === 'software' && <>
        <label className="form-field"><span className="field-label">Fuente</span><input name="source" autoFocus required maxLength={500} placeholder={provider === 'github' ? 'https://github.com/propietario/proyecto' : 'Nombre del paquete, ej. @scope/paquete'} autoCapitalize="off" spellCheck={false} /></label>
        <CreatableComboBox label="Nombre del proyecto" name="name" value={projectName} onChange={setProjectName} options={savedNames} hint="Opcional" placeholder="Se obtiene de la fuente" />
        <div className="form-columns"><label className="form-field"><span className="field-label">Proveedor</span><select value={provider} onChange={event => setProvider(event.target.value as 'github' | 'npm')}><option value="github">GitHub</option><option value="npm">npm</option></select></label>
          <label className="form-field"><span className="field-label">Categoría</span><select name="group" defaultValue="project"><option value="project">Proyecto</option><option value="server">Servidor</option><option value="pc">Equipo</option></select></label></div>
        <fieldset className="installation-fields"><legend>Instalación</legend><div className="form-columns">
          <label className="form-field"><span className="field-label">Versión instalada <span className="optional">Opcional</span></span><input name="installedVersion" maxLength={100} placeholder="Ej. 1.4.0" autoCapitalize="off" spellCheck={false} /></label>
          <CreatableComboBox label="Equipo / ubicación" name="location" value={location} onChange={setLocation} options={data.locations.map(item => item.name)} suggestions={locationSuggestions} canonicalize={locationDisplayName} placeholder="Elegir o crear" />
        </div><p className="field-help">Una instalación por equipo. La ubicación permite filtrar sus actualizaciones.</p></fieldset>
      </>}
      {modal.kind === 'game' && <>
        <label className="form-field"><span className="field-label">Enlace de AllKeyShop o Steam</span><input name="sourceUrl" value={sourceUrl} onChange={event => { setSourceUrl(event.target.value); setResolved(null); }} autoFocus required maxLength={500} inputMode="url" placeholder="Pega el enlace del juego" autoCapitalize="off" spellCheck={false} /></label>
        <div className="link-inspection"><span>{resolved?.name}</span><button type="button" className="text-button" disabled={!sourceUrl.trim() || locked} onClick={() => void inspectLink()}>{resolving ? <LoaderCircle size={16} className="spinning" /> : <Check size={16} />}Comprobar enlace</button></div>
        <label className="form-field"><span className="field-label">Objetivo en EUR <span className="optional">Opcional</span></span><input name="target" inputMode="decimal" placeholder="Ej. 10,00" maxLength={9} /></label>
        <label className="checkbox-field counterpart-choice"><input name="includeCounterpart" type="checkbox" defaultChecked /><span>Añadir también {steam ? 'AllKeyShop' : 'Steam oficial'}</span></label>
        {resolved?.matchStatus === 'verified' && <p className="resolved-pair"><Check size={16} />Steam + AllKeyShop</p>}
        {resolved && resolved.matchStatus !== 'verified' && <details className="price-disclosure"><summary>Coincidencia pendiente</summary><p className="price-disclosure-body">{resolved.matchNote ?? 'No se encontró una coincidencia exacta.'}</p></details>}
        <details className="advanced-options"><summary>Filtros y nombre</summary>
          <label className="form-field"><span className="field-label">Nombre</span><input name="name" maxLength={150} placeholder="Se obtiene del enlace" /></label>
          {!steam && <><div className="form-columns"><label className="form-field"><span className="field-label">Edición</span><input name="edition" defaultValue="Standard" maxLength={60} /></label><label className="form-field"><span className="field-label">Región</span><select name="region" defaultValue="eu-global"><option value="eu-global">Europa + Global</option><option value="global">Global</option></select></label></div>
            <label className="form-field"><span className="field-label">Pago, con comisiones publicadas</span><select name="payment" defaultValue="best"><option value="best">Menor total · tarjeta o PayPal</option><option value="card">Tarjeta</option><option value="paypal">PayPal</option></select></label>
            <label className="checkbox-field"><input name="officialOnly" type="checkbox" /><span>Solo vendedores oficiales en AllKeyShop</span></label><p className="field-help">Claves y regalos · Steam preferente · sin cuentas</p></>}
        </details>
      </>}
      {modal.kind === 'installed' && <>
        <p className="form-subject-line">{modal.watch.name}<span>Publicada: {modal.watch.latestVersion ?? 'sin comprobar'}</span></p>
        <label className="form-field"><span className="field-label">Versión instalada</span><input name="installedVersion" autoFocus maxLength={100} defaultValue={modal.watch.installedVersion ?? ''} placeholder="Sin indicar" autoCapitalize="off" spellCheck={false} /></label>
        <CreatableComboBox label="Equipo / ubicación" name="location" value={location} onChange={setLocation} options={data.locations.map(item => item.name)} suggestions={locationSuggestions} canonicalize={locationDisplayName} placeholder="Elegir o crear" />
        <p className="field-help">Etiqueta para filtrar, sin detección remota.{modal.watch.localTool ? ` La detección se ejecuta en ${data.host}.` : ' Indica manualmente la versión de otros equipos.'}</p>
        <details className="advanced-options"><summary>Origen de la instalación</summary><label className="form-field"><span className="field-label">Nota de instalación</span><input name="installedOn" maxLength={100} defaultValue={modal.watch.installedOn ?? ''} placeholder="Nota o equipo donde se comprobó" /></label></details>
      </>}
      {modal.kind === 'counterpart' && <>
        <p className="form-subject-line">{modal.game.name}<span>{sourceLabel(modal.game)} · {modal.game.edition}</span></p>
        <label className="form-field"><span className="field-label">Enlace de {modal.game.provider === 'steam' ? 'AllKeyShop' : 'Steam'} <span className="optional">Opcional</span></span><input name="counterpartUrl" maxLength={500} autoFocus inputMode="url" defaultValue={modal.game.counterpartUrl ?? ''} placeholder="Vacío para buscar automáticamente" autoCapitalize="off" spellCheck={false} /></label>
        {modal.game.counterpartNote && <details className="price-disclosure"><summary>Detalle de la búsqueda</summary><p className="price-disclosure-body">{modal.game.counterpartNote}</p></details>}
      </>}
      {modal.kind === 'target' && <>
        <p className="form-subject-line">{modal.game.name}<span>{sourceLabel(modal.game)} · {money(modal.game.current?.priceCents)}</span></p>
        <label className="form-field"><span className="field-label">Precio objetivo en EUR</span><input name="target" autoFocus inputMode="decimal" defaultValue={modal.game.targetCents === null ? '' : (modal.game.targetCents / 100).toFixed(2)} placeholder="Vacío para quitar la meta" maxLength={9} /></label>
      </>}
      {modal.kind === 'delete-software' && <p className="form-intro">¿Dejar de seguir <strong>{modal.watch.name}</strong>?</p>}
      {modal.kind === 'delete-game' && <p className="form-intro">Se eliminará <strong>{sourceLabel(modal.game)}</strong> de <strong>{modal.game.name}</strong>, incluido su histórico. Las otras fuentes no se borran.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      </fieldset></div>
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} disabled={locked}>Cancelar</button><button type="submit" className={`button ${deleting ? 'danger' : 'primary'}`} disabled={locked}>
        {busy && <LoaderCircle size={17} className="spinning" />}{deleting ? 'Eliminar' : modal.kind === 'counterpart' ? busy ? 'Comprobando…' : 'Verificar y vincular' : modal.kind === 'game' ? busy ? 'Añadiendo…' : 'Seguir juego' : busy ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  </Dialog>;
}
