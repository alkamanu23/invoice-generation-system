import { AppError } from "../../errors";
import { Order } from "../../types/order";
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
} from "../translationHelper";

export async function translateOrder(order: Order, targetLanguage: string): Promise<Order> {
    if (!order) {
        throw new AppError("INVALID_INPUT", "order is required.");
    }

    const translatedOrder: Order = structuredClone(order);

    // translate note
    if (translatedOrder.note) {
        translatedOrder.note = (await translateStringArray(translatedOrder.note, targetLanguage));
    }

    // translate validityPeriod
    if (translatedOrder.validityPeriod) {
        for (const period of translatedOrder.validityPeriod) {
            await translatePeriod(period, targetLanguage);
        }
    }

    // translate orderDocumentReference
    if (translatedOrder.orderDocumentReference) {
        translatedOrder.orderDocumentReference = await translateDocumentReferenceArray(
            translatedOrder.orderDocumentReference,
            targetLanguage
        );
    }

    // translate originatorDocumentReference
    if (translatedOrder.originatorDocumentReference) {
        translatedOrder.originatorDocumentReference = await translateDocumentReference(
            translatedOrder.originatorDocumentReference,
            targetLanguage
        );
    }

    // translate additionalDocumentReference
    if (translatedOrder.additionalDocumentReference) {
        translatedOrder.additionalDocumentReference = await translateDocumentReferenceArray(
            translatedOrder.additionalDocumentReference,
            targetLanguage
        );
    }

    // translate buyerCustomerParty
    if (translatedOrder.buyerCustomerParty) {
        translatedOrder.buyerCustomerParty = await translateCustomerParty(
            translatedOrder.buyerCustomerParty,
            targetLanguage
        );
    }

    // translate sellerSupplierParty
    if (translatedOrder.sellerSupplierParty) {
        translatedOrder.sellerSupplierParty = await translateSupplierParty(
            translatedOrder.sellerSupplierParty,
            targetLanguage
        );
    }

    // translate accountingCustomerParty
    if (translatedOrder.accountingCustomerParty) {
        translatedOrder.accountingCustomerParty = await translateCustomerParty(
            translatedOrder.accountingCustomerParty,
            targetLanguage
        );
    }

    // translate delivery
    if (translatedOrder.delivery) {
        for (const delivery of translatedOrder.delivery) {
            await translateDelivery(delivery, targetLanguage);
        }
    }

    // translate deliveryTerms
    if (translatedOrder.deliveryTerms) {
        for (const deliveryTerm of translatedOrder.deliveryTerms) {
            await translateDeliveryTerms(deliveryTerm, targetLanguage);
        }
    }

    // translate paymentMeans
    if (translatedOrder.paymentMeans) {
        await translatePaymentMeans(translatedOrder.paymentMeans, targetLanguage);
    }

    // translate paymentTerms[]
    if (translatedOrder.paymentTerms) {
        for (const paymentTerm of translatedOrder.paymentTerms) {
            await translatePaymentTerms(paymentTerm, targetLanguage);
        }
    }

    // translate allowanceCharge[]
    if (translatedOrder.allowanceCharge) {
        for (const allowanceCharge of translatedOrder.allowanceCharge) {
            await translateAllowanceCharge(allowanceCharge, targetLanguage);
        }
    }

    // translate taxTotal[]
    if (translatedOrder.taxTotal) {
        for (const taxTotal of translatedOrder.taxTotal) {
            if (taxTotal.taxSubtotal) {
                for (const taxSubtotal of taxTotal.taxSubtotal) {
                    await translateTaxCategory(taxSubtotal.taxCategory, targetLanguage);
                }
            }
        }
    }

    // translate orderLine[]
    for (const line of translatedOrder.orderLine) {
        await translateOrderLine(line, targetLanguage);
    }

    return translatedOrder;
}