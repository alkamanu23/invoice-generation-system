import pool from '../db/db';
import { AppError } from '../errors';

export interface AdjustmentNoteFilterQuery {
  type?: string;
  fromDate?: string;
  toDate?: string;
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function filterAdjustmentNotes(filters: AdjustmentNoteFilterQuery, createdBy?: string) {
  const values: string[] = [];

  let query = `
    SELECT *
    FROM (
      SELECT id, issueDate, 'credit' AS type, created_by
      FROM credit_note
      UNION ALL
      SELECT id, issueDate, 'debit' AS type, created_by
      FROM debit_note
    ) AS adjustment_notes
    WHERE 1=1
  `;

  if (createdBy) {
    values.push(createdBy);
    query += ` AND created_by = $${values.length}`;
  }

  if (filters.type) {
    if (!['credit', 'debit'].includes(filters.type)) {
      throw new AppError('INVALID_INPUT', "type must be 'credit' or 'debit'.");
    }
    values.push(filters.type);
    query += ` AND type = $${values.length}`;
  }

  if (filters.fromDate) {
    if (!isValidDateString(filters.fromDate)) {
      throw new AppError('INVALID_INPUT', 'fromDate must be in YYYY-MM-DD format.');
    }
    values.push(filters.fromDate);
    query += ` AND issueDate::date >= $${values.length}`;
  }

  if (filters.toDate) {
    if (!isValidDateString(filters.toDate)) {
      throw new AppError('INVALID_INPUT', 'toDate must be in YYYY-MM-DD format.');
    }
    values.push(filters.toDate);
    query += ` AND issueDate::date <= $${values.length}`;
  }

  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    throw new AppError('INVALID_INPUT', 'fromDate cannot be later than toDate.');
  }

  query += ` ORDER BY issueDate DESC, id DESC`;

  const result = await pool.query(query, values);
  return result.rows;
}