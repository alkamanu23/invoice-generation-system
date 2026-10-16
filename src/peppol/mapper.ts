// Map to formal UBL renaming
const MAP: Record<string, string> = {
  id: "cbc:ID",
  buyerReference: "cbc:BuyerReference",
  issueDate: "cbc:IssueDate",
  documentCurrencyCode: "cbc:DocumentCurrencyCode",
  customizationID: "cbc:CustomizationID",
  profileID: "cbc:ProfileID",
  accountingSupplierParty: "cac:AccountingSupplierParty",
  accountingCustomerParty: "cac:AccountingCustomerParty",
  party: "cac:Party",
  endpointID: "cbc:EndpointID",
  partyName: "cac:PartyName",
  name: "cbc:Name",
  legalMonetaryTotal: "cac:LegalMonetaryTotal",
  payableAmount: "cbc:PayableAmount",
  lineExtensionAmount: "cbc:LineExtensionAmount",
  invoiceLine: "cac:InvoiceLine",
  item: "cac:Item",
  orderLineReference: "cac:OrderLineReference",
  lineID: "cbc:LineID",
  taxTotal: "cac:TaxTotal",
  taxAmount: "cbc:TaxAmount",
  taxSubtotal: "cac:TaxSubtotal",
  taxableAmount: "cbc:TaxableAmount",
  taxCategory: "cac:TaxCategory",
  percent: "cbc:Percent",
  taxScheme: "cac:TaxScheme",
  invoicedQuantity: "cbc:InvoicedQuantity",
  price: "cac:Price",
  priceAmount: "cbc:PriceAmount",
  classifiedTaxCategory: "cac:ClassifiedTaxCategory",
  taxExclusiveAmount: "cbc:TaxExclusiveAmount",
  taxInclusiveAmount: "cbc:TaxInclusiveAmount",
  dueDate: "cbc:DueDate",
  paymentMeans: "cac:PaymentMeans",
  paymentTerms: "cac:PaymentTerms",
  delivery: "cac:Delivery",
  deliveryTerms: "cac:DeliveryTerms",
  orderReference: "cac:OrderReference"
};

const allowedKeys = new Set(Object.keys(MAP));

// Renames nested data keys to MAP 
export function mapKeys(object: any): any {
  if (Array.isArray(object)) {
    return object.map(mapKeys);
  };

  if (object !== null && typeof object === "object") {
    return Object.fromEntries(
      Object.entries(object)
      .map(([key, value]) => [ MAP[key] || key, mapKeys(value) ]) //fallback to keep original key if not found in MAP
    );
  }
  return object;
}

// Defines XML structure 
export const UBL_NAMING = {
  "@_xmlns": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  "@_xmlns:cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  "@_xmlns:cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
};