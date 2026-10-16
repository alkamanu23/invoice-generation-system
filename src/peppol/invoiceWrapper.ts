import { generateInvoice } from "../routes/invoices"; 
import { validateInput, Validator, rules } from "./validator";
import { invoiceToPeppol } from "./invoiceFormatter";
import { AppError } from "../errors";
import { Invoice, InvoiceLine, OrderRequest, Order, OrderLine, TaxTotal } from "../types/invoice";
import pool from "../db/db";

// Wrapper for generateInvoice with strict Peppol validation
export async function generatePeppolInvoice(orderRequest: OrderRequest) {
  try {
    const invoiceData = await generateInvoice(orderRequest);  
    const order = orderRequest.order;

    //maps peppol fields if missing
    invoiceData.orderReference = invoiceData.orderReference || { id: order.id };
    invoiceData.buyerReference = invoiceData.buyerReference || order.customerReference || order.id; 
    invoiceData.documentCurrencyCode = invoiceData.documentCurrencyCode || order.documentCurrencyCode || 'AUD';

    const errors = validateInput(rules, invoiceData);
    if (errors.length > 0) {
      throw new AppError('PEPPOL_VALIDATION_FAILED', errors.join('\n'));
    }

    const output = invoiceToPeppol(invoiceData);
    return { 
      id: invoiceData.id,
      invoiceData, 
      output 
    }; 
  } catch (error) {
    if (error instanceof AppError) throw error;
      throw new AppError('INVOICE_GENERATION_FAILED', (error as Error).message);
  }
}