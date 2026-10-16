import pool from '../db/db';
import { AppError } from '../errors';

export interface InvoiceFilterQuery {
  invoiceID?: string;
  supplierId?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function filterInvoices(filters: InvoiceFilterQuery, createdBy?: string) {  
  const values: (string | number)[] = [];

  let query = `
    SELECT invoice_data
    FROM invoices
    WHERE 1=1
  `;

  if (createdBy) {
    values.push(createdBy);
    query += ` AND created_by = $${values.length}`;
  }

  if (filters.invoiceID) {
    values.push(filters.invoiceID);
    query += ` AND invoiceID = $${values.length}`;
  }

  if (filters.supplierId) {
    const supplierId = Number(filters.supplierId);
    if (Number.isNaN(supplierId) || supplierId <= 0) {
      throw new AppError('INVALID_INPUT', 'supplierId must be a positive number.');
    }
    values.push(supplierId);
    query += ` AND accountingSupplierPartyID = $${values.length}`;
  }

  if (filters.customerId) {
    const customerId = Number(filters.customerId);
    if (Number.isNaN(customerId) || customerId <= 0) {
      throw new AppError('INVALID_INPUT', 'customerId must be a positive number.');
    }
    values.push(customerId);
    query += ` AND accountingCustomerPartyID = $${values.length}`;
  }

  if (filters.fromDate) {
    if (!isValidDateString(filters.fromDate)) {
      throw new AppError('INVALID_INPUT', 'fromDate must be in YYYY-MM-DD format.');
    }
    values.push(filters.fromDate);
    query += ` AND issueDate >= $${values.length}`;
  }

  if (filters.toDate) {
    if (!isValidDateString(filters.toDate)) {
      throw new AppError('INVALID_INPUT', 'toDate must be in YYYY-MM-DD format.');
    }
    values.push(filters.toDate);
    query += ` AND issueDate <= $${values.length}`;
  }

  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    throw new AppError('INVALID_INPUT', 'fromDate cannot be later than toDate.');
  }

  query += ` ORDER BY issueDate DESC, id DESC`;

  const result = await pool.query(query, values);
  return result.rows.map((row) => row.invoice_data);
}