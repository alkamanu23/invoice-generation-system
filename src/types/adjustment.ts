import { 
  MonetaryTotal,
  Item,
  TaxTotal,
  AllowanceCharge,
  DocumentReference,
  SupplierParty,
  CustomerParty
} from './invoice';

export interface GenerateAdjustmentRequest {
  invoiceIdReference: number;
  adjustmentType: "credit" | "debit";
  amount: number;
  reason: string;
  lines: LineItem[];
}

export interface LineItem {
  id: string;
  item: Item;
  quantity?: number | undefined;
  lineExtensionAmount?: number | undefined;
  price?: Price | undefined;
  taxTotal?: TaxTotal[] | undefined;
  allowanceCharge?: AllowanceCharge[] | undefined;
}

export interface Price {
  priceAmount: string;              // was number, align with invoice.ts
  baseQuantity?: string | undefined;
  allowanceCharge?: AllowanceCharge[] | undefined;
  priceTypeCode?: string | undefined;
  priceType?: string | undefined;
}

export interface CreditNote {
  id: string;
  UUID?: string | undefined;
  issueDate: string;
  issueTime?: string | undefined;
  creditNoteTypeCode?: string | undefined;
  note?: string[] | undefined;
  documentCurrencyCode?: string | undefined;
  billingReference?: DocumentReference[] | undefined;
  accountingSupplierParty: SupplierParty;
  accountingCustomerParty: CustomerParty;
  taxTotal?: TaxTotal[] | undefined;
  legalMonetaryTotal: MonetaryTotal;
  creditNoteLine: CreditNoteLine[];
}

export interface CreditNoteLine {
  id: string;
  lineExtensionAmount: number;
  item: Item;
  creditedQuantity?: number | undefined;
  price?: Price | undefined;
  taxTotal?: TaxTotal[] | undefined;
  allowanceCharge?: AllowanceCharge[] | undefined;
}

export interface DebitNote {
  id: string;
  issueDate: string;
  issueTime?: string | undefined;
  note?: string[] | undefined;
  billingReference?: DocumentReference[] | undefined;
  accountingSupplierParty: SupplierParty;
  accountingCustomerParty: CustomerParty;
  taxTotal?: TaxTotal[] | undefined;
  legalMonetaryTotal: MonetaryTotal;
  debitNoteLine: DebitNoteLine[];
}

export interface DebitNoteLine {
  id: string;
  debitedQuantity?: number | undefined;
  lineExtensionAmount: number;
  item: Item;
  price?: Price | undefined;
}