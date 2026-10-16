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
    id: 'order-invoice-translate-001',
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
          id: 'line-invoice-translate-001',
          delivery: [],
          quantity: 1,
          item: {
            name: 'Original invoice item',
            description: ['Original invoice item description'],
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

describe('POST /v2/api/invoices/:id/translate', () => {
  let invoiceId: number;

  beforeAll(() => {
    const invoiceRes = post('/v1/api/invoices', validOrder);
    expect(invoiceRes.statusCode).toBe(200);

    const invoiceBody = bodyOf(invoiceRes);
    expect(invoiceBody.id).toBeDefined();
    invoiceId = Number(invoiceBody.id);
  }, 30000);

  describe('success cases', () => {
    test('returns translated invoice for a valid target language', () => {
      const res = post(`/v2/api/invoices/${invoiceId}/translate`, {
        targetLanguage: 'fr',
      });

      expect(res.statusCode).toBe(200);

      const body = bodyOf(res);
      expect(body.id).toBeDefined();
      expect(Number(body.id)).toBe(invoiceId);
      expect(body.invoiceLine).toBeDefined();
      expect(Array.isArray(body.invoiceLine)).toBe(true);
    });

    test('returns an invoice with the expected structure', () => {
      const res = post(`/v2/api/invoices/${invoiceId}/translate`, {
        targetLanguage: 'es',
      });

      expect(res.statusCode).toBe(200);

      const body = bodyOf(res);
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('issueDate');
      expect(body).toHaveProperty('accountingSupplierParty');
      expect(body).toHaveProperty('accountingCustomerParty');
      expect(body).toHaveProperty('legalMonetaryTotal');
      expect(body).toHaveProperty('invoiceLine');
      expect(Array.isArray(body.invoiceLine)).toBe(true);
      expect(body.invoiceLine.length).toBeGreaterThan(0);
    });
  });

  describe('error cases', () => {
    test('returns 400 when targetLanguage is missing', () => {
      const res = post(`/v2/api/invoices/${invoiceId}/translate`, {});
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 for invalid invoice id', () => {
      const res = post('/v2/api/invoices/abc/translate', {
        targetLanguage: 'fr',
      });

      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 for non-positive invoice id', () => {
      const res = post('/v2/api/invoices/0/translate', {
        targetLanguage: 'fr',
      });

      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 404 when invoice does not exist', () => {
      const res = post('/v2/api/invoices/999999/translate', {
        targetLanguage: 'fr',
      });

      expect(res.statusCode).toBe(404);
      expect(bodyOf(res)).toMatchObject({ error: 'NOT_FOUND' });
    });
  });
});