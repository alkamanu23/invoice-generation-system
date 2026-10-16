import { searchAdjustmentNotes } from '../../routes/adjustmentNoteSearch';
import pool from '../../db/db';

jest.mock('../../db/db', () => ({
  query: jest.fn(),
}));

describe('Adjustment Note Search Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success cases', () => {
    test('returns all adjustment notes when no query is provided', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 1, issuedate: '2026-03-20T00:00:00.000Z', type: 'credit' },
          { id: 2, issuedate: '2026-03-19T00:00:00.000Z', type: 'debit' },
        ],
      });

      const result = await searchAdjustmentNotes({});

      expect(result).toEqual([
        { id: 1, issuedate: '2026-03-20T00:00:00.000Z', type: 'credit' },
        { id: 2, issuedate: '2026-03-19T00:00:00.000Z', type: 'debit' },
      ]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM credit_note'),
        []
      );
    });

    test('searches adjustment notes by id', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 3, issuedate: '2026-03-18T00:00:00.000Z', type: 'credit' },
        ],
      });

      const result = await searchAdjustmentNotes({ query: '3' });

      expect(result).toEqual([
        { id: 3, issuedate: '2026-03-18T00:00:00.000Z', type: 'credit' },
      ]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('CAST(id AS TEXT) ILIKE $1'),
        ['%3%']
      );
    });

    test('searches adjustment notes by issueDate', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 4, issuedate: '2026-03-17T00:00:00.000Z', type: 'debit' },
        ],
      });

      const result = await searchAdjustmentNotes({ query: '2026-03-17' });

      expect(result).toEqual([
        { id: 4, issuedate: '2026-03-17T00:00:00.000Z', type: 'debit' },
      ]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('CAST(issueDate AS TEXT) ILIKE $1'),
        ['%2026-03-17%']
      );
    });

    test('searches adjustment notes by type', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 5, issuedate: '2026-03-16T00:00:00.000Z', type: 'credit' },
        ],
      });

      const result = await searchAdjustmentNotes({ query: 'credit' });

      expect(result).toEqual([
        { id: 5, issuedate: '2026-03-16T00:00:00.000Z', type: 'credit' },
      ]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('type ILIKE $1'),
        ['%credit%']
      );
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT when query is empty after trimming', async () => {
      await expect(
        searchAdjustmentNotes({ query: '   ' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT when query is too long', async () => {
      await expect(
        searchAdjustmentNotes({ query: 'a'.repeat(101) })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});