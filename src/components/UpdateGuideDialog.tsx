import { useState } from 'react';
import { Check, Copy, ExternalLink, Terminal } from 'lucide-react';
import type { SoftwareWatch } from '../types';
import { safeLink } from '../lib/format';
import Dialog from './Dialog';

type TargetOS = 'Windows' | 'Linux' | 'macOS';
interface Command { label: string; value: string }
interface Plan { summary: string; commands: Command[]; verify: string; note: string }

function planFor(watch: SoftwareWatch, platform: TargetOS): Plan {
  if (watch.provider === 'dotnet') {
    const channel = watch.source || '10.0';
    if (platform === 'Windows') return { summary: `Instala el SDK ${channel} en paralelo con versiones anteriores.`,
      commands: [{ label: 'PowerShell · WinGet', value: `winget install --id Microsoft.DotNet.SDK.${channel.split('.')[0]} --exact` }],
      verify: 'dotnet --list-sdks', note: 'Si lo instalaste con Visual Studio o con el instalador oficial, actualízalo desde ese mismo instalador; no elimines el SDK anterior hasta comprobar tus proyectos.' };
    if (platform === 'macOS') return { summary: `Instala el SDK ${channel} sin quitar otros canales.`,
      commands: [{ label: 'Homebrew Cask', value: 'brew install --cask dotnet-sdk' }], verify: 'dotnet --list-sdks',
      note: 'Si usas el instalador de Microsoft u otro gestor, utiliza el mismo método para evitar instalaciones duplicadas.' };
    return { summary: `Instala el SDK ${channel} para Linux.`,
      commands: [{ label: 'APT · Debian/Ubuntu con feed de Microsoft', value: `sudo apt-get update && sudo apt-get install dotnet-sdk-${channel.split('.')[0]}.0` }],
      verify: 'dotnet --list-sdks', note: 'El feed de Microsoft debe estar configurado. En otras distribuciones, usa el repositorio de .NET correspondiente a tu sistema.' };
  }

  if (watch.provider === 'node-lts') {
    const verify = 'node --version';
    if (platform === 'Windows') return { summary: 'Actualiza al canal LTS de Node.js.',
      commands: [{ label: 'WinGet · si se instaló con WinGet', value: 'winget upgrade --id OpenJS.NodeJS.LTS --exact' },
        { label: 'Instalación nueva o gestionada fuera de WinGet', value: 'winget install --id OpenJS.NodeJS.LTS --exact' }], verify,
      note: 'El instalador MSI puede sustituir la versión global. Si usas nvm-windows, actualiza desde nvm en lugar de mezclar gestores.' };
    return { summary: 'Instala la versión LTS y márcala como predeterminada en NVM.',
      commands: [{ label: 'NVM · Linux/macOS', value: "nvm install --lts && nvm alias default 'lts/*' && nvm use default" }], verify,
      note: 'Requiere nvm. Si instalaste Node con el gestor de paquetes de tu sistema, actualízalo desde ese mismo gestor para no cambiar el PATH activo.' };
  }

  if (watch.provider === 'npm') {
    const pkg = watch.source;
    return { summary: `Actualiza el paquete ${pkg} a la última versión publicada.`,
      commands: [{ label: 'Instalación global', value: `npm install --global ${pkg}@latest` },
        { label: 'Dependencia de proyecto · desde la carpeta del proyecto', value: `npm install ${pkg}@latest` }],
      verify: `npm view ${pkg} version`, note: 'Elige el comando que corresponda a cómo instalaste el paquete; el segundo actualiza el package.json y el lockfile del proyecto actual.' };
  }

  if (watch.localTool === 'git' || watch.source.toLowerCase() === 'git-for-windows/git' || watch.source.toLowerCase() === 'git/git') {
    const verify = 'git --version';
    if (platform === 'Windows') return { summary: 'Actualiza Git for Windows.',
      commands: [{ label: 'WinGet · si se instaló con WinGet', value: 'winget upgrade --id Git.Git --exact' },
        { label: 'Instalación nueva o gestionada fuera de WinGet', value: 'winget install --id Git.Git --exact' }], verify,
      note: 'Si Git lo gestiona otra distribución, utiliza su actualizador para conservar PATH y configuración.' };
    if (platform === 'macOS') return { summary: 'Actualiza Git con Homebrew.',
      commands: [{ label: 'Homebrew', value: 'brew update && brew upgrade git' }], verify,
      note: 'Si usas Xcode Command Line Tools u otro gestor, actualiza Git desde ese mismo método.' };
    return { summary: 'Actualiza Git desde el gestor de paquetes del sistema.',
      commands: [{ label: 'APT · Debian/Ubuntu', value: 'sudo apt-get update && sudo apt-get install --only-upgrade git' }], verify,
      note: 'La versión disponible depende del repositorio configurado en la distribución.' };
  }

  return { summary: 'La fuente publica versiones, pero no declara cómo se instala esta aplicación.', commands: [],
    verify: watch.localTool ? `${watch.localTool} --version` : '',
    note: 'No hay un comando universal seguro: GitHub puede publicar instaladores, archivos comprimidos, contenedores o código fuente. Abre la publicación y usa el mismo método con el que instalaste el programa.' };
}

