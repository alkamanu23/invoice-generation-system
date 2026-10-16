import { Invoice, InvoiceLine, OrderRequest, Order, OrderLine, TaxTotal } from "../types/invoice";
import pool from "../db/db";
import { AppError } from "../errors";


export async function generateInvoice(orderRequest: OrderRequest, createdBy?: string): Promise<Invoice> {
    const order = orderRequest.order;

    if (!order) {
        throw new AppError('INVALID_INPUT', 'order is required.');
    }
    if (!order.sellerSupplierParty) {
        throw new AppError('INVALID_INPUT', 'sellerSupplierParty is required.');
    }
    if (!order.buyerCustomerParty) {
        throw new AppError('INVALID_INPUT', 'buyerCustomerParty is required.');
    }
    if (!order.orderLine || order.orderLine.length === 0) {
        throw new AppError('INVALID_INPUT', 'orderLine is required and must not be empty.');
    }

    // Current date in correct format
    const issueDate = new Date().toISOString().split("T")[0] ?? '';
    // assumed industry standard 30 days
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const paymentDueDate = dueDate.toISOString().split("T")[0] ?? '';

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // insert supplier party into parties to get id 
        const supplierPartyResult = await client.query(
            `INSERT INTO parties (party_data) VALUES ($1) RETURNING id`,
            [JSON.stringify(order.sellerSupplierParty.party ?? {})]
        );
        //now insert into supplierParties
        const supplierResult = await client.query(
            `INSERT INTO supplierParties (partyID, supplier_party_data) VALUES ($1, $2) RETURNING id`,
            [supplierPartyResult.rows[0].id, JSON.stringify(order.sellerSupplierParty)]
        );
        const supplierPartyID = supplierResult.rows[0].id;

        //insert customerparty int parties to get id for customerParty in schema
        const customerPartyResult = await client.query(
            `INSERT INTO parties (party_data) VALUES ($1) RETURNING id`,
            [JSON.stringify(order.buyerCustomerParty.party ?? {})]
        );
        const customerResult = await client.query(
            `INSERT INTO customerParties (partyID, customer_party_data) VALUES ($1, $2) RETURNING id`,
            [customerPartyResult.rows[0].id, JSON.stringify(order.buyerCustomerParty)]
        )
        const customerPartyID = customerResult.rows[0].id;

        // building invoice lines
        let lineExtensionTotal = 0;
        for (const orderLine of order.orderLine) {
            lineExtensionTotal += parseFloat(orderLine.lineItem.lineExtensionAmount ?? "0");
        }

        // //fall back if order doc doesnt have a tax total section    
        // let calculatedTaxAmount = 0;
        // for (const orderLine of order.orderLine) {
        //     for(const taxTotalCurr of orderLine.lineItem.taxTotal ?? []) {
        //         calculatedTaxAmount += parseFloat(taxTotalCurr.taxAmount);
        //     }
        // }

        // //fall back to 2pd
        // const taxTotal: TaxTotal[] = order.taxTotal ?? (calculatedTaxAmount > 0
        //     ? [{ taxAmount: calculatedTaxAmount.toFixed(2) }]
        //     : []
        // );

        let totalTaxAmount = 0;
        for (const tt of order.taxTotal ?? []) {
            totalTaxAmount += parseFloat(tt.taxAmount);
        }

        const taxInclusiveAmount = lineExtensionTotal + totalTaxAmount;

        const legalMonetaryTotal = order.anticipatedMonetaryTotal ?? {
            payableAmount: taxInclusiveAmount.toFixed(2),
            lineExtensionAmount: lineExtensionTotal.toFixed(2),
            taxExclusiveAmount: lineExtensionTotal.toFixed(2),
            taxInclusiveAmount: taxInclusiveAmount.toFixed(2),
        };

        const monetaryResult = await client.query(
            `INSERT INTO monetaryTotals (payableAmount, monetary_total_data) VALUES ($1, $2) RETURNING id`,
            [parseFloat(legalMonetaryTotal.payableAmount), JSON.stringify(legalMonetaryTotal)]
        );
        const monetaryTotalID = monetaryResult.rows[0].id;

        // Insert invoice (w/o lines first) 
        const invoiceResult = await client.query(
            `INSERT INTO invoices (
        invoiceID, issueDate, accountingSupplierPartyID,
        accountingCustomerPartyID, legalMonetaryTotalID, created_by, invoice_data
     ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
                order.id,
                issueDate,
                supplierPartyID,
                customerPartyID,
                monetaryTotalID,
                createdBy ?? null,
                JSON.stringify({}),
            ]
        );
        const invoiceID = invoiceResult.rows[0].id;

        const invoiceLines: InvoiceLine[] = [];

        for (const orderLine of order.orderLine) {
            const lineItem = orderLine.lineItem;
            const lineExtensionAmount = lineItem.lineExtensionAmount ?? "0";

            // Insert item
            const itemResult = await client.query(
                `INSERT INTO items (item_data) VALUES ($1) RETURNING id`,
                [JSON.stringify(lineItem.item)]
            );
            const itemID = itemResult.rows[0].id;

            // Insert invoice line
            const lineResult = await client.query(
                `INSERT INTO invoiceLines (invoiceID, invoiceLineID, lineExtensionAmount, itemID, invoice_line_data)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [
                    invoiceID,
                    lineItem.id,
                    parseFloat(lineExtensionAmount),
                    itemID,
                    JSON.stringify(lineItem),
                ]
            );

            // Build invoice line using DB id
            const invoiceLine: InvoiceLine = {
                id: lineResult.rows[0].id.toString(),
                lineExtensionAmount,
                item: lineItem.item,
                orderLineReference: [{ lineID: lineItem.id }],
            };

            if (orderLine.note) invoiceLine.note = orderLine.note;
            if (lineItem.quantity) invoiceLine.invoicedQuantity = lineItem.quantity;
            if (lineItem.price) invoiceLine.price = lineItem.price;
            if (lineItem.taxTotal?.length) invoiceLine.taxTotal = lineItem.taxTotal;
            if (lineItem.allowanceCharge?.length) invoiceLine.allowanceCharge = lineItem.allowanceCharge;

            invoiceLines.push(invoiceLine);
        }

        const invoice: Invoice = {
            id: invoiceID.toString(),
            issueDate,
            accountingSupplierParty: order.sellerSupplierParty,
            accountingCustomerParty: order.buyerCustomerParty,
            legalMonetaryTotal,
            invoiceLine: invoiceLines,
        };

        if (order.UUID) invoice.UUID = order.UUID;
        if (order.orderTypeCode) invoice.invoiceTypeCode = order.orderTypeCode;
        if (order.note) invoice.note = order.note;
        if (order.documentCurrencyCode) invoice.documentCurrencyCode = order.documentCurrencyCode;
        if (order.taxCurrencyCode) invoice.taxCurrencyCode = order.taxCurrencyCode;
        if (order.pricingCurrencyCode) invoice.pricingCurrencyCode = order.pricingCurrencyCode;
        if (order.requestedInvoiceCurrencyCode) invoice.paymentCurrencyCode = order.requestedInvoiceCurrencyCode;
        if (order.customerReference) invoice.buyerReference = order.customerReference;
        if (order.buyerCustomerParty) invoice.buyerCustomerParty = order.buyerCustomerParty;
        if (order.sellerSupplierParty) invoice.sellerSupplierParty = order.sellerSupplierParty;
        if (order.delivery?.length) invoice.delivery = order.delivery;
        if (order.deliveryTerms?.length) {
            const terms = order.deliveryTerms[0];
            if (terms) invoice.deliveryTerms = terms;
        }
        if (order.paymentMeans) invoice.paymentMeans = [order.paymentMeans];
        if (order.paymentTerms?.length) invoice.paymentTerms = order.paymentTerms;
        if (order.allowanceCharge?.length) invoice.allowanceCharge = order.allowanceCharge;
        if (order.taxTotal?.length) invoice.taxTotal = order.taxTotal;
        if (order.validityPeriod?.length) invoice.invoicePeriod = order.validityPeriod;
        if (order.additionalDocumentReference?.length) invoice.additionalDocumentReference = order.additionalDocumentReference;
        if (order.originatorDocumentReference) invoice.originatorDocumentReference = [order.originatorDocumentReference];
        if (order.orderDocumentReference?.length) {
            const ref = order.orderDocumentReference[0];
            if (ref) invoice.orderReference = ref;
        }
        if (paymentDueDate) invoice.dueDate = paymentDueDate;

        await client.query(
            `UPDATE invoices SET invoice_data = $1 WHERE id = $2`,
            [JSON.stringify(invoice), invoiceID]
        );

        await client.query("COMMIT");
        return invoice;

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        throw new AppError('INVOICE_GENERATION_FAILED', err instanceof Error ? err.message : 'Failed to generate invoice.');
    } finally {
        client.release();
    }
}


export async function getInvoiceById(invoiceId: number): Promise<Invoice> {
    const result = await pool.query(
        `SELECT invoice_data FROM invoices WHERE id = $1`,
        [invoiceId]
    );

    if (result.rows.length === 0) {
        throw new AppError("NOT_FOUND", `Invoice with id ${invoiceId} not found`);
    }

    return result.rows[0].invoice_data;
}

export async function getInvoices(createdBy?: string): Promise<Invoice[]> {
    const result = await pool.query(
        `SELECT invoice_data FROM invoices WHERE created_by = $1`,
        [createdBy]
    );
    return result.rows.map((row: { invoice_data: Invoice }) => row.invoice_data);
}

export async function deleteInvoice(invoiceId: number, createdBy?: string): Promise<void> {
    const check = await pool.query(
        `SELECT created_by FROM invoices WHERE id = $1`,
        [invoiceId]
    );

    if (check.rows.length === 0) {
        throw new AppError('NOT_FOUND', `Invoice with id ${invoiceId} not found`);
    }

    if (check.rows[0].created_by !== createdBy) {
        throw new AppError('FORBIDDEN', 'You do not have permission to delete this invoice');
    }

    await pool.query(`DELETE FROM invoices WHERE id = $1`, [invoiceId]);
}