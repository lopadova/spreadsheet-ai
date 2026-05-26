// ============================================================
// Stable per-cell citation numbering (fixes prototype bug §1.A.2).
//
// The prototype recomputed a global counter on EVERY paint (O(rows×cols) each
// frame) and the numbers reshuffled whenever data changed. We instead assign an
// index ONCE, the first time a given cell key is seen with a citation, and keep
// it for the life of the run. The index is monotonic in first-seen order.
// ============================================================

import { citationCount } from './format';

export class CitationRegistry {
    private readonly indexByKey = new Map<string, number>();
    private next = 1;

    /**
     * Returns the stable 1-based citation index for `key` if it has citations,
     * assigning one on first sight. Cells without citations get `null` and
     * never consume a number.
     */
    assign(key: string, citations: unknown): number | null {
        if (citationCount(citations) === 0) return null;
        const existing = this.indexByKey.get(key);
        if (existing != null) return existing;
        const idx = this.next++;
        this.indexByKey.set(key, idx);
        return idx;
    }

    /** Look up an already-assigned index without assigning a new one. */
    peek(key: string): number | null {
        return this.indexByKey.get(key) ?? null;
    }

    /** Reset everything (e.g. on preset switch). */
    clear(): void {
        this.indexByKey.clear();
        this.next = 1;
    }

    size(): number {
        return this.indexByKey.size;
    }
}
