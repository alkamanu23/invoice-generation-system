import 'dotenv/config';
import request from 'sync-request-curl';
import config from '../../config.json';

const url: string = config.url;
const port: string = config.port;
const SERVER_URL = `${url}:${port}`;
const TIMEOUT_MS = 15 * 1000;

let VALID_TOKEN = '';

// TODO: fix this test file after getting gcp access

function post(path: string, body?: object) {
  return request('POST', `${SERVER_URL}${path}`, {
    json: body,
    timeout: TIMEOUT_MS,
    headers: VALID_TOKEN ? { Authorization: `Bearer ${VALID_TOKEN}` } : {},
  });
}

function bodyOf(res: ReturnType<typeof request>) {
  return JSON.parse(res.body.toString());
}

const validOrder = {
  order: {
    id: 'order-debit-translate-001',
    issueDate: '2026-03-15',
    note: ['Original order note'],
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Buyer Translate Test' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Seller Translate Test' }] },
    },
    orderLine: [
      {
        lineItem: {
          id: 'line-debit-translate-001',
          delivery: [],
          quantity: 1,
          item: {
            description: ['Original item description'],
            classifiedTaxCategory: [{ percent: '10', taxScheme: {} }],
          },
          price: { priceAmount: 100 },
          lineExtensionAmount: '100.00',
        },
      },
    ],
  },
};

beforeAll(() => {
  const loginRes = request('POST', `${SERVER_URL}/v1/auth/login`, {
    json: {
      username: process.env.TEST_USERNAME ?? 'testuser',
      password: process.env.TEST_PASSWORD ?? 'YourPassword123!',
    },
    timeout: TIMEOUT_MS,
  });

  const loginBody = bodyOf(loginRes);
  VALID_TOKEN = loginBody.token;
}, 30000);

describe('POST /v2/api/debitNotes/:id/translate', () => {
  let invoiceId: number;
  let debitNoteId: number;

  beforeAll(() => {
    const invoiceRes = post('/v1/api/invoices', validOrder);
    expect(invoiceRes.statusCode).toBe(200);

    const invoiceBody = bodyOf(invoiceRes);
    expect(invoiceBody.id).toBeDefined();
    invoiceId = Number(invoiceBody.id);

    const debitRes = post('/v1/api/adjNotes', {
      adjustmentType: 'debit',
      invoiceIdReference: invoiceId,
      reason: 'Debit note translation test reason',
      amount: 50,
      lines: [
        {
          quantity: 1,
          lineExtensionAmount: 50,
          price: { priceAmount: 50 },
          item: {
            name: 'Original debit item',
            description: ['Original debit item description'],
            classifiedTaxCategory: [
              { percent: '10', taxScheme: {} },
            ],
          },
        },
      ],
    });

    expect(debitRes.statusCode).toBe(201);

    const debitBody = bodyOf(debitRes);
    expect(debitBody.id).toBeDefined();
    debitNoteId = Number(debitBody.id);
  }, 30000);

  describe('success cases', () => {
    test('returns translated debit note for a valid target language', () => {
      const res = post(`/v2/api/debitNotes/${debitNoteId}/translate`, {
        targetLanguage: 'fr',
      });

      expect(res.statusCode).toBe(200);

      const body = bodyOf(res);
      expect(body.id).toBeDefined();
      expect(Number(body.id)).toBe(debitNoteId);
      expect(body.debitNoteLine).toBeDefined();
      expect(Array.isArray(body.debitNoteLine)).toBe(true);
    });

    test('returns a debit note with the expected structure', () => {
      const res = post(`/v2/api/debitNotes/${debitNoteId}/translate`, {
        targetLanguage: 'es',
      });

      expect(res.statusCode).toBe(200);

      const body = bodyOf(res);
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('issueDate');
      expect(body).toHaveProperty('accountingSupplierParty');
      expect(body).toHaveProperty('accountingCustomerParty');
      expect(body).toHaveProperty('legalMonetaryTotal');
      expect(body).toHaveProperty('debitNoteLine');
      expect(Array.isArray(body.debitNoteLine)).toBe(true);
      expect(body.debitNoteLine.length).toBeGreaterThan(0);
    });
  });

  describe('error cases', () => {
    test('returns 400 when targetLanguage is missing', () => {
      const res = post(`/v2/api/debitNotes/${debitNoteId}/translate`, {});
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 for invalid debit note id', () => {
      const res = post('/v2/api/debitNotes/abc/translate', {
        targetLanguage: 'fr',
      });

      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 for non-positive debit note id', () => {
      const res = post('/v2/api/debitNotes/0/translate', {
        targetLanguage: 'fr',
      });

      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 404 when debit note does not exist', () => {
      const res = post('/v2/api/debitNotes/999999/translate', {
        targetLanguage: 'fr',
      });

      expect(res.statusCode).toBe(404);
      expect(bodyOf(res)).toMatchObject({ error: 'NOT_FOUND' });
    });
  });
});