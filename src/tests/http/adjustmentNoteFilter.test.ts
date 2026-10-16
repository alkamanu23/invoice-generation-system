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
    id: 'order-adj-filter-001',
    issueDate: '2026-03-15',
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Buyer Adj Filter' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Seller Adj Filter' }] },
    },
    orderLine: [
      {
        lineItem: {
          id: 'line-adj-filter-001',
          quantity: 1,
          item: {
            name: 'Adjustment Item',
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

describe('GET /v2/api/adjNotes/filter', () => {
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
            name: 'Credit Item',
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
            name: 'Debit Item',
            classifiedTaxCategory: [{ percent: '10' }],
          },
        },
      ],
    });

    const debitBody = bodyOf(debitRes);
    expect(debitBody.id).toBeDefined();
    debitNoteId = Number(debitBody.id);
  }, 30000);

  test('returns all created adjustment notes when no filters are provided', () => {
    const res = get('/v2/api/adjNotes/filter');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);

    const ids = body.map((note: any) => Number(note.id));
    expect(ids).toContain(creditNoteId);
    expect(ids).toContain(debitNoteId);

    const types = body
      .filter((note: any) =>
        Number(note.id) === creditNoteId || Number(note.id) === debitNoteId
      )
      .map((note: any) => String(note.type).toLowerCase());

    expect(types).toContain('credit');
    expect(types).toContain('debit');
  });

  test('filters by type and returns only credit adjustment notes', () => {
    const res = get('/v2/api/adjNotes/filter?type=credit');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    const ids = body.map((note: any) => Number(note.id));
    expect(ids).toContain(creditNoteId);

    body.forEach((note: any) => {
      expect(String(note.type).toLowerCase()).toBe('credit');
    });
  });

  test('filters by date range', () => {
    const res = get('/v2/api/adjNotes/filter?fromDate=2026-03-01&toDate=2026-03-31');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
  });

  test('returns 400 for invalid type', () => {
    const res = get('/v2/api/adjNotes/filter?type=invalid');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 for invalid fromDate format', () => {
    const res = get('/v2/api/adjNotes/filter?fromDate=03-01-2026');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 for invalid toDate format', () => {
    const res = get('/v2/api/adjNotes/filter?toDate=03-31-2026');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 when fromDate is later than toDate', () => {
    const res = get('/v2/api/adjNotes/filter?fromDate=2026-04-01&toDate=2026-03-01');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });
});