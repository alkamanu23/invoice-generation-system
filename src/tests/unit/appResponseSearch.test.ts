import { searchAppResponses } from '../../routes/appResponseSearch';
import pool from '../../db/db';

jest.mock('../../db/db', () => ({
  query: jest.fn(),
}));

describe('AppResponse Search Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success cases', () => {
    test('returns all app responses when no query is provided', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            ar_id: 1,
            issue_date: '2026-03-15',
            application_response_data: {
              documentResponse: [{ response: { responseCode: 'accepted' } }]
            }
          },
          {
            ar_id: 2,
            issue_date: '2026-03-16',
            application_response_data: {
              documentResponse: [{ response: { responseCode: 'rejected' } }]
            }
          },
        ],
      });

      const result = await searchAppResponses({});

      expect(result).toEqual([
        { documentResponse: [{ response: { responseCode: 'accepted' } }] },
        { documentResponse: [{ response: { responseCode: 'rejected' } }] },
      ]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM application_responses ar'),
        []
      );
    });

    test('searches app responses by responseCode text', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            ar_id: 10,
            issue_date: '2026-03-15',
            application_response_data: {
              documentResponse: [{ response: { responseCode: 'accepted' } }]
            }
          },
        ],
      });

      const result = await searchAppResponses({ query: 'accepted' });

      expect(result).toEqual([{ documentResponse: [{ response: { responseCode: 'accepted' } }] }]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('r.response_data::text ILIKE $1'),
        ['%accepted%']
      );
    });

    test('searches app responses by invoiceId text', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            ar_id: 11,
            issue_date: '2026-03-15',
            application_response_data: {
              documentResponse: [{ response: { responseCode: 'accepted' } }]
            }
          },
        ],
      });

      const result = await searchAppResponses({ query: '123' });

      expect(result).toEqual([{ documentResponse: [{ response: { responseCode: 'accepted' } }] }]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('dref.document_reference_id::text ILIKE $1'),
        ['%123%']
      );
    });

    test('searches app responses by issue date text', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            ar_id: 12,
            issue_date: '2026-03-15',
            application_response_data: {
              documentResponse: [{ response: { responseCode: 'accepted' } }]
            }
          },
        ],
      });

      const result = await searchAppResponses({ query: '2026-03' });

      expect(result).toEqual([{ documentResponse: [{ response: { responseCode: 'accepted' } }] }]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ar.issue_date::text ILIKE $1'),
        ['%2026-03%']
      );
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT when query is empty after trimming', async () => {
      await expect(
        searchAppResponses({ query: '   ' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT when query is too long', async () => {
      await expect(
        searchAppResponses({ query: 'a'.repeat(101) })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});