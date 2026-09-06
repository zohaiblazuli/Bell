/**
 * PetShelf — choose the app's mascot, and import new ones from codex-pets.net.
 *
 * Two lists. **On this device** is what can be selected right now and works with the network
 * unplugged: Mr. Bell, who is always first and always there, then every installed pet. **From
 * codex-pets.net** is the registry, fetched on open and only on open — browsing is the one thing here
 * that needs a connection, so it is the one thing that is allowed to fail without breaking the screen.
 *
 * Every byte arrives through Rust. The sheets, the thumbnails and the index alike: `img-src` is
 * `'self' data: blob:` and `connect-src` names no remote origin, so a registry thumbnail is fetched by
 * `pet_preview` and turned into a blob here. Do not put a `codex-pets.net` URL in an `<img src>`.
 *
 * **An install is not finished until its bytes have been proved to render.** `pet_install` checks that
 * what came back is a WebP, which is all Rust can say without decoding an image; the geometry — 9 rows
 * or 11, on 192x208 cells — is checked here by `loadPet`, because this is the side that has a decoder.
 * A sheet that fails is deleted again rather than left as a mascot that would silently draw nothing.
 *
 * Sheet fill is `--card`, not `--glass`: it is a panel holding a grid and a paragraph, and CLAUDE.md's
 * one refinement to "glass is chrome" is that a sheet this size in chrome glass reads muddy.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './PetShelf.css';
import Button from '@ui/Button';
import Chip from '@ui/Chip';
import IconButton from '@ui/IconButton';
import Notice from '@ui/Notice';
import SectionLabel from '@ui/SectionLabel';
import MrBell from '@ui/brand/MrBell';
import Pet from '@ui/Pet';
import {
  parseRegistry,
  petDelete,
  petInstall,
  petList,
  petPreview,
  petRegistry,
  type PetEntry,
  type RegistryPet,
} from '@/lib/pets';
import { forgetPet, loadPet, petSheetSpec, usePet } from '@/state/usePet';

/** Tile art is 96px tall — the dialog size, and enough for a 192x208 cell to read. */
const TILE = 96;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

/* ── thumbnails ────────────────────────────────────────────────────────────────────────────────── */

/** One blob per preview, kept for the session: reopening the shelf must not refetch thirty images. */
const previews = new Map<string, string>();
const previewsInFlight = new Map<string, Promise<string>>();

/** Rust has already refused anything that is not one of these two, so the first byte decides. */
const mimeOf = (bytes: ArrayBuffer) =>
  new Uint8Array(bytes, 0, 1)[0] === 0x89 ? 'image/png' : 'image/webp';

function thumbFor(url: string): Promise<string> {
  const cached = previews.get(url);
  if (cached) return Promise.resolve(cached);
  const existing = previewsInFlight.get(url);
  if (existing) return existing;
  const task = petPreview(url)
    .then((bytes) => {
      const blob = URL.createObjectURL(new Blob([bytes], { type: mimeOf(bytes) }));
      previews.set(url, blob);
      return blob;
    })
    .finally(() => previewsInFlight.delete(url));
  previewsInFlight.set(url, task);
  return task;
}

/**
 * A registry pet's picture — an `<img>`, not a `<Pet>`.
 *
 * A full sheet is 1.7 MB and thirty of them is not a gallery, so a pet nobody has installed shows the
 * still the registry posters it with; an installed pet gets the real thing, animating from its own
 * atlas. Note the field: it is the POSTER, because `previewUrl` is the whole strip — see `RegistryPet`.
 */
function Thumb({ url, alt }: { url: string | null; alt: string }) {
  const [src, setSrc] = useState<string | null>(() => (url ? previews.get(url) ?? null : null));

  useEffect(() => {
    if (!url) return;
    let live = true;
    // A thumbnail that will not load leaves an empty frame. It is decoration for a row that already
    // says its own name, so it must never be the thing that reports a problem.
    void thumbFor(url).then((blob) => live && setSrc(blob)).catch(() => {});
    return () => {
      live = false;
    };
  }, [url]);

  if (!src) return <div className="pets-thumb pets-thumb--empty" aria-hidden />;
  return <img className="pets-thumb" src={src} alt={alt} />;
}

