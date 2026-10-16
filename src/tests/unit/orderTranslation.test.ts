import { translateOrder } from '../../services/translators/orderTranslator';
import {
  translateAllowanceCharge,
  translateCustomerParty,
  translateDelivery,
  translateDeliveryTerms,
  translateDocumentReference,
  translateDocumentReferenceArray,
  translateOrderLine,
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
  translateOrderLine: jest.fn(),
  translatePaymentMeans: jest.fn(),
  translatePaymentTerms: jest.fn(),
  translatePeriod: jest.fn(),
  translateStringArray: jest.fn(),
  translateSupplierParty: jest.fn(),
  translateTaxCategory: jest.fn(),
}));

describe('Order Translation Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success cases', () => {
    test('translates top level order fields', async () => {
      const note = ['original order note'];
      const validityPeriod = [{ startDate: '2026-03-01' }];
      const orderDocumentReference = [{ id: 'doc-1' }];
      const originatorDocumentReference = { id: 'origin-1' };
      const additionalDocumentReference = [{ id: 'add-1' }];
      const buyerCustomerParty = { party: {} };
      const sellerSupplierParty = { party: {} };
      const accountingCustomerParty = { party: {} };
      const delivery = [{ id: 'delivery-1' }];
      const deliveryTerms = [{ id: 'terms-1' }];
      const paymentMeans = { paymentMeansCode: '30' };
      const paymentTerms = [{ id: 'pt-1' }];
      const allowanceCharge = [{ amount: '5', chargeIndicator: true, taxCategory: [] }];
      const taxCategory = { id: 'A' };

      (translateStringArray as jest.Mock).mockResolvedValue(['translated order note']);
      (translateDocumentReferenceArray as jest.Mock).mockResolvedValue(orderDocumentReference);
      (translateDocumentReference as jest.Mock).mockResolvedValue(originatorDocumentReference);
      (translateCustomerParty as jest.Mock).mockResolvedValue(buyerCustomerParty);
      (translateSupplierParty as jest.Mock).mockResolvedValue(sellerSupplierParty);

      const order = {
        id: 'ORD-1',
        issueDate: '2026-03-20',
        note,
        validityPeriod,
        orderDocumentReference,
        originatorDocumentReference,
        additionalDocumentReference,
        buyerCustomerParty,
        sellerSupplierParty,
        accountingCustomerParty,
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
        orderLine: [
          {
            lineItem: {
              id: '1',
              delivery: [],
              lineExtensionAmount: '100.00',
              item: {},
            },
          },
        ],
      } as any;

      const result = await translateOrder(order, 'fr');

      expect(translateStringArray).toHaveBeenCalledWith(note, 'fr');
      expect(translatePeriod).toHaveBeenCalledWith(validityPeriod[0], 'fr');
      expect(translateDocumentReferenceArray).toHaveBeenCalledWith(orderDocumentReference, 'fr');
      expect(translateDocumentReference).toHaveBeenCalledWith(originatorDocumentReference, 'fr');
      expect(translateCustomerParty).toHaveBeenCalledWith(buyerCustomerParty, 'fr');
      expect(translateSupplierParty).toHaveBeenCalledWith(sellerSupplierParty, 'fr');
      expect(translateCustomerParty).toHaveBeenCalledWith(accountingCustomerParty, 'fr');
      expect(translateDelivery).toHaveBeenCalledWith(delivery[0], 'fr');
      expect(translateDeliveryTerms).toHaveBeenCalledWith(deliveryTerms[0], 'fr');
      expect(translatePaymentMeans).toHaveBeenCalledWith(paymentMeans, 'fr');
      expect(translatePaymentTerms).toHaveBeenCalledWith(paymentTerms[0], 'fr');
      expect(translateAllowanceCharge).toHaveBeenCalledWith(allowanceCharge[0], 'fr');
      expect(translateTaxCategory).toHaveBeenCalledWith(taxCategory, 'fr');
      expect(result).toBeDefined();
    });

    test('translates each order line', async () => {
      const line1 = {
        lineItem: {
          id: '1',
          delivery: [],
          lineExtensionAmount: '100.00',
          item: { name: 'Item 1' },
        },
      };
      const line2 = {
        lineItem: {
          id: '2',
          delivery: [],
          lineExtensionAmount: '200.00',
          item: { name: 'Item 2' },
        },
      };

      const order = {
        id: 'ORD-2',
        issueDate: '2026-03-20',
        buyerCustomerParty: {},
        sellerSupplierParty: {},
        orderLine: [line1, line2],
      } as any;

      await translateOrder(order, 'fr');

      expect(translateOrderLine).toHaveBeenCalledTimes(2);
      expect(translateOrderLine).toHaveBeenCalledWith(line1, 'fr');
      expect(translateOrderLine).toHaveBeenCalledWith(line2, 'fr');
    });

    test('returns a cloned order object', async () => {
      const order = {
        id: 'ORD-3',
        issueDate: '2026-03-20',
        buyerCustomerParty: {},
        sellerSupplierParty: {},
        orderLine: [
          {
            lineItem: {
              id: '1',
              delivery: [],
              lineExtensionAmount: '100.00',
              item: {},
            },
          },
        ],
      } as any;

      const result = await translateOrder(order, 'fr');

      expect(result).not.toBe(order);
    });

    test('does not call optional translators when optional fields are missing', async () => {
      const order = {
        id: 'ORD-4',
        issueDate: '2026-03-20',
        buyerCustomerParty: {},
        sellerSupplierParty: {},
        orderLine: [
          {
            lineItem: {
              id: '1',
              delivery: [],
              lineExtensionAmount: '100.00',
              item: {},
            },
          },
        ],
      } as any;

      await translateOrder(order, 'fr');

      expect(translateStringArray).not.toHaveBeenCalled();
      expect(translateDocumentReference).not.toHaveBeenCalled();
      expect(translateDocumentReferenceArray).not.toHaveBeenCalled();
      expect(translateAllowanceCharge).not.toHaveBeenCalled();
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT when order is missing', async () => {
      await expect(
        translateOrder(undefined as any, 'fr')
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});