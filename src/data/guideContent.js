// Todo el texto didáctico de la vista simple, como datos.
//
// Está aparte de los componentes a propósito: corregir o mejorar una explicación no
// debería exigir tocar la interfaz, y este es el único sitio donde revisar el
// vocabulario (Artículo XII: un solo nombre por concepto). Los términos coinciden con
// las etiquetas que la herramienta ya usa: «Loop», «Aprobado para producción»,
// «Pendiente de validar».
//
// Escrito para alguien SIN experiencia en audio: una o dos frases por paso y ningún
// término técnico sin explicación a mano (feature 010, FR-052).

// Los cinco pasos. El paso actual se calcula del estado del proyecto; aquí solo está
// lo que se le cuenta a la persona.
export const GUIDE_STEPS = [
  {
    n: 0,
    key: 'connect',
    title: 'Conecta tu IA',
    what: 'Elige con qué inteligencia artificial quieres trabajar y pega tu clave.',
    why: 'La clave es la llave de tu cuenta en ese servicio. Se queda en tu equipo; nadie más la ve ni sale hacia ninguna otra parte.',
    unlock: 'Pega la clave de tu IA y pulsa «Comprobar conexión».'
  },
  {
    n: 1,
    key: 'material',
    title: 'Cuenta tu juego',
    what: 'Sube capturas de pantalla del juego y escribe cómo quieres que suene.',
    why: 'La IA mira las imágenes y lee tu descripción para proponer qué sonidos hacen falta. Cuanto más concreto seas, mejor propuesta.',
    unlock: 'Escribe la descripción y pulsa «Analizar».'
  },
  {
    n: 2,
    key: 'list',
    title: 'Revisa la lista',
    what: 'La IA propone sonidos, cada uno con su prompt. Léelos, corrígelos y aprueba los que quieras producir.',
    why: 'Antes de producir hay que decidir qué sonidos hacen falta. Producir de más gasta tiempo y créditos, y el equipo del juego solo integra lo necesario.',
    unlock: 'Aprueba para producción al menos un sonido.'
  },
  {
    n: 3,
    key: 'generate',
    title: 'Crea y guarda',
    what: 'Copia el prompt de cada sonido aprobado, genera el sonido en la página de ElevenLabs, guárdalo en tu Drive y pega aquí su enlace.',
    why: 'Lo que sale de ElevenLabs es un boceto para probar. El archivo final lo termina el equipo de audio en su programa de edición.',
    unlock: 'Guarda un sonido en Drive y pega su enlace en la fila.'
  },
  {
    n: 4,
    key: 'share',
    title: 'Comparte con el equipo',
    what: 'Exporta una página web o una hoja de Excel con los nombres y los enlaces, y envíasela al equipo del juego.',
    why: 'Así el equipo sabe qué sonidos hay y dónde están, sin necesitar esta herramienta ni tus claves.',
    unlock: ''
  }
];

// Frases de «qué lo desbloquea» para cada acción bloqueada (FR-054). Nunca se deja
// un botón deshabilitado sin decir por qué.
export const BLOCKED = {
  needEngineKey: 'Para analizar, pega la clave de tu IA en ⚙️ Configuración.',
  needDescription: 'Para analizar, escribe una descripción de cómo debe sonar el juego.',
  needApproval: 'Para generar, aprueba para producción al menos este sonido.',
  needPrompt: 'Este sonido no tiene prompt: escríbelo para poder generarlo.',
  needLinkToExport: 'Ningún sonido tiene enlace todavía. Puedes exportar igualmente: saldrán como pendientes.',
  needSoundsToExport: 'Primero necesitas una lista de sonidos. Vuelve al paso «Cuenta tu juego».'
};

// Qué decir cuando se guarda el borrador de audio solo en memoria (FR-049).
export const DRAFT_WARNING =
  'El audio generado vive solo mientras tengas esta pestaña abierta. Descárgalo y guárdalo en tu Drive antes de cerrar; si no, tendrás que generarlo otra vez.';

// Aviso de la primera generación (FR-057).
export const CREDITS_NOTICE =
  'Cada sonido que generas gasta créditos de tu cuenta de ElevenLabs. Genera primero los que más te importen.';

// Aviso de la primera vez que se usa cada proveedor (FR-019).
export const THIRD_PARTY_NOTICE =
  'Para analizar tu juego, las imágenes y la descripción se envían a este proveedor de IA, con tu propia cuenta. Si el material es confidencial, confirma antes que puedes compartirlo con él.';

