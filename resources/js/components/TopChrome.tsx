export type Theme = 'dark' | 'light';

interface TopChromeProps {
    theme: Theme;
    onToggleTheme: () => void;
}

const NAV_LINKS = ['Sheets', 'Workflows', 'Library', 'Citations'];

export function TopChrome({ theme, onToggleTheme }: TopChromeProps) {
    return (
        <header className="top-chrome">
            <div className="top-chrome-left">
                <div className="brand-mono">
                    <div className="brand-mark brand-mark-glow">T</div>
                    <div>
                        <b>Tabular Review</b>
                        <small className="mono tertiary"> · padosoft / askmydocs</small>
                    </div>
                </div>
                <span className="top-chrome-sep">·</span>
                {/* Nav targets are placeholders in this single-page demo, so they
                    are buttons (not fake href="#" links) for correct a11y semantics. */}
                <nav className="top-chrome-nav" aria-label="Sezioni">
                    {NAV_LINKS.map((link) => (
                        <button
                            key={link}
                            type="button"
                            className="top-chrome-link"
                            aria-disabled="true"
                            title={`${link} (demo)`}
                        >
                            {link}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="top-chrome-right">
                <span className="live-pill">
                    <span className="pulse" />
                    4 streams · live
                </span>
                <button
                    className="iconbtn"
                    type="button"
                    onClick={onToggleTheme}
                    title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                    aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                >
                    {theme === 'dark' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                        </svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    )}
                </button>
                <div
                    className="avatar"
                    aria-hidden="true"
                    style={{ background: 'linear-gradient(135deg, oklch(0.7 0.16 280), oklch(0.7 0.16 200))' }}
                >
                    MR
                </div>
            </div>
        </header>
    );
}
