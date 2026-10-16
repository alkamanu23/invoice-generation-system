import {
  createAdjustmentNote,
  findAdjustments,
  findAdjustmentById
} from "../../routes/adjustmentNote";
import pool from "../../db/db";
import {
  GenerateAdjustmentRequest,
  LineItem,
  CreditNote,
  DebitNote
} from "../../types/adjustment";

jest.mock("../../db/db", () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    query: jest.fn()
  }
}));

const template: GenerateAdjustmentRequest = {
  invoiceIdReference: 100,
  adjustmentType: "credit",
  amount: 505.00,
  reason: "returned items",
  lines: [{
    id: "1",
    quantity: 2,
    lineExtensionAmount: 100,
    price: { priceAmount: "50.00" },   // string now
    item: {
      name: "Glove",
      classifiedTaxCategory: [{ id: "S", percent: "10", taxScheme: { id: "VAT" } }]
    }
  }]
};

// Convenience — noUncheckedIndexedAccess makes lines[0] possibly undefined
const firstLine = template.lines[0]!;

function mockSuccessfulTransaction(mockClient: any) {
  mockClient.query
    .mockResolvedValueOnce({})                        // BEGIN
    .mockResolvedValueOnce({                          // SELECT invoice
      rows: [{
        accountingsupplierpartyid: 12,
        accountingcustomerpartyid: 13,
        invoice_data: {
          accountingSupplierParty: { party: {} },
          accountingCustomerParty: { party: {} }
        }
      }]
    })
    .mockResolvedValueOnce({ rows: [{ id: 56 }] })   // INSERT monetaryTotals
    .mockResolvedValueOnce({ rows: [{ id: 58 }] })   // INSERT credit_note/debit_note
    .mockResolvedValueOnce({ rows: [{ id: 60 }] })   // INSERT items
    .mockResolvedValueOnce({})                        // INSERT creditNoteLine/debitNoteLine
    .mockResolvedValueOnce({})                        // UPDATE note with final data
    .mockResolvedValueOnce({});                       // COMMIT
}

