import 'dotenv/config';
import request from 'sync-request-curl';
import config from '../../config.json';

const url: string = config.url;
const port: string = config.port;
const SERVER_URL = `${url}:${port}`;
const TIMEOUT_MS = 15 * 1000;

let VALID_TOKEN = '';

function post(path: string, body?: object) {
  return request('POST', `${SERVER_URL}${path}`, {
    json: body,
    timeout: TIMEOUT_MS,
    headers: VALID_TOKEN ? { Authorization: `Bearer ${VALID_TOKEN}` } : {},
  });
}

function get(path: string) {
  return request('GET', `${SERVER_URL}${path}`, {
    timeout: TIMEOUT_MS,
    headers: VALID_TOKEN ? { Authorization: `Bearer ${VALID_TOKEN}` } : {},
  });
}

function bodyOf(res: ReturnType<typeof request>) {
  return JSON.parse(res.body.toString());
}

const validOrder = {
  order: {
    id: 'order-adj-search-001',
    issueDate: '2026-03-15',
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Buyer Adj Search' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Seller Adj Search' }] },
    },
    orderLine: [
      {
        lineItem: {
          id: 'line-adj-search-001',
          quantity: 1,
          item: {
            name: 'Adjustment Search Item',
            classifiedTaxCategory: [{ percent: '10' }],
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

describe('GET /v2/api/adjNotes/search', () => {
  let invoiceId: number;
  let creditNoteId: number;
  let debitNoteId: number;

  beforeAll(() => {
    const invoiceRes = post('/v1/api/invoices', validOrder);
    expect(invoiceRes.statusCode).toBe(200);

    const invoiceBody = bodyOf(invoiceRes);
    expect(invoiceBody.id).toBeDefined();
    invoiceId = Number(invoiceBody.id);

    const creditRes = post('/v1/api/adjNotes', {
      adjustmentType: 'credit',
      invoiceIdReference: invoiceId,
      reason: 'Credit adjustment reason',
      amount: 50,
      lines: [
        {
          quantity: 1,
          lineExtensionAmount: 50,
          price: { priceAmount: 50 },
          item: {
            name: 'Credit Search Item',
            classifiedTaxCategory: [{ percent: '10' }],
          },
        },
      ],
    });

    const creditBody = bodyOf(creditRes);
    expect(creditBody.id).toBeDefined();
    creditNoteId = Number(creditBody.id);

    const debitRes = post('/v1/api/adjNotes', {
      adjustmentType: 'debit',
      invoiceIdReference: invoiceId,
      reason: 'Debit adjustment reason',
      amount: 75,
      lines: [
        {
          quantity: 1,
          lineExtensionAmount: 75,
          price: { priceAmount: 75 },
          item: {
            name: 'Debit Search Item',
            classifiedTaxCategory: [{ percent: '10' }],
          },
        },
      ],
    });

    const debitBody = bodyOf(debitRes);
    expect(debitBody.id).toBeDefined();
    debitNoteId = Number(debitBody.id);
  }, 30000);

  test('returns all created adjustment notes when no query is provided', () => {
    const res = get('/v2/api/adjNotes/search');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);

    const ids = body.map((note: any) => Number(note.id));
    expect(ids).toContain(creditNoteId);
    expect(ids).toContain(debitNoteId);
  });

  test('searches adjustment notes by id', () => {
    const res = get(`/v2/api/adjNotes/search?query=${creditNoteId}`);
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);

    const ids = body.map((note: any) => Number(note.id));
    expect(ids).toContain(creditNoteId);
  });

  test('searches adjustment notes by issueDate', () => {
    const res = get('/v2/api/adjNotes/search?query=2026-04');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  test('searches adjustment notes by type', () => {
    const res = get('/v2/api/adjNotes/search?query=credit');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    body.forEach((note: any) => {
      expect(String(note.type).toLowerCase()).toBe('credit');
    });
  });

  test('returns 400 when query is empty', () => {
    const res = get('/v2/api/adjNotes/search?query=%20%20%20');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 when query is too long', () => {
    const longQuery = 'a'.repeat(101);
    const res = get(`/v2/api/adjNotes/search?query=${longQuery}`);
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });
});