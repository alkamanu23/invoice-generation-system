import { translateDebitNote } from '../../services/translators/debitNoteTranslator';
import {
  translateCustomerParty,
  translateDocumentReferenceArray,
  translateItem,
  translateStringArray,
  translateSupplierParty,
  translateTaxCategory,
} from '../../services/translationHelper';

jest.mock('../../services/translationHelper', () => ({
  translateCustomerParty: jest.fn(),
  translateDocumentReferenceArray: jest.fn(),
  translateItem: jest.fn(),
  translateStringArray: jest.fn(),
  translateSupplierParty: jest.fn(),
  translateTaxCategory: jest.fn(),
}));

describe('Debit Note Translation Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success cases', () => {
    test('translates top level debit note fields', async () => {
      const note = ['original note'];
      const billingReference = [{ id: 'ref-1' }];
      const supplierParty = { party: {} };
      const customerParty = { party: {} };
      const taxCategory = { id: 'A' };

      (translateStringArray as jest.Mock).mockResolvedValue(['translated note']);
      (translateDocumentReferenceArray as jest.Mock).mockResolvedValue(billingReference);
      (translateSupplierParty as jest.Mock).mockResolvedValue(supplierParty);
      (translateCustomerParty as jest.Mock).mockResolvedValue(customerParty);

      const debitNote = {
        id: 'DN-1',
        issueDate: '2026-03-20',
        note,
        billingReference,
        accountingSupplierParty: supplierParty,
        accountingCustomerParty: customerParty,
        taxTotal: [
          {
            taxSubtotal: [{ taxCategory }],
          },
        ],
        legalMonetaryTotal: {},
        debitNoteLine: [
          {
            id: '1',
            lineExtensionAmount: 100,
            item: {},
          },
        ],
      } as any;

      const result = await translateDebitNote(debitNote, 'fr');

      expect(translateStringArray).toHaveBeenCalledWith(note, 'fr');
      expect(translateDocumentReferenceArray).toHaveBeenCalledWith(billingReference, 'fr');
      expect(translateSupplierParty).toHaveBeenCalledWith(supplierParty, 'fr');
      expect(translateCustomerParty).toHaveBeenCalledWith(customerParty, 'fr');
      expect(translateTaxCategory).toHaveBeenCalledWith(taxCategory, 'fr');
      expect(result).toBeDefined();
    });

    test('translates each debit note line item', async () => {
      const item1 = { name: 'Item 1' };
      const item2 = { name: 'Item 2' };

      const debitNote = {
        id: 'DN-2',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: {},
        debitNoteLine: [
          {
            id: '1',
            lineExtensionAmount: 100,
            item: item1,
          },
          {
            id: '2',
            lineExtensionAmount: 200,
            item: item2,
          },
        ],
      } as any;

      await translateDebitNote(debitNote, 'fr');

      expect(translateItem).toHaveBeenCalledTimes(2);
      expect(translateItem).toHaveBeenCalledWith(item1, 'fr');
      expect(translateItem).toHaveBeenCalledWith(item2, 'fr');
    });

    test('returns a cloned debit note object', async () => {
      const debitNote = {
        id: 'DN-4',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: {},
        debitNoteLine: [
          {
            id: '1',
            lineExtensionAmount: 100,
            item: {},
          },
        ],
      } as any;

      const result = await translateDebitNote(debitNote, 'fr');

      expect(result).not.toBe(debitNote);
    });

    test('does not call optional translators when optional fields are missing', async () => {
      const debitNote = {
        id: 'DN-5',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: {},
        debitNoteLine: [
          {
            id: '1',
            lineExtensionAmount: 100,
            item: {},
          },
        ],
      } as any;

      await translateDebitNote(debitNote, 'fr');

      expect(translateStringArray).not.toHaveBeenCalled();
      expect(translateDocumentReferenceArray).not.toHaveBeenCalled();
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT when debit note is missing', async () => {
      await expect(
        translateDebitNote(undefined as any, 'fr')
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});