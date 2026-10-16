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
    id: 'order-app-filter-001',
    issueDate: '2026-03-15',
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Buyer App Filter' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Seller App Filter' }] },
    },
    orderLine: [
      {
        lineItem: {
          id: 'line-app-filter-001',
          item: { name: 'Widget App Filter' },
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

describe('GET /v2/api/appResponses/filter', () => {
  let invoiceId: number;
  let acceptedResponseId: number;
  let rejectedResponseId: number;

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

    const acceptedBody = bodyOf(acceptedRes);
    expect(acceptedBody.responseId).toBeDefined();
    acceptedResponseId = Number(acceptedBody.responseId);

    const rejectedRes = post('/v1/api/appResponses', {
      invoiceId,
      responseType: 'rejected',
      remarks: 'Rejected response',
    });
    expect(rejectedRes.statusCode).toBe(200);

    const rejectedBody = bodyOf(rejectedRes);
    expect(rejectedBody.responseId).toBeDefined();
    rejectedResponseId = Number(rejectedBody.responseId);
  }, 30000);

  test('returns all created application responses when no filters are provided', () => {
    const res = get('/v2/api/appResponses/filter');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);

    const matchingResponses = body.filter((appRes: any) => {
      const documentResponses = appRes.documentResponse ?? [];
      return documentResponses.some((dr: any) => {
        const docRefId = dr.documentReference?.[0]?.id;
        return String(docRefId) === String(invoiceId);
      });
    });

    expect(matchingResponses.length).toBeGreaterThanOrEqual(2);

    const responseCodes = matchingResponses.map((appRes: any) => {
      const dr = appRes.documentResponse?.[0];
      return String(dr?.response?.responseCode ?? '').toLowerCase();
    });

    expect(responseCodes).toContain('accepted');
    expect(responseCodes).toContain('rejected');
  });

  test('filters by responseCode', () => {
    const res = get('/v2/api/appResponses/filter?responseCode=accepted');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    body.forEach((appRes: any) => {
      const dr = appRes.documentResponse?.[0];
      const code = String(dr?.response?.responseCode ?? '').toLowerCase();
      expect(code).toBe('accepted');
    });
  });

  test('filters by invoiceId', () => {
    const res = get(`/v2/api/appResponses/filter?invoiceId=${invoiceId}`);
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    body.forEach((appRes: any) => {
      const dr = appRes.documentResponse?.[0];
      const returnedInvoiceId = String(dr?.documentReference?.[0]?.id ?? '');
      expect(returnedInvoiceId).toBe(String(invoiceId));
    });
  });

  test('filters by date range', () => {
    const res = get('/v2/api/appResponses/filter?fromDate=2026-03-01&toDate=2026-03-31');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
  });

  test('returns 400 for invalid senderId', () => {
    const res = get('/v2/api/appResponses/filter?senderId=abc');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 for invalid receiverId', () => {
    const res = get('/v2/api/appResponses/filter?receiverId=-1');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 for invalid fromDate format', () => {
    const res = get('/v2/api/appResponses/filter?fromDate=03-01-2026');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 for invalid toDate format', () => {
    const res = get('/v2/api/appResponses/filter?toDate=03-31-2026');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 when fromDate is later than toDate', () => {
    const res = get('/v2/api/appResponses/filter?fromDate=2026-04-01&toDate=2026-03-01');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });
});