import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Alto y ancho aproximados del menú: deciden si se abre hacia arriba y hacia qué lado.
const MENU_HEIGHT_GUESS = 360;
const MENU_WIDTH_GUESS = 340;

/**
 * Un botón que abre un menú de opciones, cada una con su nombre en texto y una frase de qué
 * hace. Lo usan las acciones de cada fila de la tabla y la barra de la lista (feature 002).
 *
 * Es presentacional: recibe las opciones ya descritas y avisa de la elegida por callback.
 *   items:  [{ key, label, hint, disabled?, done?, tone?: 'danger', separated? }]
 *   align:  'left' | 'right' — de qué borde del botón cuelga el menú (se corrige si no cabe).
 *
 * El menú se pinta en el <body>, no dentro de quien lo usa: una tabla que se desplaza recorta lo
 * que sobresale, y un ancestro con `backdrop-filter` ataría una posición fija a su propia caja.
 * Su altura de apilamiento es la de los desplegables (500).
 *
 * Una opción apagada se ve y explica por qué en su frase, pero no hace nada ni cierra el menú.
 */
const DropdownMenu = ({ label, items, onSelect, triggerClassName = '', title, align = 'right' }) => {
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const open = position !== null;

  const close = (returnFocus = false) => {
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  const toggle = () => {
    if (open) return close();
    const box = triggerRef.current.getBoundingClientRect();
    const fitsBelow = window.innerHeight - box.bottom > MENU_HEIGHT_GUESS;
    const vertical = fitsBelow ? { top: box.bottom + 4 } : { bottom: window.innerHeight - box.top + 4 };

    // Preferencia de la llamada, corregida si el menú se saldría de la pantalla por ese lado.
    const fitsLeft = box.left + MENU_WIDTH_GUESS <= window.innerWidth;
    const fitsRight = box.right - MENU_WIDTH_GUESS >= 0;
    const useLeft = align === 'left' ? fitsLeft || !fitsRight : !fitsRight && fitsLeft;
    setPosition({ ...vertical, ...(useLeft ? { left: box.left } : { right: window.innerWidth - box.right }) });
  };

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close(true);
    };
    // Si la página se desplaza o la ventana cambia, el menú ya no estaría junto a su botón.
    const onMove = () => close();

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    // Sin desplazar: un scroll cerraría el menú justo al abrirlo.
    menuRef.current?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  const choose = (item) => {
    if (item.disabled) return;
    close();
    onSelect(item);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${triggerClassName} ${open ? 'open' : ''}`}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        {label}
      </button>

      {open && createPortal(
        <div ref={menuRef} className="dropdown-menu" role="menu" style={position}>
          {items.map(item => (
            <React.Fragment key={item.key}>
              {item.separated && <div className="dropdown-sep" role="separator" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`dropdown-item ${item.tone === 'danger' ? 'danger' : ''}`}
                onClick={() => choose(item)}
              >
                <span className="dropdown-item-name">
                  {item.done && <span className="dropdown-done" aria-hidden="true">✓ </span>}
                  {item.label}
                </span>
                <span className="dropdown-item-hint">{item.hint}</span>
              </button>
            </React.Fragment>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

export default DropdownMenu;
