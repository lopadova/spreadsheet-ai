import { describe, expect, it } from 'vitest';
import { escapeCsvField, toCsv } from '../../resources/js/lib/csv';

describe('escapeCsvField — formula neutralisation (CSV injection)', () => {
    it.each([
        ['=cmd|calc', "'=cmd|calc"],
        ['+1', "'+1"],
        ['-1', "'-1"],
        ['@x', "'@x"],
        ['\tTAB', "'\tTAB"],
        ['\rCR', "'\rCR"],
    ])('prefixes a single quote to %j', (input, expected) => {
        // CR makes it quoted too; assert the quote is present at the start.
        const out = escapeCsvField(input);
        expect(out.startsWith("'") || out.startsWith('"\'')).toBe(true);
        // Direct comparison for the non-quoted cases.
        if (!/[",\n\r]/.test(expected.replace(/^'/, ''))) {
            expect(out).toBe(expected);
        }
    });

    it('leaves a safe leading char untouched', () => {
        expect(escapeCsvField('Wrong Size')).toBe('Wrong Size');
        expect(escapeCsvField('42%')).toBe('42%');
        expect(escapeCsvField('')).toBe('');
    });
});

describe('escapeCsvField — quoting + escaping', () => {
    it('quotes a field with a comma', () => {
        expect(escapeCsvField('Milano, Italia')).toBe('"Milano, Italia"');
    });

    it('quotes + doubles embedded quotes', () => {
        expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    });

    it('quotes a field with a newline', () => {
        expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    });

    it('formula + comma: prefixes then quotes', () => {
        expect(escapeCsvField('=A1,B1')).toBe('"\'=A1,B1"');
    });
});

describe('toCsv', () => {
    it('round-trips a normal row CRLF-joined', () => {
        const csv = toCsv(['Name', 'City'], [['Mario', 'Milano']]);
        expect(csv).toBe('Name,City\r\nMario,Milano');
    });

    it('neutralises a formula cell inside a row', () => {
        const csv = toCsv(['A'], [['=SUM(A1:A2)']]);
        expect(csv).toBe("A\r\n'=SUM(A1:A2)");
    });

    it('handles empty rows (header only)', () => {
        expect(toCsv(['A', 'B'], [])).toBe('A,B');
    });
});
