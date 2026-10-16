import pool from '../db/db';
import { AppError } from '../errors';

export interface AdjustmentNoteSearchQuery {
  query?: string;
}

export async function searchAdjustmentNotes(params: AdjustmentNoteSearchQuery, createdBy?: string) {
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

  if (params.query !== undefined) {
    const trimmedQuery = params.query.trim();

    if (trimmedQuery === '') {
      throw new AppError('INVALID_INPUT', 'query cannot be empty.');
    }

    if (trimmedQuery.length > 100) {
      throw new AppError('INVALID_INPUT', 'query is too long.');
    }

    values.push(`%${trimmedQuery}%`);
    query += `
      AND (
        CAST(id AS TEXT) ILIKE $${values.length}
        OR CAST(issueDate AS TEXT) ILIKE $${values.length}
        OR type ILIKE $${values.length}
      )
    `;
  }

  query += ` ORDER BY issueDate DESC, id DESC`;

  const result = await pool.query(query, values);
  return result.rows;
}