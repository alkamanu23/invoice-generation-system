import { CreditNote, DebitNote } from "../types/adjustment";
import { Address, AllowanceCharge, Contact, CustomerParty, Delivery, DeliveryTerms, DocumentReference, FinancialAccount, InvoiceLine, Item, OrderLine, Party, PaymentMeans, PaymentTerms, Period, Person, SupplierParty, TaxCategory } from "../types/invoice";
import { translateText } from "./translationService";

export async function translateStringArray(values: string[], targetLanguage: string): Promise<string[]> {
    return Promise.all(
        values.map((value) => translateText(value, targetLanguage))
    );
}


export async function translateDocumentReference(documentReference: DocumentReference, targetLanguage: string
): Promise<DocumentReference> {
    if(documentReference.documentDescription) {
        documentReference.documentDescription = (await translateStringArray(
            documentReference.documentDescription,
            targetLanguage)
        ) ?? [];
    }

    if(documentReference.attachment?.externalReference?.description) {
        documentReference.attachment.externalReference.description = (await translateStringArray(
            documentReference.attachment.externalReference.description,
            targetLanguage)
        ) ?? [];
    }

    return documentReference;
}

export async function translateDocumentReferenceArray(documentReferences: DocumentReference[], targetLanguage: string
): Promise<DocumentReference[]> {
    for (const documentReference of documentReferences) {
        await translateDocumentReference(documentReference, targetLanguage);
    }
    return documentReferences;
}

export async function translateContact(contact: Contact, targetLanguage: string): Promise<Contact> {
    if (contact.note) {
        contact.note = await translateStringArray(contact.note, targetLanguage);
    }
    return contact;
}

async function translatePerson(person: Person, targetLanguage: string): Promise<Person> {
    if (person.Contact) {
        person.Contact = await translateContact(person.Contact, targetLanguage);
    }
    return person;
}

export async function translateParty(party: Party, targetLanguage: string
): Promise<Party> {
    if (party.contact) {
        party.contact = await translateContact(party.contact, targetLanguage);
    }
    if (party.Person) {
        for (const person of party.Person) {
            await translatePerson(person, targetLanguage);
        }
    }
    return party;
}

export async function translatePeriod(period: Period, targetLanguage: string): Promise<Period> {
    if (period.Description) {
        period.Description = await translateStringArray(period.Description, targetLanguage);
    }
    return period;
}

export async function translateSupplierParty(
    supplierParty: SupplierParty,
    targetLanguage: string
): Promise<SupplierParty> {
    if (supplierParty.party) {
        supplierParty.party = await translateParty(supplierParty.party, targetLanguage);
    }
    if (supplierParty.DespatchContact) {
        supplierParty.DespatchContact = await translateContact(supplierParty.DespatchContact, targetLanguage);
    }
    if (supplierParty.accountingContact) {
        supplierParty.accountingContact = await translateContact(supplierParty.accountingContact, targetLanguage);
    }
    if (supplierParty.sellerContact) {
        supplierParty.sellerContact = await translateContact(supplierParty.sellerContact, targetLanguage);
    }
    return supplierParty;
}

export async function translateCustomerParty(
    customerParty: CustomerParty,
    targetLanguage: string
): Promise<CustomerParty> {
    if (customerParty.party) {
        customerParty.party = await translateParty(customerParty.party, targetLanguage);
    }
    if (customerParty.deliveryContact) {
        customerParty.deliveryContact = await translateContact(customerParty.deliveryContact, targetLanguage);
    }
    if (customerParty.accountingContact) {
        customerParty.accountingContact = await translateContact(customerParty.accountingContact, targetLanguage);
    }
    if (customerParty.buyerContact) {
        customerParty.buyerContact = await translateContact(customerParty.buyerContact, targetLanguage);
    }
    return customerParty;
}

export async function translateDeliveryTerms(
    deliveryTerms: DeliveryTerms,
    targetLanguage: string
): Promise<DeliveryTerms> {
    if (deliveryTerms.specialTerms) {
        deliveryTerms.specialTerms = await translateStringArray(deliveryTerms.specialTerms, targetLanguage);
    }
    if (deliveryTerms.lossRisk) {
        deliveryTerms.lossRisk = await translateStringArray(deliveryTerms.lossRisk, targetLanguage);
    }
    return deliveryTerms;
}


export async function translateDelivery(
    delivery: Delivery,
    targetLanguage: string
): Promise<Delivery> {
    if (delivery.requestedDeliveryPeriod) {
        delivery.requestedDeliveryPeriod = await translatePeriod(delivery.requestedDeliveryPeriod, targetLanguage);
    }
    if (delivery.promisedDeliveryPeriod) {
        delivery.promisedDeliveryPeriod = await translatePeriod(delivery.promisedDeliveryPeriod, targetLanguage);
    }
    if (delivery.estimatedDeliveryPeriod) {
        delivery.estimatedDeliveryPeriod = await translatePeriod(delivery.estimatedDeliveryPeriod, targetLanguage);
    }
    if (delivery.carrierParty) {
        delivery.carrierParty = await translateParty(delivery.carrierParty, targetLanguage);
    }
    if (delivery.deliveryParty) {
        delivery.deliveryParty = await translateParty(delivery.deliveryParty, targetLanguage);
    }
    if (delivery.notifyParty) {
        for (const party of delivery.notifyParty) {
            await translateParty(party, targetLanguage);
        }
    }
    if (delivery.deliveryTerms) {
        delivery.deliveryTerms = await translateDeliveryTerms(delivery.deliveryTerms, targetLanguage);
    }
    return delivery;
}

