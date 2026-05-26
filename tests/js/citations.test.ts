import { describe, expect, it } from 'vitest';
import { CitationRegistry } from '../../resources/js/grid/citations';

describe('CitationRegistry — stable per-cell numbering (§1.A.2)', () => {
    it('assigns once and keeps the index across re-renders', () => {
        const reg = new CitationRegistry();
        const first = reg.assign('R1:0', [{ quote: 'a' }]);
        // Re-render: same key, same citations → SAME number, not recomputed.
        expect(reg.assign('R1:0', [{ quote: 'a' }])).toBe(first);
        expect(reg.peek('R1:0')).toBe(first);
    });

    it('numbers monotonically in first-seen order, skipping empty cells', () => {
        const reg = new CitationRegistry();
        expect(reg.assign('R1:0', ['x'])).toBe(1);
        expect(reg.assign('R1:1', [])).toBeNull(); // no citation → no number consumed
        expect(reg.assign('R2:0', ['y'])).toBe(2);
        // Re-visiting an earlier cell does not renumber.
        expect(reg.assign('R1:0', ['x'])).toBe(1);
        expect(reg.size()).toBe(2);
    });

    it('treats null/empty citations as no badge', () => {
        const reg = new CitationRegistry();
        expect(reg.assign('R1:0', null)).toBeNull();
        expect(reg.assign('R1:0', undefined)).toBeNull();
        expect(reg.size()).toBe(0);
    });

    it('clears on preset switch', () => {
        const reg = new CitationRegistry();
        reg.assign('R1:0', ['x']);
        reg.clear();
        expect(reg.size()).toBe(0);
        expect(reg.assign('R9:9', ['z'])).toBe(1);
    });
});
