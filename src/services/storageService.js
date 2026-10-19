import { migrateDatabase } from '../data/migrateSounds.js';

// Persistencia de la base de proyectos.
//
// Dos capas, siempre ambas:
//   1. Nube  — Vercel Blob a través de /api/db. Sin OAuth ni sesiones.
//   2. Local — localStorage, que actúa como caché y respaldo automático.
//
// El Artículo X de la constitución exige que la aplicación sea plenamente
// usable sin credenciales: si la nube no responde (desarrollo con `npm run dev`,
// sin token configurado, sin red), todo sigue funcionando contra localStorage.

const LOCAL_KEY = 'local_projects_db';
const API = '/api/db';

class StorageService {
  constructor() {
    this.mode = 'unknown';       // 'cloud' | 'local' | 'unknown'
    this.lastSyncAt = null;      // marca del blob leído, para detectar conflictos
    this.onStatusChange = null;
  }

  subscribe(callback) {
    this.onStatusChange = callback;
    this.notify();
  }

  notify() {
    this.onStatusChange?.({
      mode: this.mode,
      lastSyncAt: this.lastSyncAt
    });
  }

  setMode(mode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.notify();
    }
  }

  // --- Local ---

  readLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  writeLocal(projects) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
      return true;
    } catch (e) {
      console.error('No se pudo escribir el respaldo local:', e);
      return false;
    }
  }

  // --- Carga ---

  async loadDatabase() {
    try {
      const res = await fetch(API, { headers: { Accept: 'application/json' } });

      if (res.ok) {
        const data = await res.json();
        this.lastSyncAt = data.updatedAt || null;
        this.setMode('cloud');

        if (Array.isArray(data.projects)) {
          const normalized = migrateDatabase(data.projects);
          // La nube manda: se refresca el respaldo local con lo que hay allí.
          this.writeLocal(normalized);
          return normalized;
        }

        // Nube disponible pero vacía: se sube lo que haya en local. Si tampoco hay
        // nada, se empieza en blanco: ninguna carga inventa ni sustituye proyectos.
        const local = this.readLocal();
        if (Array.isArray(local) && local.length > 0) {
          const seed = migrateDatabase(local);
          await this.saveDatabase(seed);
          return seed;
        }
        return [];
      }
    } catch {
      // Sin red o sin función servida (Vite en local): se cae a modo local.
    }

    this.setMode('local');
    const local = this.readLocal();
    return Array.isArray(local) ? migrateDatabase(local) : [];
  }

  // --- Guardado ---

  async saveDatabase(projects, { force = false } = {}) {
    // El respaldo local se escribe siempre y primero: aunque la nube falle,
    // el trabajo nunca se pierde.
    this.writeLocal(projects);

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projects,
          baseUpdatedAt: this.lastSyncAt,
          force
        })
      });

      if (res.status === 409) {
        const data = await res.json();
        this.setMode('cloud');
        return {
          ok: false,
          conflict: true,
          remoteUpdatedAt: data.remoteUpdatedAt
        };
      }

      if (res.ok) {
        const data = await res.json();
        this.lastSyncAt = data.updatedAt || null;
        this.setMode('cloud');
        this.notify();
        return { ok: true };
      }

      this.setMode('local');
      return { ok: false, localOnly: true };
    } catch {
      this.setMode('local');
      return { ok: false, localOnly: true };
    }
  }

  // Descarga la base completa como archivo, para respaldo manual.
  exportBackup() {
    const projects = this.readLocal() || [];
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `sonidos_dashboard_backup_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

const storageService = new StorageService();
export default storageService;
