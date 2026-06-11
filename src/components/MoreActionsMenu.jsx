import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export default function MoreActionsMenu({ actions = [], align = 'right', buttonClassName = '', menuClassName = '' }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const visibleActions = actions.filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!visibleActions.length) return null;

  const menuAlignClass = align === 'left' ? 'left-0' : 'right-0';

  return (
    <div ref={menuRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={`inline-flex items-center justify-center rounded-full text-gnd-gray transition hover:bg-gnd-cream/70 hover:text-gnd-dark focus:outline-none focus:ring-2 focus:ring-gnd-red/20 ${buttonClassName || 'h-8 w-8'}`}
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute ${menuAlignClass} top-full z-40 mt-2 min-w-36 overflow-hidden rounded-lg border border-gnd-cream bg-white py-1 shadow-xl shadow-red-900/10 ${menuClassName}`}
        >
          {visibleActions.map((action) => (
            <button
              key={action.key || action.label}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                action.onClick?.();
              }}
              className="flex w-full items-center px-3 py-2 text-left text-xs font-black text-gnd-dark transition hover:bg-gnd-cream/45 hover:text-gnd-red disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
