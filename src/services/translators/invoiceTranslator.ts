import { AppError } from "../../errors";
import { Invoice } from "../../types/invoice";
import { translateAllowanceCharge, translateCustomerParty, translateDelivery, translateDeliveryTerms, translateDocumentReference, translateDocumentReferenceArray, translateInvoiceLine, translateParty, translatePaymentMeans, translatePaymentTerms, translatePeriod, translateStringArray, translateSupplierParty, translateTaxCategory } from "../translationHelper"
//get something for supported languages

//should i go by id or request the entire invoice
//how to validate target language, is only giving the options in the front end enough 
export async function translateInvoice(invoice: Invoice, targetLanguage: string): Promise<Invoice> {
    if (!invoice) {
        throw new AppError("INVALID_INPUT", "invoice is required.");
    }
    //use structured clone so that only the text fields are modified
    const translatedInvoice: Invoice = structuredClone(invoice);

    //translate note
    if (translatedInvoice.note)
    translatedInvoice.note = (await translateStringArray(translatedInvoice.note, targetLanguage));

    //translate invoicePeriod[]
    if (translatedInvoice.invoicePeriod) {
        for (const period of translatedInvoice.invoicePeriod) {
            await translatePeriod(period, targetLanguage);
        }
    }

    //translate orderReference
    if(translatedInvoice.orderReference) {
        translatedInvoice.orderReference = (await translateDocumentReference(translatedInvoice.orderReference, targetLanguage));
    }

    //translate billing reference
    if(translatedInvoice.billingReference) {
        translatedInvoice.billingReference = (await translateDocumentReferenceArray(translatedInvoice.billingReference, targetLanguage));
    }

    //translate despatchDocumentReference
    if(translatedInvoice.despatchDocumentReference) {
        translatedInvoice.despatchDocumentReference = (await translateDocumentReferenceArray(translatedInvoice.despatchDocumentReference, targetLanguage));
    }

    //translate receiptDocumentReference
    if(translatedInvoice.receiptDocumentReference) {
        translatedInvoice.receiptDocumentReference = (await translateDocumentReferenceArray(translatedInvoice.receiptDocumentReference, targetLanguage));
    }

    //translate originatorDocumentReference
    if(translatedInvoice.originatorDocumentReference) {
        translatedInvoice.originatorDocumentReference = (await translateDocumentReferenceArray(translatedInvoice.originatorDocumentReference, targetLanguage));
    }

    //translate contractDocumentReference
    if(translatedInvoice.contractDocumentReference) {
        translatedInvoice.contractDocumentReference = (await translateDocumentReferenceArray(translatedInvoice.contractDocumentReference, targetLanguage));
    }

    //translate additionalDocumentReference
    if(translatedInvoice.additionalDocumentReference) {
        translatedInvoice.additionalDocumentReference = (await translateDocumentReferenceArray(translatedInvoice.additionalDocumentReference, targetLanguage));
    }

    // translate accountingSupplierParty
    if(translatedInvoice.accountingSupplierParty) {
        translatedInvoice.accountingSupplierParty = ( await translateSupplierParty(translatedInvoice.accountingSupplierParty, targetLanguage));
    }

    //translate accountingCustomerParty
    if(translatedInvoice.accountingCustomerParty) {
        translatedInvoice.accountingCustomerParty = ( await translateCustomerParty(translatedInvoice.accountingCustomerParty, targetLanguage));       
    }

    //translate payeeParty 
    if(translatedInvoice.payeeParty) {
        translatedInvoice.payeeParty = ( await translateParty(translatedInvoice.payeeParty, targetLanguage));       
    }

    //translate buyerCustomerParty 
    if(translatedInvoice.buyerCustomerParty) {
        translatedInvoice.buyerCustomerParty = ( await translateCustomerParty(translatedInvoice.buyerCustomerParty, targetLanguage));       
    }

    //translate sellerSupplierParty 
    if(translatedInvoice.sellerSupplierParty) {
        translatedInvoice.sellerSupplierParty = ( await translateSupplierParty(translatedInvoice.sellerSupplierParty, targetLanguage));       
    }

    //translate invoicePeriod[]
    if (translatedInvoice.invoicePeriod) {
        for (const period of translatedInvoice.invoicePeriod) {
            await translatePeriod(period, targetLanguage)
        }
    }

    //translate delivery 
    if (translatedInvoice.delivery) {
        for (const delivery of translatedInvoice.delivery) {
            await translateDelivery(delivery, targetLanguage);
        }
    }

    //translate delivery terms
    if (translatedInvoice.deliveryTerms) {
        translatedInvoice.deliveryTerms = await translateDeliveryTerms(translatedInvoice.deliveryTerms, targetLanguage);
    }

    //translate paymentMeans
    if (translatedInvoice.paymentMeans) {
        for (const paymentMeans of translatedInvoice.paymentMeans) {
            await translatePaymentMeans(paymentMeans, targetLanguage);
        }
    }

    //translate paymentTerms
    if (translatedInvoice.paymentTerms) {
        for (const paymentTerm of translatedInvoice.paymentTerms) {
            await translatePaymentTerms(paymentTerm, targetLanguage);
        }
    }

    //translate allowanceCharge
    if (translatedInvoice.allowanceCharge) {
        for (const allowanceCharge of translatedInvoice.allowanceCharge) {
            await translateAllowanceCharge(allowanceCharge, targetLanguage);
        }
    }

    //translate taxTotal
    if (translatedInvoice.taxTotal) {
        for (const taxTotal of translatedInvoice.taxTotal) {
            if (taxTotal.taxSubtotal) {
                for (const taxSubtotal of taxTotal.taxSubtotal) {
                    await translateTaxCategory(taxSubtotal.taxCategory, targetLanguage);
                }
            }
        }
    }

    //translate invoice lines
    for (const line of translatedInvoice.invoiceLine) {
        await translateInvoiceLine(line, targetLanguage);
    }

    return translatedInvoice;

}
