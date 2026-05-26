import type { HeroStats } from '../lib/stats';

interface HeroBannerProps {
    stats: HeroStats;
    /** When true, render skeleton numbers (review still loading). */
    loading?: boolean;
}

const NF = new Intl.NumberFormat('it-IT');

export function HeroBanner({ stats, loading = false }: HeroBannerProps) {
    const fig = (value: string) =>
        loading ? <span className="skel" style={{ width: 40, height: 18 }} /> : value;

    return (
        <div className="hero">
            <div className="hero-bg" aria-hidden="true">
                <div className="hero-grid-pattern" />
                <div className="hero-glow hero-glow-1" />
                <div className="hero-glow hero-glow-2" />
            </div>
            <div className="hero-inner">
                <div className="hero-eyebrow">
                    <span className="brand-badge">
                        <span className="brand-badge-dot" />
                        TABULAR REVIEW
                    </span>
                    <span className="tertiary mono" style={{ fontSize: 11 }}>
                        v4.7 · open source
                    </span>
                    <span className="ver-sep">·</span>
                    <span className="live-pill">
                        <span className="pulse" />
                        Live demo
                    </span>
                </div>
                <h1 className="hero-title">
                    Ogni colonna
                    <br />
                    <span className="hero-title-accent">è un prompt.</span>
                </h1>
                <p className="hero-sub">
                    Spreadsheet AI-driven dove le righe sono entità, le colonne sono prompt LLM
                    riusabili, e ogni cella si verifica in un click con citation in-line.
                </p>
                <div className="hero-stats">
                    <div className="hero-stat">
                        <small>Righe</small>
                        <b className="mono">{fig(NF.format(stats.rows))}</b>
                    </div>
                    <div className="hero-stat">
                        <small>Colonne AI</small>
                        <b className="mono">{fig(NF.format(stats.aiColumns))}</b>
                    </div>
                    <div className="hero-stat">
                        <small>Celle generate</small>
                        <b className="mono">{fig(NF.format(stats.cells))}</b>
                    </div>
                    <div className="hero-stat">
                        <small>Costo run</small>
                        <b className="mono" style={{ color: 'var(--ai)' }}>
                            {fig(`€${stats.cost.toFixed(4)}`)}
                        </b>
                    </div>
                    <div className="hero-stat">
                        <small>Latency p95</small>
                        <b className="mono">{stats.latency}s</b>
                    </div>
                </div>
            </div>
        </div>
    );
}
