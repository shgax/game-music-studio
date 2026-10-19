import React, { useState, useEffect, useRef } from 'react';
import storageService from '../services/storageService';
import { generateSoundEffect } from '../services/elevenLabsService';
import { analyzeGame, engineSupportsImages } from '../services/analysisService';
import { hasEngineKey, hasKey, getEngine, describeEngine, engineShortName } from '../services/aiEngineSettings';
import { getViewMode, setViewMode, isGuideHidden, setGuideHidden, areAdvancedOptionsShown, setAdvancedOptionsShown } from '../services/uiPreferences';
import {
  downloadFullProjectJSON,
  downloadEngineManifest,
  copyPromptsToClipboard,
  downloadEntregaHTML,
  downloadEntregaXLSX,
  downloadBlob
} from '../data/developerExports';
import { EXAMPLE_PROJECT, EXAMPLE_PROJECT_ID } from '../data/exampleProject';
import SimplePromptView from './SimplePromptView';
import EmptyStart from './EmptyStart';
import SoundSpreadsheet from './SoundSpreadsheet';
import SoundKanbanBoard from './SoundKanbanBoard';
import Header from './Header';
import ProjectSwitcher from './ProjectSwitcher';
import ProjectConfigPanel from './ProjectConfigPanel';
import DiscoveryPanel from './DiscoveryPanel';
import PromptComposerPanel from './PromptComposerPanel';
import SoundReviewPanel from './SoundReviewPanel';
import AnalysisReport from './AnalysisReport';
import DropdownMenu from './DropdownMenu';
import { usePromptPackage } from './usePromptPackage';
import { buildStartOptions } from '../data/listStartOptions';
import { getActivePackage } from '../services/livePrompts';
import { getProfile, evaluateScope } from '../data/gameProfiles';
import { createSound, countAssets, sanitizeSoundList, isDiscarded, COMPLEXITY_LEVELS } from '../data/soundModel';
import { migrateSound } from '../data/migrateSounds';
import { parseCSVBody, detectDelimiter } from '../data/csvParser';
import { normalizeAnalysis, resolveThemeTag, applyTheme } from '../data/analysisModel';
import { applyReview } from '../data/reviewModel';