describe("createAdjustmentNote", () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  describe("success cases", () => {
    test("creates a credit note successfully", async () => {
      mockSuccessfulTransaction(mockClient);
      const result = await createAdjustmentNote(template) as CreditNote;
      expect(result.id).toBe("58");
      expect(result.creditNoteLine).toBeDefined();
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    test("creates a debit note successfully", async () => {
      mockSuccessfulTransaction(mockClient);
      const result = await createAdjustmentNote({
        ...template,
        adjustmentType: "debit"
      }) as DebitNote;
      expect(result.id).toBe("58");
      expect(result.debitNoteLine).toBeDefined();
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    test("returned note includes correct billing reference and reason", async () => {
      mockSuccessfulTransaction(mockClient);
      const result = await createAdjustmentNote(template);
      expect(result.note).toEqual(["returned items"]);
      expect(result.billingReference).toEqual([{ id: "100" }]);
    });

    test("returned credit line maps quantity to creditedQuantity", async () => {
      mockSuccessfulTransaction(mockClient);
      const result = await createAdjustmentNote(template) as CreditNote;
      expect(result.creditNoteLine[0]).toMatchObject({
        id: "1",
        creditedQuantity: 2,
        lineExtensionAmount: 100,
      });
    });

    test("returned debit line maps quantity to debitedQuantity", async () => {
      mockSuccessfulTransaction(mockClient);
      const result = await createAdjustmentNote({
        ...template,
        adjustmentType: "debit"
      }) as DebitNote;
      expect(result.debitNoteLine[0]).toMatchObject({
        id: "1",
        debitedQuantity: 2,
        lineExtensionAmount: 100,
      });
    });
  });

  describe("error cases", () => {
    test("returns INVALID_INPUT for invalid adjustmentType", async () => {
      await expect(
        createAdjustmentNote({ ...template, adjustmentType: "refund" as any })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Adjustment type must be 'credit' or 'debit'." });
    });

    test("returns INVALID_INPUT for negative invoiceIdReference", async () => {
      await expect(
        createAdjustmentNote({ ...template, invoiceIdReference: -1 })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Invalid invoice ID." });
    });

    test("returns INVALID_INPUT for missing invoiceIdReference", async () => {
      await expect(
        createAdjustmentNote({ ...template, invoiceIdReference: 0 })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Invalid invoice ID." });
    });

    test("returns INVALID_INPUT when reason is too long", async () => {
      await expect(
        createAdjustmentNote({ ...template, reason: "r".repeat(256) })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Adjustment reason is missing or too long." });
    });

    test("returns INVALID_INPUT when reason is empty string", async () => {
      await expect(
        createAdjustmentNote({ ...template, reason: "" })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Adjustment reason is missing or too long." });
    });

    test("returns INVALID_INPUT when lines is empty", async () => {
      await expect(
        createAdjustmentNote({ ...template, lines: [] })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "At least one adjustment item is required." });
    });

    test("returns INVALID_INPUT when line quantity is zero", async () => {
      await expect(
        createAdjustmentNote({
          ...template,
          lines: [{ ...firstLine, quantity: 0 }]
        })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Item quantity must be > 0." });
    });

    test("returns INVALID_INPUT when line price is negative", async () => {
      await expect(
        createAdjustmentNote({
          ...template,
          lines: [{ ...firstLine, price: { priceAmount: "-200" } }]  // string
        })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Item price cannot be missing or negative." });
    });

    test("returns INVALID_INPUT when line price is zero", async () => {
      await expect(
        createAdjustmentNote({
          ...template,
          lines: [{ ...firstLine, price: { priceAmount: "0" } }]  // string
        })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Item price cannot be missing or negative." });
    });

    test("returns INVALID_INPUT when item name is too long", async () => {
      await expect(
        createAdjustmentNote({
          ...template,
          lines: [{ ...firstLine, item: { ...firstLine.item, name: "n".repeat(101) } }]
        })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Item name too long." });
    });

    test("returns INVALID_INPUT when tax percent exceeds 100", async () => {
      await expect(
        createAdjustmentNote({
          ...template,
          lines: [{
            ...firstLine,
            item: {
              ...firstLine.item,
              classifiedTaxCategory: [{ id: "S", percent: "101", taxScheme: { id: "VAT" } }]
            }
          }]
        })
      ).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Tax percent cannot exceed 100." });
    });

    test("does not throw for tax percent exactly at 100", async () => {
      mockSuccessfulTransaction(mockClient);
      const result = await createAdjustmentNote({
        ...template,
        lines: [{
          ...firstLine,
          item: {
            ...firstLine.item,
            classifiedTaxCategory: [{ id: "S", percent: "100", taxScheme: { id: "VAT" } }]
          }
        }]
      }) as CreditNote;
      expect(result.id).toBe("58");
    });

    test("returns NOT_FOUND when invoice does not exist", async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        createAdjustmentNote(template)
      ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Invoice not found." });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    test("rolls back and throws DB_ERROR on transaction failure", async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [{
            accountingsupplierpartyid: 12,
            accountingcustomerpartyid: 13,
            invoice_data: {
              accountingSupplierParty: { party: {} },
              accountingCustomerParty: { party: {} }
            }
          }]
        })
        .mockRejectedValueOnce(new Error("DB failed"));

      await expect(
        createAdjustmentNote(template)
      ).rejects.toMatchObject({ code: "DB_ERROR" });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    test("releases client after success", async () => {
      mockSuccessfulTransaction(mockClient);
      await createAdjustmentNote(template);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    test("releases client after failure", async () => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error("fail"));

      await expect(createAdjustmentNote(template)).rejects.toBeDefined();
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
});

describe("findAdjustments", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("success cases", () => {
    test("returns all adjustment notes from both tables", async () => {
      const rows = [
        { id: 1, issuedate: new Date(), type: "credit" },
        { id: 2, issuedate: new Date(), type: "debit" }
      ];
      (pool.query as jest.Mock).mockResolvedValue({ rows });
      const result = await findAdjustments();
      expect(result).toStrictEqual(rows);
    });

    test("returns empty array when no notes exist", async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await findAdjustments();
      expect(result).toEqual([]);
    });
  });
});

describe("findAdjustmentById", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("success cases", () => {
    test("returns credit note data by ID", async () => {
      const noteData = {
        id: "1",
        issueDate: "2026-03-16",
        note: ["returned items"],
        creditNoteLine: [{ id: "line-001", lineExtensionAmount: 100, item: { name: "Glove" } }]
      };
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ data: noteData }] });
      const result = await findAdjustmentById(1, "credit");
      expect(result).toEqual(noteData);
    });

    test("returns debit note data by ID", async () => {
      const noteData = {
        id: "2",
        issueDate: "2026-03-16",
        note: ["wrong order"],
        debitNoteLine: [{ id: "line-001", lineExtensionAmount: 100, item: { name: "Glove" } }]
      };
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ data: noteData }] });
      const result = await findAdjustmentById(2, "debit");
      expect(result).toEqual(noteData);
    });

    test("queries the correct table for credit type", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ data: {} }] });
      await findAdjustmentById(1, "credit");
      expect((pool.query as jest.Mock).mock.calls[0]![0]).toContain("credit_note");
    });

    test("queries the correct table for debit type", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ data: {} }] });
      await findAdjustmentById(2, "debit");
      expect((pool.query as jest.Mock).mock.calls[0]![0]).toContain("debit_note");
    });
  });

  describe("error cases", () => {
    test("returns NOT_FOUND when note does not exist", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await expect(
        findAdjustmentById(999, "credit")
      ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Adjustment note not found." });
    });
  });
});