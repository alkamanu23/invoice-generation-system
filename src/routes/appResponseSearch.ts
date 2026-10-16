import pool from '../db/db';
import { AppError } from '../errors';

export interface AppResponseSearchQuery {
  query?: string;
}

export async function searchAppResponses(params: AppResponseSearchQuery, createdBy?: string) {
  const values: string[] = [];

  let queryStr = `
    SELECT DISTINCT ON (ar.id)
      ar.id,
      ar.issue_date,
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
    queryStr += ` AND ar.created_by = $${values.length}`;
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
    queryStr += `
      AND (
        ar.application_response_data::text ILIKE $${values.length}
        OR r.response_data::text ILIKE $${values.length}
        OR dref.document_reference_id::text ILIKE $${values.length}
        OR ar.issue_date::text ILIKE $${values.length}
      )
    `;
  }

  queryStr += ` ORDER BY ar.id DESC`;

  const result = await pool.query(queryStr, values);
  return result.rows.map((row) => row.application_response_data);
}