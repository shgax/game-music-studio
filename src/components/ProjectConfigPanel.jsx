import React, { useState } from 'react';
import { COMPLEXITY_LEVELS } from '../data/soundModel';
import { getProfile } from '../data/gameProfiles';

// Configuración de UN proyecto (spec 007).
//
// Implementa specs/reference/templates/PROJECT_CONFIG.md.
//
// El Artículo VIII es la razón de existir de este panel: las restricciones son
// por proyecto, NUNCA universales. Un juego puede prohibir la estética retro y
// otro exigirla. Y las restricciones visuales se guardan aparte de las sonoras,
// porque una regla de marca no es una regla de audio.

// Ejemplos del sistema, presentados como sugerencias y no como valores por
// defecto: 01_GLOBAL_AUDIO_RULES §7 los llama explícitamente "ejemplos por
// proyecto, no reglas universales".
const TRAIT_SUGGESTIONS = ['horror', 'childish', 'retro_arcade', 'aggressive_animal', 'military', 'slapstick'];

const VOICE_FIELDS = [
  { key: 'vocals_allowed', label: 'Voces', desc: 'Cualquier contenido vocal cantado o sostenido.' },
  { key: 'speech_allowed', label: 'Habla', desc: 'Líneas habladas, locución, anuncios del crupier.' },
  { key: 'chants_allowed', label: 'Coros', desc: 'Cánticos y coros de multitud.' },
  { key: 'character_voice_allowed', label: 'Voz de personaje', desc: 'Sonidos vocales de una mascota o personaje.' },
  { key: 'laughter_allowed', label: 'Risas', desc: 'Risas y celebraciones vocales, humanas o de personaje.' }
];

const SAMPLE_RATES = [44100, 48000, 96000];
const BIT_DEPTHS = [16, 24, 32];