export async function translateFinancialAccount(
    account: FinancialAccount,
    targetLanguage: string
): Promise<FinancialAccount> {
    if (account.paymentNote) {
        account.paymentNote = await translateStringArray(account.paymentNote, targetLanguage);
    }
    return account;
}

export async function translatePaymentMeans(
    paymentMeans: PaymentMeans,
    targetLanguage: string
): Promise<PaymentMeans> {
    if (paymentMeans.instructionNote) {
        paymentMeans.instructionNote = await translateStringArray(paymentMeans.instructionNote, targetLanguage);
    }
    if (paymentMeans.payerFinancialAccount) {
        paymentMeans.payerFinancialAccount = await translateFinancialAccount(paymentMeans.payerFinancialAccount, targetLanguage);
    }
    if (paymentMeans.payeeFinancialAccount) {
        paymentMeans.payeeFinancialAccount = await translateFinancialAccount(paymentMeans.payeeFinancialAccount, targetLanguage
        );
    }
    return paymentMeans;
}

export async function translatePaymentTerms(
    paymentTerms: PaymentTerms,
    targetLanguage: string
): Promise<PaymentTerms> {
    if (paymentTerms.note) {
        paymentTerms.note = await translateStringArray(paymentTerms.note, targetLanguage);
    }
    if (paymentTerms.SettlementPeriod) {
        paymentTerms.SettlementPeriod = await translatePeriod(paymentTerms.SettlementPeriod, targetLanguage);
    }
    return paymentTerms;
}

export async function translateTaxCategory(
    taxCategory: TaxCategory,
    targetLanguage: string
): Promise<TaxCategory> {
    if (taxCategory.taxExemptionReason) {
        taxCategory.taxExemptionReason = await translateStringArray(taxCategory.taxExemptionReason, targetLanguage);
    }
    return taxCategory;
}

export async function translateAllowanceCharge(
    allowanceCharge: AllowanceCharge,
    targetLanguage: string
): Promise<AllowanceCharge> {
    if (allowanceCharge.allowanceChargeReason) {
        allowanceCharge.allowanceChargeReason = await translateStringArray(allowanceCharge.allowanceChargeReason, targetLanguage);
    }
    for (const taxCategory of allowanceCharge.taxCategory) {
        await translateTaxCategory(taxCategory, targetLanguage);
    }
    return allowanceCharge;
}

export async function translateItem(item: Item, targetLanguage: string): Promise<Item> {
    if (item.description) {
        item.description = await translateStringArray(item.description, targetLanguage);
    }
    if (item.classifiedTaxCategory) {
        for (const taxCategory of item.classifiedTaxCategory) {
            await translateTaxCategory(taxCategory, targetLanguage);
        }
    }
    return item;
}

export async function translateInvoiceLine(
    invoiceLine: InvoiceLine,
    targetLanguage: string
): Promise<InvoiceLine> {
    if (invoiceLine.note) {
        invoiceLine.note = await translateStringArray(invoiceLine.note, targetLanguage);
    }

    if (invoiceLine.invoicePeriod) {
        for (const period of invoiceLine.invoicePeriod) {
            await translatePeriod(period, targetLanguage);
        }
    }

    if (invoiceLine.documentReference) {
        invoiceLine.documentReference = await translateDocumentReferenceArray(
            invoiceLine.documentReference,
            targetLanguage
        );
    }

    if (invoiceLine.allowanceCharge) {
        for (const allowanceCharge of invoiceLine.allowanceCharge) {
            await translateAllowanceCharge(allowanceCharge, targetLanguage);
        }
    }

    invoiceLine.item = await translateItem(invoiceLine.item, targetLanguage);

    if (invoiceLine.deliveryTerms) {
        invoiceLine.deliveryTerms = await translateDeliveryTerms(invoiceLine.deliveryTerms, targetLanguage);
    }

    return invoiceLine;
}

export async function translateOrderLine(orderLine: OrderLine, targetLanguage: string): Promise<OrderLine> {
    if (orderLine.note) {
        orderLine.note = await translateStringArray(orderLine.note, targetLanguage);
    }

    if (orderLine.lineItem) {
        if (orderLine.lineItem.note) {
            orderLine.lineItem.note = await translateStringArray(orderLine.lineItem.note, targetLanguage);
        }

        if (orderLine.lineItem.item) {
            await translateItem(orderLine.lineItem.item, targetLanguage);
        }

        if (orderLine.lineItem.delivery) {
            for (const delivery of orderLine.lineItem.delivery) {
                await translateDelivery(delivery, targetLanguage);
            }
        }
    }

    return orderLine;
}
