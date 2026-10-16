import pool from '../db/db';
import { ApplicationResponse } from '../types/appResponse';
import { AppError } from '../errors';

function mapToAppResponse(row: Record<string, any>): ApplicationResponse {
  const fullData = row.application_response_data as ApplicationResponse;

  const response: ApplicationResponse = {
    ...fullData,
    id: row.id.toString(),
    issueDate: row.issue_date,
    senderParty: {
      ...fullData.senderParty,
      partyIdentification: [{ id: row.sender_party_id }]
    },
    receiverParty: {
      ...fullData.receiverParty,
      partyIdentification: [{ id: row.receiver_party_id }]
    }
  };

  return response;
}

export async function insertAppResponse(response: ApplicationResponse, createdBy?: string): Promise<{ id: string; status: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mainQuery = `
  INSERT INTO application_responses (
    issue_date, 
    sender_party_id, 
    receiver_party_id,
    created_by,
    application_response_data
  )
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id
`;

    const senderId = response.senderParty.partyIdentification?.[0]?.id;
    const receiverId = response.receiverParty.partyIdentification?.[0]?.id;

    const mainRes = await client.query(mainQuery, [
      response.issueDate,
      senderId,
      receiverId,
      createdBy ?? null,
      JSON.stringify(response)
    ]);
    const appResponseId = mainRes.rows[0].id;

    if (response.signature && response.signature.length > 0) {
      for (const sig of response.signature) {
        await client.query(
          `INSERT INTO signatures (application_response_id, signature_data) VALUES ($1, $2)`,
          [appResponseId, JSON.stringify(sig)]
        );
      }
    }

    if (response.documentResponse && response.documentResponse.length > 0) {
      for (const docResp of response.documentResponse) {

        const resTableRes = await client.query(
          `INSERT INTO responses (response_data) VALUES ($1) RETURNING id`,
          [JSON.stringify(docResp.response)]
        );
        const responseTableId = resTableRes.rows[0].id;

        let docRefId = null;
        if (docResp.documentReference?.[0]) {
          const dr = docResp.documentReference[0];
          const drRes = await client.query(
            `INSERT INTO document_references (document_reference_id, document_reference_data) VALUES ($1, $2) RETURNING id`,
            [dr.id, JSON.stringify(dr)]
          );
          docRefId = drRes.rows[0].id;
        }

        const docRespRes = await client.query(
          `INSERT INTO document_responses (
            application_response_id, 
            response_id, 
            document_reference_id, 
            document_response_data
          ) VALUES ($1, $2, $3, $4) RETURNING id`,
          [
            appResponseId,
            responseTableId,
            docRefId,
            JSON.stringify(docResp)
          ]
        );
        const docRespId = docRespRes.rows[0].id;

        if (docResp.lineResponse && docResp.lineResponse.length > 0) {
          for (const line of docResp.lineResponse) {
            const lineRefRes = await client.query(
              `INSERT INTO line_references (line_id, line_reference_data) VALUES ($1, $2) RETURNING id`,
              [line.lineReference.lineID, JSON.stringify(line.lineReference)]
            );
            const lineRefId = lineRefRes.rows[0].id;

            for (const lr of line.response) {
              const lrResId = (await client.query(
                `INSERT INTO responses (response_data) VALUES ($1) RETURNING id`,
                [JSON.stringify(lr)]
              )).rows[0].id;

              await client.query(
                `INSERT INTO line_responses (
                  document_response_id, 
                  line_reference_id, 
                  response_id, 
                  line_response_data
                ) VALUES ($1, $2, $3, $4)`,
                [docRespId, lineRefId, lrResId, JSON.stringify(line)]
              );
            }
          }
        }
      }
    }

    await client.query('COMMIT');
    return { id: appResponseId.toString(), status: 'SUCCESS' };

  } catch (e) {
    await client.query('ROLLBACK');
    if (e instanceof AppError) throw e;
    throw new AppError('DB_ERROR', e instanceof Error ? e.message : 'Database operation failed.');
  } finally {
    client.release();
  }
}

export async function getAllResponses(createdBy?: string): Promise<ApplicationResponse[]> {
  const query = `
    SELECT DISTINCT ON (ar.id)
      ar.id, 
      ar.issue_date, 
      ar.sender_party_id, 
      ar.receiver_party_id, 
      ar.application_response_data
    FROM application_responses ar
    WHERE ar.created_by = $1
    ORDER BY ar.id DESC
  `;
  const result = await pool.query(query, [createdBy]);
  return result.rows.map(row => mapToAppResponse(row));
}

export async function getResponseById(id: number): Promise<ApplicationResponse | null> {
  const query = `
    SELECT 
      ar.*, 
      r.response_data->>'responseCode' as response_code, 
      dr.document_reference_id as doc_ref_id
    FROM application_responses ar
    LEFT JOIN document_responses dresp ON ar.id = dresp.application_response_id
    LEFT JOIN responses r ON dresp.response_id = r.id
    LEFT JOIN document_references dr ON dresp.document_reference_id = dr.id
    WHERE ar.id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows.length ? mapToAppResponse(result.rows[0]) : null;
}