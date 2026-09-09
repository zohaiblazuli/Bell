import { useEffect, useMemo, useRef, useState } from 'react';
import './PageJumper.css';

export interface PageJumperProps {
  /** The currently visible page number (1-indexed) */
  page: number;
  /** Total number of pages */
  pageCount: number;
  /** Callback fired when the user commits a jump to a target page */
  onJump: (targetPage: number) => void;
  /** Optional class name for the wrapper */
  className?: string;
}

export default function PageJumper({
  page,
  pageCount,
  onJump,
  className = '',
}: PageJumperProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(() => String(page));
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize input text with external page changes when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setInputVal(String(page));
    }
  }, [page, isEditing]);

  const dynamicWidth = useMemo(() => {
    const digits = Math.max(String(page).length, String(pageCount).length, inputVal.length);
    return Math.max(26, digits * 8 + 12);
  }, [page, pageCount, inputVal.length]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    e.currentTarget.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits only
    const digits = raw.replace(/[^0-9]/g, '');
    setInputVal(digits);
  };

  const commitJump = (val: string) => {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(1, Math.min(pageCount, parsed));
      onJump(clamped);
      setInputVal(String(clamped));
    } else {
      setInputVal(String(page));
    }
    setIsEditing(false);
  };

  const handleBlur = () => {
    commitJump(inputVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitJump(inputVal);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputVal(String(page));
      setIsEditing(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(pageCount, page + 1);
      onJump(next);
      setInputVal(String(next));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = Math.max(1, page - 1);
      onJump(prev);
      setInputVal(String(prev));
    }
  };

  return (
    <div
      className={`rd-page-jumper t-mono-small ${className}`.trim()}
      role="group"
      aria-label="Page navigation"
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="rd-page-input"
        style={{ width: `${dynamicWidth}px` }}
        value={inputVal}
        onFocus={handleFocus}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        aria-label="Current page — type a number and press Enter to jump"
        aria-valuenow={page}
        aria-valuemin={1}
        aria-valuemax={pageCount}
        title="Current page — type a number and press Enter to jump"
      />
      <span className="rd-page-slash" aria-hidden="true">
        /
      </span>
      <span className="rd-page-total" aria-label={`of ${pageCount} pages`}>
        {pageCount}
      </span>
    </div>
  );
}
