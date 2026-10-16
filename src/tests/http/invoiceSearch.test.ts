import 'dotenv/config';
import request from 'sync-request-curl';
import config from '../../config.json';

const url: string = config.url;
const port: string = config.port;
const SERVER_URL = `${url}:${port}`;
const TIMEOUT_MS = 15 * 1000;

let VALID_TOKEN = '';

beforeAll(() => {
  const res = request('POST', `${SERVER_URL}/v1/auth/login`, {
    json: {
      username: process.env.TEST_USERNAME ?? 'testuser',
      password: process.env.TEST_PASSWORD ?? 'YourPassword123!',
    },
    timeout: TIMEOUT_MS,
  });

  VALID_TOKEN = JSON.parse(res.body.toString()).token;
}, 30000);

function post(route: string, body?: object) {
  return request('POST', `${SERVER_URL}${route}`, {
    json: body,
    timeout: TIMEOUT_MS,
    headers: VALID_TOKEN ? { Authorization: `Bearer ${VALID_TOKEN}` } : {},
  });
}

function get(route: string) {
  return request('GET', `${SERVER_URL}${route}`, {
    timeout: TIMEOUT_MS,
    headers: VALID_TOKEN ? { Authorization: `Bearer ${VALID_TOKEN}` } : {},
  });
}

function bodyOf(res: ReturnType<typeof request>) {
  return JSON.parse(res.body.toString());
}

const validOrder = {
  order: {
    id: 'order-search-test',
    issueDate: '2026-03-15',
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Buyer Search Test' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Seller Search Test' }] },
    },
    orderLine: [
      {
        lineItem: {
          id: 'line-search',
          item: { name: 'Widget Search' },
          lineExtensionAmount: '100.00',
        },
      },
    ],
  },
};

describe('GET /v2/api/invoices/search', () => {
  let invoiceId: number;

  beforeAll(() => {
    const res = post('/v1/api/invoices', validOrder);
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(body.id).toBeDefined();
    invoiceId = Number(body.id);
  }, 30000);

  test('returns all invoices when no query is provided', () => {
    const res = get('/v2/api/invoices/search');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);

    const ids = body.map((inv: any) => Number(inv.id));
    expect(ids).toContain(invoiceId);
  });

  test('searches invoices by id', () => {
    const res = get(`/v2/api/invoices/search?query=${invoiceId}`);
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    const ids = body.map((inv: any) => Number(inv.id));

    expect(ids).toContain(invoiceId);
  });

  test('returns empty array when no invoices match the query', () => {
    const res = get('/v2/api/invoices/search?query=no-match-xyz-123');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  test('returns 400 when query is empty', () => {
    const res = get('/v2/api/invoices/search?query=%20%20%20');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 when query is too long', () => {
    const longQuery = 'a'.repeat(101);

    const res = get(`/v2/api/invoices/search?query=${longQuery}`);
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });
});