import type { Cell } from '../api/client';
import type { PresetMeta } from '../lib/presets';
import { citationText } from '../grid/format';

interface StatusFooterProps {
    preset: PresetMeta;
    rowCount: number;
    cells: ReadonlyMap<string, Cell>;
}

interface CitationChip {
    key: string;
    flag: string | null;
    text: string;
}

function dotColor(flag: string | null): string {
    switch (flag) {
        case 'green':
            return 'var(--status-success)';
        case 'yellow':
            return 'var(--status-paused)';
        case 'red':
            return 'var(--status-failed)';
        default:
            return 'var(--text-tertiary)';
    }
}

/** Derive up to 4 citation chips from generated cells that carry citation text. */
function deriveCitations(cells: ReadonlyMap<string, Cell>): CitationChip[] {
    const out: CitationChip[] = [];
    for (const [key, cell] of cells) {
        const text = citationText(cell.content?.citations);
        if (text) {
            out.push({ key, flag: cell.flag, text });
            if (out.length >= 4) break;
        }
    }
    return out;
}

export function StatusFooter({ preset, rowCount, cells }: StatusFooterProps) {
    const citations = deriveCitations(cells);
    const entityLabel = rowCount === 1 ? preset.entity : preset.entityPlural;

    return (
        <div className="status-footer">
            <div className="status-footer-left">
                <span className="badge outline">
                    {rowCount} {entityLabel}
                </span>
                <span className="tertiary" style={{ fontSize: 11.5 }}>·</span>
                <span className="tertiary mono" style={{ fontSize: 11.5 }}>
                    tenant <b style={{ color: 'var(--text-secondary)' }}>padosoft</b>
                </span>
                <span className="tertiary" style={{ fontSize: 11.5 }}>·</span>
                <span className="tertiary mono" style={{ fontSize: 11.5 }}>
                    provider{' '}
                    <b style={{ color: 'var(--text-secondary)' }}>anthropic / claude-haiku-4.5</b>
                </span>
            </div>
            <div className="status-footer-right">
                <span className="tertiary" style={{ fontSize: 11.5 }}>
                    recent citations
                </span>
                <div className="cit-strip">
                    {citations.length === 0 && (
                        <span className="tertiary" style={{ fontSize: 11 }}>
                            — run a generation to populate
                        </span>
                    )}
                    {citations.map((c) => (
                        <span key={c.key} className={`cit-chip flag-${c.flag ?? 'grey'}`} title={c.text}>
                            <span className="conf-dot" style={{ background: dotColor(c.flag) }} />
                            <span style={{ fontSize: 11 }}>
                                &quot;{c.text.slice(0, 28)}
                                {c.text.length > 28 ? '…' : ''}&quot;
                            </span>
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
