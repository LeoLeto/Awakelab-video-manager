import { useState, useEffect, useCallback } from 'react';
import {
  adminGetUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
} from '../services/apiService';
import type { AdminUser, UserPermissions } from '../services/apiService';
import { useAuth } from '../context/useAuth';
import './UserManager.css';

interface Props {
  folders: string[];
}

const defaultPermissions = (): UserPermissions => ({
  directoryAccess   : 'all',
  allowedDirectories: [],
  canUpload         : false,
  canDelete         : false,
  canMove           : false,
});

interface Draft extends UserPermissions {
  isAdmin: boolean;
}

// ─── Shared dir helpers ──────────────────────────────────────────────────────
const getNestingLevel = (p: string) => p.split('/').length - 1;
const getDisplayName  = (p: string) => p.split('/').at(-1) ?? p;

/** Returns the folder itself plus all folders nested inside it. */
const getWithDescendants = (dir: string, allFolders: string[]) =>
  allFolders.filter(f => f === dir || f.startsWith(dir + '/'));

// ─── Toggle switch ────────────────────────────────────────────────────────────
const Toggle = ({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    className={`um-toggle ${checked ? 'um-toggle--on' : ''} ${disabled ? 'um-toggle--disabled' : ''}`}
    onClick={() => !disabled && onChange(!checked)}
  >
    <span className="um-toggle-thumb" />
  </button>
);

// ─── Create-user modal ────────────────────────────────────────────────────────
interface CreateModalProps {
  folders : string[];
  onClose : () => void;
  onCreate: (user: AdminUser) => void;
}

const CreateUserModal = ({ folders, onClose, onCreate }: CreateModalProps) => {
  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [permissions,  setPermissions]  = useState<UserPermissions>(defaultPermissions());
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Usuario y contraseña son obligatorios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const user = await adminCreateUser(username.trim(), password.trim(), isAdmin, permissions);
      onCreate(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  const setP = (key: keyof UserPermissions, value: UserPermissions[keyof UserPermissions]) =>
    setPermissions(prev => ({ ...prev, [key]: value }));

  const toggleDir = (dir: string) => {
    const affected = getWithDescendants(dir, contentFolders);
    setPermissions(prev => {
      const adding = !prev.allowedDirectories.includes(dir);
      const list   = adding
        ? [...new Set([...prev.allowedDirectories, ...affected])]
        : prev.allowedDirectories.filter(d => !affected.includes(d));
      return { ...prev, allowedDirectories: list };
    });
  };

  const contentFolders = folders.filter(f => f !== 'Recycle Bin');

  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal" onClick={e => e.stopPropagation()}>
        <div className="um-modal-header">
          <h3>Crear Nuevo Usuario</h3>
          <button className="um-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="um-modal-body">
          {error && <div className="um-error">{error}</div>}

          <div className="um-field">
            <label>Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="nombre de usuario"
              autoFocus
            />
          </div>
          <div className="um-field">
            <label>Contraseña</label>
            <div className="um-password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="um-password-toggle"
                onClick={() => setShowPassword(v => !v)}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="um-field um-field--row">
            <label>Administrador</label>
            <Toggle checked={isAdmin} onChange={v => { setIsAdmin(v); }} />
          </div>

          {!isAdmin && (
            <>
              <hr className="um-divider" />
              <p className="um-section-title">Permisos</p>

              <div className="um-field">
                <label>Acceso a Directorios</label>
                <select
                  value={permissions.directoryAccess}
                  onChange={e => setP('directoryAccess', e.target.value as 'all' | 'specific')}
                >
                  <option value="all">Todos</option>
                  <option value="specific">Específicos</option>
                </select>
              </div>

              {permissions.directoryAccess === 'specific' && (
                <div className="um-dir-list">
                  {contentFolders.length === 0 && (
                    <p className="um-no-folders">No hay directorios disponibles.</p>
                  )}
                  {contentFolders.map(f => (
                    <label
                      key={f}
                      className="um-dir-checkbox"
                      style={{ paddingLeft: `${0.5 + getNestingLevel(f) * 1.5}rem` }}
                    >
                      <input
                        type="checkbox"
                        checked={permissions.allowedDirectories.includes(f)}
                        onChange={() => toggleDir(f)}
                      />
                      {getDisplayName(f)}
                    </label>
                  ))}
                </div>
              )}

              <div className="um-field um-field--row">
                <label>Subir Archivos</label>
                <Toggle checked={permissions.canUpload} onChange={v => setP('canUpload', v)} />
              </div>
              <div className="um-field um-field--row">
                <label>Eliminar Archivos</label>
                <Toggle checked={permissions.canDelete} onChange={v => setP('canDelete', v)} />
              </div>
              <div className="um-field um-field--row">
                <label>Mover Archivos</label>
                <Toggle checked={permissions.canMove} onChange={v => setP('canMove', v)} />
              </div>
            </>
          )}

          <div className="um-modal-footer">
            <button type="button" className="um-btn um-btn--secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="um-btn um-btn--primary" disabled={saving}>
              {saving ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Change-password modal ───────────────────────────────────────────────────
interface ChangePasswordModalProps {
  username: string;
  onClose : () => void;
  onSaved : () => void;
}

const ChangePasswordModal = ({ username, onClose, onSaved }: ChangePasswordModalProps) => {
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('La contraseña no puede estar vacía.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminUpdateUser(username, { password: password.trim() });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal um-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="um-modal-header">
          <h3>Cambiar Contraseña</h3>
          <button className="um-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="um-modal-body">
          {error && <div className="um-error">{error}</div>}
          <p className="um-change-pw-user">Usuario: <strong>{username}</strong></p>
          <div className="um-field">
            <label>Nueva Contraseña</label>
            <div className="um-password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
              />
              <button
                type="button"
                className="um-password-toggle"
                onClick={() => setShowPassword(v => !v)}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div className="um-modal-footer">
            <button type="button" className="um-btn um-btn--secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="um-btn um-btn--primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Directory picker popover ─────────────────────────────────────────────────
interface DirPickerProps {
  allowedDirectories: string[];
  folders            : string[];
  onChange           : (dirs: string[]) => void;
  onClose            : () => void;
}

const DirPicker = ({ allowedDirectories, folders, onChange, onClose }: DirPickerProps) => {
  const contentFolders = folders.filter(f => f !== 'Recycle Bin');

  const toggle = (dir: string) => {
    const affected = getWithDescendants(dir, contentFolders);
    const adding   = !allowedDirectories.includes(dir);
    const next     = adding
      ? [...new Set([...allowedDirectories, ...affected])]
      : allowedDirectories.filter(d => !affected.includes(d));
    onChange(next);
  };

  return (
    <div className="um-dir-popover">
      <div className="um-dir-popover-header">
        <span>Directorios permitidos</span>
        <button onClick={onClose}>✕</button>
      </div>
      {contentFolders.length === 0 && (
        <p className="um-no-folders">No hay directorios disponibles.</p>
      )}
      {contentFolders.map(f => (
        <label
          key={f}
          className="um-dir-checkbox"
          style={{ paddingLeft: `${0.5 + getNestingLevel(f) * 1.5}rem` }}
        >
          <input
            type="checkbox"
            checked={allowedDirectories.includes(f)}
            onChange={() => toggle(f)}
          />
          {getDisplayName(f)}
        </label>
      ))}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const UserManager = ({ folders }: Props) => {
  const { username: currentUser } = useAuth();

  const [users,        setUsers]        = useState<AdminUser[]>([]);
  const [drafts,       setDrafts]       = useState<Record<string, Draft>>({});
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);
  const [showCreate,        setShowCreate]        = useState(false);
  const [openDirFor,        setOpenDirFor]        = useState<string | null>(null);
  const [deletingUser,      setDeletingUser]      = useState<string | null>(null);
  const [changingPasswordFor, setChangingPasswordFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminGetUsers();
      setUsers(data);
      const initial: Record<string, Draft> = {};
      data.forEach(u => {
        initial[u.username] = {
          isAdmin          : u.isAdmin,
          ...u.permissions,
        };
      });
      setDrafts(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Draft helpers ────────────────────────────────
  const setDraft = (username: string, key: keyof Draft, value: Draft[keyof Draft]) => {
    setDrafts(prev => ({ ...prev, [username]: { ...prev[username], [key]: value } }));
  };

  // ── Save all ─────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await Promise.all(
        users.map(u => {
          const d = drafts[u.username];
          if (!d) return Promise.resolve();
          const { isAdmin, ...permissions } = d;
          return adminUpdateUser(u.username, { isAdmin, permissions });
        }),
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete user ───────────────────────────────────
  const handleDelete = async (username: string) => {
    try {
      await adminDeleteUser(username);
      setDeletingUser(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar usuario');
    }
  };

  // ── User created ──────────────────────────────────
  const handleCreated = (user: AdminUser) => {
    setShowCreate(false);
    setUsers(prev => [...prev, user]);
    setDrafts(prev => ({
      ...prev,
      [user.username]: { isAdmin: user.isAdmin, ...user.permissions },
    }));
  };

  // ── Avatar initials ───────────────────────────────
  const initials = (name: string) => name.slice(0, 2).toUpperCase();

  if (loading) return <div className="um-loading">Cargando usuarios…</div>;

  return (
    <div className="um-container">
      <div className="um-header">
        <div>
          <h2>Administrar Permisos de Usuarios</h2>
          <p className="um-subtitle">Gestiona accesos y permisos de cada usuario</p>
        </div>
        <button className="um-btn um-btn--primary" onClick={() => setShowCreate(true)}>
          + Nuevo Usuario
        </button>
      </div>

      {error   && <div className="um-banner um-banner--error">{error}<button onClick={() => setError(null)}>✕</button></div>}
      {success && <div className="um-banner um-banner--success">✓ Cambios guardados correctamente</div>}

      <div className="um-table-wrapper">
        <table className="um-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Acceso Directorios</th>
              <th>Subir Archivos</th>
              <th>Eliminar Archivos</th>
              <th>Mover Archivos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const d          = drafts[u.username] ?? { isAdmin: u.isAdmin, ...u.permissions };
              const isAdminRow = d.isAdmin;
              const isSelf     = u.username === currentUser;

              return (
                <tr key={u.username} className={isAdminRow ? 'um-row--admin' : ''}>
                  {/* Avatar + name */}
                  <td>
                    <div className="um-user-cell">
                      <span className="um-avatar">{initials(u.username)}</span>
                      <div>
                        <span className="um-username">{u.username}</span>
                        {isAdminRow && <span className="um-badge">Admin</span>}
                      </div>
                    </div>
                  </td>

                  {/* Directory access */}
                  <td>
                    {isAdminRow ? (
                      <span className="um-all-label">Todos</span>
                    ) : (
                      <div className="um-dir-cell">
                        <select
                          value={d.directoryAccess}
                          onChange={e => {
                            setDraft(u.username, 'directoryAccess', e.target.value as 'all' | 'specific');
                            if (e.target.value === 'all') setOpenDirFor(null);
                          }}
                        >
                          <option value="all">Todos</option>
                          <option value="specific">Específicos</option>
                        </select>
                        {d.directoryAccess === 'specific' && (
                          <button
                            className="um-btn-dirs"
                            onClick={() => setOpenDirFor(openDirFor === u.username ? null : u.username)}
                          >
                            {d.allowedDirectories.length === 0
                              ? 'Ninguno'
                              : `${d.allowedDirectories.length} dir.`
                            }
                          </button>
                        )}
                        {openDirFor === u.username && (
                          <DirPicker
                            allowedDirectories={d.allowedDirectories}
                            folders={folders}
                            onChange={dirs => setDraft(u.username, 'allowedDirectories', dirs)}
                            onClose={() => setOpenDirFor(null)}
                          />
                        )}
                      </div>
                    )}
                  </td>

                  {/* canUpload */}
                  <td className="um-toggle-cell">
                    <Toggle
                      checked={isAdminRow || d.canUpload}
                      onChange={v => setDraft(u.username, 'canUpload', v)}
                      disabled={isAdminRow}
                    />
                  </td>

                  {/* canDelete */}
                  <td className="um-toggle-cell">
                    <Toggle
                      checked={isAdminRow || d.canDelete}
                      onChange={v => setDraft(u.username, 'canDelete', v)}
                      disabled={isAdminRow}
                    />
                  </td>

                  {/* canMove */}
                  <td className="um-toggle-cell">
                    <Toggle
                      checked={isAdminRow || d.canMove}
                      onChange={v => setDraft(u.username, 'canMove', v)}
                      disabled={isAdminRow}
                    />
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="um-actions-cell">
                      {(isSelf || !isAdminRow) && (
                        <button
                          className="um-btn-icon"
                          title="Cambiar contraseña"
                          onClick={() => setChangingPasswordFor(u.username)}
                        >
                          🔑
                        </button>
                      )}
                      {!isSelf && (
                        deletingUser === u.username ? (
                          <div className="um-delete-confirm">
                            <span>¿Eliminar?</span>
                            <button className="um-btn um-btn--danger-sm" onClick={() => handleDelete(u.username)}>Sí</button>
                            <button className="um-btn um-btn--ghost-sm" onClick={() => setDeletingUser(null)}>No</button>
                          </div>
                        ) : (
                          <button
                            className="um-btn-delete"
                            title="Eliminar usuario"
                            onClick={() => setDeletingUser(u.username)}
                          >
                            🗑
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="um-footer">
        <button
          className="um-btn um-btn--save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando…' : 'Guardar Cambios'}
        </button>
      </div>

      {showCreate && (
        <CreateUserModal
          folders={folders}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreated}
        />
      )}

      {changingPasswordFor && (
        <ChangePasswordModal
          username={changingPasswordFor}
          onClose={() => setChangingPasswordFor(null)}
          onSaved={() => {
            setChangingPasswordFor(null);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
          }}
        />
      )}
    </div>
  );
};
