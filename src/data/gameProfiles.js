// Perfiles de audio por tipo de videojuego.
//
// Implementa specs/reference/game-profiles/ y specs/reference/scope-templates/.
//
// Principio del sistema (constitución, Artículo I): la cantidad de sonidos NO se
// fija de forma universal, se calcula según género, mecánicas, símbolos animados,
// modos, niveles de premio, música, ambientes, variantes y necesidad de stems.
// Por eso cada perfil trae rangos por complejidad, no un número.

export const gameProfiles = {
  Slot: {
    key: 'Slot',
    label: 'Slot / Tragamonedas',
    objective: 'Slots clásicos, video slots, cluster slots y slots con bonus.',
    ranges: { basic: [16, 20], standard: [16, 28], advanced: [26, 42] },
    categories: [
      'UI', 'Rodillos', 'Resolución', 'Símbolos', 'WILD', 'SCATTER', 'Bonus',
      'Free Spins', 'Contadores', 'Premios', 'BGM', 'Ambientes', 'Recursos de mezcla'
    ],
    coreMinimum: [
      'BGM_base_game (Fondo base)', 'BGM_modal (Fondo modal)', 'BGM_freespins (Fondo free spins)',
      'UI_click (Click genérico)', 'UI_click_play (Click botón jugar)', 'MEC_reel_start (Arranque rodillos)',
      'MEC_reel_end (Parada rodillos)', 'SYM_symbol_match (Línea ganadora)', 'STG_big_win (Gran premio)',
      'STG_mega_win (Mega premio)', 'STG_super_mega_win (Super mega premio)', 'STG_epic_win (Epic premio)',
      'STG_freespins_start (Entrada free spins)', 'STG_freespins_end (Salida free spins)',
      'MEC_reel_spin (Giro rodillos)', 'MEC_win_increase (Contador subiendo)'
    ],
    conditionals: 'Cascadas, multiplicadores, sticky symbols, expanding wild, walking wild, collect, hold and win, respin, mystery symbol, jackpot, buy bonus, gamble, reacciones de personajes, animaciones específicas o música dinámica.',
    formula: '16 assets base del equipo + símbolos especiales (Wild/Scatter) + features confirmadas en GDD + modos extra + recursos de mezcla',
    questions: [
      { key: 'reels', label: 'Rodillos', type: 'number', hint: 'Columnas del tablero' },
      { key: 'rows', label: 'Filas', type: 'number' },
      { key: 'pay_system', label: 'Sistema de pago', type: 'text', hint: 'Líneas, ways, cluster, megaways...' },
      { key: 'regular_symbols', label: 'Símbolos regulares', type: 'number' },
      { key: 'animated_regular_symbols', label: 'Símbolos regulares animados', type: 'number', hint: 'Solo estos necesitan sonido propio' },
      { key: 'special_symbols', label: 'Símbolos especiales', type: 'number' },
      { key: 'wild_types', label: 'Tipos de WILD', type: 'text', hint: 'Normal, expanding, walking, sticky...' },
      { key: 'scatter_types', label: 'Tipos de SCATTER', type: 'text' },
      { key: 'bonus_modes', label: 'Modos de bonus', type: 'number' },
      { key: 'free_spin_modes', label: 'Modos de Free Spins', type: 'number' },
      { key: 'win_tiers', label: 'Niveles de premio', type: 'number', hint: 'Small, Big, Mega, Epic...' },
      { key: 'jackpot_tiers', label: 'Niveles de jackpot', type: 'number' },
      { key: 'characters', label: 'Personajes o mascotas', type: 'text' },
      { key: 'character_voice', label: '¿El personaje tiene voz?', type: 'boolean', hint: 'Requiere activar la voz en la configuración' },
      { key: 'cascades', label: '¿Hay cascadas?', type: 'boolean' },
      { key: 'respins', label: '¿Hay respins?', type: 'boolean' },
      { key: 'dynamic_music', label: '¿La música es dinámica?', type: 'boolean', hint: 'Cambia con el estado del juego' }
    ],
    risks: [
      'Crear sonidos para símbolos que no se animan.',
      'Hacer UI demasiado brillante.',
      'Confundir anticipación con premio.',
      'Crear premios sin jerarquía.',
      'No separar bonus trigger de free spins intro.',
      'Forzar BGM diferente para cada modo sin necesidad.'
    ],
    scope: {
      basic: {
        range: [16, 20],
        breakdown: { UI: [2, 2], 'Mecánicas': [4, 5], 'Símbolos': [1, 2], Premios: [4, 4], BGM: [3, 3], 'Recursos de mezcla': [1, 2] },
        suitedFor: 'Slot base de 16 assets oficiales del equipo con mecánicas directas y sin bloat.'
      },
      standard: {
        range: [16, 28],
        breakdown: { UI: [2, 3], 'Mecánicas': [4, 6], 'Símbolos': [2, 5], 'Modos/Free Spins': [2, 4], Premios: [4, 5], BGM: [3, 3], 'Recursos de mezcla': [1, 2] },
        suitedFor: 'Video slot comercial estándar: 16 assets base más Wild, Scatter y features confirmadas en el GDD.'
      },
      advanced: {
        range: [26, 42],
        features: 'Múltiples modos, Hold and Win, cascadas, antebet, compra de bono y jackpots confirmados.'
      }
    }
  },

  Crash: {
    key: 'Crash',
    label: 'Crash / Multiplicador',
    objective: 'Juegos donde un multiplicador aumenta hasta un evento de crash y el usuario decide cuándo retirar.',
    ranges: { basic: [10, 16], standard: [16, 26], advanced: [26, 40] },
    categories: [
      'UI de apuesta', 'Cuenta regresiva', 'Inicio', 'Ascenso', 'Tensión',
      'Cashout', 'Crash', 'Historial', 'Mascota o vehículo', 'BGM', 'Loops', 'Eventos especiales'
    ],
    coreMinimum: [
      'Bet increase/decrease', 'Bet confirm', 'Auto cashout toggle', 'Round countdown',
      'Launch', 'Multiplier loop', 'Low tension layer', 'High tension layer',
      'Cashout', 'Big cashout', 'Crash', 'Round reset', 'Error', 'BGM base'
    ],
    // Escalabilidad dinámica: no es obligatorio un archivo por valor.
    // Usar capas y parámetros del motor cuando sea posible.
    multiplierRanges: ['1.00x_to_1.49x', '1.50x_to_2.99x', '3.00x_to_9.99x', '10.00x_plus'],
    questions: [
      { key: 'theme', label: 'Tema visual', type: 'text', hint: 'Espacial, urbano, retro...' },
      { key: 'vehicle_or_character', label: 'Vehículo o personaje', type: 'text', hint: 'Qué es lo que asciende' },
      { key: 'countdown', label: '¿Hay cuenta regresiva?', type: 'boolean' },
      { key: 'multiplier_speed', label: 'Velocidad del multiplicador', type: 'text', hint: 'Constante, acelerada, por tramos' },
      { key: 'cashout_types', label: 'Tipos de cobro', type: 'text', hint: 'Manual, automático, parcial' },
      { key: 'crash_visual', label: 'Cómo es visualmente el crash', type: 'text' },
      { key: 'special_rounds', label: 'Rondas especiales', type: 'text' },
      { key: 'voice_allowed', label: '¿Se permite voz?', type: 'boolean' },
      { key: 'music_dynamic', label: '¿La música es dinámica?', type: 'boolean' },
      { key: 'risk_tiers', label: 'Niveles de riesgo', type: 'number', hint: 'Tramos de multiplicador con tensión propia' }
    ],
    risks: [
      'Tensión demasiado intensa desde el inicio.',
      'Crash demasiado agresivo.',
      'Cashout pequeño sonando como jackpot.',
      'Loop del multiplicador fatigante.',
      'No dejar espacio para UI.'
    ],
    scope: {
      basic: {
        range: [10, 16],
        breakdown: { UI: [2, 4], 'Cuenta regresiva e inicio': [2, 3], Multiplicador: [2, 3], Cashout: [2, 3], 'Crash/reset': [2, 2], BGM: [1, 1] }
      },
      standard: {
        range: [16, 26],
        breakdown: { UI: [3, 5], Inicio: [2, 3], 'Multiplicador dinámico': [3, 5], Cashout: [2, 4], Crash: [2, 3], 'Mascota/vehículo': [2, 4], BGM: [1, 2], 'Eventos especiales': [1, 3] }
      },
      advanced: {
        range: [26, 40],
        features: 'Capas dinámicas, rangos de riesgo, eventos especiales, variantes de crash y música adaptativa.'
      }
    }
  },

  CasinoTable: {
    key: 'CasinoTable',
    label: 'Casino de mesa',
    objective: 'Ruleta, blackjack, baccarat, dados, poker simplificado y wheel games.',
    ranges: { basic: [10, 18], standard: [18, 30], advanced: [30, 48] },
    categories: [
      'Fichas', 'Cartas', 'Bola', 'Ruleta', 'Dados', 'Mesa', 'Turnos',
      'Apuestas', 'Ganancias', 'Dealer', 'UI', 'Ambiente'
    ],
    questions: [
      { key: 'table_game_type', label: 'Juego de mesa', type: 'text', hint: 'Ruleta, blackjack, baccarat, dados...' },
      { key: 'dealer_voice', label: '¿El crupier habla?', type: 'boolean', hint: 'Requiere activar el habla en la configuración' },
      { key: 'chip_material', label: 'Material de las fichas', type: 'text', hint: 'Arcilla, plástico, cerámica' },
      { key: 'table_surface', label: 'Superficie de la mesa', type: 'text', hint: 'Fieltro, madera, cuero' },
      { key: 'card_handling', label: 'Manejo de cartas', type: 'text', hint: 'Barajado, reparto, revelado' },
      { key: 'betting_phases', label: 'Fases de apuesta', type: 'text' },
      { key: 'win_types', label: 'Tipos de victoria', type: 'text' },
      { key: 'loss_types', label: 'Tipos de derrota', type: 'text' },
      { key: 'special_events', label: 'Eventos especiales', type: 'text' }
    ],
    risks: [
      'Foley irreal.',
      'Exceso de monedas en juegos de fichas.',
      'Voz no autorizada.',
      'Ambiente de casino demasiado denso.'
    ]
  },

  Puzzle: {
    key: 'Puzzle',
    label: 'Puzzle',
    objective: 'Juegos de tablero, match y combinación.',
    ranges: { basic: [12, 20], standard: [20, 35], advanced: [35, 55] },
    categories: [
      'Selección', 'Movimiento', 'Match', 'Chain', 'Combo', 'Multiplicador',
      'Objetivo', 'Error', 'Power-up', 'Victoria', 'Derrota', 'UI', 'BGM'
    ],
    questions: [
      { key: 'board_type', label: 'Tipo de tablero', type: 'text' },
      { key: 'piece_types', label: 'Tipos de pieza', type: 'number' },
      { key: 'match_sizes', label: 'Tamaños de combinación', type: 'text', hint: '3, 4, 5, en L...' },
      { key: 'combo_levels', label: 'Niveles de combo', type: 'number' },
      { key: 'powerups', label: 'Power-ups', type: 'number' },
      { key: 'obstacles', label: 'Obstáculos', type: 'text' },
      { key: 'level_goals', label: 'Objetivos de nivel', type: 'text' },
      { key: 'failure_states', label: 'Estados de fracaso', type: 'text' },
      { key: 'characters', label: 'Personajes', type: 'text' }
    ],
    risks: [
      'Fatiga por repetición.',
      'Falta de jerarquía entre match y combo.',
      'Power-ups sin identidad.'
    ]
  },

  Arcade: {
    key: 'Arcade',
    label: 'Arcade',
    objective: 'Juegos de acción rápida por puntuación y combos.',
    ranges: { basic: [15, 25], standard: [25, 45], advanced: [45, 75] },
    categories: [
      'Movimiento', 'Interacción', 'Puntuación', 'Combos', 'Power-ups',
      'Obstáculos', 'Enemigos', 'Estados', 'UI', 'BGM', 'Stingers'
    ],
    questions: [
      { key: 'game_loop', label: 'Bucle de juego', type: 'text', hint: 'Qué hace el jugador una y otra vez' },
      { key: 'player_actions', label: 'Acciones del jugador', type: 'text' },
      { key: 'enemy_types', label: 'Tipos de enemigo', type: 'number' },
      { key: 'score_events', label: 'Eventos de puntuación', type: 'text' },
      { key: 'combo_tiers', label: 'Niveles de combo', type: 'number' },
      { key: 'powerups', label: 'Power-ups', type: 'number' },
      { key: 'failure_states', label: 'Estados de fracaso', type: 'text' },
      { key: 'levels', label: 'Niveles', type: 'number' },
      { key: 'retro_style', label: '¿Estética retro?', type: 'boolean', hint: 'Solo si el proyecto la pide explícitamente' }
    ],
    // La estética retro solo se utiliza cuando el proyecto la solicita.
    risks: ['Aplicar estética retro sin que el proyecto la pida.']
  },

  Action: {
    key: 'Action',
    label: 'Acción y aventura',
    objective: 'Juegos de exploración, combate y narrativa.',
    ranges: { basic: [30, 60], standard: [60, 120], advanced: [120, 220] },
    categories: [
      'Pasos', 'Superficies', 'Movimiento', 'Ataques', 'Impactos', 'Armas',
      'Enemigos', 'Criaturas', 'Inventario', 'Objetos', 'Ambientes',
      'Cinemáticas', 'UI', 'Música', 'Estados del personaje'
    ],
    questions: [
      { key: 'player_actions', label: 'Acciones del jugador', type: 'text' },
      { key: 'surface_types', label: 'Tipos de superficie', type: 'number', hint: 'Cada una multiplica los pasos' },
      { key: 'weapon_types', label: 'Tipos de arma', type: 'number' },
      { key: 'enemy_types', label: 'Tipos de enemigo', type: 'number' },
      { key: 'biomes', label: 'Biomas o entornos', type: 'number' },
      { key: 'interactable_objects', label: 'Objetos interactuables', type: 'text' },
      { key: 'cinematics', label: 'Cinemáticas', type: 'text' },
      { key: 'dialogue', label: '¿Hay diálogo?', type: 'boolean' },
      { key: 'music_states', label: 'Estados musicales', type: 'number' },
      { key: 'distance_variants', label: '¿Variantes por distancia?', type: 'boolean', hint: 'Cerca/lejos multiplica los assets' }
    ],
    risks: [
      'Subestimar variantes.',
      'No diseñar por distancia.',
      'No separar player/enemy.',
      'No registrar superficies.',
      'Exceso de archivos sin reutilización.'
    ]
  }
};

