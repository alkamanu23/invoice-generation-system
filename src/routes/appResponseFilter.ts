import pool from '../db/db';
import { AppError } from '../errors';

export interface AppResponseFilterQuery {
  responseCode?: string;
  invoiceId?: string;
  senderId?: string;
  receiverId?: string;
  fromDate?: string;
  toDate?: string;
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function filterAppResponses(filters: AppResponseFilterQuery, createdBy?: string) {  
  const values: (string | number)[] = [];

  let query = `
    SELECT
      ar.application_response_data
    FROM application_responses ar
    LEFT JOIN document_responses dr
      ON ar.id = dr.application_response_id
    LEFT JOIN responses r
      ON dr.response_id = r.id
    LEFT JOIN document_references dref
      ON dr.document_reference_id = dref.id
    WHERE 1=1
  `;

  if (createdBy) {
    values.push(createdBy);
    query += ` AND ar.created_by = $${values.length}`;
  }

  if (filters.responseCode) {
    values.push(filters.responseCode);
    query += ` AND r.response_data->>'responseCode' = $${values.length}`;
  }

  if (filters.invoiceId) {
    values.push(filters.invoiceId);
    query += ` AND dref.document_reference_id = $${values.length}`;
  }

  if (filters.senderId) {
    const senderId = Number(filters.senderId);
    if (Number.isNaN(senderId) || senderId <= 0) {
      throw new AppError('INVALID_INPUT', 'senderId must be a positive number.');
    }
    values.push(senderId);
    query += ` AND ar.sender_party_id = $${values.length}`;
  }

  if (filters.receiverId) {
    const receiverId = Number(filters.receiverId);
    if (Number.isNaN(receiverId) || receiverId <= 0) {
      throw new AppError('INVALID_INPUT', 'receiverId must be a positive number.');
    }
    values.push(receiverId);
    query += ` AND ar.receiver_party_id = $${values.length}`;
  }

  if (filters.fromDate) {
    if (!isValidDateString(filters.fromDate)) {
      throw new AppError('INVALID_INPUT', 'fromDate must be in YYYY-MM-DD format.');
    }
    values.push(filters.fromDate);
    query += ` AND ar.issue_date >= $${values.length}`;
  }

  if (filters.toDate) {
    if (!isValidDateString(filters.toDate)) {
      throw new AppError('INVALID_INPUT', 'toDate must be in YYYY-MM-DD format.');
    }
    values.push(filters.toDate);
    query += ` AND ar.issue_date <= $${values.length}`;
  }

  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    throw new AppError('INVALID_INPUT', 'fromDate cannot be later than toDate.');
  }

  query += ` ORDER BY ar.issue_date DESC, ar.id DESC`;

  const result = await pool.query(query, values);
  return result.rows.map((row) => row.application_response_data);
}