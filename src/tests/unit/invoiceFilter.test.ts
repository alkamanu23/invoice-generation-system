import { filterInvoices } from '../../routes/invoiceFilter';
import pool from '../../db/db';

jest.mock('../../db/db', () => ({
  query: jest.fn(),
}));

describe('Invoice Filter Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success cases', () => {
    test('returns all invoices when no filters are provided', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { invoice_data: { id: 'INV-001' } },
          { invoice_data: { id: 'INV-002' } },
        ],
      });

      const result = await filterInvoices({});

      expect(result).toEqual([
        { id: 'INV-001' },
        { id: 'INV-002' },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT invoice_data'),
        []
      );
    });

    test('filters by invoiceID', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ invoice_data: { id: 'INV-001' } }],
      });

      const result = await filterInvoices({ invoiceID: 'INV-001' });

      expect(result).toEqual([{ id: 'INV-001' }]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND invoiceID = $1'),
        ['INV-001']
      );
    });

    test('filters by supplierId and customerId', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ invoice_data: { id: 'INV-003' } }],
      });

      await filterInvoices({
        supplierId: '1',
        customerId: '2',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND accountingSupplierPartyID = $1'),
        [1, 2]
      );
    });

    test('filters by date range', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ invoice_data: { id: 'INV-004' } }],
      });

      await filterInvoices({
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND issueDate >= $1'),
        ['2026-03-01', '2026-03-31']
      );
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT for invalid supplierId', async () => {
      await expect(
        filterInvoices({ supplierId: 'abc' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT for invalid customerId', async () => {
      await expect(
        filterInvoices({ customerId: '-1' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT for invalid fromDate format', async () => {
      await expect(
        filterInvoices({ fromDate: '03-01-2026' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT for invalid toDate format', async () => {
      await expect(
        filterInvoices({ toDate: '03-31-2026' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT when fromDate is later than toDate', async () => {
      await expect(
        filterInvoices({
          fromDate: '2026-04-01',
          toDate: '2026-03-01',
        })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});