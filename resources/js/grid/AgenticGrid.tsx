// ============================================================
// AgenticGrid — the Glide DataEditor that replaces GridPlaceholder.
//
// Columns = base (display) columns + AI columns. AI cells stream in via SSE
// (useSseGeneration). Missing / generating / pending cells render as
// GridCellKind.Loading (skeleton); ready cells use our single custom renderer.
//
// Canvas a11y/testability: Glide draws to <canvas>, which is invisible to
// Playwright + screen readers. We render a visually-hidden but
// screen-reader-available MIRROR <table> reflecting the current cell values,
// keyed by data-testid, updated from the cell store. Tests assert against it.
// ============================================================

import { useCallback, useMemo, useRef } from 'react';
import {
    DataEditor,
    GridCellKind,
    type DataEditorRef,
    type GridCell,
    type GridColumn,
    type GridSelection,
    type Item,
} from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import type { AiColumn, BaseColumn, Cell, Row } from '../api/client';
import { cellKey, useCellStore, type SubscribableCellStore } from '../store/cells';
import { aiColumnIdByIndex, aiColumnWidth, baseColumnWidth } from './columnWidths';
import { agenticCellRenderer, cellSummaryText, type AgenticCellData } from './renderers';
import { CitationRegistry } from './citations';
import { buildGlideTheme } from './theme';
import { cellDisplayText, normaliseFlag, truncate } from './format';

const FORMAT_ICON: Record<string, string> = {
    text: 'Aa', bulleted_list: '•', number: '#', percentage: '%', monetary_amount: '€',
    currency: '¤', yes_no: '?', date: '⌗', tag: '#', enum: '◉', enum_status: '⬤',
    rating: '★', url: '↗', person: '◍', tags_multi: '⌗⌗', relation: '⇄', json_path: '$',
};

interface AgenticGridProps {
    preset: string;
    baseColumns: BaseColumn[];
    columns: AiColumn[];
    rows: Row[];
    store: SubscribableCellStore;
    gridRef: React.RefObject<DataEditorRef | null>;
    loading?: boolean;
    onEditColumn?: (column: AiColumn) => void;
    /** Click a generated AI cell → open the side-panel for (row_id, columnIndex). */
    onCellClicked?: (rowId: string, columnIndex: number) => void;
    /** Current grid selection (controlled), for bulk regenerate. */
    gridSelection?: GridSelection;
    onGridSelectionChange?: (sel: GridSelection) => void;
    /**
     * Toggle whole-column selection for an AI column (keyboard-accessible
     * mirror of canvas column-select). Receives the Glide grid column index.
     */
    onToggleColumnSelect?: (gridColumn: number) => void;
    /** Set of currently-selected Glide grid column indexes (for the mirror). */
    selectedGridColumns?: ReadonlySet<number>;
    themeVersion?: number;
}

function isJsonPath(col: AiColumn): boolean {
    return col.format === 'json_path' || (col.json_path != null && col.json_path !== '');
}

