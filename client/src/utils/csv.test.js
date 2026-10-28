import { describe, expect, it } from 'vitest';
import { parseCsv, TEMPLATE_CSV } from './csv';

describe('parseCsv', () => {
  it('reads the template', () => {
    const rows = parseCsv(TEMPLATE_CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0].Name).toBe('Ravi Kumar');
    expect(rows[1]['Expiry Date']).toBe('15/03/2027');
  });
  it('handles quotes, commas, windows line breaks and a BOM', () => {
    const rows = parseCsv('﻿Name,Phone\r\n"Kumar, Ravi",9876543210\r\n"He said ""hi""",9123456780\r\n');
    expect(rows).toEqual([{ Name: 'Kumar, Ravi', Phone: '9876543210' }, { Name: 'He said "hi"', Phone: '9123456780' }]);
  });
  it('returns nothing for an empty file', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('Name,Phone')).toEqual([]);
  });
});
