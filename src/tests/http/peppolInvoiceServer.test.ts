import 'dotenv/config';
import request from "sync-request-curl";
import config from '../../config.json';
import fs from 'fs';
import path from 'path';

const SERVER_URL = `${config.url}:${config.port}`;
const TIMEOUT_MS = 15 * 1000;

beforeAll(() => {
  const res = request('POST', `${SERVER_URL}/v1/auth/login`, {
    json: {
      username: process.env.TEST_USERNAME ?? 'testuser',
      password: process.env.TEST_PASSWORD ?? 'YourPassword123!',
    },
    timeout: TIMEOUT_MS,
  });

  const body = JSON.parse(res.body.toString());
    process.env.TEST_JWT = body.token;
});

function post(body: object) {
  return request('POST', `${SERVER_URL}/v2/api/invoices`, {
    json: body,
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${process.env.TEST_JWT}` },
  });
}

describe('peppol coversion testing', () => {
  const validOrder = {
    order: {
      id: "order-001",
      issueDate: "2026-03-15",
      documentCurrencyCode: "AUD",
      sellerSupplierParty: {
        party: {
          endpointID: "98765432109",
          endpointSchemeID: "0151",
          partyName: [{ name: "Zara" }],
          postalAddress: { 
            cityName: "Melbourne", 
            country: { identificationCode: "AU" } 
        }
        },
      },
      buyerCustomerParty: {
        party: {
          endpointID: "12345678910",
          endpointSchemeID: "0151",
          partyName: [{ name: "Uniqlo" }],
          postalAddress: { 
            cityName: "Sydney", 
            country: { identificationCode: "AU" } 
          }
        },
      },
      anticipatedMonetaryTotal: {
          payableAmount: "110.00",
          lineExtensionAmount: "100.00"
      },
      orderLine: [
        {
          lineItem: {
            id: "line-001",
            item: { name: "Coat" },
            lineExtensionAmount: "100.00",
            quantity: "1",
            price: { priceAmount: "100.00" }
          },
        },
      ],
    },
  };

  test('/v2/api/invoices returns 201 for valid order data', () => {
    const result = post(validOrder);
    expect(result.statusCode).toBe(200);
    expect(result.body.toString()).toContain('<Invoice');
  });

  test('/v2/api/invoices returns 422 when city Name is missing', () => {
    const incomplete = JSON.parse(JSON.stringify(validOrder));
    delete incomplete.order.sellerSupplierParty.party.postalAddress.cityName;
  
    const result = post(incomplete);
    expect(result.statusCode).toBe(422);
    expect(JSON.parse(result.body.toString()).message).toContain('Supplier City is mandatory');
  });

  test('/v2/api/invoices returns 422 for invalid currency code', () => {
    const invalidCurr = JSON.parse(JSON.stringify(validOrder));
    invalidCurr.order.documentCurrencyCode = "AU";
  
    const result = post(invalidCurr);
    expect(result.statusCode).toBe(422);
  });

  test('/v2/api/invoices defaults to 0088 schemeID when not provided', () => {
    const noScheme = JSON.parse(JSON.stringify(validOrder));
    delete noScheme.order.sellerSupplierParty.party.endpointSchemeID;
  
    const result = post(noScheme);
    expect(result.statusCode).toBe(200);
    expect(result.body.toString()).toContain('schemeID="0088"');
  });

  test('/v2/api/invoices rounds payableAmount to 2 decimal places', () => {
    const decimal = JSON.parse(JSON.stringify(validOrder));
    decimal.order.orderLine[0].lineItem.price.priceAmount = "100.556";
    decimal.order.orderLine[0].lineItem.lineExtensionAmount = "100.556";
    decimal.order.taxTotal = [{ taxAmount: "10.056" }];
    
    const result = post(decimal);
    const output = result.body.toString();
    
    expect(output).toContain('110.61'); 
  });

  test('/v2/api/invoices returns 422 if order ID is missing', () => {
    const noId = JSON.parse(JSON.stringify(validOrder));
    noId.order.id = "   ";
  
    const result = post(noId);
    expect(result.statusCode).toBe(422);
  });

  test('/v2/api/invoices returns 400 when orderLine is empty', () => {
    const noLines = JSON.parse(JSON.stringify(validOrder));
    noLines.order.orderLine = [];
  
    const result = post(noLines);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body.toString()).message).toContain('orderLine is required and must not be empty');
  });

  test('/v2/api/invoices returns 422 for invalid ABN', () => {
    const invalid = JSON.parse(JSON.stringify(validOrder));
    invalid.order.sellerSupplierParty.party.endpointID = 123; 

    const result = post(invalid);
    const body = JSON.parse(result.body.toString());

    expect(result.statusCode).toBe(422);
    expect(body.error).toBe('PEPPOL_VALIDATION_FAILED');
    expect(body.message).toContain('Supplier EndpointID is mandatory.');
  });
});