import { AppError } from "../../errors";
import { CreditNote } from "../../types/adjustment";
import {
    translateAllowanceCharge,
    translateCustomerParty,
    translateDocumentReferenceArray,
    translateStringArray,
    translateSupplierParty,
    translateTaxCategory,
    translateItem,
} from "../translationHelper";

export async function translateCreditNote(
    creditNote: CreditNote,
    targetLanguage: string
): Promise<CreditNote> {
    if (!creditNote) {
        throw new AppError("INVALID_INPUT", "credit note is required.");
    }

    const translatedCreditNote: CreditNote = structuredClone(creditNote);

    // translate note
    if (translatedCreditNote.note) {
        translatedCreditNote.note = await translateStringArray(
            translatedCreditNote.note,
            targetLanguage
        );
    }

    // translate billingReference
    if (translatedCreditNote.billingReference) {
        translatedCreditNote.billingReference = await translateDocumentReferenceArray(
            translatedCreditNote.billingReference,
            targetLanguage
        );
    }

    // translate accountingSupplierParty
    if (translatedCreditNote.accountingSupplierParty) {
        translatedCreditNote.accountingSupplierParty = await translateSupplierParty(
            translatedCreditNote.accountingSupplierParty,
            targetLanguage
        );
    }

    // translate accountingCustomerParty
    if (translatedCreditNote.accountingCustomerParty) {
        translatedCreditNote.accountingCustomerParty = await translateCustomerParty(
            translatedCreditNote.accountingCustomerParty,
            targetLanguage
        );
    }

    // translate taxTotal
    if (translatedCreditNote.taxTotal) {
        for (const taxTotal of translatedCreditNote.taxTotal) {
            if (taxTotal.taxSubtotal) {
                for (const taxSubtotal of taxTotal.taxSubtotal) {
                    await translateTaxCategory(taxSubtotal.taxCategory, targetLanguage);
                }
            }
        }
    }

    // translate creditNoteLine
    for (const line of translatedCreditNote.creditNoteLine) {
        if (line.item) {
            await translateItem(line.item, targetLanguage);
        }

        if (line.allowanceCharge) {
            for (const allowanceCharge of line.allowanceCharge) {
                await translateAllowanceCharge(allowanceCharge, targetLanguage);
            }
        }

        if (line.taxTotal) {
            for (const taxTotal of line.taxTotal) {
                if (taxTotal.taxSubtotal) {
                    for (const taxSubtotal of taxTotal.taxSubtotal) {
                        await translateTaxCategory(taxSubtotal.taxCategory, targetLanguage);
                    }
                }
            }
        }
    }

    return translatedCreditNote;
}