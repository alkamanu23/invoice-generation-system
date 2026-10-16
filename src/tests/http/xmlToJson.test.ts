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

const ENDPOINT = '/v1/convert/xml-to-json';

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

describe('POST /v1/convert/xml-to-json', () => {
  describe('success cases', () => {
    test('returns 200 for a simple self-closing tag', () => {
      const res = post({ xml: '<Invoice/>' });
      expect(res.statusCode).toBe(200);
    });

    test('converts a simple element with text content', () => {
      const res = post({ xml: '<supplierName>Globex Supplies</supplierName>' });
      expect(res.statusCode).toBe(200);
      expect(bodyOf(res)).toMatchObject({ supplierName: 'Globex Supplies' });
    });

    test('converts nested elements', () => {
      const res = post({ xml: '<Invoice><supplierName>Globex Supplies</supplierName><totalAmount>5000</totalAmount></Invoice>' });
      expect(res.statusCode).toBe(200);
      expect(bodyOf(res)).toMatchObject({ Invoice: { supplierName: 'Globex Supplies', totalAmount: 5000 } });
    });

    test('converts attributes (prefixed with @_)', () => {
      const res = post({ xml: '<Invoice id="INV-2026-001">Tax Invoice</Invoice>' });
      expect(res.statusCode).toBe(200);
      expect(bodyOf(res).Invoice['@_id']).toBe('INV-2026-001');
    });

    test('converts sibling elements into an array', () => {
      const res = post({ xml: '<orderLines><item>Office Chair</item><item>Standing Desk</item><item>Monitor Stand</item></orderLines>' });
      expect(res.statusCode).toBe(200);
      expect(bodyOf(res)).toMatchObject({ orderLines: { item: ['Office Chair', 'Standing Desk', 'Monitor Stand'] } });
    });

    test('handles deeply nested xml', () => {
      const res = post({ xml: '<order><buyer><contact><email>procurement@acme.com</email></contact></buyer></order>' });
      expect(res.statusCode).toBe(200);
      expect(bodyOf(res)).toMatchObject({ order: { buyer: { contact: { email: 'procurement@acme.com' } } } });
    });

    test('returns a plain object (not an array or primitive)', () => {
      const res = post({ xml: '<Invoice/>' });
      const body = bodyOf(res);
      expect(typeof body).toBe('object');
      expect(Array.isArray(body)).toBe(false);
    });
  });

  describe('error cases', () => {
    test('returns 400 when xml field is missing', () => {
      const res = post({});
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when xml is an empty string', () => {
      const res = post({ xml: '' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when xml is only whitespace', () => {
      const res = post({ xml: '   ' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when xml is not a string', () => {
      const res = post({ xml: 123 });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 for unclosed tag', () => {
      const res = post({ xml: '<Invoice><supplierName></Invoice>' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_XML' });
    });

    test('returns 400 for malformed attribute', () => {
      const res = post({ xml: '<Invoice id=INV-2026-001/>' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_XML' });
    });

    test('returns 400 for plain text (not xml at all)', () => {
      const res = post({ xml: 'Total Amount Due: 5000 AUD' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_XML' });
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

  test('invoice XML can be converted back to JSON', () => {
    // convert invoice to XML first via json-to-xml
    const toXmlRes = request('POST', `${SERVER_URL}/v1/convert/json-to-xml`, {
      json: { json: { Invoice: originalInvoice } },
      timeout: TIMEOUT_MS,
    });
    expect(toXmlRes.statusCode).toBe(200);
    const xml = xmlBodyOf(toXmlRes);

    // convert XML back to JSON
    const res = post({ xml });
    expect(res.statusCode).toBe(200);
    const roundTripped = bodyOf(res);
    expect(typeof roundTripped).toBe('object');
    expect(Array.isArray(roundTripped)).toBe(false);
  });

  test('round-tripped JSON preserves key invoice fields', () => {
    const toXmlRes = request('POST', `${SERVER_URL}/v1/convert/json-to-xml`, {
      json: { json: { Invoice: originalInvoice } },
      timeout: TIMEOUT_MS,
    });
    const xml = xmlBodyOf(toXmlRes);

    const res = post({ xml });
    const roundTripped = bodyOf(res);
    expect(JSON.stringify(roundTripped)).toContain('Globex Supplies');
    expect(JSON.stringify(roundTripped)).toContain('Acme Corp');
    expect(JSON.stringify(roundTripped)).toContain('Office Chair');
  });

  test('round-tripped JSON contains invoice id', () => {
    const toXmlRes = request('POST', `${SERVER_URL}/v1/convert/json-to-xml`, {
      json: { json: { Invoice: originalInvoice } },
      timeout: TIMEOUT_MS,
    });
    const xml = xmlBodyOf(toXmlRes);

    const res = post({ xml });
    const roundTripped = bodyOf(res);
    expect(JSON.stringify(roundTripped)).toContain(invoiceId);
  });
});