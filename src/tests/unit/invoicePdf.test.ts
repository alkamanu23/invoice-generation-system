import { invoiceToHtml, invoiceToPdf } from '../../utils/invoicePdf';
import type { Invoice } from '../../types/invoice';
import puppeteer from 'puppeteer-core';

const mockPdf = jest.fn();
const mockSetContent = jest.fn();
const mockClose = jest.fn();
const mockNewPage = jest.fn();

jest.mock('puppeteer-core', () => ({
  launch: jest.fn(),
}));

const baseInvoice: Invoice = {
  id: 'INV-001',
  issueDate: '2026-03-15',
  accountingSupplierParty: {
    party: {
      partyName: [{ name: 'Seller Co' }],
      postalAddress: {
        streetName: '1 Seller St',
        cityName: 'Sydney',
        postalZone: '2000',
        country: { identificationCode: 'AU' },
      },
    },
  },
  accountingCustomerParty: {
    party: {
      partyName: [{ name: 'Buyer Co' }],
      postalAddress: {
        cityName: 'Melbourne',
        country: { identificationCode: 'AU' },
      },
    },
  },
  legalMonetaryTotal: { payableAmount: '110.00' },
  invoiceLine: [
    {
      id: 'line-1',
      lineExtensionAmount: '100.00',
      item: { name: 'Widget' },
      price: { priceAmount: '100.00' },
      invoicedQuantity: 1,
    },
  ],
};

describe('invoiceToHtml', () => {
  test('contains invoice ID and dates', () => {
    const html = invoiceToHtml(baseInvoice);
    expect(html).toContain('INV-001');
    expect(html).toContain('2026-03-15');
  });

  test('contains seller and buyer names', () => {
    const html = invoiceToHtml(baseInvoice);
    expect(html).toContain('Seller Co');
    expect(html).toContain('Buyer Co');
  });

  test('contains line item name and amount', () => {
    const html = invoiceToHtml(baseInvoice);
    expect(html).toContain('Widget');
    expect(html).toContain('100.00');
  });

  test('contains payable total', () => {
    const html = invoiceToHtml(baseInvoice);
    expect(html).toContain('110.00');
  });

  test('uses documentCurrencyCode when present', () => {
    const html = invoiceToHtml({ ...baseInvoice, documentCurrencyCode: 'USD' });
    expect(html).toContain('USD');
  });

  test('falls back to AUD when no currency code', () => {
    const html = invoiceToHtml(baseInvoice);
    expect(html).toContain('AUD');
  });

  test('renders item description when name is missing', () => {
    const invoice: Invoice = {
      ...baseInvoice,
      invoiceLine: [
        {
          id: 'line-2',
          lineExtensionAmount: '50.00',
          item: { description: ['A described item'] },
        },
      ],
    };
    const html = invoiceToHtml(invoice);
    expect(html).toContain('A described item');
  });

  test('renders Untitled item when item has no name or description', () => {
    const invoice: Invoice = {
      ...baseInvoice,
      invoiceLine: [
        {
          id: 'line-3',
          lineExtensionAmount: '50.00',
          item: {},
        },
      ],
    };
    const html = invoiceToHtml(invoice);
    expect(html).toContain('Untitled item');
  });

  test('escapes HTML in invoice ID to prevent XSS', () => {
    const html = invoiceToHtml({ ...baseInvoice, id: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('escapes HTML in party names', () => {
    const invoice: Invoice = {
      ...baseInvoice,
      accountingSupplierParty: {
        party: { partyName: [{ name: '<b>Injected</b>' }] },
      },
    };
    const html = invoiceToHtml(invoice);
    expect(html).not.toContain('<b>Injected</b>');
    expect(html).toContain('&lt;b&gt;Injected&lt;/b&gt;');
  });

  test('renders notes when present', () => {
    const html = invoiceToHtml({ ...baseInvoice, note: ['Please pay promptly', 'Thank you'] });
    expect(html).toContain('Please pay promptly Thank you');
  });

  test('handles missing optional party fields gracefully', () => {
    const invoice: Invoice = {
      ...baseInvoice,
      accountingSupplierParty: {},
      accountingCustomerParty: {},
    };
    expect(() => invoiceToHtml(invoice)).not.toThrow();
  });

  test('falls back to PartyLegalEntity name when partyName is absent', () => {
    const invoice: Invoice = {
      ...baseInvoice,
      accountingSupplierParty: {
        party: { PartyLegalEntity: [{ registrationName: 'Legal Seller Pty Ltd' }] },
      },
    };
    const html = invoiceToHtml(invoice);
    expect(html).toContain('Legal Seller Pty Ltd');
  });

  test('includes supplier address parts', () => {
    const html = invoiceToHtml(baseInvoice);
    expect(html).toContain('1 Seller St');
    expect(html).toContain('Sydney');
  });

  test('returns a valid HTML document', () => {
    const html = invoiceToHtml(baseInvoice);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('</html>');
  });
});

describe('invoiceToPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPdf.mockResolvedValue(Buffer.from('fake-pdf-content'));
    mockSetContent.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
    mockNewPage.mockResolvedValue({ setContent: mockSetContent, pdf: mockPdf });
    (puppeteer.launch as jest.Mock).mockResolvedValue({ newPage: mockNewPage, close: mockClose });
  });

  test('returns a Buffer', async () => {
    const result = await invoiceToPdf(baseInvoice);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  test('launches puppeteer with headless: true', async () => {
    await invoiceToPdf(baseInvoice);
    expect(puppeteer.launch).toHaveBeenCalledWith(expect.objectContaining({ headless: true }));
  });

  test('calls setContent with the invoice HTML', async () => {
    await invoiceToPdf(baseInvoice);
    const html = mockSetContent.mock.calls[0][0] as string;
    expect(html).toContain('INV-001');
    expect(html).toContain('Seller Co');
  });

  test('calls pdf with A4 format', async () => {
    await invoiceToPdf(baseInvoice);
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'A4' }));
  });

  test('always closes the browser even on error', async () => {
    mockPdf.mockRejectedValueOnce(new Error('pdf failed'));
    await expect(invoiceToPdf(baseInvoice)).rejects.toThrow('pdf failed');
    expect(mockClose).toHaveBeenCalled();
  });
});
