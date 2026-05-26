import { describe, expect, it } from 'vitest';
import {
    citationCount,
    citationText,
    detectJsonPathType,
    deterministicHue,
    isSafeUrl,
    normaliseFlag,
    parsePercent,
    percentSign,
    truncate,
    urlHost,
    valueToText,
} from '../../resources/js/grid/format';

describe('parsePercent — NaN guard (§1.A.5)', () => {
    it('parses signed and plain percentages', () => {
        expect(parsePercent('+18%')).toBe(18);
        expect(parsePercent('-42%')).toBe(-42);
        expect(parsePercent('24.8')).toBeCloseTo(24.8);
        expect(parsePercent('76,5%')).toBeCloseTo(76.5);
        expect(parsePercent(94)).toBe(94);
    });

    it('returns null (never NaN) for un-parseable input', () => {
        expect(parsePercent('abc')).toBeNull();
        expect(parsePercent('')).toBeNull();
        expect(parsePercent(null)).toBeNull();
        expect(parsePercent(undefined)).toBeNull();
        expect(parsePercent(Number.NaN)).toBeNull();
        expect(parsePercent({})).toBeNull();
    });

    it('exposes the sign for coloring', () => {
        expect(percentSign('+18%')).toBe('pos');
        expect(percentSign('-42%')).toBe('neg');
        expect(percentSign('18%')).toBe('neutral');
    });
});

describe('detectJsonPathType — auto-detect (§1.A.1)', () => {
    it('detects percentage', () => {
        expect(detectJsonPathType('+18%')).toBe('percentage');
        expect(detectJsonPathType('94%')).toBe('percentage');
    });
    it('detects money', () => {
        expect(detectJsonPathType('52,40 EUR')).toBe('money');
        expect(detectJsonPathType('1.249,00 €')).toBe('money');
    });
    it('detects date', () => {
        expect(detectJsonPathType('2026-05-15')).toBe('date');
        expect(detectJsonPathType('2026-05-15T09:42')).toBe('date');
    });
    it('detects number', () => {
        expect(detectJsonPathType(94)).toBe('number');
        expect(detectJsonPathType('1247')).toBe('number');
    });
    it('falls back to text', () => {
        expect(detectJsonPathType('Wrong Size')).toBe('text');
        expect(detectJsonPathType('')).toBe('text');
        expect(detectJsonPathType({})).toBe('text');
    });
});

describe('isSafeUrl — http(s) only (§1.A.5 / security)', () => {
    it('accepts http and https', () => {
        expect(isSafeUrl('https://zalando.it/x')).toBe(true);
        expect(isSafeUrl('http://example.com')).toBe(true);
    });
    it('rejects dangerous and non-url schemes', () => {
        expect(isSafeUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeUrl('data:text/html,x')).toBe(false);
        expect(isSafeUrl('ftp://host/x')).toBe(false);
        expect(isSafeUrl('not a url')).toBe(false);
        expect(isSafeUrl('')).toBe(false);
        expect(isSafeUrl(null)).toBe(false);
    });
    it('extracts host, stripping www', () => {
        expect(urlHost('https://www.zalando.it/path')).toBe('zalando.it');
        expect(urlHost('garbage')).toBe('garbage');
    });
});

describe('deterministicHue — stable hashing', () => {
    it('is stable for the same input', () => {
        expect(deterministicHue('Wrong Size')).toBe(deterministicHue('Wrong Size'));
        expect(deterministicHue('Damaged')).toBe(deterministicHue('Damaged'));
    });
    it('differs across distinct inputs (typically)', () => {
        expect(deterministicHue('Wrong Size')).not.toBe(deterministicHue('Damaged'));
    });
    it('is always within [0,360)', () => {
        for (const s of ['', 'a', 'High', 'Critical', 'véry-ünïcödé']) {
            const h = deterministicHue(s);
            expect(h).toBeGreaterThanOrEqual(0);
            expect(h).toBeLessThan(360);
        }
    });
});

describe('valueToText / truncate / flag / citations', () => {
    it('flattens arrays and person/relation objects', () => {
        expect(valueToText(['a', 'b'])).toBe('a · b');
        expect(valueToText({ name: 'Sara Conte', initials: 'SC' })).toBe('Sara Conte');
        expect(valueToText({ kind: 'order', label: 'ordini:94521' })).toBe('ordini:94521');
        expect(valueToText(94)).toBe('94');
        expect(valueToText(null)).toBe('');
    });
    it('truncates with ellipsis', () => {
        expect(truncate('hello world', 5)).toBe('hell…');
        expect(truncate('hi', 5)).toBe('hi');
    });
    it('normalises flags', () => {
        expect(normaliseFlag('green')).toBe('green');
        expect(normaliseFlag(null)).toBe('grey');
        expect(normaliseFlag('weird')).toBe('grey');
    });
    it('counts and reads citations (string + {quote})', () => {
        expect(citationCount(['a', 'b'])).toBe(2);
        expect(citationCount(null)).toBe(0);
        expect(citationText([{ quote: 'fonte X' }])).toBe('fonte X');
        expect(citationText(['plain'])).toBe('plain');
        expect(citationText([])).toBe('');
    });
});
