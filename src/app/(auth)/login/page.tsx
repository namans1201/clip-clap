'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Instrument_Sans } from 'next/font/google';
import { createClient, resetClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { ProfileButton } from '@/components/profile-button';
import styles from './login.module.css';

// Used only by the "Clip::Clap" hero title below (login.module.css
// references --font-instrument-sans in exactly one place). Loaded here
// rather than the root layout so no other route pays for it — see root
// layout.tsx for the fuller rationale.
const instrumentSans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
});

// Note: the expiry duration is enforced server-side now by the
// public.record_session_start() function (see
// supabase/migrations/20260522_security_hardening.sql). The client just
// tells the function whether this is a public-device session; the SQL
// caps both durations.

/* Extend Document type for View Transition API */
type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

function SessionExpiredNotice() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('reason') === 'session_expired') {
      toast.warning('Your session has expired. Please sign in again.');
    }
  }, [searchParams]);
  return null;
}

export default function LoginPage() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [isPublicDevice, setIsPublicDevice] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [mounted, setMounted]           = useState(false);
  const router                          = useRouter();
  const { resolvedTheme, setTheme }     = useTheme();

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  /* Moon/sun toggle with View Transition ripple */
  const handleThemeToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextDark = e.target.checked;
      const label    = (e.currentTarget as HTMLElement).closest('label');
      let x = window.innerWidth  / 2;
      let y = window.innerHeight / 2;
      if (label) {
        const r = label.getBoundingClientRect();
        x = r.left + r.width  / 2;
        y = r.top  + r.height / 2;
      }
      const apply = () => setTheme(nextDark ? 'dark' : 'light');
      const doc   = document as DocWithVT;
      if (!doc.startViewTransition) { apply(); return; }
      const vt = doc.startViewTransition(apply);
      vt.ready.then(() => {
        document.documentElement.style.setProperty('--x', `${x}px`);
        document.documentElement.style.setProperty('--y', `${y}px`);
      });
    },
    [setTheme],
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      resetClient();
      // Must be set BEFORE signInWithPassword — the Supabase SSR client
      // writes auth cookies synchronously as part of that call (see
      // setBrowserCookies() in lib/supabase/client.ts), and it decides
      // session-only vs 400-day-persistent cookie by reading this flag at
      // that exact moment. This was silently missing (nothing in the app
      // ever called sessionStorage.setItem for it), so every login — public
      // device checkbox checked or not — got a persistent cookie; the
      // "Auto-expires after 15 min & tab close" promise in the UI only ever
      // delivered the 15-minute part (still enforced server-side by
      // record_session_start/middleware), never the tab-close part.
      sessionStorage.setItem('is_public_device', String(isPublicDevice));
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Record session start server-side. The SECURITY DEFINER function
      // record_session_start computes and stores the expires_at in
      // public.user_sessions — the client cannot extend it. Public
      // device → 15 min, trusted → 30 days.
      const { error: rpcErr } = await supabase.rpc('record_session_start', {
        p_is_public: isPublicDevice,
      });
      if (rpcErr) throw rpcErr;

      toast.success('Logged in successfully!');
      router.push('/');
      router.refresh();
    } catch (error) {
      // Don't console.error in production — the build strips it, but in
      // dev we still want some signal. Use toast for the user.
      if (process.env.NODE_ENV !== 'production') console.error('Login error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`${styles.wrapper} ${instrumentSans.variable}`}>
      <Suspense fallback={null}>
        <SessionExpiredNotice />
      </Suspense>

      {/* ── Moon / Sun theme toggle ── */}
      <label className={styles.moonToggle} aria-label="Toggle theme">
        {mounted && (
          <input
            type="checkbox"
            checked={isDark}
            onChange={handleThemeToggle}
          />
        )}
        <div />
      </label>

      {/* ── Hero title ── */}
      <div className={styles.titleBlock}>
        <hr className={styles.titleHr} />
        <section className={styles.titleSection}>
          <div className={styles.dot} />
          <div className={styles.dot} />
          <div className={styles.dot} />
          <div className={styles.dot} />
          <h1>
            <strong>Clip:</strong><span>:Clap</span>
          </h1>
        </section>
        <hr className={styles.titleHr} />
      </div>

      {/* ── Login card ── */}
      <div className={styles.cardWrapper}>
        <div className={styles.flipCardFront}>
          <div className={styles.cardTitle}>Log in</div>
          <form className={styles.flipCardForm} onSubmit={handleLogin}>
            <input
              className={styles.flipCardInput}
              name="email"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className={styles.flipCardInput}
              name="password"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className={styles.publicDevice}>
              <label className={styles.glCheckbox}>
                <input
                  className={styles.glCheckboxInput}
                  type="checkbox"
                  checked={isPublicDevice}
                  onChange={(e) => setIsPublicDevice(e.target.checked)}
                />
                <span className={styles.glCheckboxBox}>
                  <svg
                    className={styles.glCheckboxCheck}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className={styles.glCheckboxLabel}>
                  <Lock size={13} className={styles.lockIcon} />
                  Public/Shared Device
                </span>
              </label>
              <p className={styles.deviceHint}>Auto-expires after 15 min &amp; tab close</p>
            </div>

            <button className={styles.flipCardBtn} type="submit" disabled={isLoading}>
              {isLoading ? 'Signing in…' : "Let's go!"}
            </button>
          </form>
        </div>
      </div>

      {/* ── Bottom-right profile FAB → opens developer profile card ── */}
      <ProfileButton />
    </div>
  );
}
