import { useCallback, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import Mascot from '@/components/Mascot';
import Button from '@ui/Button';
import WindowLights from '@/components/WindowLights';
import type { BellMood } from '@ui/brand/MrBell';
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
  const [mood, setMood] = useState<BellMood>('glint');

  const handleOpenRepo = useCallback(async () => {
    try {
      await openUrl(REPO_URL);
      setOpenedRepo(true);
      setMood('glint');
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
      return;
    }

    setChecking(true);
    setFeedback(null);
    setMood('specs-push-up');

    try {
      const isStarred = await checkGitHubStar(cleanUser);
      if (isStarred) {
        setMood('hop');
        setFeedback({
          type: 'success',
          text: `Star verified! Thank you for supporting Bell, @${cleanUser}. Enjoy studying! 🌟`,
        });
        setTimeout(() => {
          onComplete();
        }, 1200);
      } else {
        setMood('double-take');
        setFeedback({
          type: 'error',
          text: `We couldn't find Bell in @${cleanUser}'s starred repositories yet. Make sure you clicked the Star button on GitHub, then try again!`,
        });
      }
    } catch (err: unknown) {
      setMood('specs-push-up');
      const msg = typeof err === 'string' ? err : 'Could not verify star. Please check your connection or use the link below.';
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

  return (
    <div className="stargate">
      <div className="stargate__lights">
        <WindowLights />
      </div>

      <div className="stargate__panel">
        <div className="stargate__mascot">
          <Mascot size={110} mood={mood} />
        </div>

        <div className="stargate__header">
          <h1 className="stargate__title t-display-setup-title">
            {userName?.trim() ? `One quick thing, ${userName.trim()}!` : 'One quick thing!'}
          </h1>
          <p className="stargate__desc t-body-default">
            Bell is free and offline-first for Cambridge students. To support the project and help other students discover Bell, please take a moment to star the repository.
          </p>
        </div>

        <div className="stargate__actions">
          <div className="stargate__star-btn">
            <Button
              variant="primary"
              label={openedRepo ? '★ Open GitHub Repo Again' : '★ Star Bell on GitHub'}
              onClick={() => void handleOpenRepo()}
            />
          </div>

          <div className="stargate__divider">
            <span>Verify your star</span>
          </div>

          <div className="stargate__verify-row">
            <div className="stargate__input-wrap">
              <span className="stargate__input-at">@</span>
              <input
                type="text"
                className="stargate__input"
                placeholder="GitHub username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={checking}
                autoFocus
              />
            </div>
            <Button
              variant="secondary"
              label={checking ? 'Checking…' : 'Verify'}
              disabled={checking || !username.trim()}
              onClick={() => void handleVerify()}
              className="stargate__verify-btn"
            />
          </div>

          {feedback && (
            <div className={`stargate__notice stargate__notice--${feedback.type} t-body-meta`}>
              <span>{feedback.text}</span>
            </div>
          )}
        </div>

        <div className="stargate__footer">
          <button
            type="button"
            className="stargate__fallback-btn"
            onClick={onComplete}
          >
            Already starred, or don't have a GitHub account? Continue to Bell →
          </button>
        </div>
      </div>
    </div>
  );
}
