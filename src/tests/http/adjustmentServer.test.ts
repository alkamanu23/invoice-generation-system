import 'dotenv/config';
import request from 'sync-request-curl';
import config from '../../config.json'

const url: string = config.url;
const port: string = config.port;
const SERVER_URL = `${url}:${port}`;
const TIMEOUT_MS = 15 * 1000;

// helpers
function getToken(): string {
  const res = request('POST', `${SERVER_URL}/v1/auth/login`, {
    json: {
      username: process.env.TEST_USERNAME ?? 'testuser',
      password: process.env.TEST_PASSWORD ?? 'YourPassword123!',
    },
    timeout: TIMEOUT_MS,
  });
  return JSON.parse(res.body.toString()).token;
}

function post(endpoint: string, token: string, body: object) {
  return request('POST', `${SERVER_URL}${endpoint}`, {
    json: body,
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${token}` },
  });
}

function get(endpoint: string, token: string) {
  return request('GET', `${SERVER_URL}${endpoint}`, {
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${token}` },
  });
}

function bodyOf(res: ReturnType<typeof request>) {
  return JSON.parse(res.body.toString());
}

const validOrder = {
  order: {
    id: 'order-adj-001',
    issueDate: '2026-03-15',
    buyerCustomerParty: {
      party: { partyName: [{ name: 'Acme Corp' }] },
    },
    sellerSupplierParty: {
      party: { partyName: [{ name: 'Globex Supplies' }] },
    },
    orderLine: [{
      lineItem: {
        id: 'line-001',
        item: { name: 'Office Chair' },
        lineExtensionAmount: '500.00',
      },
    }],
  },
};

const validAdjustmentNote = (invoiceId: number, type: 'credit' | 'debit' = 'credit') => ({
  invoiceIdReference: invoiceId,
  adjustmentType: type,
  amount: '505',
  reason: 'Returned items in good condition',
  lines: [{
    id: 'line-001',
    quantity: 2,
    lineExtensionAmount: 100.00,
    price: { priceAmount: '50' },
    item: {
      name: 'Office Chair',
      classifiedTaxCategory: [{ percent: '10' }]
    }
  }]
});

// tests