// Editor de una lista de términos.
const TagList = ({ label, hint, values = [], suggestions = [], onChange, accent }) => {
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const value = (raw ?? draft).trim().toLowerCase();
    if (!value || values.includes(value)) {
      setDraft('');
      return;
    }
    onChange([...values, value]);
    setDraft('');
  };

  const remove = (value) => onChange(values.filter(v => v !== value));

  const available = suggestions.filter(s => !values.includes(s));

  return (
    <div className="tag-list">
      <label className="tag-list-label">
        {label}
        {hint && <span className="tag-list-hint">{hint}</span>}
      </label>

      <div className="tag-list-values">
        {values.map(v => (
          <button
            key={v}
            className={`tag-chip ${accent || ''}`}
            onClick={() => remove(v)}
            title="Quitar"
          >
            {v} <span className="tag-chip-x">×</span>
          </button>
        ))}
        {values.length === 0 && <span className="tag-list-empty">Ninguna</span>}
      </div>

      <div className="tag-list-input-row">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Escribe y pulsa Enter..."
          className="tag-list-input"
        />
        <button className="tag-list-add" onClick={() => add()} disabled={!draft.trim()}>
          Añadir
        </button>
      </div>

      {available.length > 0 && (
        <div className="tag-suggestions">
          <span className="tag-suggestions-label">Ejemplos del sistema:</span>
          {available.map(s => (
            <button key={s} className="tag-suggestion" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectConfigPanel = ({ project, onUpdateConfig, onClose }) => {
  const config = project.config || {};
  const voice = config.voice || {};
  const restrictions = config.restrictions || {};
  const technical = config.technical || {};
  const profile = getProfile(project.type);

  const patch = (changes) => onUpdateConfig({ ...config, ...changes });

  const setVoice = (key, value) => patch({ voice: { ...voice, [key]: value } });
  const setRestriction = (key, value) => patch({ restrictions: { ...restrictions, [key]: value } });
  const setTechnical = (key, value) => patch({ technical: { ...technical, [key]: value } });

  const complexity = config.complexity_level || 'standard';
  const [min, max] = profile.ranges[complexity] || profile.ranges.standard;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container project-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Ajustes del juego</h2>
            <p className="project-config-subtitle">
              <strong>{project.name}</strong> · {profile.label}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="project-config-scope-note">
            Estas reglas gobiernan <strong>solo este proyecto</strong> y se aplican a lo que se
            genere a partir de ahora. Los prompts ya creados no se reescriben.
          </p>

          {/* Alcance */}
          <div className="config-section">
            <h3>Alcance</h3>
            <p className="section-desc">
              El nivel de complejidad es una <strong>guía de alcance, no una etiqueta comercial</strong>.
              Determina cuántos assets se esperan y con qué rango se compara la lista maestra.
            </p>

            <div className="config-radio-group">
              {COMPLEXITY_LEVELS.map(c => {
                const [cmin, cmax] = profile.ranges[c.key];
                return (
                  <button
                    key={c.key}
                    className={`config-radio ${complexity === c.key ? 'active' : ''}`}
                    onClick={() => patch({ complexity_level: c.key })}
                  >
                    <span className="config-radio-label">{c.label}</span>
                    <span className="config-radio-meta">{cmin}–{cmax} assets</span>
                  </button>
                );
              })}
            </div>

            <p className="config-note">
              Rango activo para {profile.label}: <strong>{min}–{max} assets oficiales</strong>.
              El género no se puede cambiar una vez creado el proyecto: alteraría el significado
              de toda la lista maestra.
            </p>
          </div>

          {/* Voz */}
          <div className="config-section">
            <h3>Política de voz</h3>
            <p className="section-desc">
              Todo está desactivado por defecto. Cada opción que dejes desactivada se inyecta como
              prohibición explícita en los prompts enviados a la IA.
            </p>

            {VOICE_FIELDS.map(f => (
              <label className="config-toggle" key={f.key}>
                <input
                  type="checkbox"
                  checked={Boolean(voice[f.key])}
                  onChange={(e) => setVoice(f.key, e.target.checked)}
                />
                <span className="config-toggle-text">
                  <strong>{f.label}</strong>
                  <span className="config-toggle-desc">{f.desc}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Restricciones */}
          <div className="config-section">
            <h3>Restricciones</h3>
            <p className="section-desc">
              Las restricciones <strong>sonoras</strong> y las <strong>visuales</strong> se guardan
              por separado a propósito: una regla de marca sobre lo que no debe verse no es una
              restricción sobre lo que no debe sonar. La IA las recibe marcadas como tales.
            </p>

            <TagList
              label="Rasgos de audio prohibidos"
              hint="No se usarán en ningún prompt de este proyecto"
              values={restrictions.forbidden_audio_traits || []}
              suggestions={TRAIT_SUGGESTIONS}
              onChange={(v) => setRestriction('forbidden_audio_traits', v)}
              accent="danger"
            />

            <TagList
              label="Temas visuales prohibidos"
              hint="Restricción de imagen; NO se traduce a restricción sonora"
              values={restrictions.forbidden_visual_themes || []}
              onChange={(v) => setRestriction('forbidden_visual_themes', v)}
            />

            <TagList
              label="Frases obligatorias en todo prompt"
              values={restrictions.mandatory_prompt_phrases || []}
              onChange={(v) => setRestriction('mandatory_prompt_phrases', v)}
              accent="ok"
            />

            <TagList
              label="Frases prohibidas en todo prompt"
              values={restrictions.forbidden_prompt_phrases || []}
              onChange={(v) => setRestriction('forbidden_prompt_phrases', v)}
              accent="danger"
            />
          </div>

          {/* Técnica */}
          <div className="config-section">
            <h3>Entrega técnica</h3>
            <p className="section-desc">
              Formato de los archivos finales. Se incluye en el manifiesto exportado.
            </p>

            <div className="config-tech-grid">
              <div className="input-group">
                <label htmlFor="tech-format">Formato</label>
                <input
                  id="tech-format"
                  type="text"
                  value={technical.format || 'WAV'}
                  onChange={(e) => setTechnical('format', e.target.value.toUpperCase())}
                  className="modal-input"
                />
              </div>

              <div className="input-group">
                <label htmlFor="tech-rate">Frecuencia de muestreo</label>
                <select
                  id="tech-rate"
                  value={technical.sample_rate || 48000}
                  onChange={(e) => setTechnical('sample_rate', Number(e.target.value))}
                  className="modal-input"
                >
                  {SAMPLE_RATES.map(r => (
                    <option key={r} value={r}>{r.toLocaleString('es')} Hz</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="tech-depth">Profundidad de bits</label>
                <select
                  id="tech-depth"
                  value={technical.bit_depth || 24}
                  onChange={(e) => setTechnical('bit_depth', Number(e.target.value))}
                  className="modal-input"
                >
                  {BIT_DEPTHS.map(b => (
                    <option key={b} value={b}>{b} bits</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <span className="config-autosave">Los cambios se guardan solos.</span>
          <button className="save-btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default ProjectConfigPanel;
