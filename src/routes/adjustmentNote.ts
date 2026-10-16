import pool from "../db/db";
import {
  GenerateAdjustmentRequest,
  CreditNote,
  DebitNote
} from "../types/adjustment";
import { AppError } from "../errors";
import { MonetaryTotal } from "../types/invoice";

function validateInput(data: GenerateAdjustmentRequest) {
  if (!['credit', 'debit'].includes(data.adjustmentType)) {
    throw new AppError('INVALID_INPUT', "Adjustment type must be 'credit' or 'debit'.");
  }
  if (!data.invoiceIdReference || data.invoiceIdReference <= 0) {
    throw new AppError('INVALID_INPUT', "Invalid invoice ID.");
  }
  if (!data.reason || data.reason.length > 255) {
    throw new AppError('INVALID_INPUT', "Adjustment reason is missing or too long.");
  }
  if (!data.lines || data.lines.length < 1) {
    throw new AppError('INVALID_INPUT', "At least one adjustment item is required.");
  }

  for (const line of data.lines) {
    if (!line.quantity || line.quantity <= 0) {
      throw new AppError('INVALID_INPUT', "Item quantity must be > 0.");
    }
    if (!line.price || !line.price.priceAmount || parseFloat(line.price.priceAmount) <= 0) {
      throw new AppError('INVALID_INPUT', "Item price cannot be missing or negative.");
    }
    if (!line.item) {
      throw new AppError('INVALID_INPUT', "Item is required.");
    }
    if (line.item.name && line.item.name.length > 100) {
      throw new AppError('INVALID_INPUT', "Item name too long.");
    }
    const taxCategory = line.item.classifiedTaxCategory?.[0];
    if (taxCategory && parseFloat(taxCategory.percent ?? '0') > 100) {
      throw new AppError('INVALID_INPUT', "Tax percent cannot exceed 100.");
    }
  }
}

