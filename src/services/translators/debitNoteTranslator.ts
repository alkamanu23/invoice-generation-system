import { AppError } from "../../errors";
import { DebitNote } from "../../types/adjustment";
import {
    translateCustomerParty,
    translateDocumentReferenceArray,
    translateStringArray,
    translateSupplierParty,
    translateTaxCategory,
    translateItem,
} from "../translationHelper";

export async function translateDebitNote(
    debitNote: DebitNote,
    targetLanguage: string
): Promise<DebitNote> {
    if (!debitNote) {
        throw new AppError("INVALID_INPUT", "debit note is required.");
    }

    const translatedDebitNote: DebitNote = structuredClone(debitNote);

    // translate note
    if (translatedDebitNote.note) {
        translatedDebitNote.note = await translateStringArray(
            translatedDebitNote.note,
            targetLanguage
        );
    }

    // translate billingReference
    if (translatedDebitNote.billingReference) {
        translatedDebitNote.billingReference = await translateDocumentReferenceArray(
            translatedDebitNote.billingReference,
            targetLanguage
        );
    }

    // translate accountingSupplierParty
    if (translatedDebitNote.accountingSupplierParty) {
        translatedDebitNote.accountingSupplierParty = await translateSupplierParty(
            translatedDebitNote.accountingSupplierParty,
            targetLanguage
        );
    }

    // translate accountingCustomerParty
    if (translatedDebitNote.accountingCustomerParty) {
        translatedDebitNote.accountingCustomerParty = await translateCustomerParty(
            translatedDebitNote.accountingCustomerParty,
            targetLanguage
        );
    }

    // translate taxTotal
    if (translatedDebitNote.taxTotal) {
        for (const taxTotal of translatedDebitNote.taxTotal) {
            if (taxTotal.taxSubtotal) {
                for (const taxSubtotal of taxTotal.taxSubtotal) {
                    await translateTaxCategory(taxSubtotal.taxCategory, targetLanguage);
                }
            }
        }
    }

    // translate debitNoteLine
    for (const line of translatedDebitNote.debitNoteLine) {
        if (line.item) {
            await translateItem(line.item, targetLanguage);
        }
    }

    return translatedDebitNote;
}