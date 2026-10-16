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

const ENDPOINT = '/v1/convert/json-to-xml';

// helpers

function post(body: object) {
  return request('POST', `${SERVER_URL}${ENDPOINT}`, {
    json: body,
    timeout: TIMEOUT_MS,
  });
}

function postAuth(endpoint: string, body: object) {
  return request('POST', `${SERVER_URL}${endpoint}`, {
    json: body,
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${VALID_TOKEN}` },
  });
}

function getAuth(endpoint: string) {
  return request('GET', `${SERVER_URL}${endpoint}`, {
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${VALID_TOKEN}` },
  });
}

function bodyOf(res: ReturnType<typeof request>) {
  return JSON.parse(res.body.toString());
}

function xmlBodyOf(res: ReturnType<typeof request>) {
  return res.body.toString();
}

const validOrder = {
  order: {
    id: 'INV-2026-001',
    issueDate: '2026-03-15',
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Acme Corp' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Globex Supplies' }] },
    },
    orderLine: [
      {
        lineItem: {
          id: 'line-001',
          item: { name: 'Office Chair' },
          lineExtensionAmount: '500.00',
        },
      },
    ],
  },
};

// tests

describe('POST /v1/convert/json-to-xml', () => {
  describe('success cases', () => {
    test('returns 200 for a simple object', () => {
      const res = post({ json: { invoiceId: 'INV-2026-001' } });
      expect(res.statusCode).toBe(200);
    });

    test('returns xml content-type', () => {
      const res = post({ json: { invoiceId: 'INV-2026-001' } });
      expect(res.headers['content-type']).toMatch(/application\/xml/);
    });

    test('converts a simple key-value pair', () => {
      const res = post({ json: { supplierName: 'Globex Supplies' } });
      expect(res.statusCode).toBe(200);
      expect(xmlBodyOf(res)).toContain('<supplierName>Globex Supplies</supplierName>');
    });

    test('converts nested objects', () => {
      const res = post({ json: { invoice: { supplier: 'Globex Supplies', totalAmount: 5000 } } });
      expect(res.statusCode).toBe(200);
      const xml = xmlBodyOf(res);
      expect(xml).toContain('<supplier>Globex Supplies</supplier>');
      expect(xml).toContain('<totalAmount>5000</totalAmount>');
    });

    test('converts attributes (prefixed with @_)', () => {
      const res = post({ json: { Invoice: { '@_id': 'INV-2026-001', '#text': 'Tax Invoice' } } });
      expect(res.statusCode).toBe(200);
      expect(xmlBodyOf(res)).toContain('id="INV-2026-001"');
    });

    test('converts arrays into sibling elements', () => {
      const res = post({ json: { orderLines: { item: ['Office Chair', 'Standing Desk', 'Monitor Stand'] } } });
      expect(res.statusCode).toBe(200);
      const xml = xmlBodyOf(res);
      expect(xml).toContain('<item>Office Chair</item>');
      expect(xml).toContain('<item>Standing Desk</item>');
      expect(xml).toContain('<item>Monitor Stand</item>');
    });

    test('handles deeply nested objects', () => {
      const res = post({ json: { order: { buyer: { contact: { email: 'procurement@acme.com' } } } } });
      expect(res.statusCode).toBe(200);
      expect(xmlBodyOf(res)).toContain('<email>procurement@acme.com</email>');
    });
  });

  describe('error cases', () => {
    test('returns 400 when json field is missing', () => {
      const res = post({});
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when json is null', () => {
      const res = post({ json: null });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when json is a string', () => {
      const res = post({ json: 'INV-2026-001' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when json is a number', () => {
      const res = post({ json: 5000 });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when json is an array', () => {
      const res = post({ json: ['INV-2026-001', 'INV-2026-002'] });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when json is an empty object', () => {
      const res = post({ json: {} });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });
  });
});

describe('Invoice round-trip: create → fetch → convert to XML → convert back to JSON', () => {
  let invoiceId: string;
  let originalInvoice: object;

  beforeAll(() => {
    const createRes = postAuth('/v1/api/invoices', validOrder);
    expect(createRes.statusCode).toBe(200);
    invoiceId = bodyOf(createRes).id;

    const fetchRes = getAuth(`/v1/api/invoices/${invoiceId}`);
    expect(fetchRes.statusCode).toBe(200);
    originalInvoice = bodyOf(fetchRes);
  }, 30000);

  test('invoice can be converted to XML', () => {
    const res = post({ json: { Invoice: originalInvoice } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    const xml = xmlBodyOf(res);
    expect(xml).toContain('Globex Supplies');
    expect(xml).toContain('Acme Corp');
    expect(xml).toContain('Office Chair');
    expect(xml).toContain('500.00');
  });

  test('XML can be converted back to JSON', () => {
    const toXmlRes = post({ json: { Invoice: originalInvoice } });
    expect(toXmlRes.statusCode).toBe(200);
    const xml = xmlBodyOf(toXmlRes);

    const toJsonRes = request('POST', `${SERVER_URL}/v1/convert/xml-to-json`, {
      json: { xml },
      timeout: TIMEOUT_MS,
    });
    expect(toJsonRes.statusCode).toBe(200);
    const roundTripped = bodyOf(toJsonRes);
    expect(typeof roundTripped).toBe('object');
    expect(Array.isArray(roundTripped)).toBe(false);
  });

  test('round-tripped JSON preserves key invoice fields', () => {
    const toXmlRes = post({ json: { Invoice: originalInvoice } });
    const xml = xmlBodyOf(toXmlRes);

    const toJsonRes = request('POST', `${SERVER_URL}/v1/convert/xml-to-json`, {
      json: { xml },
      timeout: TIMEOUT_MS,
    });
    const roundTripped = bodyOf(toJsonRes);
    expect(JSON.stringify(roundTripped)).toContain('Globex Supplies');
    expect(JSON.stringify(roundTripped)).toContain('Acme Corp');
    expect(JSON.stringify(roundTripped)).toContain('Office Chair');
  });
});