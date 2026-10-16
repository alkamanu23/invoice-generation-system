import { mapKeys } from '../../peppol/mapper';
import { validateInput, Validator, rules } from '../../peppol/validator';
import { partyToPeppol } from '../../peppol/mandates';

describe('Helper function testing', () => {
  describe('mapKeys mapping', () => {
    test('converts keys to UBL prefixes', () => {
      const input = { 
        id: '123', 
        buyerReference: 'REF-001', 
        orderReference: { id: 'PO-99' }};
      const result = mapKeys(input);
      expect(result).toEqual({
          'cbc:ID': '123',
          'cbc:BuyerReference': 'REF-001',
          'cac:OrderReference': { 'cbc:ID': 'PO-99' }
      });
    });

    test('successful nesting of objects and arrays', () => {
      const input = { invoiceLine: [{ id: 'L1', item: { name: 'Apples' }}] };
      const result = mapKeys(input);
      expect(result['cac:InvoiceLine'][0]['cbc:ID']).toBe('L1');
      expect(result['cac:InvoiceLine'][0]['cac:Item']['cbc:Name']).toBe('Apples');
    });
  });

  describe('validateInput logic testing', () => {
    const mock = [
      { path: "party.abn", 
        validate: (value) => /^\d{11}$/.test(value), 
        errorMessage: "ABN must be 11 digits" }
    ];

    test('passes valid input', () => {
      expect(validateInput(mock, { party: { abn: "12345678910" }})).toHaveLength(0);
    });

    test.each(["", "123"])('returns error for invalid/missing ABN: %s', (abn) => {
      expect(validateInput(mock, { party: {abn} })).toEqual(["ABN must be 11 digits"]);
    });
  });

  describe('validator testing', () => {
    const invoice = {
      id: "INV-001",
      documentCurrencyCode: "AUD",
      buyerReference: "ORDER-ID-123",
      accountingSupplierParty: {
        party: {
          endpointID: "12345678910",
          endpointSchemeID: "0151",
          postalAddress: { cityName: "Sydney", country: { identificationCode: "AU" } }
        }
      },
      accountingCustomerParty: { party: { endpointID: "98765432109" } },
      legalMonetaryTotal: { payableAmount: 100.00 },
      invoiceLine: [{ id: "1" }]
    };

    test('validates a valid invoice', () => {
      expect(validateInput(rules, invoice)).toHaveLength(0);
    });

    test('fails if buyerReference is missing or empty', () => {
      const invalid = { ...invoice, buyerReference: "" };
      const result = validateInput(rules, invalid);
      expect(result).toContain("Buyer Reference is mandatory for PEPPOL (mapped from Customer Reference or Order ID).");
    });

    test.each(["", "   ", null, undefined])('validates invoice format', (id) => {
      expect(validateInput(rules, {...invoice, id: id })).toEqual(["Invoice ID must be a non-empty string."]);
    });

    test.each(["A", "123", "INV-2026"])('passes for valid invoice ID: %p', (id) => {
      const result = validateInput(rules, { ...invoice, id: id });
      expect(result).not.toContain("Invoice ID must be a non-empty string.");
    });

    test('validates supplier details', () => {
      const supplier = {
        ...invoice,
        accountingSupplierParty: {
          party: {
            endpointID: "123",
            endpointSchemeID: "0088",
            postalAddress: { cityName: "", country: { identificationCode: "A" } }
          }
        }
      };
      const result = validateInput(rules, supplier);
      expect(result).toEqual([
        "Supplier City is mandatory for Peppol.",
        "Supplier Country Code (e.g. AU) is mandatory."
      ]);
    });

    test.each(["AU", "AUAUAU", 0])('validates currency code: %s', (code) => {
      expect(validateInput(rules, { ...invoice, documentCurrencyCode: code })).toEqual(
        ["Currency code must be a 3-letter ISO format (e.g., AUD)."]
      );
    });

    test.each(["hello", -1])('returns error when payable amount: %s', (amount) => {
      expect(validateInput(rules, { ...invoice, 
        legalMonetaryTotal: { payableAmount: amount } })).toEqual(
          ["Payable amount must be a positive number."]
        );
    });

    test('fails if invoiceLine is an empty array', () => {
      expect(validateInput(rules, { ...invoice, invoiceLine: [] })).toEqual(
        ["Must contain at least one line item."]
      );
    });
  });

  describe('partyToPeppol testing', () => {
    test('formats a valid party with default schemeID', () => {
      const input = { 
        endpointID: '12345678910',
        partyName: { name: 'Uniqlo' }
      };
      const result = partyToPeppol(input);
      expect(result.endpointID).toEqual({ "#text": '12345678910', "@_schemeID": '0088' });
      expect(result.partyName.name).toEqual('Uniqlo');
    });

    test('successfully handles nested array party names', () => {
      const input = {
        endpointID: '123',
        partyName: [{ name: 'Zara' }]
      };
      const result = partyToPeppol(input);
      expect(result.partyName.name).toBe('Zara');
    });

    test('sunccessfully handles missing names', () => {
      const result = partyToPeppol({ 
        endpointID: '808',
        endpointSchemeID: '0004', 
        partyName: {}
      });
      expect(result.partyName.name).toBe('Unknown');
    });
    
    test('overrides default schemeID when available', () => {
      const result = partyToPeppol({ 
        endpointID: '10987654321', 
        endpointSchemeID: '0004', 
      });
      expect(result.endpointID["@_schemeID"]).toBe('0004');
    });
  });
});