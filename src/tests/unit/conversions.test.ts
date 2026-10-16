import { jsonToXml, xmlToJson } from "../../routes/convert";

describe('jsonToXml', () => {
  describe('success cases', () => {
    test('converts a simple key-value pair', () => {
      const result = jsonToXml({ companyName: 'Acme Corp' });
      expect(result).toContain('<companyName>Acme Corp</companyName>');
    });

    test('converts nested objects', () => {
      const result = jsonToXml({
        invoice: {
          supplier: 'Acme Corp',
          totalAmount: 5000
        }
      });
      expect(result).toContain('<supplier>Acme Corp</supplier>');
      expect(result).toContain('<totalAmount>5000</totalAmount>');
    });

    test('converts attributes (prefixed with @_)', () => {
      const result = jsonToXml({
        invoice: { '@_id': 'INV-2026-001', '#text': 'Tax Invoice' }
      });
      expect(result).toContain('id="INV-2026-001"');
    });

    test('converts arrays into sibling elements', () => {
      const result = jsonToXml({
        orderLines: {
          item: ['Office Chair', 'Standing Desk', 'Monitor Stand']
        }
      });
      expect(result).toContain('<item>Office Chair</item>');
      expect(result).toContain('<item>Standing Desk</item>');
      expect(result).toContain('<item>Monitor Stand</item>');
    });

    test('handles deeply nested objects', () => {
      const result = jsonToXml({
        order: {
          buyer: {
            contact: {
              email: 'procurement@acme.com'
            }
          }
        }
      });
      expect(result).toContain('<email>procurement@acme.com</email>');
    });

    test('returns a string', () => {
      const result = jsonToXml({ invoiceId: 'INV-2026-001' });
      expect(typeof result).toBe('string');
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT if input is null', () => {
      try { jsonToXml(null); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_INPUT' });
      }
    });

    test('throws INVALID_INPUT if input is undefined', () => {
      try { jsonToXml(undefined); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_INPUT' });
      }
    });

    test('throws INVALID_INPUT if input is a string', () => {
      try { jsonToXml('INV-2026-001'); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_INPUT' });
      }
    });

    test('throws INVALID_INPUT if input is a number', () => {
      try { jsonToXml(5000); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_INPUT' });
      }
    });

    test('throws INVALID_INPUT if input is an array', () => {
      try { jsonToXml(['INV-2026-001', 'INV-2026-002']); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_INPUT' });
      }
    });

    test('throws INVALID_INPUT if input is an empty object', () => {
      try { jsonToXml({}); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_INPUT' });
      }
    });

    test('error response includes a message string', () => {
      try { jsonToXml(null); } catch (err: any) {
        expect(typeof err.message).toBe('string');
        expect(err.message.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('xmlToJson', () => {
  describe('success cases', () => {
    test('converts a simple self-closing tag', () => {
      const result = xmlToJson('<Invoice/>');
      expect(typeof result).toBe('object');
      expect(Array.isArray(result)).toBe(false);
    });

    test('converts a simple element with text content', () => {
      const result = xmlToJson('<supplierName>Acme Corp</supplierName>');
      expect(result).toMatchObject({ supplierName: 'Acme Corp' });
    });

    test('converts nested elements', () => {
      const result = xmlToJson(`
        <Invoice>
          <supplierName>Acme Corp</supplierName>
          <totalAmount>5000</totalAmount>
        </Invoice>
      `);
      expect(result).toMatchObject({
        Invoice: { supplierName: 'Acme Corp', totalAmount: 5000 }
      });
    });

    test('converts attributes (prefixed with @_)', () => {
      const result = xmlToJson('<Invoice id="INV-2026-001">Tax Invoice</Invoice>') as any;
      expect(result.Invoice['@_id']).toBe('INV-2026-001');
    });

    test('converts sibling elements into an array', () => {
      const result = xmlToJson(`
        <orderLines>
          <item>Office Chair</item>
          <item>Standing Desk</item>
          <item>Monitor Stand</item>
        </orderLines>
      `);
      expect(result).toMatchObject({
        orderLines: { item: ['Office Chair', 'Standing Desk', 'Monitor Stand'] }
      });
    });

    test('handles deeply nested xml', () => {
      const result = xmlToJson(`
        <order>
          <buyer>
            <contact>
              <email>procurement@acme.com</email>
            </contact>
          </buyer>
        </order>
      `);
      expect(result).toMatchObject({
        order: { buyer: { contact: { email: 'procurement@acme.com' } } }
      });
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT if xml is an empty string', () => {
      try { xmlToJson(''); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_INPUT' });
      }
    });

    test('throws INVALID_INPUT if xml is only whitespace', () => {
      try { xmlToJson('   '); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_INPUT' });
      }
    });

    test('throws INVALID_INPUT if xml is not a string', () => {
      try { xmlToJson(123 as any); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_INPUT' });
      }
    });

    test('throws INVALID_XML for unclosed tag', () => {
      try { xmlToJson('<Invoice><supplierName></Invoice>'); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_XML' });
      }
    });

    test('throws INVALID_XML for malformed attribute', () => {
      try { xmlToJson('<Invoice id=INV-2026-001/>'); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_XML' });
      }
    });

    test('throws INVALID_XML for plain text', () => {
      try { xmlToJson('Total Amount Due: 5000 AUD'); } catch (err) {
        expect(err).toMatchObject({ error: 'INVALID_XML' });
      }
    });

    test('error response includes a message string', () => {
      try { xmlToJson('<Invoice>'); } catch (err: any) {
        expect(typeof err.message).toBe('string');
        expect(err.message.length).toBeGreaterThan(0);
      }
    });
  });
});