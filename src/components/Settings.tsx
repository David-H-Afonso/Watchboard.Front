import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Download, Eye, LoaderCircle, Plus, Upload } from 'lucide-react';
import type { ConfigDocument, Dashboard, ImportPreview, User, WidgetPreferences } from '../types';
import { ownedApi } from '../services/api';
import type { Mutate } from './WatchDialog';
import WidgetView from './WidgetView';

type Tab = 'widget' | 'configuration' | 'users';
export default function Settings({ data, disabled, mutate, openWidget }: { data: Dashboard; disabled: boolean; mutate: Mutate; openWidget: () => void }) {
  const api = useMemo(() => ownedApi(data.user.id), [data.user.id]);
  const [tab, setTab] = useState<Tab>('widget');
  const [draft, setDraft] = useState<WidgetPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<unknown>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [filename, setFilename] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const prefs = draft ?? data.preferences;

  useEffect(() => {
    if (tab !== 'users' || !data.user.isAdmin) return;
    let active = true;
    api.users().then(value => { if (active) setUsers(value); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los usuarios.'); });
    return () => { active = false; };
  }, [tab, data.user.isAdmin, api]);

  function change<K extends keyof WidgetPreferences>(key: K, value: WidgetPreferences[K]) { setDraft({ ...prefs, [key]: value }); }
  async function savePrefs(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try { await mutate(() => api.savePreferences(prefs), 'Widget configurado.'); setDraft(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  async function exportConfig() {
    setBusy(true); setError(null);
    try {
      const config = await api.exportConfiguration();
      download(config, `watchboard-${data.user.username}.json`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo exportar.'); }
    finally { setBusy(false); }
  }
  async function inspectFile(selected: File | undefined) {
    setPreview(null); setDocument(null); setError(null);
    if (!selected) return;
    if (selected.size > 256 * 1024) { setError('El archivo supera el límite de 256 KiB.'); return; }
    setBusy(true);
    try {
      let config: unknown;
      try { config = JSON.parse(await selected.text()); }
      catch { setError('El archivo no contiene un JSON válido.'); return; }
      const result = await api.previewConfiguration(config);
      setDocument(config); setPreview(result); setFilename(selected.name);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo validar la configuración.'); }
    finally { setBusy(false); if (file.current) file.current.value = ''; }
  }
  async function importConfig() {
    if (!document || !preview) return;
    setBusy(true); setError(null);
    try {
      await mutate(() => api.importConfiguration(document), 'Configuración importada.');
      setDraft(null); setPreview(null); setDocument(null); setFilename('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo importar.'); }
    finally { setBusy(false); }
  }
  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const fields = new FormData(formElement);
    setBusy(true); setError(null);
    try {
      await mutate(() => api.addUser({ username: String(fields.get('username') ?? '').trim(), displayName: String(fields.get('displayName') ?? '').trim(),
        password: String(fields.get('password') ?? ''), isAdmin: fields.get('isAdmin') === 'on' }), 'Usuario creado.');
      setUsers(await api.users()); formElement.reset();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo crear el usuario.'); }
    finally { setBusy(false); }
  }
  async function toggleUser(user: User) {
    setBusy(true); setError(null);
    try { await mutate(() => api.enableUser(user.id, !user.enabled), user.enabled ? 'Usuario desactivado.' : 'Usuario activado.'); setUsers(await api.users()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar el usuario.'); }
    finally { setBusy(false); }
  }

  return <div className="settings-content">
    <nav className="settings-tabs" aria-label="Secciones de configuración">{([{ id: 'widget', label: 'Widget' }, { id: 'configuration', label: 'Importar / exportar' }, ...(data.user.isAdmin ? [{ id: 'users', label: 'Usuarios' }] : [])] as { id: Tab; label: string }[]).map(item =>
      <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setError(null); }} aria-current={tab === item.id ? 'page' : undefined}>{item.label}</button>)}</nav>
    {error && <p className="form-error" role="alert">{error}</p>}
    {tab === 'widget' && <div className="settings-grid"><section className="panel settings-panel"><h2>Qué aparece en el widget</h2><form onSubmit={savePrefs}>
      <label className="checkbox-field emphasis"><input type="checkbox" checked={prefs.onlyActionable} onChange={event => change('onlyActionable', event.target.checked)} /><span>Solo avisos pendientes</span></label>
      <p className="field-help">Actualizaciones confirmadas y precios que ya han alcanzado su objetivo.</p>
      <fieldset><legend>Seguimientos</legend><label className="checkbox-field"><input type="checkbox" checked={prefs.showVersions} onChange={event => change('showVersions', event.target.checked)} /><span>Versiones</span></label><label className="checkbox-field"><input type="checkbox" checked={prefs.showGames} onChange={event => change('showGames', event.target.checked)} /><span>Precios de juegos</span></label></fieldset>
      {prefs.showVersions && <fieldset className="widget-location-rules"><legend>Versiones por equipo</legend>
        <label className="checkbox-field emphasis"><input type="checkbox" checked={prefs.softwareUpdatesOnly} onChange={event => change('softwareUpdatesOnly', event.target.checked)} /><span>Solo actualizaciones de la versión instalada</span></label>
        <p className="field-help">Excluye instalaciones sin versión conocida, fuentes antiguas y detecciones fallidas.</p>
        <label className="checkbox-field"><input type="radio" name="locationMode" checked={prefs.softwareLocationIds === null} onChange={() => change('softwareLocationIds', null)} /><span>Todas las ubicaciones, incluidas las no asignadas</span></label>
        <label className="checkbox-field"><input type="radio" name="locationMode" checked={prefs.softwareLocationIds !== null} onChange={() => change('softwareLocationIds', data.locations.map(location => location.id))} /><span>Elegir ubicaciones</span></label>
        {prefs.softwareLocationIds !== null && <div className="location-choices" role="group" aria-label="Ubicaciones del widget">{data.locations.map(location => <label className={`location-choice ${prefs.softwareLocationIds!.includes(location.id) ? 'selected' : ''}`} key={location.id}>
          <input type="checkbox" checked={prefs.softwareLocationIds!.includes(location.id)} onChange={event => change('softwareLocationIds', event.target.checked ? [...prefs.softwareLocationIds!, location.id] : prefs.softwareLocationIds!.filter(id => id !== location.id))} /><span>{location.name}</span>
        </label>)}</div>}
        {prefs.softwareLocationIds?.length === 0 && <p className="field-help selection-empty">Sin ubicaciones seleccionadas: no aparecerán versiones en el widget.</p>}
        {!data.locations.length && <p className="field-help">Asigna un equipo o ubicación desde la versión instalada de un seguimiento.</p>}
      </fieldset>}
      <fieldset><legend>Incluir también</legend><label className="checkbox-field"><input type="checkbox" checked={prefs.showSales} onChange={event => change('showSales', event.target.checked)} /><span>Rebajas de Steam</span></label><label className="checkbox-field"><input type="checkbox" checked={prefs.showPriceDrops} onChange={event => change('showPriceDrops', event.target.checked)} /><span>Bajadas de precio</span></label><label className="checkbox-field"><input type="checkbox" checked={prefs.showErrors} onChange={event => change('showErrors', event.target.checked)} /><span>Errores de las fuentes</span></label></fieldset>
      <label className="inline-field">Máximo de elementos<input type="number" min={1} max={30} value={prefs.maxItems} onChange={event => change('maxItems', Number(event.target.value))} required /></label>
      <p className="field-help">El botón del ojo en cada seguimiento permite incluirlo o excluirlo.</p>
      <div className="form-actions"><button className="button primary" disabled={disabled || busy || !draft}>{busy && <LoaderCircle size={16} className="spinning" />}Guardar widget</button>{draft && <button type="button" className="button secondary" onClick={() => setDraft(null)} disabled={busy}>Deshacer</button>}</div>
    </form></section><div className="widget-settings-preview"><div className="preview-label"><h2>Vista previa{draft ? ' · sin guardar' : ''}</h2><button className="text-button" onClick={openWidget}><Eye size={16} />Abrir widget</button></div><WidgetView data={{ ...data, preferences: prefs }} embedded /></div></div>}
    {tab === 'configuration' && <div className="settings-grid"><section className="panel settings-panel"><h2>Exportar configuración</h2><p>Guarda tus fuentes, metas y reglas del widget. No incluye contraseñas ni historial de precios.</p><button className="button secondary" onClick={() => void exportConfig()} disabled={disabled || busy}><Download size={17} />Exportar JSON</button></section>
      <section className="panel settings-panel"><h2>Importar configuración</h2><p>Se añade a tu usuario sin borrar los seguimientos ni sus lecturas. Acepta los formatos v1 y v2; las ubicaciones se trasladan por su nombre.</p><input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Archivo de configuración" onChange={event => void inspectFile(event.target.files?.[0])} /><button className="button secondary" disabled={disabled || busy} onClick={() => file.current?.click()}><Upload size={17} />Elegir archivo JSON</button>
        {preview && <div className="import-preview"><strong>{filename}</strong><ul><li>{preview.softwareAdded} versiones nuevas · {preview.softwareUpdated} existentes</li><li>{preview.gamesAdded} fuentes de precio nuevas · {preview.gamesUpdated} existentes</li></ul>{preview.warnings.map((warning,index) => <p key={index}>{warning}</p>)}<button className="button primary" disabled={busy || disabled} onClick={() => void importConfig()}>Importar y fusionar</button></div>}</section>
      <p className="settings-note">Para una copia completa, detén la API y copia la carpeta <code>data</code>. El archivo de configuración no sustituye a esa copia.</p></div>}
    {tab === 'users' && data.user.isAdmin && <div className="settings-grid"><section className="panel settings-panel"><h2>Usuarios</h2><div className="users-list">{users.map(user => <div className="user-row" key={user.id}><div><strong>{user.displayName || user.username}</strong><small>{user.username} · {user.isAdmin ? 'Administrador' : 'Usuario'}{!user.enabled ? ' · desactivado' : ''}</small></div>{user.id !== data.user.id && <button className="text-button" disabled={disabled || busy} onClick={() => void toggleUser(user)}>{user.enabled ? 'Desactivar' : 'Activar'}</button>}</div>)}</div></section>
      <section className="panel settings-panel"><h2>Crear usuario</h2><form className="account-form" onSubmit={createUser}><label>Usuario<input name="username" required minLength={3} maxLength={40} autoComplete="off" autoCapitalize="off" pattern="[A-Za-z0-9_.-]+" /></label><label>Nombre<input name="displayName" required maxLength={100} /></label><label>Contraseña inicial<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label><label className="checkbox-field"><input name="isAdmin" type="checkbox" /><span>Administrador</span></label><button className="button primary" disabled={disabled || busy}><Plus size={16} />Crear usuario</button></form></section></div>}
  </div>;
}

function download(value: ConfigDocument, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = window.document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