/** An installed pet, drawn from its own sheet — so the shelf animates, because by then it can. */
function InstalledArt({ id }: { id: string }) {
  const pet = usePet(id);
  if (!pet) return <div className="pets-thumb pets-thumb--empty" aria-hidden />;
  return <Pet sheet={pet.url} version={pet.version} density={pet.density} size={TILE} />;
}

/* ── the shelf ─────────────────────────────────────────────────────────────────────────────────── */

export interface PetShelfProps {
  open: boolean;
  onClose: () => void;
  /** The chosen mascot: a pet id, or `null` for Mr. Bell. */
  selected: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * Where the sheet mounts: `.app`, and **not** `document.body**.
 *
 * It has to leave `.view` — see the note at the return below — but it must not leave `.app`, because
 * that is where the tone lives. Day is `:root` and Night overrides on `.app[data-tone='night']`
 * (CLAUDE.md), and `[data-motion='off']` hangs off the same element, so a sheet portalled to `<body>`
 * reads every token from the Day column and draws a white panel over a Night app. `.app` is a child
 * of `#root` with no transform or filter of its own, so a `position: fixed` child of it still anchors
 * to the viewport — which is the whole reason for portalling in the first place.
 */
const shelfRoot = () => document.querySelector('.app') ?? document.body;

export default function PetShelf({ open, onClose, selected, onSelect }: PetShelfProps) {
  const [installed, setInstalled] = useState<PetEntry[]>([]);
  const [rows, setRows] = useState<RegistryPet[] | null>(null);
  /** Which pet a press is currently working on, so only its own button says so. */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reach, setReach] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      petList()
        .then(setInstalled)
        .catch((e) => setError(message(e))),
    [],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    void refresh();
    // The registry is fetched on open and only on open. It is the one thing on this screen that needs
    // a connection, so it is the one thing allowed to fail without taking the screen with it — the
    // installed list above stays selectable with the network unplugged.
    setReach(null);
    petRegistry()
      .then((json) => setRows(parseRegistry(json)))
      .catch((e) => {
        setRows([]);
        setReach(message(e));
      });
  }, [open, refresh]);

  // Escape closes, the same as every other sheet in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /**
   * Fetch a pet, prove it renders, then make it the mascot.
   *
   * The verification is the point: `pet_install` can only say the bytes are a WebP, so an atlas of the
   * wrong shape would otherwise install cleanly and then draw nothing at all. `loadPet` decodes it and
   * measures the height, and a sheet that fails is removed again rather than left on the shelf.
   *
   * Selecting it afterwards is not a liberty — importing a pet is how someone asks for that pet.
   */
  const install = async (pet: RegistryPet) => {
    setBusy(pet.id);
    setError(null);
    try {
      await petInstall(
        {
          id: pet.id,
          displayName: pet.displayName,
          description: pet.description,
          spritesheetPath: pet.spritesheetPath,
          spriteVersionNumber: pet.spriteVersionNumber,
          kind: pet.kind,
        },
        pet.sheetUrl,
      );
      // Re-installing over a pet already in the cache has to re-read it, or the old sheet would win.
      forgetPet(pet.id);
      try {
        await loadPet(pet.id);
      } catch (bad) {
        await petDelete(pet.id).catch(() => {});
        throw new Error(
          `${pet.displayName} did not arrive as a pet Bell can draw — a spritesheet has to be ` +
            `${petSheetSpec()}. ${message(bad)}`,
        );
      }
      await refresh();
      onSelect(pet.id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  /**
   * Remove a pet's files. Not destructive in the way clearing data is — the registry still has it —
   * but it does hand the mascot back to Mr. Bell if this was the one on screen, and it has to: a
   * selection pointing at a directory that is gone would silently fall back anyway, and a Settings row
   * that reads "Sara" over a drawing of a crab is worse than one that reads "Mr. Bell".
   */
  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await petDelete(id);
      forgetPet(id);
      if (selected === id) onSelect(null);
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  const have = new Set(installed.map((p) => p.id));
  const available = (rows ?? []).filter((p) => !have.has(p.id));

  /**
   * **Portalled out of the view, and that is load-bearing rather than tidy.**
   *
   * `Dialog` gets away with rendering in place because `App` mounts it as a sibling of `.main`. This
   * sheet is opened from a Settings row, so in place means inside `.view` — a scrolling box, 1,300px
   * of Settings above it, and `animation: rise` putting a transform on it for the first 400ms of
   * every visit. Rendered there the panel laid out roughly 1,180px below the fold: fully opaque,
   * correctly sized, and off screen. Both halves below anchor to the VIEWPORT instead of to whatever
   * happens to be above them, which is the only thing a modal ever wanted.
   */
  return createPortal(
    <div className="pets-scrim" onPointerDown={onClose}>
      {/* The sheet swallows the press, so only the ground closes it. */}
      <div
        className="pets-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Pets"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="pets-head">
          <div className="pets-head__text">
            <h2 className="pets-title t-title-toolbar">Pets</h2>
            <p className="pets-sub t-body-small">
              Your mascot, wherever Bell draws one. Pets come from codex-pets.net and are stored on
              this machine.
            </p>
          </div>
          <IconButton icon="x" label="Close pets" onClick={onClose} />
        </header>

        {error ? <Notice>{error}</Notice> : null}

        <div className="pets-body">
          <section className="pets-group" aria-label="On this device">
            <SectionLabel label="On this device" meta={`${installed.length + 1}`} />
            <div className="pets-grid">
              {/* Mr. Bell is first and cannot be removed: he is in the binary, and he is what the app
                  draws before it has ever reached the network. */}
              <div className="pets-card" data-on={selected === null ? '' : undefined}>
                <button className="pets-pick" onClick={() => onSelect(null)} aria-pressed={selected === null}>
                  <span className="pets-art">
                    <MrBell size={TILE} />
                  </span>
                  <span className="pets-name t-body-default">Mr. Bell</span>
                  <span className="pets-meta t-body-meta">Built in</span>
                </button>
              </div>

              {installed.map((pet) => (
                <div className="pets-card" key={pet.id} data-on={selected === pet.id ? '' : undefined}>
                  <button
                    className="pets-pick"
                    onClick={() => onSelect(pet.id)}
                    aria-pressed={selected === pet.id}
                  >
                    <span className="pets-art">
                      <InstalledArt id={pet.id} />
                    </span>
                    <span className="pets-name t-body-default">{pet.displayName}</span>
                    <span className="pets-meta t-body-meta">
                      {pet.kind} · {sizeLabel(pet.bytes)}
                    </span>
                  </button>
                  {/* A sibling of the tile, never a child: a button inside a button is not markup. */}
                  <IconButton
                    className="pets-remove"
                    icon="trash"
                    label={`Remove ${pet.displayName}`}
                    disabled={busy === pet.id}
                    onClick={() => void remove(pet.id)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="pets-group" aria-label="From codex-pets.net">
            <SectionLabel
              label="From codex-pets.net"
              meta={rows == null ? undefined : `${available.length} to import`}
            />
            {reach ? <Notice>{reach}</Notice> : null}
            {rows == null ? <p className="pets-note t-body-small">Looking…</p> : null}
            {rows != null && !reach && available.length === 0 ? (
              <p className="pets-note t-body-small">
                Every pet the registry lists is already on this machine.
              </p>
            ) : null}

            <div className="pets-rows">
              {available.map((pet) => (
                <div className="pets-row" key={pet.id}>
                  <Thumb url={pet.posterUrl} alt={pet.displayName} />
                  <div className="pets-row__text">
                    <p className="pets-name t-body-default">{pet.displayName}</p>
                    <p className="pets-desc t-body-meta">{pet.description || pet.kind}</p>
                    <div className="pets-tags">
                      {/* A pet is somebody's drawing, so the credit travels with it. */}
                      {pet.ownerHandle ? <Chip label={`@${pet.ownerHandle}`} /> : null}
                      {pet.tags.slice(0, 3).map((tag) => (
                        <Chip key={tag} label={tag} />
                      ))}
                    </div>
                  </div>
                  <Button
                    icon="plus"
                    label={busy === pet.id ? 'Importing…' : 'Import'}
                    disabled={busy != null}
                    onClick={() => void install(pet)}
                  />
                </div>
              ))}
            </div>

            <p className="pets-note t-body-meta">
              Pets are made by the codex-pets.net community, which is not affiliated with Bell or with
              OpenAI. Importing one copies its spritesheet onto this machine; nothing about you is sent.
            </p>
          </section>
        </div>
      </div>
    </div>,
    shelfRoot(),
  );
}
