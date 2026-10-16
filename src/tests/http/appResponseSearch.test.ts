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
    id: 'order-app-search-001',
    issueDate: '2026-03-15',
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Buyer App Search' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Seller App Search' }] },
    },
    orderLine: [
      {
        lineItem: {
          id: 'line-app-search-001',
          item: { name: 'Widget App Search' },
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

  VALID_TOKEN = bodyOf(loginRes).token;
}, 30000);

describe('GET /v2/api/appResponses/search', () => {
  let invoiceId: number;

  beforeAll(() => {
    const invoiceRes = post('/v1/api/invoices', validOrder);
    expect(invoiceRes.statusCode).toBe(200);

    const invoiceBody = bodyOf(invoiceRes);
    expect(invoiceBody.id).toBeDefined();
    invoiceId = Number(invoiceBody.id);

    const acceptedRes = post('/v1/api/appResponses', {
      invoiceId,
      responseType: 'accepted',
      remarks: 'Accepted response',
    });
    expect(acceptedRes.statusCode).toBe(200);

    const rejectedRes = post('/v1/api/appResponses', {
      invoiceId,
      responseType: 'rejected',
      remarks: 'Rejected response',
    });
    expect(rejectedRes.statusCode).toBe(200);
  }, 30000);

  test('returns all created application responses when no query is provided', () => {
    const res = get('/v2/api/appResponses/search');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  test('searches by responseCode', () => {
    const res = get('/v2/api/appResponses/search?query=accepted');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    body.forEach((appRes: any) => {
      const dr = appRes.documentResponse?.[0];
      const code = String(dr?.response?.responseCode ?? '').toLowerCase();
      expect(code).toContain('accepted');
    });
  });

  test('searches by invoiceId', () => {
    const res = get(`/v2/api/appResponses/search?query=${invoiceId}`);
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  test('searches by issue date text', () => {
    const res = get('/v2/api/appResponses/search?query=2026-04');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
  });

  test('returns 400 when query is empty', () => {
    const res = get(`/v2/api/appResponses/search?query=%20%20%20`);
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 when query is too long', () => {
    const longQuery = 'a'.repeat(101);
    const res = get(`/v2/api/appResponses/search?query=${longQuery}`);
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });
});