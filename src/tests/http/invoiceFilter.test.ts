import 'dotenv/config';
import request from 'sync-request-curl';
import config from '../../config.json';
import fs from 'fs';
import path from 'path';

const url: string = config.url;
const port: string = config.port;
const SERVER_URL = `${url}:${port}`;
const TIMEOUT_MS = 15 * 1000;
const VALID_TOKEN = process.env.TEST_JWT ?? '';

beforeAll(async () => {
  const res = request('POST', `${SERVER_URL}/v1/auth/login`, {
    json: {
      username: process.env.TEST_USERNAME ?? 'testuser',
      password: process.env.TEST_PASSWORD ?? 'YourPassword123!',
    },
    timeout: TIMEOUT_MS,
  });

  const token = JSON.parse(res.body.toString()).token;
  process.env.TEST_JWT = token;
}, 30000);

function post(route: string, body?: object) {
  return request('POST', `${SERVER_URL}${route}`, {
    json: body,
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${process.env.TEST_JWT ?? VALID_TOKEN}` },
  });
}

function get(route: string) {
  return request('GET', `${SERVER_URL}${route}`, {
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${process.env.TEST_JWT ?? VALID_TOKEN}` },
  });
}

function bodyOf(res: ReturnType<typeof request>) {
  return JSON.parse(res.body.toString());
}

const validOrderA = {
  order: {
    id: 'order-filter-a',
    issueDate: '2026-03-10',
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Buyer A' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Seller A' }] },
    },
    orderLine: [
      {
        lineItem: {
          id: 'line-a',
          item: { name: 'Widget A' },
          lineExtensionAmount: '100.00',
        },
      },
    ],
  },
};

const validOrderB = {
  order: {
    id: 'order-filter-b',
    issueDate: '2026-03-20',
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Buyer B' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Seller B' }] },
    },
    orderLine: [
      {
        lineItem: {
          id: 'line-b',
          item: { name: 'Widget B' },
          lineExtensionAmount: '200.00',
        },
      },
    ],
  },
};

describe('GET /v2/api/invoices/filter', () => {
  let invoiceIdA: number;
  let invoiceIdB: number;

  beforeAll(() => {
    const resA = post('/v1/api/invoices', validOrderA);
    expect(resA.statusCode).toBe(200);
    const bodyA = bodyOf(resA);
    expect(bodyA.id).toBeDefined();
    invoiceIdA = Number(bodyA.id);

    const resB = post('/v1/api/invoices', validOrderB);
    expect(resB.statusCode).toBe(200);
    const bodyB = bodyOf(resB);
    expect(bodyB.id).toBeDefined();
    invoiceIdB = Number(bodyB.id);
  }, 30000);

  test('returns all invoices when no filters are provided', () => {
    const res = get('/v2/api/invoices/filter');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);

    const ids = body.map((inv: any) => Number(inv.id));

    expect(ids).toContain(invoiceIdA);
    expect(ids).toContain(invoiceIdB);
  });

  test('filters invoices by date range correctly', () => {
    const res = get('/v2/api/invoices/filter?fromDate=2026-04-01&toDate=2026-04-30');
    expect(res.statusCode).toBe(200);

    const body = bodyOf(res);
    expect(Array.isArray(body)).toBe(true);

    const ids = body.map((inv: any) => Number(inv.id));

    expect(ids).toContain(invoiceIdA);
    expect(ids).toContain(invoiceIdB);

    body.forEach((inv: any) => {
      const date = String(inv.issueDate).slice(0, 10);
      expect(date >= '2026-04-01').toBe(true);
      expect(date <= '2026-04-30').toBe(true);
    });
  });

  test('returns 400 for invalid supplierId', () => {
    const res = get('/v2/api/invoices/filter?supplierId=abc');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 for invalid customerId', () => {
    const res = get('/v2/api/invoices/filter?customerId=-1');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 for invalid fromDate format', () => {
    const res = get('/v2/api/invoices/filter?fromDate=03-01-2026');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 for invalid toDate format', () => {
    const res = get('/v2/api/invoices/filter?toDate=03-31-2026');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });

  test('returns 400 when fromDate is later than toDate', () => {
    const res = get('/v2/api/invoices/filter?fromDate=2026-04-01&toDate=2026-03-01');
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
  });
});