// Las opciones del menú «Empezar la lista» (feature 005, enmienda del 2026-10-19).
//
// Antes eran tres botones sueltos en la barra de la lista (cargar plantilla, importar JSON,
// importar CSV) con nombres que solo entendía quien conociera el método. Ahora son un menú con
// el nombre en texto y una frase de qué hace cada una, y si REEMPLAZA la lista o AÑADE.
//
// Las importaciones son opciones avanzadas: están ocultas salvo que se active «Opciones
// avanzadas» (feature 002, FR-001a). Siguen existiendo porque son el camino de las listas hechas
// fuera de la herramienta, por ejemplo un análisis hecho en consola.
//
// Es una función pura para que se pueda comprobar sin navegador.

export const buildStartOptions = ({ genreLabel, templateCount = 0, showAdvanced = false }) => [
  {
    key: 'template',
    label: `Partir de la lista base de ${genreLabel}`,
    // Sin lista base, la opción se ve apagada y lo dice: no espera a que se pulse para avisar.
    disabled: !templateCount,
    hint: templateCount
      ? `Pone ${templateCount} sonidos con sus prompts, sin usar IA. Reemplaza la lista actual (te lo pregunta antes).`
      : `${genreLabel} aún no tiene lista base. Usa el análisis con IA o añade filas a mano.`
  },
  showAdvanced && {
    key: 'json',
    label: 'Importar un archivo JSON',
    separated: true,
    hint: 'Una lista maestra hecha fuera de la herramienta, con su informe si lo trae. Reemplaza la lista actual.'
  },
  showAdvanced && {
    key: 'csv',
    label: 'Importar un CSV',
    hint: 'Añade al final las filas de un CSV, por ejemplo una lista que llevabas en Excel.'
  }
].filter(Boolean);
