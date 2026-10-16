import { PEPPOL, partyToPeppol } from "./mandates";
import { validateInput, Validator, rules } from "./validator";
import { mapKeys, UBL_NAMING } from "./mapper";
import { AppError } from "../errors";
import { jsonToXml } from "../routes/convert";

//Formats invoices into peppol adhering XML
export function invoiceToPeppol(invoice: any): string {
  const errors = validateInput(rules, invoice);
  if (errors.length > 0) {
    throw new AppError('VALIDATION_FAILED', errors.join('\n'));
  }

  const currency = invoice.documentCurrencyCode;
  const rounding = (invoice.invoiceLine || []).map((line: { lineExtensionAmount: any; }) => {
    return {
      ...line,
      roundedExtension: Number(line.lineExtensionAmount || 0)
    };
  });

  const totExtension = rounding.reduce((sum: any, line: { roundedExtension: any; }) => sum + line.roundedExtension, 0);
  const totalTax = Number(invoice.taxTotal?.[0]?.taxAmount || 0);
  const payableAmount = Number(invoice.legalMonetaryTotal?.payableAmount || (totExtension + totalTax));
  const taxScheme = invoice.taxTotal?.[0]?.taxSubtotal?.[0]?.taxCategory?.taxScheme?.id || "GST";
  const defaultRate = invoice.taxTotal?.[0]?.taxSubtotal?.[0]?.percent || "10";

  const output = {
    ...UBL_NAMING,
    customizationID: PEPPOL.invoiceCustomisationId,
    profileID: PEPPOL.invoiceProfileId,
    id: invoice.id,
    issueDate: invoice.issueDate,
    documentCurrencyCode: currency,
    buyerReference: invoice.buyerReference,
    orderReference: invoice.orderReference?.id,
    accountingSupplierParty: { party: partyToPeppol(invoice.accountingSupplierParty?.party) },
    accountingCustomerParty: { party: partyToPeppol(invoice.accountingCustomerParty?.party) },
    taxTotal: {
      taxAmount: { "@_currencyID": currency, "#text": totalTax.toFixed(2) },
      taxSubtotal: {
        taxableAmount: { "@_currencyID": currency, "#text": totExtension.toFixed(2) },
        taxAmount: { "@_currencyID": currency, "#text": totalTax.toFixed(2) },
        taxCategory: { id: "S", percent: defaultRate, 
          taxScheme: { id: taxScheme } }
      }
    },
    legalMonetaryTotal: {
      lineExtensionAmount: { "@_currencyID": currency, "#text": totExtension.toFixed(2) },
      taxExclusiveAmount: { "@_currencyID": currency, "#text": Number(invoice.legalMonetaryTotal?.taxExclusiveAmount || totExtension).toFixed(2) },
      taxInclusiveAmount: { "@_currencyID": currency, "#text": Number(invoice.legalMonetaryTotal?.taxInclusiveAmount || (totExtension + totalTax)).toFixed(2) },
      payableAmount: { "@_currencyID": currency, "#text": payableAmount.toFixed(2) }
    },
    invoiceLine: rounding.map((line: { id: any; price: { baseQuantityUnitCode: any; priceAmount: any; }; invoicedQuantity: any; roundedExtension: number; item: { name: any; }; }) => ({
      id: line.id,
      invoicedQuantity: { "@_unitCode": line.price?.baseQuantityUnitCode || "EA", "#text": Number(line.invoicedQuantity || 1).toFixed(0) },
      lineExtensionAmount: { "@_currencyID": currency, "#text": line.roundedExtension.toFixed(2) },
      item: { 
        name: line.item?.name || "Service Item",
        classifiedTaxCategory: { id: "S", percent: defaultRate, taxScheme: { id: taxScheme } }
      },
      price: { priceAmount: { "@_currencyID": currency, "#text": Number(line.price?.priceAmount || 0).toFixed(2) } }
    }))
  };

  return jsonToXml({ 
    Invoice: mapKeys(output)
  });
}