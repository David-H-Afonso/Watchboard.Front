import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="main-content"><section className="panel startup-state" role="alert"><h1>No se pudo dibujar esta vista.</h1><p>Tus seguimientos siguen guardados en la base de datos. Recarga para volver a consultar el panel.</p><button className="button primary" onClick={() => location.reload()}><RefreshCw size={17} />Recargar Watchboard</button></section></main>;
  }
}
