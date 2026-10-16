import { GenerateResponseRequest, GenerateResponseResult, ApplicationResponse } from '../types/appResponse';
import pool from '../db/db';
import * as repo from '../repositories/appResponsesRepository';
import { AppError } from '../errors';

// change signature:
export async function generateAppResponse(req: GenerateResponseRequest, createdBy?: string): Promise<GenerateResponseResult> {
    if (!req.invoiceId || req.invoiceId <= 0) {
        throw new AppError('INVALID_INPUT', 'invoiceId is required and must be a positive number.');
    }
    if (!req.responseType) {
        throw new AppError('INVALID_INPUT', 'responseType is required.');
    }
    if (!req.remarks) {
        throw new AppError('INVALID_INPUT', 'remarks is required.');
    }

    const invoiceQuery = await pool.query(
        `SELECT 
            accountingSupplierPartyID, accountingCustomerPartyID
         FROM invoices 
         WHERE id = $1`,
        [req.invoiceId]
    );

    if (invoiceQuery.rows.length === 0) {
        throw new AppError('NOT_FOUND', 'Invoice not found.');
    }

    const {
        accountingsupplierpartyid: supplierId,
        accountingcustomerpartyid: customerId
    } = invoiceQuery.rows[0];

    const responsePayload: ApplicationResponse = {
        id: "",
        issueDate: new Date().toISOString().split('T')[0] as string,
        note: [req.remarks],
        senderParty: { partyIdentification: [{ id: customerId }] },
        receiverParty: { partyIdentification: [{ id: supplierId }] },
        documentResponse: [
            {
                response: {
                    responseCode: req.responseType,
                    description: [req.remarks]
                },
                documentReference: [{
                    id: req.invoiceId.toString(),
                }]
            }
        ]
    };

const dbResult: { id: string; status: string } = await repo.insertAppResponse(responsePayload, createdBy);

    return {
        responseId: dbResult.id,
        status: req.responseType,
        createdAt: new Date().toISOString()
    };
}

export async function getAppResponses(createdBy?: string): Promise<GenerateResponseResult[]> {
    const responses = await repo.getAllResponses(createdBy);
    return responses.map((r) => ({
        responseId: r.id,
        status: (r.documentResponse?.[0]?.response?.responseCode) ?? "generated",
        createdAt: r.issueDate,
    }));
}

export async function getAppResponseById(responseId: string): Promise<ApplicationResponse> {
    const id = parseInt(responseId);
    if (isNaN(id)) {
        throw new AppError('INVALID_INPUT', 'Invalid response ID format.');
    }

    const response = await repo.getResponseById(id);
    if (!response) {
        throw new AppError('NOT_FOUND', 'Application response not found.');
    }
    return response;
}

