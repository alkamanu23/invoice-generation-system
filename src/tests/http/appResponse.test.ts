import 'dotenv/config';
import request from "sync-request-curl";
import config from '../../config.json';
import fs from 'fs';
import path from 'path';

beforeAll(async () => {
  const res = request('POST', `${SERVER_URL}/v1/auth/login`, {
    json: {
      username: process.env.TEST_USERNAME ?? 'testuser',
      password: process.env.TEST_PASSWORD ?? 'YourPassword123!',
    },
    timeout: TIMEOUT_MS,
  });
  const token = JSON.parse(res.body.toString()).token;

  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('TEST_JWT=')) {
    envContent = envContent.replace(/TEST_JWT=.*/,  `TEST_JWT=${token}`);
  } else {
    envContent += `\nTEST_JWT=${token}`;
  }
  fs.writeFileSync(envPath, envContent);

  process.env.TEST_JWT = token;
}, 30000);

const url: string = config.url;
const port: string = config.port;
const SERVER_URL = `${url}:${port}`;
const TIMEOUT_MS = 15 * 1000;
const VALID_TOKEN = process.env.TEST_JWT ?? '';

// helpers

function post(path: string, body?: object) {
  return request('POST', `${SERVER_URL}${path}`, {
    json: body,
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${VALID_TOKEN}` },
  });
}

function get(path: string) {
  return request('GET', `${SERVER_URL}${path}`, {
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${VALID_TOKEN}` },
  });
}

function bodyOf(res: ReturnType<typeof request>) {
  return JSON.parse(res.body.toString());
}

const validOrder = {
  order: {
    id: 'order-001',
    issueDate: '2026-03-15',
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Buyer Co' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Seller Co' }] },
    },
    orderLine: [
      {
        lineItem: {
          id: 'line-001',
          item: { name: 'Widget' },
          lineExtensionAmount: '100.00',
        },
      },
    ],
  },
};

// tests

describe('POST /v1/api/appResponses', () => {
  let testInvoiceId: number;

  beforeAll(() => {
    const res = post('/v1/api/invoices', validOrder);
    testInvoiceId = Number(bodyOf(res).id);
  }, 30000);

  describe('success cases', () => {
    test('returns 200 and a generated response', () => {
      const res = post('/v1/api/appResponses', {
        invoiceId: testInvoiceId,
        responseType: 'accepted',
        remarks: 'Looks good',
      });
      expect(res.statusCode).toBe(200);
      const body = bodyOf(res);
      expect(typeof body.responseId).toBe('string');
      expect(body.status).toBe('accepted');
      expect(typeof body.createdAt).toBe('string');
    });
  });

  describe('error cases', () => {
    test('returns 400 if invoiceId is missing', () => {
      const res = post('/v1/api/appResponses', { responseType: 'accepted', remarks: 'missing id' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if invoiceId is negative', () => {
      const res = post('/v1/api/appResponses', { invoiceId: -1, responseType: 'accepted', remarks: 'negative id' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if invoiceId is zero', () => {
      const res = post('/v1/api/appResponses', { invoiceId: 0, responseType: 'accepted', remarks: 'zero id' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if responseType is missing', () => {
      const res = post('/v1/api/appResponses', { invoiceId: testInvoiceId, remarks: 'missing responseType' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if remarks is missing', () => {
      const res = post('/v1/api/appResponses', { invoiceId: testInvoiceId, responseType: 'accepted' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 404 if invoice does not exist', () => {
      const res = post('/v1/api/appResponses', {
        invoiceId: 999999,
        responseType: 'accepted',
        remarks: 'Non-existent invoice',
      });
      expect(res.statusCode).toBe(404);
      expect(bodyOf(res)).toMatchObject({ error: 'NOT_FOUND' });
    });
  });
});

describe('GET /v1/api/appResponses', () => {
  describe('success cases', () => {
    test('returns 200 and an array', () => {
      const res = get('/v1/api/appResponses');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(bodyOf(res))).toBe(true);
    });

    test('returns responses in the list', () => {
      const res = get('/v1/api/appResponses');
      expect(res.statusCode).toBe(200);
      expect(bodyOf(res).length).toBeGreaterThan(0);
    });
  });
});

describe('GET /v1/api/appResponses/:responseId', () => {
  let testResponseId: string;

  beforeAll(() => {
    const invoiceRes = post('/v1/api/invoices', validOrder);
    const invoiceId = Number(bodyOf(invoiceRes).id);

    const res = post('/v1/api/appResponses', {
      invoiceId,
      responseType: 'accepted',
      remarks: 'Find me',
    });
    testResponseId = bodyOf(res).responseId;
  }, 30000);

  describe('success cases', () => {
    test('returns 200 and correct data for a valid ID', () => {
      const res = get(`/v1/api/appResponses/${testResponseId}`);
      expect(res.statusCode).toBe(200);
      expect(Number(bodyOf(res).id)).toBe(Number(testResponseId));
    });
  });

  describe('error cases', () => {
    test('returns 400 for invalid ID format', () => {
      const res = get('/v1/api/appResponses/notanumber');
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 404 for a valid format ID that does not exist', () => {
      const res = get('/v1/api/appResponses/999999');
      expect(res.statusCode).toBe(404);
      expect(bodyOf(res)).toMatchObject({ error: 'NOT_FOUND' });
    });
  });
});