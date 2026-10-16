import { invoiceToPeppol } from '../../peppol/invoiceFormatter';
import { AppError } from '../../errors';

describe('invoiceToPeppol testing', () => {
  const validData = {
    id: 'INV-2026-001',
    issueDate: '2026-05-20',
    documentCurrencyCode: 'AUD',
    buyerReference: 'REF123',
    orderReference: { id: '1234' },
    accountingSupplierParty: {
      party: { 
        endpointID: '12345678910', 
        endpointSchemeID: '0151',
        partyName: { name: 'Uniqlo' },
        postalAddress: { cityName: 'Sydney', country: { identificationCode: 'AU' } }
      }
    },
    accountingCustomerParty: {
      party: { endpointID: '98765432109', partyName: { name: 'Zara' } }
    },
    legalMonetaryTotal: { 
      payableAmount: "165.55",
      lineExtensionAmount: "150.50",
      taxExclusiveAmount: "150.50",
      taxInclusiveAmount: "165.55"
    },
    taxTotal: [{ taxAmount: "15.05" }],
    invoiceLine: [
      { 
        id: '1',
        invoicedQuantity: 1,
        lineExtensionAmount: "150.5",
        price: { priceAmount: "150.5" },
        item: { name: 'Coat' }
      }
    ]
  };
  
  describe('valid cases', () => {


    test('generates valid XML', () => {
      const result = invoiceToPeppol(validData);

      expect(result).toMatch(/<Invoice/);
      expect(result).toMatch(/xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"/);
      expect(result).toMatch(/xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"/);
      expect(result).toMatch(/<cbc:ID>INV-2026-001<\/cbc:ID>/);
    });

    test('generates correct GST and currency values', () => {
      const result = invoiceToPeppol(validData);

      expect(result).toMatch(/<cbc:TaxAmount currencyID="AUD">15\.05<\/cbc:TaxAmount>/);
      expect(result).toMatch(/<cbc:ID>GST<\/cbc:ID>/);
      expect(result).toMatch(/<cbc:Percent>10<\/cbc:Percent>/);
    });

    test('handles missing quantity code', () => {
      const result = invoiceToPeppol(validData);
      expect(result).toMatch(/<cbc:InvoicedQuantity unitCode="EA">1<\/cbc:InvoicedQuantity>/);
    });

    test('correctly maps party names through partyToPeppol', () => {
      const result = invoiceToPeppol(validData);
      expect(result).toMatch(/<cac:PartyName>\s*<cbc:Name>Uniqlo<\/cbc:Name>\s*<\/cac:PartyName>/);
    });

    test('handles multiple invoice lines and aggregates totals correctly', () => {
      const multi = {
        ...validData,
        invoiceLine: [
          { id: '1', invoicedQuantity: 2, price: { priceAmount: "50" }, lineExtensionAmount: "100" },
          { id: '2', invoicedQuantity: 1, price: { priceAmount: "25.5" }, lineExtensionAmount: "25.5" }
        ],
        taxTotal: [{ taxAmount: "12.55" }],
        legalMonetaryTotal: { payableAmount: "138.05" }
      };
      const result = invoiceToPeppol(multi);
      expect(result).toMatch(/<cbc:LineExtensionAmount currencyID="AUD">125\.50<\/cbc:LineExtensionAmount>/);
      expect(result).toMatch(/<cbc:TaxAmount currencyID="AUD">12\.55<\/cbc:TaxAmount>/);
    });
  });

  describe('invalid cases', () => {
    test('throws error if currency code is missing', () => {
      const { documentCurrencyCode, ...invalid } = validData;
      expect(() => invoiceToPeppol(invalid)).toThrow(AppError);
    });

    test('throws if invoiceLine is missing', () => {
      const input = { ...validData, invoiceLine: [] };
      expect(() => invoiceToPeppol(input)).toThrow(AppError);
    });

    test('throws for invalid supplier endpointID', () => {
      const input = {
        ...validData,
        accountingSupplierParty: { 
          party: { ...validData.accountingSupplierParty.party, endpointID: 123 } 
        }
      };
      expect(() => invoiceToPeppol(input)).toThrow(/Supplier EndpointID is mandatory./);
    });

    test('throws when payableAmount is negative', () => {
      const input = {
        ...validData,
        legalMonetaryTotal: { ...validData.legalMonetaryTotal, payableAmount: -50 }
      };
      expect(() => invoiceToPeppol(input)).toThrow(/Payable amount must be a positive number/);
    });

    test('validates multiple errors simultaneously via newline joining', () => {
      const input = {
        ...validData,
        id: "",
        documentCurrencyCode: "INVALID"
      };
      expect(() => invoiceToPeppol(input)).toThrow(
        /Invoice ID must be a non-empty string.*Currency code must be a 3-letter ISO format/s
      );
    });

    test('handles missing taxTotal by defaulting to zero', () => {
      const noTax = {
        ...validData,
        taxTotal: undefined
      };
      const result = invoiceToPeppol(noTax);
      expect(result).toMatch(/<cbc:TaxAmount currencyID="AUD">0\.00<\/cbc:TaxAmount>/);
    });
  });

  describe('extended test cases', () => {
    test('throws when supplier country is missing', () => {
      const noCountry = {
        ...validData,
        accountingSupplierParty: {
          party: {
            ...validData.accountingSupplierParty.party,
            postalAddress: { cityName: 'Sydney', country: { identificationCode: "" } }
          }
        }
      };
      expect(() => invoiceToPeppol(noCountry)).toThrow('Supplier Country Code (e.g. AU) is mandatory.');
    });
  
    test('falls back for missing item names', () => {
      const noName = { ...validData };
      delete noName.invoiceLine[0].item.name;
  
      const result = invoiceToPeppol(noName);
      expect(result).toContain('<cbc:Name>Service Item</cbc:Name>');
    });

    test('throws when missing nested party fields', () => {
      const missingParty = {
        ...validData,
        accountingSupplierParty: { party: {} }
      };
      expect(() => invoiceToPeppol(missingParty)).toThrow(AppError);
    });
  
    test('rounds monetary amounts to 2 decimal places', () => {
      const invalid = {
        ...validData,
        invoiceLine: [{
          ...validData.invoiceLine[0],
          lineExtensionAmount: 10.556, 
          price: { priceAmount: 10.556 }
        }],
        taxTotal: [{ taxAmount: "1.06" }],
        legalMonetaryTotal: { ...validData.legalMonetaryTotal, payableAmount: "11.62" }
      };
      const result = invoiceToPeppol(invalid);
      expect(result).toContain('10.56');
    });
  });
});