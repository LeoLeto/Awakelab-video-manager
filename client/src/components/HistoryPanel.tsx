import { useState, useEffect, useCallback } from 'react';
import { getHistory } from '../services/apiService';
import type { HistoryEntry, HistoryAction } from '../services/apiService';
import { useAuth } from '../context/useAuth';
import './HistoryPanel.css';

const ACTION_LABELS: Record<HistoryAction, string> = {
  upload          : 'Subida',
  delete          : 'Eliminado',
  delete_permanent: 'Eliminado permanente',
  rename          : 'Renombrado',
  move            : 'Movido',
  restore         : 'Restaurado',
};

const PAGE_SIZE = 50;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day   : '2-digit',
    month : '2-digit',
    year  : 'numeric',
    hour  : '2-digit',
    minute: '2-digit',
  });
};

const ActionBadge = ({ action }: { action: HistoryAction }) => (
  <span className={`hp-badge hp-badge--${action.replace('_', '-')}`}>
    {ACTION_LABELS[action]}
  </span>
);

const DetailText = ({ entry }: { entry: HistoryEntry }) => {
  if (entry.action === 'rename' && entry.details?.oldName) {
    return <span className="hp-detail">← {entry.details.oldName}</span>;
  }
  if (entry.action === 'move' && entry.details?.fromFolder) {
    return <span className="hp-detail">de: {entry.details.fromFolder}</span>;
  }
  return null;
};

export const HistoryPanel = () => {
  const { isAdmin } = useAuth();

  const [entries,    setEntries]    = useState<HistoryEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [actionFilter, setActionFilter] = useState<HistoryAction | ''>('');
  const [userFilter,   setUserFilter]   = useState('');
  const [page,       setPage]       = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allUsers = Array.from(new Set(entries.map(e => e.user))).sort();

  const filtered = entries.filter(e => {
    if (actionFilter && e.action !== actionFilter) return false;
    if (userFilter   && e.user   !== userFilter)   return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !e.filename.toLowerCase().includes(q) &&
        !e.folder.toLowerCase().includes(q)   &&
        !e.user.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetPage = () => setPage(1);

  return (
    <div className="hp-container">
      <div className="hp-header">
        <div>
          <h2>Historial de Actividad</h2>
          <p className="hp-subtitle">Registro de subidas, eliminaciones y cambios</p>
        </div>
        <button className="hp-refresh-btn" onClick={load} disabled={loading}>
          {loading ? '⏳' : '↻'} Actualizar
        </button>
      </div>

      {error && (
        <div className="hp-error">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="hp-filters">
        <input
          className="hp-search"
          type="text"
          placeholder="Buscar archivo, carpeta o usuario..."
          value={search}
          onChange={e => { setSearch(e.target.value); resetPage(); }}
        />
        <select
          className="hp-select"
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value as HistoryAction | ''); resetPage(); }}
        >
          <option value="">Todas las acciones</option>
          {(Object.keys(ACTION_LABELS) as HistoryAction[]).map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a]}</option>
          ))}
        </select>
        {isAdmin && (
          <select
            className="hp-select"
            value={userFilter}
            onChange={e => { setUserFilter(e.target.value); resetPage(); }}
          >
            <option value="">Todos los usuarios</option>
            {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
        {(search || actionFilter || userFilter) && (
          <button
            className="hp-clear-btn"
            onClick={() => { setSearch(''); setActionFilter(''); setUserFilter(''); resetPage(); }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="hp-count">
        {loading ? 'Cargando…' : `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {!loading && (
        <div className="hp-table-wrapper">
          <table className="hp-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Archivo</th>
                <th>Carpeta</th>
                {isAdmin && <th>Usuario</th>}
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {pageEntries.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="hp-empty">
                    No hay registros que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                pageEntries.map(entry => (
                  <tr key={entry.id} className={`hp-row hp-row--${entry.action.replace('_', '-')}`}>
                    <td className="hp-cell--date">{formatDate(entry.timestamp)}</td>
                    <td><ActionBadge action={entry.action} /></td>
                    <td className="hp-cell--file" title={entry.key}>{entry.filename}</td>
                    <td className="hp-cell--folder">{entry.folder}</td>
                    {isAdmin && <td className="hp-cell--user">{entry.user}</td>}
                    <td><DetailText entry={entry} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="hp-pagination">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            ‹ Anterior
          </button>
          <span>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Siguiente ›
          </button>
        </div>
      )}
    </div>
  );
};
