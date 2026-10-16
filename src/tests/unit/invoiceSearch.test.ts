import { searchInvoices } from '../../routes/invoiceSearch';
import pool from '../../db/db';

jest.mock('../../db/db', () => ({
  query: jest.fn(),
}));

describe('Invoice Search Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success cases', () => {
    test('returns all invoices when no query is provided', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { invoice_data: { id: 'INV-001' } },
          { invoice_data: { id: 'INV-002' } },
        ],
      });

      const result = await searchInvoices({});

      expect(result).toEqual([
        { id: 'INV-001' },
        { id: 'INV-002' },
      ]);
    });

    test('searches invoices by query', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ invoice_data: { id: 'INV-003' } }],
      });

      const result = await searchInvoices({ query: 'INV-003' });

      expect(result).toEqual([{ id: 'INV-003' }]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE $1'),
        ['%INV-003%']
      );
    });

    test('trims query before searching', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ invoice_data: { id: 'INV-004' } }],
      });

      await searchInvoices({ query: '  INV-004  ' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE $1'),
        ['%INV-004%']
      );
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT when query is empty', async () => {
      await expect(
        searchInvoices({ query: '   ' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT when query is too long', async () => {
      const longQuery = 'a'.repeat(101);

      await expect(
        searchInvoices({ query: longQuery })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});