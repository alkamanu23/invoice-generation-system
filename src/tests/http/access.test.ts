import 'dotenv/config';
import request from 'sync-request-curl';
import config from '../../config.json';

const url: string = config.url;
const port: string = config.port;
const SERVER_URL = `${url}:${port}`;
const TIMEOUT_MS = 15 * 1000;

let userOneToken: string;

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

const validOrder = (id: string) => ({
    order: {
        id,
        issueDate: '2026-03-15',
        buyerCustomerParty: {
            party: { partyName: [{ name: 'Buyer Co' }] },
        },
        sellerSupplierParty: {
            party: { partyName: [{ name: 'Seller Co' }] },
        },
        orderLine: [{
            lineItem: {
                id: 'line-001',
                item: { name: 'Widget' },
                lineExtensionAmount: '100.00',
            },
        }],
    },
});

beforeAll(() => {
    const res1 = request('POST', `${SERVER_URL}/v1/auth/login`, {
        json: {
            username: process.env.TEST_USERNAME ?? 'testuser',
            password: process.env.TEST_PASSWORD ?? 'YourPassword123!',
        },
        timeout: TIMEOUT_MS,
    });
    userOneToken = bodyOf(res1).token;
}, 30000);

describe('Data visibility scoping', () => {
    describe('Invoices', () => {
        let userOneInvoiceId: string;

        beforeAll(() => {
            const res = post('/v1/api/invoices', userOneToken, validOrder(`order-vis-${Date.now()}`));
            expect(res.statusCode).toBe(200);
            userOneInvoiceId = bodyOf(res).id;
        }, 30000);

        test('user can see their own invoices in list', () => {
            const res = get('/v1/api/invoices', userOneToken);
            expect(res.statusCode).toBe(200);
            const body = bodyOf(res);
            expect(Array.isArray(body)).toBe(true);
            expect(body.map((i: any) => i.id)).toContain(userOneInvoiceId);
        });

        test('invoice filter only returns own invoices', () => {
            const res = get('/v2/api/invoices/filter', userOneToken);
            expect(res.statusCode).toBe(200);
            const body = bodyOf(res);
            expect(Array.isArray(body)).toBe(true);
            expect(body.map((i: any) => i.id)).toContain(userOneInvoiceId);
        });

        test('invoice search only returns own invoices', () => {
            const res = get('/v2/api/invoices/search?query=Buyer%20Co', userOneToken);
            expect(res.statusCode).toBe(200);
            const body = bodyOf(res);
            expect(Array.isArray(body)).toBe(true);
            expect(body.map((i: any) => i.id)).toContain(userOneInvoiceId);
        });
    });

    describe('Adjustment Notes', () => {
        let userOneInvoiceId: number;
        let userOneCreditNoteId: string;

        beforeAll(() => {
            const invoiceRes = post('/v1/api/invoices', userOneToken, validOrder(`order-adj-vis-${Date.now()}`));
            expect(invoiceRes.statusCode).toBe(200);
            userOneInvoiceId = Number(bodyOf(invoiceRes).id);

            const adjRes = post('/v1/api/adjNotes', userOneToken, {
                invoiceIdReference: userOneInvoiceId,
                adjustmentType: 'credit',
                amount: '100',
                reason: 'Visibility test',
                lines: [{
                    id: 'line-001',
                    quantity: 1,
                    lineExtensionAmount: 100,
                    price: { priceAmount: '100' },
                    item: { name: 'Widget' },
                }],
            });
            expect(adjRes.statusCode).toBe(201);
            userOneCreditNoteId = bodyOf(adjRes).id;
        }, 30000);

        test('user can see their own adjustment notes in list', () => {
            const res = get('/v1/api/adjNotes', userOneToken);
            expect(res.statusCode).toBe(200);
            const body = bodyOf(res);
            expect(Array.isArray(body)).toBe(true);
            expect(body.map((i: any) => String(i.id))).toContain(userOneCreditNoteId);
        });

        test('adjustment note filter only returns own notes', () => {
            const res = get('/v2/api/adjNotes/filter?type=credit', userOneToken);
            expect(res.statusCode).toBe(200);
            const body = bodyOf(res);
            expect(Array.isArray(body)).toBe(true);
            expect(body.map((i: any) => String(i.id))).toContain(userOneCreditNoteId);
        });

        test('adjustment note search only returns own notes', () => {
            const res = get('/v2/api/adjNotes/search?query=credit', userOneToken);
            expect(res.statusCode).toBe(200);
            const body = bodyOf(res);
            expect(Array.isArray(body)).toBe(true);
            expect(body.map((i: any) => String(i.id))).toContain(userOneCreditNoteId);
        });
    });

    describe('App Responses', () => {
        let userOneInvoiceId: number;
        let userOneResponseId: string;

        beforeAll(() => {
            const invoiceRes = post('/v1/api/invoices', userOneToken, validOrder(`order-resp-vis-${Date.now()}`));
            expect(invoiceRes.statusCode).toBe(200);
            userOneInvoiceId = Number(bodyOf(invoiceRes).id);

            const respRes = post('/v1/api/appResponses', userOneToken, {
                invoiceId: userOneInvoiceId,
                responseType: 'accepted',
                remarks: 'Visibility test response',
            });
            expect(respRes.statusCode).toBe(200);
            userOneResponseId = bodyOf(respRes).responseId;
        }, 30000);

        test('user can see their own app responses in list', () => {
            const res = get('/v1/api/appResponses', userOneToken);
            expect(res.statusCode).toBe(200);
            const body = bodyOf(res);
            expect(Array.isArray(body)).toBe(true);
            expect(body.map((i: any) => String(i.responseId))).toContain(userOneResponseId);
        });

        test('app response filter only returns own responses', () => {
            const res = get('/v2/api/appResponses/filter', userOneToken);
            expect(res.statusCode).toBe(200);
            const body = bodyOf(res);
            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBeGreaterThan(0);
        });

        test('app response search only returns own responses', () => {
            const res = get('/v2/api/appResponses/search?query=accepted', userOneToken);
            expect(res.statusCode).toBe(200);
            const body = bodyOf(res);
            expect(Array.isArray(body)).toBe(true);
        });
    });
});