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

// helpers
function post(endpoint: string, body: object) {
  return request('POST', `${SERVER_URL}${endpoint}`, {
    json: body,
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${process.env.TEST_JWT}` },
  });
}

function get(endpoint: string) {
  return request('GET', `${SERVER_URL}${endpoint}`, {
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${process.env.TEST_JWT}` },
  });
}

function bodyOf(res: ReturnType<typeof request>) {
  return JSON.parse(res.body.toString());
}

const validOrder = {
  order: {
    id: "order-001",
    issueDate: "2026-03-15",
    buyerCustomerParty: {
      party: {
        partyName: [{ name: "Buyer Co" }],
      },
    },
    sellerSupplierParty: {
      party: {
        partyName: [{ name: "Seller Co" }],
      },
    },
    orderLine: [
      {
        lineItem: {
          id: "line-001",
          item: { name: "Widget" },
          lineExtensionAmount: "100.00",
        },
      },
    ],
  },
};

// tests

describe('POST /v1/api/invoices', () => {
  describe('success cases', () => {
    test('returns 200 and a generated invoice', () => {
      const res = post('/v1/api/invoices', validOrder);
      expect(res.statusCode).toBe(200);
      const body = bodyOf(res);
      expect(typeof body.id).toBe('string');
      expect(typeof body.issueDate).toBe('string');
      expect(body.invoiceLine).toHaveLength(1);
    });

    test('invoice contains correct supplier and customer', () => {
      const res = post('/v1/api/invoices', validOrder);
      expect(res.statusCode).toBe(200);
      const body = bodyOf(res);
      expect(body.accountingSupplierParty.party.partyName[0].name).toBe('Seller Co');
      expect(body.accountingCustomerParty.party.partyName[0].name).toBe('Buyer Co');
    });

    test('invoice contains correct monetary total', () => {
      const res = post('/v1/api/invoices', validOrder);
      expect(res.statusCode).toBe(200);
      const body = bodyOf(res);
      expect(body.legalMonetaryTotal.payableAmount).toBe('100.00');
      expect(body.legalMonetaryTotal.lineExtensionAmount).toBe('100.00');
    });

    test('invoice line has correct amount and item', () => {
      const res = post('/v1/api/invoices', validOrder);
      expect(res.statusCode).toBe(200);
      const body = bodyOf(res);
      expect(body.invoiceLine[0].lineExtensionAmount).toBe('100.00');
      expect(body.invoiceLine[0].item.name).toBe('Widget');
    });

    test('sets dueDate to 30 days from issueDate', () => {
      const res = post('/v1/api/invoices', validOrder);
      expect(res.statusCode).toBe(200);
      const body = bodyOf(res);
      const expected = new Date();
      expected.setDate(expected.getDate() + 30);
      expect(body.dueDate).toBe(expected.toISOString().split('T')[0]);
    });
  });

  describe('error cases', () => {
    test('returns 400 if order is missing', () => {
      const res = post('/v1/api/invoices', {});
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if sellerSupplierParty is missing', () => {
      const res = post('/v1/api/invoices', {
        order: { ...validOrder.order, sellerSupplierParty: undefined }
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if buyerCustomerParty is missing', () => {
      const res = post('/v1/api/invoices', {
        order: { ...validOrder.order, buyerCustomerParty: undefined }
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if orderLine is empty', () => {
      const res = post('/v1/api/invoices', {
        order: { ...validOrder.order, orderLine: [] }
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });
  });
});

describe('GET /v1/api/invoices', () => {
  describe('success cases', () => {
    test('returns 200 and an array', () => {
      const res = get('/v1/api/invoices');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(bodyOf(res))).toBe(true);
    });

    test('returns created invoice in the list', () => {
      post('/v1/api/invoices', validOrder);
      const res = get('/v1/api/invoices');
      expect(res.statusCode).toBe(200);
      const body = bodyOf(res);
      expect(body.length).toBeGreaterThan(0);
    });
  });
});

describe('GET /v1/api/invoices/:id', () => {
  describe('success cases', () => {
    test('returns 200 and correct invoice for a valid ID', () => {
      const createRes = post('/v1/api/invoices', validOrder);
      expect(createRes.statusCode).toBe(200);
      const invoiceId = bodyOf(createRes).id;

      const res = get(`/v1/api/invoices/${invoiceId}`);
      expect(res.statusCode).toBe(200);
      expect(bodyOf(res).id).toBe(invoiceId);
    });

    test('returned invoice has expected fields', () => {
      const createRes = post('/v1/api/invoices', validOrder);
      const invoiceId = bodyOf(createRes).id;

      const res = get(`/v1/api/invoices/${invoiceId}`);
      const body = bodyOf(res);
      expect(typeof body.issueDate).toBe('string');
      expect(typeof body.legalMonetaryTotal).toBe('object');
      expect(Array.isArray(body.invoiceLine)).toBe(true);
    });
  });

  describe('error cases', () => {
    test('returns 400 for invalid ID format', () => {
      const res = get('/v1/api/invoices/notanumber');
      expect(res.statusCode).toBe(400);
    });

    test('returns 400 for negative ID', () => {
      const res = get('/v1/api/invoices/-1');
      expect(res.statusCode).toBe(400);
    });

    test('returns 404 for valid format ID that does not exist', () => {
      const res = get('/v1/api/invoices/999999');
      expect(res.statusCode).toBe(404);
      expect(bodyOf(res)).toMatchObject({ error: 'NOT_FOUND' });
    });
  });
});