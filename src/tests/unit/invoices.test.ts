import { generateInvoice, getInvoiceById, getInvoices } from '../../routes/invoices'
import { OrderRequest } from "../../types/invoice";
import pool from "../../db/db";

jest.mock("../../db/db", () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const minimalOrder: OrderRequest = {
  order: {
    id: "order-001",
    issueDate: "2026-03-15",
    buyerCustomerParty: {
      party: {
        partyName: [{ name: "Buyer Co" }],
      },
    },
    sellerSupplierParty: {
      party: {
        partyName: [{ name: "Seller Co" }],
      },
    },
    orderLine: [
      {
        lineItem: {
          id: "line-001",
          item: { name: "Widget" },
          lineExtensionAmount: "100.00",
        },
      },
    ],
  },
};

describe("generateInvoice", () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  function mockSuccessfulTransaction() {
    mockClient.query
      .mockResolvedValueOnce({})                      // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })   // insert supplier party
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })   // insert supplierParties
      .mockResolvedValueOnce({ rows: [{ id: 3 }] })   // insert customer party
      .mockResolvedValueOnce({ rows: [{ id: 4 }] })   // insert customerParties
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })   // insert monetaryTotals
      .mockResolvedValueOnce({ rows: [{ id: 6 }] })   // insert invoice
      .mockResolvedValueOnce({ rows: [{ id: 7 }] })   // insert item
      .mockResolvedValueOnce({ rows: [{ id: 8 }] })   // insert invoiceLine
      .mockResolvedValueOnce({})                       // UPDATE invoice
      .mockResolvedValueOnce({});                      // COMMIT
  }

  describe("success cases", () => {
    it("sets issueDate to today", async () => {
      mockSuccessfulTransaction();
      const result = await generateInvoice(minimalOrder);
      expect(result.issueDate).toBe(new Date().toISOString().split("T")[0]);
    });

    it("sets dueDate to 30 days from today", async () => {
      mockSuccessfulTransaction();
      const result = await generateInvoice(minimalOrder);
      const expected = new Date();
      expected.setDate(expected.getDate() + 30);
      expect(result.dueDate).toBe(expected.toISOString().split("T")[0]);
    });

    it("calculates lineExtensionAmount correctly with no tax", async () => {
      mockSuccessfulTransaction();
      const result = await generateInvoice(minimalOrder);
      expect(result.legalMonetaryTotal.lineExtensionAmount).toBe("100.00");
    });

    it("calculates payableAmount correctly with tax", async () => {
      mockSuccessfulTransaction();
      const orderWithTax: OrderRequest = {
        order: {
          ...minimalOrder.order,
          taxTotal: [{ taxAmount: "10.00" }],
          orderLine: [
            {
              lineItem: {
                id: "line-001",
                item: { name: "Widget" },
                lineExtensionAmount: "100.00",
              },
            },
          ],
        },
      };
      const result = await generateInvoice(orderWithTax);
      expect(result.legalMonetaryTotal.payableAmount).toBe("110.00");
    });

    it("uses anticipatedMonetaryTotal if provided", async () => {
      mockSuccessfulTransaction();
      const orderWithTotal: OrderRequest = {
        order: {
          ...minimalOrder.order,
          anticipatedMonetaryTotal: {
            payableAmount: "999.00",
            lineExtensionAmount: "900.00",
          },
        },
      };
      const result = await generateInvoice(orderWithTotal);
      expect(result.legalMonetaryTotal.payableAmount).toBe("999.00");
    });

    it("maps seller to accountingSupplierParty", async () => {
      mockSuccessfulTransaction();
      const result = await generateInvoice(minimalOrder);
      expect(result.accountingSupplierParty.party?.partyName?.[0]?.name).toBe("Seller Co");
    });

    it("maps buyer to accountingCustomerParty", async () => {
      mockSuccessfulTransaction();
      const result = await generateInvoice(minimalOrder);
      expect(result.accountingCustomerParty.party?.partyName?.[0]?.name).toBe("Buyer Co");
    });

    it("generates one invoice line per order line", async () => {
      mockSuccessfulTransaction();
      const result = await generateInvoice(minimalOrder);
      expect(result.invoiceLine).toHaveLength(1);
    });

    it("sets orderLineReference to original lineItem id", async () => {
      mockSuccessfulTransaction();
      const result = await generateInvoice(minimalOrder);
      expect(result.invoiceLine[0]?.orderLineReference?.[0]?.lineID).toBe("line-001");
    });

    it("maps optional order fields correctly", async () => {
      mockSuccessfulTransaction();
      const orderWithOptionals: OrderRequest = {
        order: {
          ...minimalOrder.order,
          note: ["test note"],
          documentCurrencyCode: "AUD",
          customerReference: "ref-123",
        },
      };
      const result = await generateInvoice(orderWithOptionals);
      expect(result.note).toEqual(["test note"]);
      expect(result.documentCurrencyCode).toBe("AUD");
      expect(result.buyerReference).toBe("ref-123");
    });

    it("calls COMMIT on success", async () => {
      mockSuccessfulTransaction();
      await generateInvoice(minimalOrder);
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });
  });

  describe("error cases", () => {
    it("returns INVALID_INPUT if order is missing", async () => {
      await expect(
        generateInvoice({ order: null } as any)
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });

    it("returns INVALID_INPUT if sellerSupplierParty is missing", async () => {
      await expect(
        generateInvoice({ order: { ...minimalOrder.order, sellerSupplierParty: undefined } } as any)
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });

    it("returns INVALID_INPUT if buyerCustomerParty is missing", async () => {
      await expect(
        generateInvoice({ order: { ...minimalOrder.order, buyerCustomerParty: undefined } } as any)
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });

    it("returns INVALID_INPUT if orderLine is empty", async () => {
      await expect(
        generateInvoice({ order: { ...minimalOrder.order, orderLine: [] } })
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });

    it("rolls back and throws INVOICE_GENERATION_FAILED on DB error", async () => {
      mockClient.query
        .mockResolvedValueOnce({})                      // BEGIN
        .mockRejectedValueOnce(new Error("DB failed")); // first insert

      await expect(
        generateInvoice(minimalOrder)
      ).rejects.toMatchObject({ code: "INVOICE_GENERATION_FAILED" });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });
});

describe("getInvoiceById", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("success cases", () => {
    it("returns invoice data for a valid id", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ invoice_data: { id: "1", issueDate: "2026-03-15" } }],
      });
      const result = await getInvoiceById(1);
      expect(result.id).toBe("1");
    });
  });

  describe("error cases", () => {
    it("returns NOT_FOUND if invoice does not exist", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await expect(getInvoiceById(999)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});

describe("getInvoices", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("success cases", () => {
    it("returns all invoices", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { invoice_data: { id: "1", issueDate: "2026-03-15" } },
          { invoice_data: { id: "2", issueDate: "2026-03-16" } },
        ],
      });
      const result = await getInvoices();
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no invoices exist", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const result = await getInvoices();
      expect(result).toEqual([]);
    });
  });
});