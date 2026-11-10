import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dashboard, DashboardLoad, User } from '../types';
import { clearCache, commitDashboard, loadDashboard, offlineGames } from '../services/dashboard';
import { ownedApi, HttpError } from '../services/api';

export default function useDashboard(user: User, onSessionLost: () => void) {
  const [load, setLoad] = useState<DashboardLoad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const mutations = useRef(0);
  const primed = useRef(new Set<string>());
  const sessionLost = useRef(onSessionLost);
  useEffect(() => { sessionLost.current = onSessionLost; }, [onSessionLost]);
  const cancel = useCallback(() => { generation.current++; controller.current?.abort(); }, []);

  const read = useCallback(async (allowFallback = true) => {
    const current = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await loadDashboard(user.id, abort.signal, allowFallback);
      if (!mounted.current || current !== generation.current || abort.signal.aborted) return null;
      result.cacheSaved = commitDashboard(user.id, result);
      setLoad(result);
      setError(null);
      return result;
    } catch (reason) {
      if (!mounted.current || abort.signal.aborted || current !== generation.current) return null;
      if (reason instanceof HttpError && [401,403].includes(reason.status)) {
        clearCache(user.id);
        setLoad(null);
        sessionLost.current();
      } else {
        setError(reason instanceof Error ? reason.message : 'No se pudo cargar el panel.');
        setLoad(previous => previous ? { ...previous, mode: 'cache', data: { ...previous.data,
          software: previous.data.software.map(item => ({ ...item, stale: true })), games: offlineGames(previous.data.games) } } : null);
      }
      return null;
    }
  }, [user.id]);

  useEffect(() => {
    mounted.current = true;
    const startup = generation.current;
    queueMicrotask(() => { if (mounted.current && generation.current === startup) void read(); });
    const timer = window.setInterval(() => { if (!document.hidden && mutations.current === 0) void read(); }, 30_000);
    return () => { mounted.current = false; cancel(); window.clearInterval(timer); };
  }, [read, cancel]);

  useEffect(() => {
    if (load?.mode !== 'panel') return;
    const pending = [...load.data.software, ...load.data.games].filter(watch => watch.lastAttemptAt === null && !primed.current.has(watch.id));
    if (!pending.length) return;
    pending.forEach(watch => primed.current.add(watch.id));
    // Prime newly added/imported sources without blocking edits or showing a permanent success banner.
    ownedApi(user.id).refresh().then(() => { if (mounted.current && mutations.current === 0) void read(); }).catch(() => undefined);
  }, [load, read, user.id]);

  async function mutate<T>(action: () => Promise<T>, reconcile?: (data: Dashboard) => Dashboard): Promise<{ value: T; reloaded: boolean }> {
    mutations.current++;
    generation.current++;
    controller.current?.abort();
    try {
      const value = await action();
      clearCache(user.id);
      if (reconcile) setLoad(previous => previous ? { ...previous, data: reconcile(previous.data) } : null);
      const confirmed = await read(false);
      return { value, reloaded: confirmed?.mode === 'panel' };
    } catch (reason) {
      if (reason instanceof HttpError && reason.status === 401) {
        clearCache(user.id);
        setLoad(null);
        sessionLost.current();
      }
      throw reason;
    } finally { mutations.current--; }
  }

  return { load, error, dismissError: () => setError(null), read, mutate };
}
