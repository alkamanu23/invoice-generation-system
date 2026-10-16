import * as appResponseLogic from '../../routes/appResponse';
import * as repo from '../../repositories/appResponsesRepository';
import pool from '../../db/db';

jest.mock('../../db/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../repositories/appResponsesRepository', () => ({
  insertAppResponse: jest.fn(),
  getAllResponses: jest.fn(),
  getResponseById: jest.fn(),
}));

describe('AppResponse Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAppResponse', () => {
    describe('success cases', () => {
      test('returns responseId, status, and createdAt on success', async () => {
        (pool.query as jest.Mock).mockResolvedValueOnce({
          rows: [{ accountingsupplierpartyid: 10, accountingcustomerpartyid: 20 }],
        });
        (repo.insertAppResponse as jest.Mock).mockResolvedValueOnce({
          id: '101',
          status: 'accepted',
        });

        const result = await appResponseLogic.generateAppResponse({
          invoiceId: 1,
          responseType: 'accepted',
          remarks: 'Full coverage test',
        });

        expect(result.responseId).toBe('101');
        expect(result.status).toBe('accepted');
        expect(typeof result.createdAt).toBe('string');
      });

      test('calls repo.insertAppResponse with correct payload shape', async () => {
        (pool.query as jest.Mock).mockResolvedValueOnce({
          rows: [{ accountingsupplierpartyid: 10, accountingcustomerpartyid: 20 }],
        });
        (repo.insertAppResponse as jest.Mock).mockResolvedValueOnce({
          id: '55',
          status: 'rejected',
        });

        await appResponseLogic.generateAppResponse({
          invoiceId: 5,
          responseType: 'rejected',
          remarks: 'Missing info',
        });

        const payload = (repo.insertAppResponse as jest.Mock).mock.calls[0][0];
        expect(payload.note).toEqual(['Missing info']);
        expect(payload.documentResponse[0].response.responseCode).toBe('rejected');
        expect(payload.documentResponse[0].documentReference[0].id).toBe('5');
        expect(payload.senderParty.partyIdentification[0].id).toBe(20);
        expect(payload.receiverParty.partyIdentification[0].id).toBe(10);
      });
    });

    describe('error cases', () => {
      test('returns INVALID_INPUT for invoiceId of 0', async () => {
        await expect(
          appResponseLogic.generateAppResponse({ invoiceId: 0 } as any)
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      });

      test('returns INVALID_INPUT for negative invoiceId', async () => {
        await expect(
          appResponseLogic.generateAppResponse({ invoiceId: -1 } as any)
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      });

      test('returns INVALID_INPUT if responseType is missing', async () => {
        await expect(
          appResponseLogic.generateAppResponse({ invoiceId: 1, remarks: 'B' } as any)
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      });

      test('returns INVALID_INPUT if remarks is missing', async () => {
        await expect(
          appResponseLogic.generateAppResponse({ invoiceId: 1, responseType: 'A' } as any)
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      });

      test('returns NOT_FOUND if invoice does not exist', async () => {
        (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
        await expect(
          appResponseLogic.generateAppResponse({ invoiceId: 99, responseType: 'A', remarks: 'B' })
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      });

      test('propagates error from repo.insertAppResponse', async () => {
        (pool.query as jest.Mock).mockResolvedValueOnce({
          rows: [{ accountingsupplierpartyid: 10, accountingcustomerpartyid: 20 }],
        });
        (repo.insertAppResponse as jest.Mock).mockRejectedValueOnce(
          new Error('DB insert failed')
        );

        await expect(
          appResponseLogic.generateAppResponse({ invoiceId: 1, responseType: 'A', remarks: 'B' })
        ).rejects.toThrow('DB insert failed');
      });
    });
  });

  describe('getAppResponses', () => {
    describe('success cases', () => {
      test('returns mapped responses with responseId from repo', async () => {
        (repo.getAllResponses as jest.Mock).mockResolvedValueOnce([
          {
            id: '50',
            issueDate: '2026-03-15',
            documentResponse: [{ response: { responseCode: 'accepted' } }],
          },
        ]);

        const res = await appResponseLogic.getAppResponses();
        expect(res).toHaveLength(1);
        expect(res[0]?.responseId).toBe('50');
        expect(res[0]?.status).toBe('accepted');
        expect(res[0]?.createdAt).toBe('2026-03-15');
      });

      test('falls back to "generated" status when documentResponse is missing', async () => {
        (repo.getAllResponses as jest.Mock).mockResolvedValueOnce([
          {
            id: '51',
            issueDate: '2026-03-15',
            documentResponse: undefined,
          },
        ]);

        const res = await appResponseLogic.getAppResponses();
        expect(res[0]?.status).toBe('generated');
      });

      test('returns empty array when no responses exist', async () => {
        (repo.getAllResponses as jest.Mock).mockResolvedValueOnce([]);
        const res = await appResponseLogic.getAppResponses();
        expect(res).toEqual([]);
      });
    });
  });

  describe('getAppResponseById', () => {
    describe('success cases', () => {
      test('returns ApplicationResponse for valid ID', async () => {
        const mockResponse = {
          id: '1',
          issueDate: '2026-03-15',
          senderParty: { partyIdentification: [{ id: 'S1' }] },
          receiverParty: { partyIdentification: [{ id: 'R1' }] },
          documentResponse: [],
          note: [],
        };
        (repo.getResponseById as jest.Mock).mockResolvedValueOnce(mockResponse);

        const res = await appResponseLogic.getAppResponseById('1');
        expect(res.id).toBe('1');
        expect(res.issueDate).toBe('2026-03-15');
      });
    });

    describe('error cases', () => {
      test('returns INVALID_INPUT for non-numeric ID', async () => {
        await expect(
          appResponseLogic.getAppResponseById('nan')
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      });

      test('returns INVALID_INPUT for empty string ID', async () => {
        await expect(
          appResponseLogic.getAppResponseById('')
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      });

      test('returns NOT_FOUND when repo returns null/undefined', async () => {
        (repo.getResponseById as jest.Mock).mockResolvedValueOnce(null);
        await expect(
          appResponseLogic.getAppResponseById('999')
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      });

      test('calls repo.getResponseById with parsed integer', async () => {
        (repo.getResponseById as jest.Mock).mockResolvedValueOnce({
          id: '7',
          issueDate: '2026-01-01',
          documentResponse: [],
          note: [],
        });

        await appResponseLogic.getAppResponseById('7');
        expect(repo.getResponseById as jest.Mock).toHaveBeenCalledWith(7);
      });
    });
  });
});