// El ejemplo de buena descripción que acompaña al campo (FR-055).
export const DESCRIPTION_EXAMPLE = {
  label: 'Ejemplo de una buena descripción',
  text:
    'Tragaperras con una lechuza de madera tallada en un bosque al anochecer. ' +
    'Hay farolillos de cristal, luciérnagas doradas y hongos que brillan. Quiero un sonido acogedor y mágico, no solemne. ' +
    'Sin voces ni sonidos de animales: la lechuza suena a madera y a cristal. ' +
    'Hay tiradas gratis y un símbolo especial que las activa.',
  tips: [
    'Di el ambiente: dónde pasa y qué se ve.',
    'Di los materiales: madera, metal, cerámica, papel.',
    'Di lo que NO debe sonar: voces, música dentro de los efectos, animales.',
    'Menciona los momentos importantes: bonos, premios, tiradas gratis.'
  ]
};

// Un prompt de muestra con sus ocho partes (Artículo VII), para que la persona vea
// de qué se compone y por qué (FR-055). Va marcado con [THEME]: en un prompt real, ese
// marcador se sustituye por la identidad de TU juego.
export const PROMPT_EXAMPLE = {
  label: 'Un prompt, parte por parte',
  intro: 'Todos los prompts de la lista siguen esta misma receta. Pulsa una parte para ver qué hace.',
  parts: [
    {
      key: 'duration',
      name: 'Duración',
      text: '0.5 seconds.',
      why: 'Cuánto dura el sonido. Va en el texto y también se envía como dato aparte.'
    },
    {
      key: 'moment',
      name: 'Qué es y cuándo suena',
      text: 'UI button press at the start of a spin.',
      why: 'El momento exacto del juego. Un sonido sin momento sale genérico.'
    },
    {
      key: 'action',
      name: 'Qué ocurre en el tiempo',
      text: 'A single short tap with a soft rebound.',
      why: 'Cómo evoluciona: empieza, golpea, se apaga. Evita pedir varias cosas a la vez.'
    },
    {
      key: 'materials',
      name: 'Materiales',
      text: 'Wooden block and brushed brass contact.',
      why: 'Con qué suena. Es lo que más se nota y lo que lo hace sonar a tu juego.'
    },
    {
      key: 'function',
      name: 'Carácter y función',
      text: 'Crisp, tactile and quiet so it survives hundreds of repetitions, never sounding like a reward.',
      why: 'Qué debe sentir el jugador y qué NO debe comunicar. Un botón no debe sonar a premio.'
    },
    {
      key: 'theme',
      name: 'Identidad del juego',
      text: '[THEME].',
      why: 'Aquí va el tema de tu juego (por ejemplo «firefly forest dusk»). Hace que todos los sonidos suenen al mismo juego.'
    },
    {
      key: 'restrictions',
      name: 'Restricciones',
      text: 'No voice, no vocals, no speech, no music.',
      why: 'Lo que no quieres oír. Sin esto, la IA puede añadir voces o música sin que se las pidas.'
    },
    {
      key: 'technical',
      name: 'Tratamiento técnico',
      text: 'Clean, isolated, completely dry, zero reverb.',
      why: 'Sonido limpio y sin eco. Es lo correcto para efectos cortos; la música de fondo lleva otro tratamiento.'
    }
  ]
};

// El glosario (FR-053). Los términos usan las etiquetas que ya muestra la herramienta.
export const GLOSSARY = [
  {
    term: 'Prompt de sonido',
    definition: 'El texto que le dice a ElevenLabs cómo debe sonar un efecto. Está en inglés porque ElevenLabs lo entiende mejor así. Puedes editarlo antes de generar.'
  },
  {
    term: 'Lista maestra',
    definition: 'La lista de todos los sonidos que necesita tu juego. La IA propone una; tú decides cuáles se producen.'
  },
  {
    term: 'Pendiente de validar',
    definition: 'Un sonido que la IA propone y que nadie ha decidido todavía. Así entran todos, siempre.'
  },
  {
    term: 'Aprobado para producción',
    definition: 'Un sonido que has decidido producir. Se consigue con «Aprobar para producción». Hasta entonces no se puede generar.'
  },
  {
    term: 'Duración',
    definition: 'Cuántos segundos dura el sonido. Un clic dura décimas de segundo; una música de fondo, un minuto. La herramienta te avisa si la duración pedida no se puede generar tal cual.'
  },
  {
    term: 'Loop',
    definition: 'Un sonido que se repite sin cortes, como la música de fondo o el giro continuo de los rodillos. Su final enlaza con su principio.'
  },
  {
    term: 'Boceto y master',
    definition: 'El boceto es lo que genera ElevenLabs para que pruebes la idea. El master es la versión final, pulida por el equipo de audio en su programa de edición. Lo que generas aquí es un boceto.'
  },
  {
    term: 'Tema (THEME)',
    definition: 'Dos a cinco palabras en inglés que resumen la identidad de tu juego, como «jungle temple». Se pega dentro de todos los prompts para que el juego suene coherente.'
  },
  {
    term: 'Enlace',
    definition: 'La dirección donde guardaste el audio, por ejemplo en Drive. La herramienta no guarda tus archivos: solo apunta a ellos.'
  }
];