export async function createAdjustmentNote(input: GenerateAdjustmentRequest, createdBy?: string): Promise<CreditNote | DebitNote> {
  validateInput(input);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT accountingSupplierPartyID, accountingCustomerPartyID, invoice_data
       FROM invoices WHERE id = $1`,
      [input.invoiceIdReference]
    );
    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', "Invoice not found.");
    }

    const accountingSupplierPartyId = result.rows[0].accountingsupplierpartyid;
    const accountingCustomerPartyId = result.rows[0].accountingcustomerpartyid;
    const invoiceData = result.rows[0].invoice_data;
    const monetaryTotal: MonetaryTotal = { payableAmount: input.amount.toString() };
    const monetaryResult = await client.query(
      `INSERT INTO monetaryTotals (payableAmount, monetary_total_data)
       VALUES ($1, $2)
       RETURNING id`,
      [input.amount, JSON.stringify(monetaryTotal)]
    );
    const monetaryTotalId = monetaryResult.rows[0].id;

    let tableName: string;
    let dataType: string;
    let lineType: string;
    let typeId: string;
    let lineData: string;

    if (input.adjustmentType === "credit") {
      tableName = "credit_note";
      dataType = "credit_note_data";
      lineType = "creditNoteLine";
      typeId = "creditNoteId";
      lineData = "credit_line_data";
    } else {
      tableName = "debit_note";
      dataType = "debit_note_data";
      lineType = "debitNoteLine";
      typeId = "debitNoteId";
      lineData = "debit_line_data";
    }

    const noteResult = await client.query(
      `INSERT INTO ${tableName}
   (issueDate, accountingSupplierPartyId, accountingCustomerPartyId, legalMonetaryTotalID, created_by, ${dataType})
   VALUES (NOW(), $1, $2, $3, $4, $5)
   RETURNING id`,
      [accountingSupplierPartyId, accountingCustomerPartyId, monetaryTotalId, createdBy ?? null, JSON.stringify({})]
    );
    const noteId = noteResult.rows[0].id;

    for (const line of input.lines) {
      const itemResult = await client.query(
        `INSERT INTO items (item_data)
         VALUES ($1)
         RETURNING id`,
        [JSON.stringify(line.item)]
      );

      if (input.adjustmentType === 'debit') {
        await client.query(
          `INSERT INTO ${lineType} (${typeId}, itemID, lineExtensionAmount, ${lineData})
           VALUES ($1, $2, $3, $4)`,
          [noteId, itemResult.rows[0].id, line.lineExtensionAmount ?? 0, JSON.stringify(line)]
        );
      } else {
        await client.query(
          `INSERT INTO ${lineType} (${typeId}, itemID, ${lineData})
           VALUES ($1, $2, $3)`,
          [noteId, itemResult.rows[0].id, JSON.stringify(line)]
        );
      }
    }

    const baseOutput = {
      id: noteId.toString(),
      issueDate: new Date().toISOString().split("T")[0] as string,
      note: [input.reason],
      billingReference: [{ id: input.invoiceIdReference.toString() }],
      accountingSupplierParty:
        invoiceData.accountingSupplierParty ?? invoiceData.sellerSupplierParty,
      accountingCustomerParty:
        invoiceData.accountingCustomerParty ?? invoiceData.buyerCustomerParty,
      legalMonetaryTotal: monetaryTotal,
      ...(invoiceData.taxTotal !== undefined ? { taxTotal: invoiceData.taxTotal } : {}),
    };

    let finalOutput: CreditNote | DebitNote;

    if (input.adjustmentType === "credit") {
      finalOutput = {
        ...baseOutput,
        creditNoteLine: input.lines.map((line) => ({
          id: line.id,
          lineExtensionAmount: line.lineExtensionAmount ?? 0,
          item: line.item,
          // Only include optional fields if they are defined — required by exactOptionalPropertyTypes
          ...(line.quantity !== undefined ? { creditedQuantity: line.quantity } : {}),
          ...(line.price !== undefined ? { price: line.price } : {}),
          ...(line.taxTotal !== undefined ? { taxTotal: line.taxTotal } : {}),
          ...(line.allowanceCharge !== undefined ? { allowanceCharge: line.allowanceCharge } : {}),
        })),
      };
    } else {
      finalOutput = {
        ...baseOutput,
        debitNoteLine: input.lines.map((line) => ({
          id: line.id,
          lineExtensionAmount: line.lineExtensionAmount ?? 0,
          item: line.item,
          ...(line.quantity !== undefined ? { debitedQuantity: line.quantity } : {}),
          ...(line.price !== undefined ? { price: line.price } : {}),
        })),
      };
    }

    await client.query(
      `UPDATE ${tableName} SET ${dataType} = $1 WHERE id = $2`,
      [JSON.stringify(finalOutput), noteId]
    );

    await client.query("COMMIT");
    return finalOutput;

  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof AppError) throw err;
    throw new AppError('DB_ERROR', err instanceof Error ? err.message : 'Failed to create adjustment note.');
  } finally {
    client.release();
  }
}

export async function findAdjustments(createdBy?: string) {
  const result = await pool.query(
    `SELECT id, issueDate, 'credit' as type FROM credit_note WHERE created_by = $1
     UNION ALL
     SELECT id, issueDate, 'debit' as type FROM debit_note WHERE created_by = $1
     ORDER BY issueDate DESC`,
    [createdBy]
  );
  return result.rows;
}

export async function findAdjustmentById(id: number, type: 'credit' | 'debit') {
  const tableMap = {
    credit: { note: 'credit_note', data: 'credit_note_data' },
    debit: { note: 'debit_note', data: 'debit_note_data' }
  };
  const { note, data } = tableMap[type];

  const result = await pool.query(
    `SELECT ${data} AS data
     FROM ${note}
     WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new AppError('NOT_FOUND', "Adjustment note not found.");
  }

  return result.rows[0].data;
}