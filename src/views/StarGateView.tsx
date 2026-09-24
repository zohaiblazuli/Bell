import { useCallback, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import Mascot from '@/components/Mascot';
import WindowLights from '@/components/WindowLights';
import type { HushPose } from '@ui/shapekit/Hush';
import { checkGitHubStar } from '@/lib/api';
import './StarGateView.css';

export interface StarGateViewProps {
  onComplete: () => void;
  userName?: string;
}

const REPO_URL = 'https://github.com/zohaiblazuli/Bell';

export default function StarGateView({ onComplete, userName }: StarGateViewProps) {
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [openedRepo, setOpenedRepo] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [mood, setMood] = useState<HushPose>('proud');
  // The design's reaction on top of the pose: a glint when GitHub opens, a head-tilt while
  // checking, a hop on success and a double-take (plus a shaking input row) on a miss.
  const [act, setAct] = useState<'glint' | 'think' | 'hop' | 'dt' | null>(null);
  const [miss, setMiss] = useState(0);

  const handleOpenRepo = useCallback(async () => {
    try {
      await openUrl(REPO_URL);
      setOpenedRepo(true);
      setMood('hello');
      setAct('glint');
      setFeedback({
        type: 'info',
        text: 'GitHub opened in your browser. Click the Star (★) button at the top right, then verify below!',
      });
    } catch {
      setFeedback({
        type: 'error',
        text: `Could not open browser automatically. Please visit ${REPO_URL} directly.`,
      });
    }
  }, []);

  const handleVerify = useCallback(async () => {
    const cleanUser = username.trim().replace(/^@/, '');
    if (!cleanUser) {
      setFeedback({
        type: 'error',
        text: 'Please enter your GitHub username.',
      });
      setAct('dt');
      setMiss((n) => n + 1);
      return;
    }

    setChecking(true);
    setFeedback(null);
    setMood('watch');
    setAct('think');

    try {
      const isStarred = await checkGitHubStar(cleanUser);
      if (isStarred) {
        setMood('done');
        setAct('hop');
        setFeedback({
          type: 'success',
          text: `Star verified! Thank you for supporting Bell, @${cleanUser}. Enjoy studying!`,
        });
        setTimeout(() => {
          onComplete();
        }, 1200);
      } else {
        setMood('alarm');
        setAct('dt');
        setMiss((n) => n + 1);
        setFeedback({
          type: 'error',
          text: `We couldn't find Bell in @${cleanUser}'s starred repositories yet. Make sure you clicked the Star button on GitHub, then try again!`,
        });
      }
    } catch (err: unknown) {
      setMood('alarm');
      setAct('dt');
      setMiss((n) => n + 1);
      const msg = typeof err === 'string' ? err : 'Could not verify star. Please check your connection and try again.';
      setFeedback({
        type: 'error',
        text: msg,
      });
    } finally {
      setChecking(false);
    }
  }, [username, onComplete]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleVerify();
    }
  };

  const name = userName?.trim();
  const star = <i className="stargate__star" />;

  return (
    <div className="stargate">
      <span className="stargate__sun" aria-hidden />
      <span className="stargate__quarter" aria-hidden />
      <span className="stargate__twinkle stargate__twinkle--red" aria-hidden>{star}</span>
      <span className="stargate__twinkle stargate__twinkle--ink" aria-hidden>{star}</span>
      <div className="stargate__lights">
        <WindowLights />
      </div>

      <div className="stargate__panel">
        <div className="stargate__mascot" data-act={act ?? undefined} key={act === 'dt' ? `dt${miss}` : act ?? 'rest'}>
          <Mascot size={130} mood={mood} />
        </div>

        <div className="stargate__header">
          <h1 className="stargate__title">{name ? `One quick thing, ${name}!` : 'One quick thing!'}</h1>
          <p className="stargate__desc">
            Bell is free and offline-first for Cambridge students. To support the project and help other students discover Bell, please take a moment to star the repository.
          </p>
        </div>

        <button type="button" className="stargate__repo" onClick={() => void handleOpenRepo()}>
          <span className="stargate__spin">{star}</span>
          {openedRepo ? 'Open GitHub repo again' : 'Star Bell on GitHub'}
        </button>

        <div className="stargate__divider">
          <i />
          <span>VERIFY YOUR STAR</span>
          <i />
        </div>

        <div className="stargate__verify-row" data-shake={miss ? (miss % 2 ? 'a' : 'b') : undefined}>
          <label className="stargate__input-wrap" data-error={feedback?.type === 'error' ? 'true' : undefined}>
            <span className="stargate__input-at">@</span>
            <input
              type="text"
              className="stargate__input"
              placeholder="GitHub username"
              aria-label="GitHub username"
              autoComplete="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={checking}
              autoFocus
            />
          </label>
          <button
            type="button"
            className="stargate__verify"
            disabled={checking || !username.trim()}
            onClick={() => void handleVerify()}
          >
            {checking ? 'Checking…' : 'Verify'}
          </button>
        </div>

        {feedback && (
          <div className="stargate__notice" data-type={feedback.type} role={feedback.type === 'error' ? 'alert' : 'status'}>
            <i />
            <span>{feedback.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