describe('POST /v1/api/adjNotes', () => {
  let token: string;
  let testInvoiceId: number;

  beforeAll(() => {
    token = getToken();
    const invoiceRes = post('/v1/api/invoices', token, validOrder);
    expect(invoiceRes.statusCode).toBe(200);
    testInvoiceId = Number(bodyOf(invoiceRes).id);
  }, 30000);

  describe('success cases', () => {
    test('returns 201 and creates a credit note', () => {
      const res = post('/v1/api/adjNotes', token, validAdjustmentNote(testInvoiceId, 'credit'));
      expect(res.statusCode).toBe(201);
      const body = bodyOf(res);
      expect(typeof body.id).toBe('string');
      expect(typeof body.issueDate).toBe('string');
      expect(body.legalMonetaryTotal.payableAmount).toBe('505');
      expect(Array.isArray(body.creditNoteLine)).toBe(true);
    });

    test('returns 201 and creates a debit note', () => {
      const res = post('/v1/api/adjNotes', token, validAdjustmentNote(testInvoiceId, 'debit'));
      expect(res.statusCode).toBe(201);
      const body = bodyOf(res);
      expect(typeof body.id).toBe('string');
      expect(Array.isArray(body.debitNoteLine)).toBe(true);
    });
  });

  describe('error cases', () => {
    test('returns 400 when adjustmentType is invalid', () => {
      const res = post('/v1/api/adjNotes', token, {
        ...validAdjustmentNote(testInvoiceId),
        adjustmentType: 'refund',
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when invoiceIdReference is missing', () => {
      const res = post('/v1/api/adjNotes', token, {
        ...validAdjustmentNote(testInvoiceId),
        invoiceIdReference: null,
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when invoiceIdReference is negative', () => {
      const res = post('/v1/api/adjNotes', token, {
        ...validAdjustmentNote(testInvoiceId),
        invoiceIdReference: -1,
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when reason is missing', () => {
      const res = post('/v1/api/adjNotes', token, {
        ...validAdjustmentNote(testInvoiceId),
        reason: '',
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when lines is empty', () => {
      const res = post('/v1/api/adjNotes', token, {
        ...validAdjustmentNote(testInvoiceId),
        lines: [],
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when line quantity is zero', () => {
      const res = post('/v1/api/adjNotes', token, {
        ...validAdjustmentNote(testInvoiceId),
        lines: [{ ...validAdjustmentNote(testInvoiceId).lines[0], quantity: 0 }],
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 when line price is negative', () => {
      const res = post('/v1/api/adjNotes', token, {
        ...validAdjustmentNote(testInvoiceId),
        lines: [{ ...validAdjustmentNote(testInvoiceId).lines[0], price: { priceAmount: -10 } }],
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 404 when invoice does not exist', () => {
      const res = post('/v1/api/adjNotes', token, validAdjustmentNote(999999));
      expect(res.statusCode).toBe(404);
      expect(bodyOf(res)).toMatchObject({ error: 'NOT_FOUND' });
    });
  });
});

describe('GET /v1/api/adjNotes', () => {
  let token: string;

  beforeAll(() => {
    token = getToken();
  }, 30000);

  describe('success cases', () => {
    test('returns 200 and a list of adjustment notes', () => {
      const res = get('/v1/api/adjNotes', token);
      expect(res.statusCode).toBe(200);
      const body = bodyOf(res);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty('id');
      expect(body[0]).toHaveProperty('type');
    });
  });
});

describe('GET /v1/api/adjNotes/:adjNoteId', () => {
  let token: string;
  let testCreditNoteId: string;
  let testDebitNoteId: string;

  beforeAll(() => {
    token = getToken();

    const invoiceRes = post('/v1/api/invoices', token, validOrder);
    const invoiceId = Number(bodyOf(invoiceRes).id);

    const creditRes = post('/v1/api/adjNotes', token, validAdjustmentNote(invoiceId, 'credit'));
    expect(creditRes.statusCode).toBe(201);
    testCreditNoteId = bodyOf(creditRes).id;

    const debitRes = post('/v1/api/adjNotes', token, validAdjustmentNote(invoiceId, 'debit'));
    expect(debitRes.statusCode).toBe(201);
    testDebitNoteId = bodyOf(debitRes).id;
  }, 30000);

  describe('success cases', () => {
    test('returns 200 and correct data for a valid credit note ID', () => {
      const res = get(`/v1/api/adjNotes/${testCreditNoteId}?type=credit`, token);
      expect(res.statusCode).toBe(200);
      expect(JSON.stringify(bodyOf(res))).toContain('Office Chair');
    });

    test('returns 200 and correct data for a valid debit note ID', () => {
      const res = get(`/v1/api/adjNotes/${testDebitNoteId}?type=debit`, token);
      expect(res.statusCode).toBe(200);
      expect(JSON.stringify(bodyOf(res))).toContain('Office Chair');
    });
  });

  describe('error cases', () => {
    test('returns 400 when type is missing', () => {
      const res = get(`/v1/api/adjNotes/${testCreditNoteId}`, token);
      expect(res.statusCode).toBe(400);
    });

    test('returns 400 when type is invalid', () => {
      const res = get(`/v1/api/adjNotes/${testCreditNoteId}?type=refund`, token);
      expect(res.statusCode).toBe(400);
    });

    test('returns 400 when ID is not a number', () => {
      const res = get('/v1/api/adjNotes/notanumber?type=credit', token);
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 404 when adjustment note does not exist', () => {
      const res = get('/v1/api/adjNotes/999999?type=credit', token);
      expect(res.statusCode).toBe(404);
      expect(bodyOf(res)).toMatchObject({ error: 'NOT_FOUND' });
    });
  });
});