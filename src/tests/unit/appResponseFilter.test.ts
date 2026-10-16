import { filterAppResponses } from '../../routes/appResponseFilter';
import pool from '../../db/db';

jest.mock('../../db/db', () => ({
  query: jest.fn(),
}));

describe('AppResponse Filter Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success cases', () => {
    test('returns all app responses when no filters are provided', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { application_response_data: { id: '1', note: ['A'] } },
          { application_response_data: { id: '2', note: ['B'] } },
        ],
      });

      const result = await filterAppResponses({});

      expect(result).toEqual([
        { id: '1', note: ['A'] },
        { id: '2', note: ['B'] },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM application_responses ar'),
        []
      );
    });

    test('filters by responseCode', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { application_response_data: { id: '10', note: ['accepted'] } },
        ],
      });

      const result = await filterAppResponses({ responseCode: 'accepted' });

      expect(result).toEqual([
        { id: '10', note: ['accepted'] },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining(`r.response_data->>'responseCode' = $1`),
        ['accepted']
      );
    });

    test('filters by invoiceId', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { application_response_data: { id: '11', note: ['invoice match'] } },
        ],
      });

      const result = await filterAppResponses({ invoiceId: '123' });

      expect(result).toEqual([
        { id: '11', note: ['invoice match'] },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('dref.document_reference_id = $1'),
        ['123']
      );
    });

    test('filters by senderId and receiverId', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { application_response_data: { id: '12', note: ['party match'] } },
        ],
      });

      const result = await filterAppResponses({
        senderId: '1',
        receiverId: '2',
      });

      expect(result).toEqual([
        { id: '12', note: ['party match'] },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ar.sender_party_id = $1'),
        [1, 2]
      );
      expect((pool.query as jest.Mock).mock.calls[0][0]).toContain('ar.receiver_party_id = $2');
    });

    test('filters by date range', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { application_response_data: { id: '13', note: ['date match'] } },
        ],
      });

      const result = await filterAppResponses({
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });

      expect(result).toEqual([
        { id: '13', note: ['date match'] },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ar.issue_date >= $1'),
        ['2026-03-01', '2026-03-31']
      );
      expect((pool.query as jest.Mock).mock.calls[0][0]).toContain('ar.issue_date <= $2');
    });

    test('filters by multiple fields together', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { application_response_data: { id: '14', note: ['full match'] } },
        ],
      });

      const result = await filterAppResponses({
        responseCode: 'accepted',
        invoiceId: '55',
        senderId: '7',
        receiverId: '8',
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });

      expect(result).toEqual([
        { id: '14', note: ['full match'] },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining(`r.response_data->>'responseCode' = $1`),
        ['accepted', '55', 7, 8, '2026-03-01', '2026-03-31']
      );
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT for invalid senderId', async () => {
      await expect(
        filterAppResponses({ senderId: 'abc' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT for invalid receiverId', async () => {
      await expect(
        filterAppResponses({ receiverId: '-1' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT for invalid fromDate format', async () => {
      await expect(
        filterAppResponses({ fromDate: '03-01-2026' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT for invalid toDate format', async () => {
      await expect(
        filterAppResponses({ toDate: '03-31-2026' })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('throws INVALID_INPUT when fromDate is later than toDate', async () => {
      await expect(
        filterAppResponses({
          fromDate: '2026-04-01',
          toDate: '2026-03-01',
        })
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});