const ProjectManager = ({ storageStatus, onOpenConfig }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copyNotification, setCopyNotification] = useState('');
  const exportMenuRef = useRef(null);
  const fileInputRefCSV = useRef(null);
  const fileInputRefJSON = useRef(null);

  // Formulario de análisis con el motor de IA elegido
  const [gameDescription, setGameDescription] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysisReport, setShowAnalysisReport] = useState(true);
  const [activeView, setActiveView] = useState('excel'); // 'excel' | 'kanban'

  // Estados de carga generales. Se arranca cargando: sin esto, la pantalla de «no hay
  // ningún juego» parpadearía un instante antes de que lleguen los proyectos.
  const [loadingDb, setLoadingDb] = useState(true);
  const [generatingSoundId, setGeneratingSoundId] = useState(null);

  // Vista simple o completa (feature 010). Es la misma información: los dos modos
  // leen el mismo array de proyectos y usan los mismos handlers.
  const [viewMode, setViewModeState] = useState(getViewMode);
  const [guideHidden, setGuideHiddenState] = useState(isGuideHidden);

  // Los audios generados son borradores en MEMORIA, nunca datos del proyecto (FR-049):
  // el Artículo X prohíbe guardar binarios, y una dirección `blob:` deja de existir al
  // recargar. Clave `proyecto:sonido` → { url, blob, extension }.
  const [audioDrafts, setAudioDrafts] = useState({});
  const audioDraftsRef = useRef({});
  audioDraftsRef.current = audioDrafts;

  // Lo último que se sabe de los proyectos, para cuando una operación larga (generar
  // un audio tarda segundos) termina después de que la persona haya seguido editando.
  const projectsRef = useRef([]);
  projectsRef.current = projects;
  const [saveWarning, setSaveWarning] = useState(null);
  const [showProjectConfig, setShowProjectConfig] = useState(false);
  // Opciones avanzadas de la lista (feature 002, FR-001a): ocultas salvo que la persona las pida.
  const [showAdvanced, setShowAdvanced] = useState(areAdvancedOptionsShown);
  const { pkg: promptPackage } = usePromptPackage();

  const toggleAdvanced = (shown) => {
    setShowAdvanced(shown);
    setAdvancedOptionsShown(shown);
  };
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [composerTarget, setComposerTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);

  // Cargar proyectos al iniciar
  useEffect(() => {
    loadProjectsData();
  }, []);

  // Al cerrar la herramienta se liberan las direcciones temporales de los borradores.
  useEffect(() => () => {
    Object.values(audioDraftsRef.current).forEach(d => URL.revokeObjectURL(d.url));
  }, []);

  // Cerrar menú de exportación al hacer clic fuera
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showExportMenu]);

  const handleCopyPrompts = async () => {
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project || !project.sounds?.length) {
      alert('No hay sonidos en este proyecto para copiar.');
      return;
    }
    try {
      const count = await copyPromptsToClipboard(project.sounds);
      setCopyNotification(`✓ ${count} prompts copiados`);
      setTimeout(() => setCopyNotification(''), 3000);
    } catch (e) {
      alert(e.message);
    }
  };

  const loadProjectsData = async () => {
    setLoadingDb(true);
    try {
      const data = await storageService.loadDatabase();
      setProjects(data || []);
      if (data && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDb(false);
    }
  };

  // El respaldo local se escribe siempre; la nube puede fallar sin que se
  // pierda trabajo. Solo se avisa cuando la sincronización remota no ocurre.
  const saveProjectsData = async (updatedProjects) => {
    setProjects(updatedProjects);

    const result = await storageService.saveDatabase(updatedProjects);

    if (result.conflict) {
      const ok = window.confirm(
        'Otro dispositivo guardó cambios más recientes en la nube.\n\n' +
        'Aceptar: sobrescribir la nube con lo que tienes aquí.\n' +
        'Cancelar: recargar lo que hay en la nube y perder estos cambios locales.'
      );
      if (ok) {
        await storageService.saveDatabase(updatedProjects, { force: true });
        setSaveWarning(null);
      } else {
        await loadProjectsData();
      }
      return;
    }

    setSaveWarning(result.ok ? null : 'local');
  };

  const heroImageInputRef = useRef(null);

  // Crear un juego lo deja seleccionado: la barra superior pasa a mostrarlo y
  // toda la pantalla trabaja sobre él.
  const handleCreateProject = async ({ name, context, themeTag, type, complexity, coverImage }) => {
    // Configuración inicial según templates/PROJECT_CONFIG.md.
    // Voz desactivada por defecto (01_GLOBAL_AUDIO_RULES §2).
    const newProject = {
      id: 'proj_' + Date.now(),
      name,
      type,
      createdAt: new Date().toISOString(),
      coverImage: coverImage || null,
      config: {
        complexity_level: complexity,
        voice: {
          vocals_allowed: false,
          speech_allowed: false,
          chants_allowed: false,
          character_voice_allowed: false,
          laughter_allowed: false
        },
        technical: { format: 'WAV', sample_rate: 48000, bit_depth: 24 },
        restrictions: {
          forbidden_audio_traits: [],
          forbidden_visual_themes: [],
          mandatory_prompt_phrases: [],
          forbidden_prompt_phrases: []
        }
      },
      // El contexto del juego es lo primero que se sabe y alimenta todo lo
      // demás: el análisis de la IA y la identidad temática de los prompts.
      context,
      // Si ya hay etiqueta temática, el informe nace con ella para que los
      // prompts la lleven desde el primer momento.
      analysis: themeTag
        ? normalizeAnalysis({ identity: { themeTag } })
        : null,
      sounds: []
    };

    const updated = [...projects, newProject];
    await saveProjectsData(updated);
    setSelectedProjectId(newProject.id);
  };

  const handleHeroImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      const updated = projects.map(p =>
        p.id === selectedProjectId ? { ...p, coverImage: dataUrl } : p
      );
      await saveProjectsData(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCoverImage = async () => {
    const updated = projects.map(p =>
      p.id === selectedProjectId ? { ...p, coverImage: null } : p
    );
    await saveProjectsData(updated);
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      setSelectedImages(Array.from(e.target.files));
    }
  };

  // Carga el core mínimo del perfil de género como punto de partida de la lista
  // maestra. No es la lista final: se amplía con los condicionales del perfil.
  const handleLoadStandardTemplate = async () => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    const gameType = project.type || 'Slot';
    // La lista base se lee en el momento de la acción: es la del paquete de prompts vigente.
    const templateSounds = getActivePackage().templates[gameType];

    // El menú «Empezar la lista» ya muestra apagada esta opción cuando el género no tiene lista base.
    if (!templateSounds) return;

    const themeWarning = resolveThemeTag(project)
      ? ''
      : '\n\nEste proyecto todavía no tiene etiqueta temática: los prompts saldrán con una identidad neutra. Defínela en el informe de análisis (sección 4) y vuelve a cargar el core, o corrígelos a mano.';

    const ok = window.confirm(
      `Cargar el core mínimo de ${getProfile(gameType).label} (${templateSounds.length} assets) en "${project.name}".\n\n` +
      `Esto REEMPLAZA la lista maestra actual.${themeWarning}`
    );
    if (!ok) return;

    // La identidad temática del core es un marcador: se sustituye por la del
    // proyecto. Sin identidad definida todavía, queda la neutra y se avisa.
    const themeTag = resolveThemeTag(project);
    const clonedSounds = templateSounds.map(s =>
      createSound(s.id, { ...s, prompt: applyTheme(s.prompt, themeTag) })
    );

    const updated = projects.map(p =>
      p.id === selectedProjectId ? { ...p, sounds: clonedSounds } : p
    );

    await saveProjectsData(updated);
  };

  // Importar sonidos desde archivo CSV local
  const handleImportCSV = async (e) => {
    if (!selectedProjectId) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = parseCSVText(text);
      if (rows.length === 0) {
        alert('El archivo CSV está vacío o tiene un formato incorrecto.');
        return;
      }

      const confirmImport = window.confirm(`Se encontraron ${rows.length} sonidos en el CSV. ¿Deseas importarlos a la lista actual?`);
      if (!confirmImport) return;

      const updated = projects.map(p => {
        if (p.id === selectedProjectId) {
          return {
            ...p,
            sounds: [
              ...(p.sounds || []),
              ...rows
            ]
          };
        }
        return p;
      });

      await saveProjectsData(updated);
      alert('¡Importación de CSV completada con éxito!');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // El CSV se lee en el formato de la tabla maestra anterior y se convierte con
  // la misma migración que usan los datos guardados: así una hoja antigua sigue
  // sirviendo sin mantener dos caminos de conversión.
  const parseCSVText = (text) => {
    const delimiter = detectDelimiter(text);
    return parseCSVBody(text, delimiter)
      .filter(cells => cells[0])
      .map((cells, i) => migrateSound({
        id: cells[0] || `CSV_${Date.now()}_${i}`,
        eventKey: cells[1] || '',
        filename: cells[2] || '',
        type: cells[3] || 'FX',
        moment: cells[4] || '',
        target: cells[5] || '',
        duration: cells[6] || '',
        priority: cells[7] || 'Media',
        loop: cells[8] === 'Sí' || cells[8] === 'true' || cells[8] === '1',
        status: cells[9] || 'Pendiente',
        modulation: cells[10] || '',
        prompt: cells[11] || '',
        notes: cells[12] || '',
        driveLink: cells[13] || ''
      }));
  };

  // Ejecuta la llamada de análisis multimodal con el motor de IA elegido
  const handleAnalyzeGame = async () => {
    if (!selectedProjectId) return;

    const project = projects.find(p => p.id === selectedProjectId);
    setAnalyzing(true);
    try {
      // Unir imágenes seleccionadas en el panel con la imagen de portada del proyecto
      const imagesToAnalyze = [...selectedImages];
      if (project?.coverImage && !imagesToAnalyze.some(img => img === project.coverImage)) {
        imagesToAnalyze.unshift(project.coverImage);
      }

      // El contexto del proyecto es lo primero que se supo del juego: encabeza
      // la descripción para que la IA parta de ahí.
      const fullDescription = [
        project?.context,
        gameDescription,
        (!project?.context?.trim() && !gameDescription.trim())
          ? `Analizar las imágenes y arte visual adjuntos para el videojuego "${project?.name || 'Videojuego'}" (género ${project?.type || 'Slot'}). Identificar el escenario, estilo de arte, personajes, materiales táctiles y proponer la lista maestra de audio necesaria según las reglas de alcance.`
          : ''
      ]
        .filter(t => t && t.trim())
        .join('\n\n');

      // `analyzeGame` ya comprueba que el resultado trae una lista de sonidos y un
      // informe: si no, lanza antes de llegar aquí y NO se toca el proyecto. Sin esa
      // guarda, un resultado sin sonidos habría sustituido la lista entera por una vacía.
      const result = await analyzeGame(
        fullDescription,
        imagesToAnalyze,
        project?.type || 'Slot',
        project?.config || {},
        project?.discovery || {}
      );

      // La lista propuesta NO está aprobada: entra como pending_validation.
      // El sistema exige validar el alcance antes de producir nada.
      // Sanear antes de guardar: lo que devuelve un modelo no es de fiar aunque
      // el esquema lo restrinja. Se corrigen categorías, prefijos y valores
      // fuera del modelo, y se renumeran los IDs para que sean continuos.
      const proposed = sanitizeSoundList(result.sounds).map(s => ({
        ...s,
        planning_status: 'pending_validation'
      }));
      if (proposed.length === 0) {
        throw new Error('La IA no propuso ningún sonido válido. No se ha cambiado nada: vuelve a intentarlo.');
      }

      const updated = projects.map(p => {
        if (p.id === selectedProjectId) {
          return {
            ...p,
            analysis: normalizeAnalysis(result),
            sounds: proposed
          };
        }
        return p;
      });

      await saveProjectsData(updated);
      setGameDescription('');
      setSelectedImages([]);

      const pendientes = result.openQuestions?.length
        ? `\n\n${result.openQuestions.length} aspectos requieren tu validación: revísalos en el informe.`
        : '';
      alert(
        `Análisis completado: ${proposed.length} assets propuestos.\n\n` +
        `Todos entran como "Pendiente de validar". Revisa la lista maestra y apruébala antes de generar prompts.${pendientes}`
      );
    } catch (e) {
      console.error(e);
      // El mensaje de un AIError ya dice qué pasó y qué hacer. Lo que haya escrito la
      // persona (descripción, imágenes) se conserva para reintentar sin volver a cargarlo.
      alert(`No se pudo analizar con ${engineShortName()}.\n\n${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // Hoja de cálculo: Actualización de celda de sonido
  const handleUpdateSound = async (soundId, field, newValue) => {
    const updated = projects.map(p => {
      if (p.id === selectedProjectId) {
        return {
          ...p,
          sounds: p.sounds.map(s => {
            if (s.id === soundId) {
              return { ...s, [field]: newValue };
            }
            return s;
          })
        };
      }
      return p;
    });
    await saveProjectsData(updated);
  };

  // Importar una lista maestra en JSON, venga de donde venga.
  //
  // El análisis puede hacerse fuera de la app: la API no siempre está
  // disponible y una IA con el sistema completo en contexto produce mejor
  // resultado que el resumen que cabe en un prompt. Se importa desde archivo
  // porque un análisis real ronda los 50.000 caracteres: no cabe en un prompt
  // del navegador.
  const handleImportJSON = async (e) => {
    if (!selectedProjectId) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      alert('El archivo no contiene JSON válido.');
      return;
    }

    const rawSounds = Array.isArray(data) ? data : data.sounds;
    if (!Array.isArray(rawSounds) || rawSounds.length === 0) {
      alert(
        'El JSON no contiene una lista de sonidos.\n\n' +
        'Se admite el objeto completo del análisis (con gameAnalysis, identity y sounds) ' +
        'o directamente el array de sonidos.'
      );
      return;
    }

    const proposed = sanitizeSoundList(rawSounds).map(s => ({
      ...s,
      planning_status: 'pending_validation'
    }));

    const traeInforme = !Array.isArray(data) && (data.gameAnalysis || data.identity);
    const themeTag = data.identity?.themeTag;
    const scope = evaluateScope(
      selectedProject.type,
      selectedProject.config?.complexity_level || 'standard',
      proposed.length
    );

    const ok = window.confirm(
      `${file.name}\n\n` +
      `${proposed.length} assets · ${scope.message}\n` +
      (traeInforme ? 'Incluye informe de análisis, que también se importará.\n' : '') +
      (themeTag ? `Identidad temática: ${themeTag}\n` : '') +
      '\nEsto REEMPLAZA la lista maestra actual. Todos entran como "Pendiente de validar".'
    );
    if (!ok) return;

    const updated = projects.map(p => {
      if (p.id !== selectedProjectId) return p;
      return {
        ...p,
        analysis: traeInforme ? normalizeAnalysis(data) : p.analysis,
        sounds: proposed
      };
    });

    await saveProjectsData(updated);
  };

  // Lista maestra: añadir un asset vacío al final.
  // Los IDs son continuos y NUNCA se reutiliza uno descartado
  // (02_NAMING_AND_VERSIONING §7), por eso el siguiente sale del máximo
  // histórico, no del número de filas.
  const handleAddRow = async () => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    const lastIdNum = project.sounds.reduce((max, s) => {
      const num = parseInt(s.id, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const nextId = String(lastIdNum + 1).padStart(3, '0');

    const newSound = createSound(nextId, { category: 'FX' });

    const updated = projects.map(p =>
      p.id === selectedProjectId ? { ...p, sounds: [...p.sounds, newSound] } : p
    );
    await saveProjectsData(updated);
  };

  // Lista maestra: eliminar un asset
  const handleDeleteSound = async (soundId) => {
    if (!window.confirm(`¿Eliminar el asset ${soundId}? Su ID no se reutilizará.`)) return;

    const updated = projects.map(p => {
      if (p.id === selectedProjectId) {
        return {
          ...p,
          sounds: p.sounds.filter(s => s.id !== soundId)
        };
      }
      return p;
    });
    await saveProjectsData(updated);
  };

  // Manifiesto de integración para el programador.
  //
  // Solo entran los assets realmente entregados: exportar un asset sin aprobar
  // contradice el Principio 6 ("no asumir que un asset está aprobado o cargado")
  // y el checklist de entrega, que exige que no haya assets no aprobados.
  const handleExportJSON = () => {
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project || !project.sounds) return;

    const deliverable = project.sounds.filter(s =>
      s.review_status === 'approved' &&
      ['exported', 'delivered', 'loaded'].includes(s.delivery_status)
    );

    if (deliverable.length === 0) {
      alert(
        'Ningún asset cumple todavía las condiciones de entrega.\n\n' +
        'El manifiesto solo incluye assets con revisión aprobada y entrega en exportado, entregado o cargado.'
      );
      return;
    }

    const excluded = project.sounds.length - deliverable.length;
    if (excluded > 0) {
      const ok = window.confirm(
        `Se exportarán ${deliverable.length} de ${project.sounds.length} assets.\n\n` +
        `${excluded} quedan fuera por no tener la revisión aprobada o no estar entregados.\n\n¿Continuar?`
      );
      if (!ok) return;
    }

    const exportData = {
      gameName: project.name,
      gameType: project.type,
      generatedAt: new Date().toISOString(),
      technical: project.config?.technical || { format: 'WAV', sample_rate: 48000, bit_depth: 24 },
      counts: countAssets(project.sounds),
      sounds: deliverable.map(s => ({
        id: s.id,
        game_event: s.game_event,
        official_filename: s.official_filename,
        category: s.category,
        priority: s.priority,
        loop: s.loop,
        source_group: s.source_group,
        single_or_stems: s.single_or_stems,
        audioSource: s.audioSource || ''
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${project.name.toLowerCase().replace(/\s+/g, '_')}_audio_manifest.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Clave de un borrador de audio: el sonido solo es único dentro de su proyecto.
  const draftKey = (projectId, soundId) => `${projectId}:${soundId}`;

  const draftFor = (projectId, soundId) => audioDrafts[draftKey(projectId, soundId)] || null;

  // Hoja de cálculo y vista simple: generación por ElevenLabs
  const handleGenerateElevenLabs = async (soundId, promptText) => {
    const project = projects.find(p => p.id === selectedProjectId);
    const sound = (project?.sounds || []).find(x => x.id === soundId);
    if (!project || !sound) return;

    // Si el sonido ya tiene un enlace, el audio nuevo NO sustituye al que está en esa
    // dirección: el enlace seguiría apuntando a una versión que ya no corresponde al
    // prompt (feature 010, FR-036).
    if (sound.audioSource && !window.confirm(
      'Este sonido ya tiene un enlace registrado. Si lo generas de nuevo, el audio nuevo NO sustituirá al que está en ese enlace y tendrás que guardarlo y volver a pegar la dirección.\n\n¿Generar de todos modos?'
    )) return;

    const projectId = project.id;
    setGeneratingSoundId(soundId);
    try {
      // La duración se envía como parámetro: antes iba fija a 2,5 s para todos.
      const { blob, duration, extension } = await generateSoundEffect(promptText, sound.duration_seconds);

      // El audio es un borrador en memoria. Se libera el anterior de este sonido.
      const key = draftKey(projectId, soundId);
      const previous = audioDraftsRef.current[key];
      if (previous) URL.revokeObjectURL(previous.url);
      setAudioDrafts(prev => ({ ...prev, [key]: { url: URL.createObjectURL(blob), blob, extension } }));

      // Generar solo avanza el eje de producción. La revisión sigue pendiente: nadie
      // ha escuchado todavía el resultado (Principio 6). Se parte de la lista MÁS
      // RECIENTE, no de la que había al empezar: generar tarda segundos y la persona
      // pudo seguir editando.
      const latest = projectsRef.current.map(p => p.id !== projectId ? p : {
        ...p,
        sounds: p.sounds.map(s => s.id === soundId ? { ...s, production_status: 'generated' } : s)
      });
      await saveProjectsData(latest);

      // En la vista completa se mantiene el aviso de siempre; en la simple el
      // reproductor que aparece en la fila ya lo dice, y solo se interrumpe si hay
      // un ajuste de duración que explicar.
      if (viewMode === 'full' || duration.note) {
        alert('Efecto generado por ElevenLabs.' + (duration.note ? `\n\n${duration.note}` : ''));
      }
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setGeneratingSoundId(null);
    }
  };

  // Descarga el borrador con el nombre oficial del sonido y la extensión del formato
  // que REALMENTE se recibió (FR-032): llamar .wav a un MP3 sería mentir.
  const handleDownloadDraft = (soundId) => {
    const project = projects.find(p => p.id === selectedProjectId);
    const sound = (project?.sounds || []).find(x => x.id === soundId);
    const draft = project ? draftFor(project.id, soundId) : null;
    if (!sound || !draft) return;

    const stem = (sound.official_filename || `sonido_${soundId}`).replace(/\.[a-z0-9]+$/i, '');
    downloadBlob(`${stem}.${draft.extension}`, draft.blob);
  };

  // Actualización genérica del proyecto activo (ficha de descubrimiento,
  // complejidad, informe editable).
  const handleUpdateProject = async (updatedProject) => {
    const updated = projects.map(p =>
      p.id === selectedProjectId ? updatedProject : p
    );
    await saveProjectsData(updated);
  };

  // El informe es un documento de trabajo: la IA lo rellena y el director lo
  // corrige. Un error de lectura de imagen se propagaría a todas las fases.
  const handleUpdateAnalysis = async (analysis) => {
    const updated = projects.map(p =>
      p.id === selectedProjectId ? { ...p, analysis } : p
    );
    await saveProjectsData(updated);
  };

  // Una revisión no solo se anota: su decisión mueve los ejes del asset. Anotar
  // "hay que rehacerlo" sin devolver la producción a "regenerar" dejaría la
  // ficha y la tabla contando cosas distintas.
  const handleSubmitReview = async (review) => {
    if (!reviewTarget) return;

    const updated = projects.map(p => {
      if (p.id !== selectedProjectId) return p;
      return {
        ...p,
        sounds: p.sounds.map(s => s.id === reviewTarget.id ? applyReview(s, review) : s)
      };
    });

    await saveProjectsData(updated);
    setReviewTarget(null);
  };

  // Configuración del proyecto activo (spec 007). Las restricciones son por
  // proyecto, nunca globales: el Artículo VIII lo exige.
  const handleUpdateProjectConfig = async (config) => {
    const updated = projects.map(p =>
      p.id === selectedProjectId ? { ...p, config } : p
    );
    await saveProjectsData(updated);
  };

  // Los WAV masterizados no se suben: viven donde ya los tienes (disco local,
  // Drive, servidor del estudio). La app guarda dónde están, no los archivos.
  // Así no se duplican gigas ni se necesita almacenamiento de binarios.
  const handleSetAudioSource = async (soundId, source) => {
    const value = (source || '').trim();

    const updated = projects.map(p => {
      if (p.id !== selectedProjectId) return p;
      return {
        ...p,
        sounds: p.sounds.map(s => {
          if (s.id !== soundId) return s;
          // Registrar la ruta no aprueba nada ni marca entrega: solo dice dónde
          // está el archivo. El avance de los ejes lo decide una persona.
          return { ...s, audioSource: value };
        })
      };
    });

    await saveProjectsData(updated);
  };

  // Aprobar para producción (feature 010, FR-048). Es la decisión de una persona sobre
  // qué sonidos quiere producir: mueve SOLO `planning_status`, y solo el de los sonidos
  // indicados. Una sola escritura aunque sean muchos. Nunca ocurre por sí sola
  // (Principio 6); la generación y la entrega no se tocan.
  const handleApproveSounds = async (ids, approved) => {
    const target = new Set(ids);
    if (target.size === 0) return;
    const next = approved ? 'approved_for_production' : 'pending_validation';

    const updated = projects.map(p => p.id !== selectedProjectId ? p : {
      ...p,
      sounds: p.sounds.map(s => target.has(s.id) ? { ...s, planning_status: next } : s)
    });
    await saveProjectsData(updated);
  };

  // El ejemplo, un juego ficticio (FR-060 a FR-062). Se carga SOLO a petición. Cargarlo
  // añade (o repone) un único proyecto con id fijo y no toca ningún otro.
  const handleLoadExample = async () => {
    const exists = projects.some(p => p.id === EXAMPLE_PROJECT_ID);
    if (exists && !window.confirm(
      'Ya tienes cargado el ejemplo. Volver a cargarlo lo deja como al principio y borra los cambios que le hayas hecho. Tus otros juegos no se tocan.\n\n¿Continuar?'
    )) return;

    const fresh = { ...structuredClone(EXAMPLE_PROJECT), createdAt: new Date().toISOString() };
    const others = projects.filter(p => p.id !== EXAMPLE_PROJECT_ID);

    // Los borradores de audio del ejemplo anterior ya no corresponden a nada.
    Object.keys(audioDraftsRef.current)
      .filter(k => k.startsWith(`${EXAMPLE_PROJECT_ID}:`))
      .forEach(k => URL.revokeObjectURL(audioDraftsRef.current[k].url));
    setAudioDrafts(prev => Object.fromEntries(
      Object.entries(prev).filter(([k]) => !k.startsWith(`${EXAMPLE_PROJECT_ID}:`))
    ));

    await saveProjectsData([...others, fresh]);
    // Se selecciona solo si es lo único que hay, o si ya se estaba mirando: quien tiene
    // otros juegos no pierde de vista el suyo porque haya pedido ver el ejemplo.
    if (others.length === 0 || selectedProjectId === fresh.id) setSelectedProjectId(fresh.id);
  };

  // La herramienta no tiene borrado general de proyectos; esto actúa SOLO sobre el
  // ejemplo, por su id fijo (FR-062).
  const handleRemoveExample = async () => {
    if (!window.confirm('Se quitará el ejemplo. Tus otros juegos no se tocan, y podrás volver a cargarlo cuando quieras.\n\n¿Quitarlo?')) return;

    const remaining = projects.filter(p => p.id !== EXAMPLE_PROJECT_ID);
    await saveProjectsData(remaining);
    if (selectedProjectId === EXAMPLE_PROJECT_ID) setSelectedProjectId(remaining[0]?.id || '');
  };

  // Exportar el documento para el equipo del juego (FR-037). Solo LEE: no modifica el
  // proyecto (FR-044).
  const handleExportDelivery = (format, ids) => {
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    const chosen = new Set(ids);
    const linked = (project.sounds || []).filter(s => chosen.has(s.id) && String(s.audioSource || '').trim());
    if (linked.length === 0 && !window.confirm(
      'Ningún sonido de esta lista tiene enlace todavía: el documento los mostrará todos como pendientes.\n\n¿Exportar igualmente?'
    )) return;

    if (format === 'xlsx') downloadEntregaXLSX(project, ids);
    else downloadEntregaHTML(project, ids);
  };

  const changeView = (mode) => {
    setViewMode(mode);
    setViewModeState(mode);
  };

  const toggleGuide = () => {
    setGuideHidden(!guideHidden);
    setGuideHiddenState(!guideHidden);
  };

  // El paso de la guía NO se guarda: se deduce del estado, como la fase activa del
  // pipeline. Es el PRIMER paso cuya condición de «completo» aún no se cumple, así que
  // si la persona retrocede (borra una clave, edita la lista) la guía la acompaña.
  const getGuideStep = (project, engineReady) => {
    if (!engineReady) return 0;

    const listed = (project?.sounds || []).filter(s => s.category !== 'MIX' && !isDiscarded(s));
    if (!project?.analysis && listed.length === 0) return 1;

    const approved = listed.filter(s => s.planning_status === 'approved_for_production');
    if (approved.length === 0) return 2;
    if (!approved.some(s => String(s.audioSource || '').trim())) return 3;
    return 4;
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Las siete fases de 04_PRODUCTION_WORKFLOW.md.
  const PIPELINE_PHASES = [
    { n: 1, label: 'Descubrimiento', desc: 'Imágenes, tipo de juego y perfil' },
    { n: 2, label: 'Análisis', desc: 'Contexto, materiales e identidad' },
    { n: 3, label: 'Alcance', desc: 'Lista maestra validada' },
    { n: 4, label: 'Producción', desc: 'Prompts y generación' },
    { n: 5, label: 'Capas', desc: 'Stems y sincronización' },
    { n: 6, label: 'Revisión', desc: 'Escucha y aprobación' },
    { n: 7, label: 'Entrega', desc: 'Exportar, cargar e integrar' }
  ];

  // La fase activa es la más temprana con trabajo pendiente: el sistema exige
  // validar antes de producir, así que no se salta hacia adelante porque un
  // asset suelto haya avanzado.
  const getActivePipelineStep = (project) => {
    if (!project) return 1;
    if (!project.analysis) return 1;

    const sounds = project.sounds || [];
    if (sounds.length === 0) return 2;

    // Fase 3: mientras haya assets sin validar, el alcance no está cerrado.
    if (sounds.some(s => ['detected', 'pending_validation'].includes(s.planning_status))) return 3;

    const active = sounds.filter(s => s.planning_status === 'approved_for_production');
    if (active.length === 0) return 3;

    if (active.some(s => s.production_status === 'not_generated')) return 4;
    if (active.some(s => s.single_or_stems === 'stems' && ['pending', 'in_progress'].includes(s.mix_status))) return 5;
    if (active.some(s => ['not_reviewed', 'in_review', 'changes_requested'].includes(s.review_status))) return 6;
    return 7;
  };

  const currentStep = selectedProject ? getActivePipelineStep(selectedProject) : 1;
  const counts = selectedProject ? countAssets(selectedProject.sounds || []) : null;
  const scope = selectedProject
    ? evaluateScope(
        selectedProject.type || 'Slot',
        selectedProject.config?.complexity_level || 'standard',
        counts.official_asset_count
      )
    : null;

  // Lo que necesitan las dos vistas para saber si pueden analizar y generar.
  const engineReady = hasEngineKey();
  const elevenLabsReady = hasKey('elevenlabs');
  const guideStep = getGuideStep(selectedProject, engineReady);

  // La tabla y el tablero reproducen `localBlobUrl`. El borrador vive en memoria, así
  // que se inyecta solo al pintar y nunca entra en el proyecto que se guarda.
  const soundsForViews = (selectedProject?.sounds || []).map(sound => {
    const draft = draftFor(selectedProject.id, sound.id);
    return draft ? { ...sound, localBlobUrl: draft.url } : sound;
  });

  const draftsForSimpleView = Object.fromEntries(
    (selectedProject?.sounds || [])
      .map(sound => [sound.id, draftFor(selectedProject.id, sound.id)])
      .filter(([, draft]) => draft)
  );

  const exampleBanner = selectedProject?.id === EXAMPLE_PROJECT_ID && (
    <div className="example-banner" role="note">
      <span>
        📘 <strong>Estás viendo el ejemplo, un juego inventado.</strong> Sirve para leer y aprender: no lleva
        audios ni enlaces, y tus propios juegos no se ven afectados.
      </span>
      <button type="button" className="simple-secondary-btn" onClick={handleRemoveExample}>
        Quitar el ejemplo
      </button>
    </div>
  );

  return (
    <div className="project-manager-container">
      {/* Barra superior: identidad + selector del juego activo + ajustes.
          Sustituye a la antigua barra lateral, que restaba ancho a una tabla
          maestra de 21 columnas. */}
      <Header onOpenConfig={onOpenConfig} viewMode={viewMode} onChangeView={changeView}>
        <ProjectSwitcher
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onCreate={handleCreateProject}
          loading={loadingDb}
        />
      </Header>


      {/* Contenido Principal: Hoja de Cálculo e Informes */}
      <div className="project-content-area">
        {/* Estado del almacenamiento. La nube es Vercel Blob a través de
            /api/db; el respaldo local se escribe siempre en paralelo. */}
        {viewMode === 'full' && (
          <div className={`sync-banner ${storageStatus.mode === 'cloud' ? 'connected' : 'local'}`}>
            <div className="banner-info">
              <span className="banner-indicator"></span>
              {storageStatus.mode === 'cloud' ? (
                <span>
                  <strong>Sincronizado en la nube</strong>. Tus proyectos están disponibles desde
                  cualquier dispositivo, con respaldo local automático en este navegador.
                  {storageStatus.lastSyncAt && (
                    <span className="banner-timestamp">
                      {' '}Último guardado: {new Date(storageStatus.lastSyncAt).toLocaleString('es')}
                    </span>
                  )}
                </span>
              ) : (
                <span>
                  <strong>Modo local</strong>. Todo se guarda en este navegador. La nube no está
                  disponible {saveWarning === 'local' ? '(el último guardado no se sincronizó)' : '(normal en desarrollo con npm run dev)'}.
                </span>
              )}
            </div>
            <div className="banner-actions">
              <button
                onClick={() => storageService.exportBackup()}
                className="banner-btn"
                title="Descargar toda la base de proyectos como archivo JSON"
              >
                Descargar respaldo
              </button>
            </div>
          </div>
        )}

        {loadingDb && !selectedProject ? (
          <p className="simple-hint">Cargando tus juegos…</p>
        ) : viewMode === 'simple' ? (
          <>
            {exampleBanner}
            <SimplePromptView
              project={selectedProject || null}
              engineLabel={describeEngine()}
              engineKeyReady={engineReady}
              imageSupport={engineSupportsImages(getEngine())}
              elevenLabsReady={elevenLabsReady}
              guideStep={guideStep}
              guideHidden={guideHidden}
              onToggleGuide={toggleGuide}
              onOpenConfig={onOpenConfig}
              images={selectedImages}
              onImagesChange={handleImageChange}
              description={gameDescription}
              onDescriptionChange={setGameDescription}
              analyzing={analyzing}
              onAnalyze={handleAnalyzeGame}
              drafts={draftsForSimpleView}
              generatingId={generatingSoundId}
              onUpdatePrompt={(id, text) => handleUpdateSound(id, 'prompt', text)}
              onApprove={handleApproveSounds}
              onGenerate={(id) => {
                const sound = (selectedProject?.sounds || []).find(x => x.id === id);
                return handleGenerateElevenLabs(id, sound?.prompt || '');
              }}
              onDownloadDraft={handleDownloadDraft}
              onSetAudioSource={handleSetAudioSource}
              onCopyPrompts={handleCopyPrompts}
              onExport={handleExportDelivery}
              notice={copyNotification}
              onCreateProject={handleCreateProject}
              onLoadExample={handleLoadExample}
              exampleLoaded={projects.some(p => p.id === EXAMPLE_PROJECT_ID)}
            />
          </>
        ) : selectedProject ? (
          <div className="project-detail-layout">
            {exampleBanner}

            
            {/* Las siete fases de 04_PRODUCTION_WORKFLOW */}
            <div className="dashboard-card pipeline-card">
              <div className="pipeline-steps-container">
                {PIPELINE_PHASES.map((phase, i) => (
                  <React.Fragment key={phase.n}>
                    {i > 0 && <div className="pipeline-connector">➔</div>}
                    <div className={`pipeline-step ${currentStep === phase.n ? 'active' : ''} ${currentStep > phase.n ? 'completed' : ''}`}>
                      <span className="step-number">{phase.n}</span>
                      <span className="step-label">{phase.label}</span>
                      <span className="step-desc">{phase.desc}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Hero del Proyecto: Nombre, Tipo, Arte Visual y Estado */}
            <div className="dashboard-card project-hero-card">
              <div className="project-hero-main">
                <div className="project-hero-art-area">
                  {selectedProject.coverImage ? (
                    <div className="project-hero-art-wrapper">
                      <img src={selectedProject.coverImage} alt={selectedProject.name} className="project-hero-art-img" />
                      <div className="project-hero-art-overlay">
                        <button
                          className="project-hero-change-btn"
                          onClick={() => heroImageInputRef.current?.click()}
                          title="Cambiar imagen de referencia"
                        >
                          🔄 Cambiar arte
                        </button>
                        <button
                          className="project-hero-remove-btn"
                          onClick={handleRemoveCoverImage}
                          title="Quitar imagen"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="project-hero-upload-dropzone"
                      onClick={() => heroImageInputRef.current?.click()}
                      title="Sube una captura, logo o boceto del juego"
                    >
                      <span className="upload-dropzone-icon">🖼️</span>
                      <span className="upload-dropzone-text">Subir arte del juego</span>
                      <span className="upload-dropzone-hint">Contexto visual para la IA</span>
                    </button>
                  )}
                  <input
                    type="file"
                    ref={heroImageInputRef}
                    onChange={handleHeroImageUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>

                <div className="project-hero-details">
                  <div className="project-hero-title-row">
                    <h1 className="project-hero-title">{selectedProject.name}</h1>
                    <div className="project-hero-badges">
                      <span className="hero-badge genre">{getProfile(selectedProject.type).label}</span>
                      <span className="hero-badge complexity">
                        {COMPLEXITY_LEVELS.find(c => c.key === (selectedProject.config?.complexity_level || 'standard'))?.label || 'Estándar'}
                      </span>
                      {selectedProject.coverImage ? (
                        <span className="hero-badge visual-ready">🎨 Contexto visual activo</span>
                      ) : (
                        <span className="hero-badge visual-pending">📷 Sin imagen de contexto</span>
                      )}
                    </div>
                  </div>
                  <p className="project-hero-context">
                    {selectedProject.context || 'Sin descripción o contexto visual definido todavía. Sube una imagen o añade notas en Descubrimiento para guiar a la IA.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Conteos y alcance: un Mega Win es 1 asset oficial, no 9 sonidos */}
            <div className="dashboard-card counts-card">
              <div className="counts-grid">
                <div className="count-item primary">
                  <span className="count-value">{counts.official_asset_count}</span>
                  <span className="count-label">En alcance</span>
                </div>
                {counts.discarded_asset_count > 0 && (
                  <div className="count-item muted">
                    <span className="count-value">{counts.discarded_asset_count}</span>
                    <span className="count-label">Descartados</span>
                  </div>
                )}
                <div className="count-item">
                  <span className="count-value">{counts.variant_count}</span>
                  <span className="count-label">Variantes</span>
                </div>
                <div className="count-item">
                  <span className="count-value">{counts.stem_count}</span>
                  <span className="count-label">Stems</span>
                </div>
                <div className="count-item">
                  <span className="count-value">{counts.generated_file_count}</span>
                  <span className="count-label">Generados</span>
                </div>
                <div className="count-item">
                  <span className="count-value">{counts.approved_asset_count}</span>
                  <span className="count-label">Aprobados</span>
                </div>
                <div className="count-item">
                  <span className="count-value">{counts.delivered_asset_count}</span>
                  <span className="count-label">Entregados</span>
                </div>
              </div>
              <div className={`scope-hint scope-${scope.level}`}>
                {scope.message}
              </div>
            </div>

            {/* Banner de bienvenida / API Key si no hay clave detectada */}
            {!engineReady && (
              <div className="api-key-banner">
                <div className="banner-content">
                  <span className="banner-icon">🔑</span>
                  <div>
                    <strong>Falta la clave de {engineShortName()}:</strong> pégala en Configuración (⚙️) para generar automáticamente la lista maestra y los prompts de tu juego. Con Gemini también puedes ponerla en un archivo <code>.env</code> como <code>VITE_GEMINI_API_KEY=tu_clave</code>.
                  </div>
                </div>
                <div className="banner-actions">
                  <button className="banner-config-btn" onClick={onOpenConfig}>
                    ⚙️ Configurar Token
                  </button>
                  <span className="banner-tip">
                    Elige tu proveedor en Configuración
                  </span>
                </div>
              </div>
            )}

            {/* Fase 1 — Descubrimiento. Es la primera pantalla de un proyecto
                sin analizar; después se colapsa pero sigue editable. */}
            <DiscoveryPanel
              engineName={engineShortName()}
              project={selectedProject}
              onUpdateProject={handleUpdateProject}
              onAnalyze={handleAnalyzeGame}
              analyzing={analyzing}
              images={selectedImages}
              onImagesChange={handleImageChange}
              description={gameDescription}
              onDescriptionChange={(e) => setGameDescription(e.target.value)}
              collapsed={Boolean(selectedProject.analysis) && !showDiscovery}
              onToggleCollapse={() => setShowDiscovery(!showDiscovery)}
            />

            {/* Fase 2 — Informe de análisis visual, editable. */}
            {selectedProject.analysis && (
              <AnalysisReport
                project={selectedProject}
                analysis={selectedProject.analysis}
                onUpdateAnalysis={handleUpdateAnalysis}
                collapsed={!showAnalysisReport}
                onToggleCollapse={() => setShowAnalysisReport(!showAnalysisReport)}
              />
            )}

            {/* Contenedor del listado / Tablero Kanban */}
            <div className="dashboard-card spreadsheet-card">
              <div className="spreadsheet-card-header">
                <h2>📊 Plan de Sonido: {selectedProject.name}</h2>
                <div className="view-toggle-buttons" style={{ marginRight: 'auto', marginLeft: '1.5rem' }}>
                  <button 
                    className={`view-toggle-btn ${activeView === 'excel' ? 'active' : ''}`}
                    onClick={() => setActiveView('excel')}
                  >
                    📄 Excel
                  </button>
                  <button 
                    className={`view-toggle-btn ${activeView === 'kanban' ? 'active' : ''}`}
                    onClick={() => setActiveView('kanban')}
                  >
                    📋 Tareas (Kanban)
                  </button>
                </div>
                <label
                  className="advanced-toggle"
                  title="Muestra revisión, mezcla y entrega, la acción Revisar de cada fila y las importaciones"
                >
                  <input
                    type="checkbox"
                    checked={showAdvanced}
                    onChange={(e) => toggleAdvanced(e.target.checked)}
                  />
                  <span>Opciones avanzadas</span>
                </label>
                <div className="header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {/* Empezar la lista: la base del género y, con opciones avanzadas, importar */}
                  <DropdownMenu
                    label="⚡ Empezar la lista ▾"
                    title="Poner una lista de sonidos para empezar a trabajar"
                    triggerClassName="load-template-btn"
                    align="left"
                    items={buildStartOptions({
                      genreLabel: getProfile(selectedProject.type).label,
                      templateCount: promptPackage.templates[selectedProject.type || 'Slot']?.length || 0,
                      showAdvanced
                    })}
                    onSelect={(item) => {
                      if (item.key === 'template') handleLoadStandardTemplate();
                      if (item.key === 'json') fileInputRefJSON.current?.click();
                      if (item.key === 'csv') fileInputRefCSV.current?.click();
                    }}
                  />
                  <input
                    type="file"
                    ref={fileInputRefJSON}
                    onChange={handleImportJSON}
                    style={{ display: 'none' }}
                    accept=".json,application/json"
                  />
                  <input
                    type="file"
                    ref={fileInputRefCSV}
                    onChange={handleImportCSV}
                    style={{ display: 'none' }}
                    accept=".csv"
                  />

                  <button className="add-row-btn" onClick={handleAddRow}>
                    + Fila
                  </button>
                  <button
                    className="project-config-btn"
                    onClick={() => setShowProjectConfig(true)}
                    title="Complejidad, política de voz y restricciones de este juego"
                  >
                    🎛️ Ajustes del juego
                  </button>
                  <button
                    className="copy-prompts-btn"
                    onClick={handleCopyPrompts}
                    title="Copiar todos los prompts para generadores de audio externos (Suno, Udio, ElevenLabs)"
                  >
                    {copyNotification || '📋 Copiar Prompts'}
                  </button>

                  <div className="export-menu-container" ref={exportMenuRef}>
                    <button
                      className="export-json-btn"
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      title="Opciones de exportación para motor y desarrollo"
                    >
                      📥 Exportar ▾
                    </button>
                    {showExportMenu && (
                      <div className="export-dropdown-menu">
                        <button
                          className="export-dropdown-item"
                          onClick={() => {
                            downloadFullProjectJSON(selectedProject);
                            setShowExportMenu(false);
                          }}
                        >
                          <strong>📥 Lista Completa con Prompts (JSON)</strong>
                          <small>Todos los assets con prompts, eventos y duraciones</small>
                        </button>
                        <button
                          className="export-dropdown-item"
                          onClick={() => {
                            downloadEngineManifest(selectedProject);
                            setShowExportMenu(false);
                          }}
                        >
                          <strong>🎮 Manifiesto de Motor (JSON)</strong>
                          <small>Mapeo evento ➔ archivo para Godot, Unity, Pixi</small>
                        </button>
                        <button
                          className="export-dropdown-item"
                          onClick={() => {
                            downloadEntregaHTML(selectedProject);
                            setShowExportMenu(false);
                          }}
                        >
                          <strong>🌐 Hoja Web de Entrega (HTML)</strong>
                          <small>Visualizador interactivo independiente con buscador</small>
                        </button>
                        <button
                          className="export-dropdown-item"
                          onClick={() => {
                            handleExportJSON();
                            setShowExportMenu(false);
                          }}
                        >
                          <strong>✓ Solo Assets Aprobados (JSON)</strong>
                          <small>Manifiesto estricto para producción final</small>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {activeView === 'excel' ? (
                <SoundSpreadsheet
                  sounds={soundsForViews}
                  onUpdateSound={handleUpdateSound}
                  onGenerateSound={handleGenerateElevenLabs}
                  onSetAudioSource={handleSetAudioSource}
                  themeTag={resolveThemeTag(selectedProject)}
                  onComposePrompt={setComposerTarget}
                  onReviewSound={setReviewTarget}
                  onDeleteSound={handleDeleteSound}
                  generatingSoundId={generatingSoundId}
                  onDownloadDraft={handleDownloadDraft}
                  showAdvanced={showAdvanced}
                />
              ) : (
                <SoundKanbanBoard
                  sounds={soundsForViews}
                  onUpdateSound={handleUpdateSound}
                  onGenerateSound={handleGenerateElevenLabs}
                  onSetAudioSource={handleSetAudioSource}
                  themeTag={resolveThemeTag(selectedProject)}
                  onComposePrompt={setComposerTarget}
                  onReviewSound={setReviewTarget}
                  onDeleteSound={handleDeleteSound}
                  generatingSoundId={generatingSoundId}
                />
              )}
            </div>

          </div>
        ) : (
          <EmptyStart
            onCreate={handleCreateProject}
            onLoadExample={handleLoadExample}
            exampleLoaded={projects.some(p => p.id === EXAMPLE_PROJECT_ID)}
          />
        )}
      </div>

      {reviewTarget && (
        <SoundReviewPanel
          sound={reviewTarget}
          onSubmit={handleSubmitReview}
          onClose={() => setReviewTarget(null)}
        />
      )}

      {composerTarget && selectedProject && (
        <PromptComposerPanel
          sound={composerTarget}
          config={selectedProject.config}
          themeTag={resolveThemeTag(selectedProject)}
          onApply={(prompt) => {
            handleUpdateSound(composerTarget.id, 'prompt', prompt);
            setComposerTarget(null);
          }}
          onClose={() => setComposerTarget(null)}
        />
      )}

      {showProjectConfig && selectedProject && (
        <ProjectConfigPanel
          project={selectedProject}
          onUpdateConfig={handleUpdateProjectConfig}
          onClose={() => setShowProjectConfig(false)}
        />
      )}
    </div>
  );
};

export default ProjectManager;
