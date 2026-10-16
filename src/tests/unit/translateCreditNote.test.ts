import { translateCreditNote } from '../../services/translators/creditNoteTranslator';
import {
  translateAllowanceCharge,
  translateCustomerParty,
  translateDocumentReferenceArray,
  translateItem,
  translateStringArray,
  translateSupplierParty,
  translateTaxCategory,
} from '../../services/translationHelper';

jest.mock('../../services/translationHelper', () => ({
  translateAllowanceCharge: jest.fn(),
  translateCustomerParty: jest.fn(),
  translateDocumentReferenceArray: jest.fn(),
  translateItem: jest.fn(),
  translateStringArray: jest.fn(),
  translateSupplierParty: jest.fn(),
  translateTaxCategory: jest.fn(),
}));

describe('Credit Note Translation Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('success cases', () => {
    test('translates top level credit note fields', async () => {
      const note = ['original note'];
      const billingReference = [{ id: 'ref-1' }];
      const supplierParty = { party: {} };
      const customerParty = { party: {} };
      const taxCategory = { id: 'A' };

      (translateStringArray as jest.Mock).mockResolvedValue(['translated note']);
      (translateDocumentReferenceArray as jest.Mock).mockResolvedValue(billingReference);
      (translateSupplierParty as jest.Mock).mockResolvedValue(supplierParty);
      (translateCustomerParty as jest.Mock).mockResolvedValue(customerParty);

      const creditNote = {
        id: 'CN-1',
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
        creditNoteLine: [
          {
            id: '1',
            lineExtensionAmount: 100,
            item: {},
          },
        ],
      } as any;

      const result = await translateCreditNote(creditNote, 'fr');

      expect(translateStringArray).toHaveBeenCalledWith(note, 'fr');
      expect(translateDocumentReferenceArray).toHaveBeenCalledWith(billingReference, 'fr');
      expect(translateSupplierParty).toHaveBeenCalledWith(supplierParty, 'fr');
      expect(translateCustomerParty).toHaveBeenCalledWith(customerParty, 'fr');
      expect(translateTaxCategory).toHaveBeenCalledWith(taxCategory, 'fr');
      expect(result).toBeDefined();
    });

    test('translates each credit note line item', async () => {
      const item1 = { name: 'Item 1' };
      const item2 = { name: 'Item 2' };

      const creditNote = {
        id: 'CN-2',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: {},
        creditNoteLine: [
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

      await translateCreditNote(creditNote, 'fr');

      expect(translateItem).toHaveBeenCalledTimes(2);
      expect(translateItem).toHaveBeenCalledWith(item1, 'fr');
      expect(translateItem).toHaveBeenCalledWith(item2, 'fr');
    });

    test('translates allowance charges on credit note lines', async () => {
      const allowance1 = { amount: 5 };
      const allowance2 = { amount: 10 };

      const creditNote = {
        id: 'CN-3',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: {},
        creditNoteLine: [
          {
            id: '1',
            lineExtensionAmount: 100,
            item: {},
            allowanceCharge: [allowance1, allowance2],
          },
        ],
      } as any;

      await translateCreditNote(creditNote, 'fr');

      expect(translateAllowanceCharge).toHaveBeenCalledTimes(2);
      expect(translateAllowanceCharge).toHaveBeenCalledWith(allowance1, 'fr');
      expect(translateAllowanceCharge).toHaveBeenCalledWith(allowance2, 'fr');
    });

    test('translates tax categories on credit note lines', async () => {
      const lineTaxCategory1 = { id: 'A' };
      const lineTaxCategory2 = { id: 'B' };

      const creditNote = {
        id: 'CN-4',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: {},
        creditNoteLine: [
          {
            id: '1',
            lineExtensionAmount: 100,
            item: {},
            taxTotal: [
              {
                taxSubtotal: [
                  { taxCategory: lineTaxCategory1 },
                  { taxCategory: lineTaxCategory2 },
                ],
              },
            ],
          },
        ],
      } as any;

      await translateCreditNote(creditNote, 'fr');

      expect(translateTaxCategory).toHaveBeenCalledWith(lineTaxCategory1, 'fr');
      expect(translateTaxCategory).toHaveBeenCalledWith(lineTaxCategory2, 'fr');
    });

    test('returns a cloned credit note object', async () => {
      const creditNote = {
        id: 'CN-5',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: {},
        creditNoteLine: [
          {
            id: '1',
            lineExtensionAmount: 100,
            item: {},
          },
        ],
      } as any;

      const result = await translateCreditNote(creditNote, 'fr');

      expect(result).not.toBe(creditNote);
    });

    test('does not call optional translators when optional fields are missing', async () => {
      const creditNote = {
        id: 'CN-6',
        issueDate: '2026-03-20',
        accountingSupplierParty: {},
        accountingCustomerParty: {},
        legalMonetaryTotal: {},
        creditNoteLine: [
          {
            id: '1',
            lineExtensionAmount: 100,
            item: {},
          },
        ],
      } as any;

      await translateCreditNote(creditNote, 'fr');

      expect(translateStringArray).not.toHaveBeenCalled();
      expect(translateDocumentReferenceArray).not.toHaveBeenCalled();
      expect(translateAllowanceCharge).not.toHaveBeenCalled();
    });
  });

  describe('error cases', () => {
    test('throws INVALID_INPUT when credit note is missing', async () => {
      await expect(
        translateCreditNote(undefined as any, 'fr')
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });
});