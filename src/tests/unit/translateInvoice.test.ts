import { translateInvoice } from '../../services/translators/invoiceTranslator';
import {
  translateAllowanceCharge,
  translateCustomerParty,
  translateDelivery,
  translateDeliveryTerms,
  translateDocumentReference,
  translateDocumentReferenceArray,
  translateInvoiceLine,
  translateParty,
  translatePaymentMeans,
  translatePaymentTerms,
  translatePeriod,
  translateStringArray,
  translateSupplierParty,
  translateTaxCategory,
} from '../../services/translationHelper';

jest.mock('../../services/translationHelper', () => ({
  translateAllowanceCharge: jest.fn(),
  translateCustomerParty: jest.fn(),
  translateDelivery: jest.fn(),
  translateDeliveryTerms: jest.fn(),
  translateDocumentReference: jest.fn(),
  translateDocumentReferenceArray: jest.fn(),
  translateInvoiceLine: jest.fn(),
  translateParty: jest.fn(),
  translatePaymentMeans: jest.fn(),
  translatePaymentTerms: jest.fn(),
  translatePeriod: jest.fn(),
  translateStringArray: jest.fn(),
  translateSupplierParty: jest.fn(),
  translateTaxCategory: jest.fn(),
}));

describe('Invoice Translation Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success cases', () => {
    test('translates top level invoice fields', async () => {
      const note = ['original invoice note'];
      const invoicePeriod = [{ startDate: '2026-03-01' }];
      const orderReference = { id: 'order-ref-1' };
      const billingReference = [{ id: 'bill-ref-1' }];
      const supplierParty = { party: {} };
      const customerParty = { party: {} };
      const payeeParty = {};
      const buyerCustomerParty = { party: {} };
      const sellerSupplierParty = { party: {} };
      const delivery = [{ id: 'delivery-1' }];
      const deliveryTerms = { id: 'terms-1' };
      const paymentMeans = [{ paymentMeansCode: '30' }];
      const paymentTerms = [{ id: 'pt-1' }];
      const allowanceCharge = [{ amount: '5', chargeIndicator: true, taxCategory: [] }];
      const taxCategory = { id: 'A' };

      (translateStringArray as jest.Mock).mockResolvedValue(['translated invoice note']);
      (translateDocumentReference as jest.Mock).mockResolvedValue(orderReference);
      (translateDocumentReferenceArray as jest.Mock).mockResolvedValue(billingReference);
      (translateSupplierParty as jest.Mock).mockResolvedValue(supplierParty);
      (translateCustomerParty as jest.Mock).mockResolvedValue(customerParty);
      (translateParty as jest.Mock).mockResolvedValue(payeeParty);
      (translateDeliveryTerms as jest.Mock).mockResolvedValue(deliveryTerms);

      const invoice = {
        id: 'INV-1',
        issueDate: '2026-03-20',
        note,
        invoicePeriod,
        orderReference,
        billingReference,
        accountingSupplierParty: supplierParty,
        accountingCustomerParty: customerParty,
        payeeParty,
        buyerCustomerParty,
        sellerSupplierParty,
        delivery,
        deliveryTerms,
        paymentMeans,
        paymentTerms,
        allowanceCharge,
        taxTotal: [
          {
            taxSubtotal: [{ taxCategory }],
          },
        ],
        legalMonetaryTotal: { payableAmount: '100.00' },
        invoiceLine: [
          {
            id: '1',
            lineExtensionAmount: '100.00',
            item: {},
          },
        ],
      } as any;

      const result = await translateInvoice(invoice, 'fr');

      expect(translateStringArray).toHaveBeenCalledWith(note, 'fr');
      expect(translatePeriod).toHaveBeenCalledWith(invoicePeriod[0], 'fr');
      expect(translateDocumentReference).toHaveBeenCalledWith(orderReference, 'fr');
      expect(translateDocumentReferenceArray).toHaveBeenCalledWith(billingReference, 'fr');
      expect(translateSupplierParty).toHaveBeenCalledWith(supplierParty, 'fr');
      expect(translateCustomerParty).toHaveBeenCalledWith(customerParty, 'fr');
      expect(translateParty).toHaveBeenCalledWith(payeeParty, 'fr');
      expect(translateDelivery).toHaveBeenCalledWith(delivery[0], 'fr');
      expect(translateDeliveryTerms).toHaveBeenCalledWith(deliveryTerms, 'fr');
      expect(translatePaymentMeans).toHaveBeenCalledWith(paymentMeans[0], 'fr');
      expect(translatePaymentTerms).toHaveBeenCalledWith(paymentTerms[0], 'fr');
      expect(translateAllowanceCharge).toHaveBeenCalledWith(allowanceCharge[0], 'fr');
      expect(translateTaxCategory).toHaveBeenCalledWith(taxCategory, 'fr');
      expect(result).toBeDefined();
    });

    test('translates each invoice line', async () => {
      const line1 = {
        id: '1',
        lineExtensionAmount: '100.00',
        item: { name: 'Item 1' },
      };
      const line2 = {
        id: '2',
        lineExtensionAmount: '200.00',
        item: { name: 'Item 2' },
      };

      const invoice = {
        id: 'INV-2',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: { payableAmount: '300.00' },
        invoiceLine: [line1, line2],
      } as any;

      await translateInvoice(invoice, 'fr');

      expect(translateInvoiceLine).toHaveBeenCalledTimes(2);
      expect(translateInvoiceLine).toHaveBeenCalledWith(line1, 'fr');
      expect(translateInvoiceLine).toHaveBeenCalledWith(line2, 'fr');
    });

    test('returns a cloned invoice object', async () => {
      const invoice = {
        id: 'INV-3',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: { payableAmount: '100.00' },
        invoiceLine: [
          {
            id: '1',
            lineExtensionAmount: '100.00',
            item: {},
          },
        ],
      } as any;

      const result = await translateInvoice(invoice, 'fr');

      expect(result).not.toBe(invoice);
    });

    test('does not call optional translators when optional fields are missing', async () => {
      const invoice = {
        id: 'INV-4',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: { payableAmount: '100.00' },
        invoiceLine: [
          {
            id: '1',
            lineExtensionAmount: '100.00',
            item: {},
          },
        ],
      } as any;

      await translateInvoice(invoice, 'fr');

      expect(translateStringArray).not.toHaveBeenCalled();
      expect(translateDocumentReference).not.toHaveBeenCalled();
      expect(translateDocumentReferenceArray).not.toHaveBeenCalled();
      expect(translateAllowanceCharge).not.toHaveBeenCalled();
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT when invoice is missing', async () => {
      await expect(
        translateInvoice(undefined as any, 'fr')
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});