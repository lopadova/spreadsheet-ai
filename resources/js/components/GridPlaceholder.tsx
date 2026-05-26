import type { AiColumn, BaseColumn } from '../api/client';
import { isJsonPathColumn } from '../lib/stats';

interface GridPlaceholderProps {
    baseColumns: BaseColumn[];
    columns: AiColumn[];
    rowCount: number;
    loading?: boolean;
}

export function GridPlaceholder({
    baseColumns,
    columns,
    rowCount,
    loading = false,
}: GridPlaceholderProps) {
    if (loading) {
        return (
            <div className="grid-placeholder" aria-busy="true">
                <div className="grid-placeholder-headrow">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i} className="skel" style={{ width: 120, height: 28 }} />
                    ))}
                </div>
                <div className="grid-placeholder-note">Loading grid…</div>
            </div>
        );
    }

    return (
        <div className="grid-placeholder" aria-label="Grid preview">
            <div className="grid-placeholder-headrow">
                {baseColumns.map((c) => (
                    <span key={`base-${c.id}`} className="gp-col gp-col-base" title={c.name}>
                        <span className="gp-col-name">{c.name}</span>
                        <span className="gp-col-fmt">base</span>
                    </span>
                ))}
                {columns.map((c) => (
                    <span key={`ai-${c.index}`} className="gp-col gp-col-ai" title={c.prompt}>
                        <span className="gp-col-name">{c.name}</span>
                        <span className="gp-col-fmt">
                            {isJsonPathColumn(c) ? `$ ${c.format}` : c.format}
                        </span>
                    </span>
                ))}
            </div>
            <div className="grid-placeholder-body">
                <div className="grid-placeholder-badge">Grid loads here — M4</div>
                <p className="grid-placeholder-note">
                    Canvas grid (Glide) arrives in M4: {rowCount} rows × {columns.length} AI columns,
                    streamed cell-by-cell with confidence flags and citations.
                </p>
            </div>
        </div>
    );
}
