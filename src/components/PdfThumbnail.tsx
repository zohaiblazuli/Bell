import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { readWorkspaceDocument } from '@/lib/workspace';
import { openPdf, renderPage } from '@/lib/pdf';
import './PdfThumbnail.css';

// In-memory cache so thumbnails render instantly on subsequent view switches
const thumbCache = new Map<string, string>();

interface Props {
  path: string;
  title: string;
  targetWidth?: number;
  className?: string;
  size?: 'card' | 'mini';
}

export default function PdfThumbnail({
  path,
  title,
  targetWidth = 500,
  className = '',
  size = 'card',
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => thumbCache.get(path) ?? null);
  const [loading, setLoading] = useState<boolean>(!thumbCache.has(path));
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (thumbCache.has(path)) {
      setDataUrl(thumbCache.get(path)!);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(false);

    async function generate() {
      try {
        const buffer = await readWorkspaceDocument(path);
        if (!active) return;
        const { doc, close } = await openPdf(new Uint8Array(buffer));
        try {
          if (!active) return;
          const canvas = document.createElement('canvas');
          await renderPage(doc, 1, canvas, targetWidth);
          if (!active) return;
          const url = canvas.toDataURL('image/webp', 0.88);
          thumbCache.set(path, url);
          setDataUrl(url);
        } finally {
          await close();
        }
      } catch (e) {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void generate();

    return () => {
      active = false;
    };
  }, [path, targetWidth]);

  if (dataUrl && !error) {
    return (
      <div
        className={`pdf-thumb-wrap ${size === 'mini' ? 'pdf-thumb-mini' : 'pdf-thumb-card'} ${className}`}
      >
        <img
          src={dataUrl}
          alt={`Preview of ${title}`}
          className="pdf-thumb-img"
          loading="lazy"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`pdf-thumb-wrap pdf-thumb-loading ${size === 'mini' ? 'pdf-thumb-mini' : 'pdf-thumb-card'} ${className}`}
      >
        <div className="pdf-thumb-skeleton" />
      </div>
    );
  }

  return (
    <div
      className={`pdf-thumb-wrap pdf-thumb-fallback ${size === 'mini' ? 'pdf-thumb-mini' : 'pdf-thumb-card'} ${className}`}
    >
      <span className="pdf-thumb-fallback-icon">
        <Icon name="doc" />
      </span>
    </div>
  );
}
