import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { normalizedName } from '../lib/names';

interface Props {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  suggestions?: string[];
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  disabled?: boolean;
  canonicalize?: (value: string) => string;
}
export default function CreatableComboBox({ label, name, value, onChange, options, suggestions = [], placeholder,
  hint, maxLength = 100, disabled = false, canonicalize = input => input.trim().replace(/\s+/g,' ') }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [above, setAbove] = useState(false);
  const [listHeight, setListHeight] = useState(240);
  const [filtering, setFiltering] = useState(false);
  const choices = new Map<string,{ value: string; saved: boolean }>();
  for (const option of options) { const text = canonicalize(option); if (text && !choices.has(normalizedName(text))) choices.set(normalizedName(text), { value: text, saved: true }); }
  for (const suggestion of suggestions) { const text = canonicalize(suggestion); if (text && !choices.has(normalizedName(text))) choices.set(normalizedName(text), { value: text, saved: false }); }
  const query = normalizedName(canonicalize(value));
  const matching = [...choices.values()].filter(option => !filtering || !query || normalizedName(option.value).includes(query)).slice(0,20);
  const exact = choices.get(query);
  const newValue = canonicalize(value);
  const rows = [...matching.map(option => ({ ...option, create: false })), ...(newValue && !exact ? [{ value: newValue, saved: false, create: true }] : [])];
  const visible = open && rows.length > 0 && !disabled;
  const focused = Math.min(active, Math.max(0,rows.length-1));

  useEffect(() => {
    if (!visible) return;
    const outside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const option = document.getElementById(`${id}-option-${focused}`);
    const list = option?.parentElement;
    if (!option || !list) return;
    // Scroll only the listbox. scrollIntoView would also move the modal/header on short screens.
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [visible, focused, id]);

  function show(filter = false) {
    const field = rootRef.current?.getBoundingClientRect();
    const boundary = rootRef.current?.closest('.dialog-body, dialog')?.getBoundingClientRect();
    if (field) {
      const below = (boundary?.bottom ?? window.innerHeight) - field.bottom - 8;
      const over = field.top - (boundary?.top ?? 0) - 8;
      const showAbove = below < 190 && over > below;
      setAbove(showAbove);
      setListHeight(Math.max(44, Math.min(240, showAbove ? over : below)));
    }
    setOpen(true); setFiltering(filter);
    setActive(filter ? 0 : Math.max(0, [...choices.values()].findIndex(option => normalizedName(option.value) === query)));
  }
  function commit(text = value) {
    const canonical = canonicalize(text);
    onChange(choices.get(normalizedName(canonical))?.value ?? canonical);
    setOpen(false);
  }
  function key(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!visible) show();
      else setActive(index => event.key === 'ArrowDown' ? (index+1)%rows.length : (index+rows.length-1)%rows.length);
    } else if (event.key === 'Enter' && visible) {
      event.preventDefault(); commit(rows[focused].value);
    } else if (event.key === 'Escape' && visible) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    }
  }
  return <div className="creatable-field" ref={rootRef}>
    <div className="field-label"><label htmlFor={`${id}-input`}>{label}</label>{hint && <span>{hint}</span>}</div>
    <div className={`combo-control ${visible ? 'expanded' : ''}`}>
      <input id={`${id}-input`} ref={inputRef} name={name} value={value} onChange={event => { onChange(event.target.value); setActive(0); setFiltering(true); if (!open) show(true); }}
        onFocus={() => show()} onBlur={() => commit()} onKeyDown={key} placeholder={placeholder} maxLength={maxLength} disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible ? `${id}-list` : undefined}
        aria-activedescendant={visible ? `${id}-option-${focused}` : undefined} autoComplete="off" />
      <button type="button" className="combo-toggle" tabIndex={-1} aria-label={`Mostrar opciones de ${label}`} disabled={disabled}
        aria-expanded={visible} aria-controls={visible ? `${id}-list` : undefined}
        onPointerDown={event => event.preventDefault()} onClick={() => { inputRef.current?.focus(); if (visible) setOpen(false); else show(); }}><ChevronDown size={16} /></button>
    </div>
    {visible && <div id={`${id}-list`} className={`combo-list ${above ? 'above' : ''}`} style={{ maxHeight: listHeight }} role="listbox" aria-label={label}>
      {rows.map((option,index) => <div key={`${option.create?'create:':''}${option.value}`} id={`${id}-option-${index}`} role="option" aria-selected={index === focused}
        className={`combo-option ${index === focused ? 'active' : ''}`} onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => commit(option.value)}>
        <span className="combo-option-icon">{option.create ? <Plus size={16} /> : normalizedName(option.value) === query ? <Check size={16} /> : null}</span>
        <span>{option.create ? `Crear «${option.value}»` : option.value}</span><small>{option.create ? 'Nuevo' : option.saved ? 'Guardado' : 'Sugerencia'}</small>
      </div>)}
    </div>}
  </div>;
}
