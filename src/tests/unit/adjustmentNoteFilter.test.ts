import { filterAdjustmentNotes } from '../../routes/adjustmentNoteFilter';
import pool from '../../db/db';

jest.mock('../../db/db', () => ({
  query: jest.fn(),
}));

describe('Adjustment Note Filter Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success cases', () => {
    test('returns all adjustment notes when no filters are provided', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 1, issuedate: '2026-03-20T00:00:00.000Z', type: 'credit' },
          { id: 2, issuedate: '2026-03-19T00:00:00.000Z', type: 'debit' },
        ],
      });

      const result = await filterAdjustmentNotes({});

      expect(result).toEqual([
        { id: 1, issuedate: '2026-03-20T00:00:00.000Z', type: 'credit' },
        { id: 2, issuedate: '2026-03-19T00:00:00.000Z', type: 'debit' },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM credit_note'),
        []
      );
    });

    test('filters by type', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 3, issuedate: '2026-03-18T00:00:00.000Z', type: 'credit' },
        ],
      });

      const result = await filterAdjustmentNotes({ type: 'credit' });

      expect(result).toEqual([
        { id: 3, issuedate: '2026-03-18T00:00:00.000Z', type: 'credit' },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND type = $1'),
        ['credit']
      );
    });

    test('filters by date range', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 4, issuedate: '2026-03-17T00:00:00.000Z', type: 'debit' },
        ],
      });

      const result = await filterAdjustmentNotes({
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });

      expect(result).toEqual([
        { id: 4, issuedate: '2026-03-17T00:00:00.000Z', type: 'debit' },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('issueDate::date >= $1'),
        ['2026-03-01', '2026-03-31']
      );
      expect((pool.query as jest.Mock).mock.calls[0][0]).toContain('issueDate::date <= $2');
    });

    test('filters by type and date range together', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { id: 5, issuedate: '2026-03-16T00:00:00.000Z', type: 'credit' },
        ],
      });

      const result = await filterAdjustmentNotes({
        type: 'credit',
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });

      expect(result).toEqual([
        { id: 5, issuedate: '2026-03-16T00:00:00.000Z', type: 'credit' },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND type = $1'),
        ['credit', '2026-03-01', '2026-03-31']
      );
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT for invalid type', async () => {
      await expect(
        filterAdjustmentNotes({ type: 'invalid' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT for invalid fromDate format', async () => {
      await expect(
        filterAdjustmentNotes({ fromDate: '03-01-2026' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT for invalid toDate format', async () => {
      await expect(
        filterAdjustmentNotes({ toDate: '03-31-2026' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT when fromDate is later than toDate', async () => {
      await expect(
        filterAdjustmentNotes({
          fromDate: '2026-04-01',
          toDate: '2026-03-01',
        })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});