export function AgenticGrid({
    preset,
    baseColumns,
    columns,
    rows,
    store,
    gridRef,
    loading = false,
    onEditColumn,
    onCellClicked,
    gridSelection,
    onGridSelectionChange,
    onToggleColumnSelect,
    selectedGridColumns,
    themeVersion = 0,
}: AgenticGridProps) {
    const { cells } = useCellStore(store);
    const baseCount = baseColumns.length;

    // Stable citation numbering across re-renders/repaints (§1.A.2).
    // Clear synchronously during render when preset changes (not via useEffect)
    // so the first getCellContent call for the new preset always sees a clean
    // registry and citation indices restart from 1. (A useEffect-based clear
    // runs AFTER the first render, potentially assigning stale indices.)
    const citationsRef = useRef(new CitationRegistry());
    const prevPresetRef = useRef(preset);
    if (prevPresetRef.current !== preset) {
        prevPresetRef.current = preset;
        citationsRef.current.clear();
    }

    const theme = useMemo(() => buildGlideTheme(), [themeVersion]);

    const gridColumns = useMemo<GridColumn[]>(() => {
        const base: GridColumn[] = baseColumns.map((c) => ({
            title: c.name,
            id: `base:${c.id}`,
            width: baseColumnWidth(preset, c.id),
        }));
        const ai: GridColumn[] = columns.map((c) => {
            const protoId = aiColumnIdByIndex(preset, c.index);
            const icon = FORMAT_ICON[c.format] ?? '◇';
            const jp = isJsonPath(c);
            return {
                title: `${icon}  ${c.name}${jp ? '  $path' : ''}`,
                id: `ai:${c.index}`,
                width: aiColumnWidth(preset, protoId),
                themeOverride: { textHeader: 'var(--ai)' },
            };
        });
        return [...base, ...ai];
    }, [baseColumns, columns, preset]);

    const getCellContent = useCallback(
        ([col, row]: Item): GridCell => {
            const r = rows[row];
            if (r == null) {
                return { kind: GridCellKind.Loading, allowOverlay: false };
            }
            if (col < baseCount) {
                const base = baseColumns[col];
                const raw = base ? (r[base.id] ?? '') : '';
                const text = String(raw);
                return {
                    kind: GridCellKind.Text,
                    data: text,
                    displayData: text,
                    allowOverlay: false,
                };
            }
            const aiCol = columns[col - baseCount];
            if (aiCol == null) {
                return { kind: GridCellKind.Loading, allowOverlay: false };
            }
            const stored = store.get(r.row_id, aiCol.index);
            if (stored == null || stored.status === 'generating' || stored.status === 'pending') {
                return { kind: GridCellKind.Loading, allowOverlay: false };
            }
            const value = stored.content?.summary ?? null;
            const key = cellKey(r.row_id, aiCol.index);
            const citationIndex = citationsRef.current.assign(key, stored.content?.citations);
            const data: AgenticCellData = {
                kind: 'agentic-cell',
                format: isJsonPath(aiCol) ? 'json_path' : aiCol.format,
                value,
                flag: normaliseFlag(stored.flag),
                confidence: stored.confidence,
                citationIndex,
                citationCount: citationIndex != null ? 1 : 0,
                enumValues: aiCol.enum_values,
            };
            return {
                kind: GridCellKind.Custom,
                data,
                copyData: cellSummaryText(data),
                allowOverlay: false,
            };
        },
        [rows, baseColumns, columns, baseCount, store],
    );

    const onHeaderClicked = useCallback(
        (col: number) => {
            if (col >= baseCount) {
                const aiCol = columns[col - baseCount];
                if (aiCol) onEditColumn?.(aiCol);
            }
        },
        [baseCount, columns, onEditColumn],
    );

    const handleCellClicked = useCallback(
        ([col, row]: Item) => {
            if (col < baseCount) return; // base columns aren't AI cells
            const aiCol = columns[col - baseCount];
            const r = rows[row];
            if (aiCol == null || r == null) return;
            onCellClicked?.(r.row_id, aiCol.index);
        },
        [baseCount, columns, rows, onCellClicked],
    );

    if (loading) {
        return (
            <div className="agentic-grid-wrap" aria-busy="true">
                <div className="agentic-grid-skeleton">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <span key={i} className="skel" style={{ width: 120, height: 28 }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="agentic-grid-wrap">
            <DataEditor
                ref={gridRef}
                className="agentic-grid"
                columns={gridColumns}
                getCellContent={getCellContent}
                rows={rows.length}
                customRenderers={[agenticCellRenderer]}
                onHeaderClicked={onHeaderClicked}
                onCellClicked={handleCellClicked}
                gridSelection={gridSelection}
                onGridSelectionChange={onGridSelectionChange}
                columnSelect="multi"
                rangeSelect="multi-rect"
                rowMarkers="both"
                rowHeight={40}
                headerHeight={40}
                smoothScrollX
                smoothScrollY
                getCellsForSelection
                keybindings={{ copy: true, paste: false }}
                theme={theme}
                width="100%"
                height={Math.min(560, Math.max(220, rows.length * 40 + 44))}
            />
            <GridMirror
                baseColumns={baseColumns}
                columns={columns}
                rows={rows}
                cells={cells}
                onEditColumn={onEditColumn}
                onCellClicked={onCellClicked}
                onToggleColumnSelect={onToggleColumnSelect}
                selectedGridColumns={selectedGridColumns}
                baseCount={baseCount}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Visually-hidden, screen-reader-available mirror of cell values.
// Drives Playwright assertions (canvas text is not queryable) and a11y.
// ---------------------------------------------------------------------------

interface GridMirrorProps {
    baseColumns: BaseColumn[];
    columns: AiColumn[];
    rows: Row[];
    cells: ReadonlyMap<string, Cell>;
    /** Edit a column (mirrors the canvas header pencil; keyboard-accessible). */
    onEditColumn?: (column: AiColumn) => void;
    /** Open the cell side-panel (mirrors a canvas cell click). */
    onCellClicked?: (rowId: string, columnIndex: number) => void;
    onToggleColumnSelect?: (gridColumn: number) => void;
    selectedGridColumns?: ReadonlySet<number>;
    baseCount: number;
}

function mirrorCellText(cell: Cell | undefined, col: AiColumn): string {
    return cellDisplayText(cell, col.format);
}

function GridMirror({
    baseColumns,
    columns,
    rows,
    cells,
    onEditColumn,
    onCellClicked,
    onToggleColumnSelect,
    selectedGridColumns,
    baseCount,
}: GridMirrorProps) {
    let filled = 0;
    for (const cell of cells.values()) {
        if (cell.status !== 'generating' && cell.status !== 'pending' && cell.content?.summary != null) {
            filled++;
        }
    }
    return (
        <table className="grid-mirror" aria-label="Tabular review cell values" data-testid="grid-mirror">
            <caption data-testid="mirror-filled-count">{filled}</caption>
            <thead>
                <tr>
                    {baseColumns.map((c) => (
                        <th key={`b:${c.id}`} scope="col">{c.name}</th>
                    ))}
                    {columns.map((c, pos) => {
                        const gridCol = baseCount + pos;
                        return (
                            <th key={`a:${c.index}`} scope="col" data-format={c.format}>
                                {c.name}
                                {onEditColumn && (
                                    <button
                                        type="button"
                                        data-testid={`edit-col-${c.index}`}
                                        aria-label={`Edit column ${c.name}`}
                                        title={`Edit column ${c.name}`}
                                        onClick={() => onEditColumn(c)}
                                    >
                                        ✎
                                    </button>
                                )}
                                {onToggleColumnSelect && (
                                    <button
                                        type="button"
                                        data-testid={`select-col-${c.index}`}
                                        aria-label={`Select column ${c.name}`}
                                        aria-pressed={selectedGridColumns?.has(gridCol) ?? false}
                                        onClick={() => onToggleColumnSelect(gridCol)}
                                    >
                                        ☑
                                    </button>
                                )}
                            </th>
                        );
                    })}
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.row_id} data-row-id={row.row_id}>
                        {baseColumns.map((c) => (
                            <td key={`b:${c.id}`}>{String(row[c.id] ?? '')}</td>
                        ))}
                        {columns.map((c) => {
                            const cell = cells.get(cellKey(row.row_id, c.index));
                            const text = mirrorCellText(cell, c);
                            const ready =
                                cell != null &&
                                cell.status !== 'generating' &&
                                cell.status !== 'pending';
                            return (
                                <td
                                    key={`a:${c.index}`}
                                    data-testid={`cell-${row.row_id}-${c.index}`}
                                    data-format={c.format}
                                    data-flag={cell ? normaliseFlag(cell.flag) : ''}
                                    data-status={cell?.status ?? 'empty'}
                                    title={truncate(text, 80)}
                                >
                                    {onCellClicked && ready ? (
                                        <button
                                            type="button"
                                            data-testid={`open-cell-${row.row_id}-${c.index}`}
                                            aria-label={`Open ${c.name} for ${row.row_id}`}
                                            onClick={() => onCellClicked(row.row_id, c.index)}
                                        >
                                            {text}
                                        </button>
                                    ) : (
                                        text
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