export const GAME_TYPES = Object.values(gameProfiles).map(p => ({
  key: p.key,
  label: p.label
}));

export const getProfile = (key) => gameProfiles[key] || gameProfiles.Slot;

// Rango de assets esperado para un género y nivel de complejidad.
export const expectedRange = (gameType, complexity = 'standard') => {
  const profile = getProfile(gameType);
  return profile.ranges[complexity] || profile.ranges.standard;
};

// Compara el alcance real contra el esperado. Sirve para avisar antes de
// producir, no después: el sistema exige validar la lista maestra primero.
export const evaluateScope = (gameType, complexity, officialCount) => {
  const [min, max] = expectedRange(gameType, complexity);

  if (officialCount === 0) return { level: 'empty', min, max, message: 'Sin lista maestra todavía.' };

  // Si es Slot y tiene al menos 16 assets (el núcleo oficial del equipo), validar positivamente
  if (gameType === 'Slot' && officialCount >= 16 && officialCount <= max) {
    return {
      level: 'ok',
      min, max,
      message: `${officialCount} assets: cubre el núcleo base de 16 assets obligatorios (06_SCOPE_POLICY.md)${officialCount > 16 ? ` más ${officialCount - 16} extras confirmados` : ''}. Alcance óptimo y ágil.`
    };
  }

  if (officialCount < min) {
    return {
      level: 'under',
      min, max,
      message: `${officialCount} assets: por debajo del rango recomendado (${min}–${max}) para ${getProfile(gameType).label} ${complexity}. Comprueba si faltan mecánicas confirmadas en el GDD.`
    };
  }
  if (officialCount > max) {
    return {
      level: 'over',
      min, max,
      message: `${officialCount} assets: por encima del rango recomendado (${min}–${max}). Comprueba si hay sonidos redundantes (UI genérica o variantes sin pantalla propia) que se puedan podar.`
    };
  }
  return {
    level: 'ok',
    min, max,
    message: `${officialCount} assets, dentro del rango recomendado (${min}–${max}).`
  };
};