export default function UpdateGuideDialog({ watch, platform, isContainer, onClose }: {
  watch: SoftwareWatch; platform: string; isContainer: boolean; onClose: () => void;
}) {
  const remoteLocation = watch.locationId !== null;
  const canChooseOS = isContainer || remoteLocation;
  const detectedOS: TargetOS = platform === 'Windows' || platform === 'macOS' ? platform : 'Linux';
  const [targetOS, setTargetOS] = useState<TargetOS>(detectedOS);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const plan = planFor(watch, targetOS);

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(value); setCopyError(false); }
    catch { setCopied(null); setCopyError(true); }
  }

  return <Dialog title={`Cómo actualizar ${watch.name}`} onClose={onClose}>
    <div className="update-guide">
      <div className="update-version-pair"><div><span>Instalada</span><strong>{watch.installedVersion ?? 'Sin indicar'}</strong></div>
        <span className="update-version-arrow" aria-hidden="true">→</span>
        <div><span>Disponible</span><strong>{watch.latestVersion ?? 'Sin comprobar'}</strong></div></div>

      {canChooseOS && <label className="update-os-field"><span>Sistema del equipo donde actualizar</span>
        <select value={targetOS} onChange={event => setTargetOS(event.target.value as TargetOS)}>
          <option value="Windows">Windows</option><option value="Linux">Linux</option><option value="macOS">macOS</option>
        </select></label>}

      {isContainer && <p className="update-context-warning" role="note">Watchboard se ejecuta en un contenedor. No ejecutes estos comandos dentro del contenedor: actualiza el equipo anfitrión o usa el gestor con el que instalaste la aplicación.</p>}
      {remoteLocation && <p className="update-context-warning" role="note">“{watch.locationName ?? 'Esta ubicación'}” es una clasificación manual. Watchboard no detecta ni actualiza ese equipo a distancia; ejecuta el comando allí.</p>}
      <p className="update-context-note">Watchboard detecta la versión, no el gestor con que se instaló. Estos comandos son sugerencias: usa el mismo instalador o gestor de paquetes que utilizaste.</p>

      <section className="update-guide-section" aria-labelledby="update-how-title">
        <div className="update-guide-heading"><Terminal size={17} /><h3 id="update-how-title">Actualizar</h3></div>
        <p>{plan.summary}</p>
        <p className="update-context-note">El comando solo se muestra para que lo revises y copies; Watchboard no lo ejecuta.</p>
        {plan.commands.length > 0 ? <div className="update-commands">{plan.commands.map(command => <div className="update-command" key={command.label}>
          <div className="update-command-label"><span>{command.label}</span><button type="button" className="text-button" onClick={() => void copy(command.value)} aria-label={`Copiar comando ${command.label}`}>
            {copied === command.value ? <Check size={15} /> : <Copy size={15} />}{copied === command.value ? 'Copiado' : 'Copiar'}</button></div>
          <code>{command.value}</code></div>)}</div> : <p className="update-context-note">No se puede deducir un comando de instalación fiable para esta fuente.</p>}
        {plan.verify && <div className="update-verify"><span>Comprobar versión</span><code>{plan.verify}</code></div>}
        <p className="update-plan-note">{plan.note}</p>
        {copyError && <p className="update-copy-error" role="status">No se pudo copiar desde este contexto. Selecciona el comando y cópialo manualmente.</p>}
      </section>

      <div className="update-guide-footer"><a className="button secondary" href={safeLink(watch.releaseUrl ?? watch.sourceUrl)} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={16} />Ver publicación</a><button type="button" className="button primary" onClick={onClose}>Entendido</button></div>
    </div>
  </Dialog>;
}
