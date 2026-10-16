import pool from '../db/db';
import { AppError } from '../errors';

export interface InvoiceSearchQuery {
  query?: string;
}

export async function searchInvoices(filters: InvoiceSearchQuery, createdBy?: string) {
  const values: string[] = [];

  let query = `
    SELECT invoice_data
    FROM invoices
    WHERE 1=1
  `;

  if (createdBy) {
    values.push(createdBy);
    query += ` AND created_by = $${values.length}`;
  }

  if (filters.query !== undefined) {
    const trimmed = filters.query.trim();

    if (trimmed === '') {
      throw new AppError('INVALID_INPUT', 'query cannot be empty.');
    }

    if (trimmed.length > 100) {
      throw new AppError('INVALID_INPUT', 'query is too long.');
    }

    values.push(`%${trimmed}%`);
    const searchParam = `$${values.length}`;

    query += `
      AND (
        invoiceID::text ILIKE ${searchParam}
        OR accountingSupplierPartyID::text ILIKE ${searchParam}
        OR accountingCustomerPartyID::text ILIKE ${searchParam}
        OR issueDate::text ILIKE ${searchParam}
        OR invoice_data::text ILIKE ${searchParam}
      )
    `;
  }

  query += ` ORDER BY issueDate DESC, id DESC`;

  const result = await pool.query(query, values);
  return result.rows.map((row) => row.invoice_data);
}