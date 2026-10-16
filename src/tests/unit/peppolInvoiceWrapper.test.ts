import { generatePeppolInvoice } from "../../peppol/invoiceWrapper";
import pool from "../../db/db";
import { AppError } from "../../errors";

jest.mock("../../db/db", () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const validOrder: any = {
  order: {
    id: "order-001",
    issueDate: "2026-03-15",
    documentCurrencyCode: "AUD",
    sellerSupplierParty: {
      party: {
        endpointID: "98765432109",
        endpointSchemeID: "0151",
        partyName: [{ name: "Zara" }],
        postalAddress: { 
          cityName: "Melbourne", 
          country: { identificationCode: "AU" } 
      }
      },
    },
    buyerCustomerParty: {
      party: {
        endpointID: "12345678910",
        endpointSchemeID: "0151",
        partyName: [{ name: "Uniqlo" }],
        postalAddress: { 
          cityName: "Sydney", 
          country: { identificationCode: "AU" } 
        }
      },
    },
    anticipatedMonetaryTotal: {
        payableAmount: "110.00",
        lineExtensionAmount: "100.00"
    },
    orderLine: [
      {
        lineItem: {
          id: "line-001",
          Item: { name: "Coat" },
          lineExtensionAmount: "100.00",
          quantity: "1",
          price: { priceAmount: "100.00" }
        },
      },
    ],
  },
};

describe("generatePeppolInvoice Wrapper", () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  function mockSuccess() {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ id: 4 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: "505" }] })
      .mockResolvedValueOnce({ rows: [{ id: 7 }] })
      .mockResolvedValueOnce({ rows: [{ id: 8 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
  }

  describe("peppol invoice wrapper testing", () => {
    test("successfully validates + saves to DB + returns XML output", async () => {
      mockSuccess("505");
      const result = await generatePeppolInvoice(validOrder);
      
      expect(result.id).toBe("505");
      expect(result.output).toContain("<cbc:ID>505</cbc:ID>");
      expect(result.output).toContain("AUD");
    });

    test("throws PEPPOL_VALIDATION_FAILED if endpointID is missing", async () => {
      mockSuccess("error-id");
      const invalidOrder = JSON.parse(JSON.stringify(validOrder));
      invalidOrder.order.sellerSupplierParty.party.endpointID = "";

      await expect(generatePeppolInvoice(invalidOrder))
        .rejects.toMatchObject({
          code: "PEPPOL_VALIDATION_FAILED"
        });
    });

    test("defaults to order.id if customerReference is missing", async () => {
      mockSuccess("fallback-id");
      const noRef = { ...validOrder, order: { ...validOrder.order, customerReference: "" }};
      
      const result = await generatePeppolInvoice(noRef);
      expect(result.output).toContain("<cbc:BuyerReference>order-001</cbc:BuyerReference>");
    });

    test("returns INVOICE_GENERATION_FAILED on database error", async () => {
      mockClient.query.mockRejectedValueOnce(new Error("Table not found"));
      await expect(generatePeppolInvoice(validOrder)) 
        .rejects.toMatchObject({
          code: "INVOICE_GENERATION_FAILED"
        });
        
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    test("enforces 3-letter currency code validation", async () => {
      mockSuccess("cur-test");
      const badCurr = { ...validOrder, order: { ...validOrder.order, documentCurrencyCode: "USDOLLARS" }};
      
      await expect(generatePeppolInvoice(badCurr))
        .rejects.toMatchObject({
          code: "PEPPOL_VALIDATION_FAILED"
        });
    });

    test("should default to AUD when documentCurrencyCode is missing", async () => {
      mockSuccess();
      const noCurr = JSON.parse(JSON.stringify(validOrder));
      delete noCurr.order.documentCurrencyCode;
  
      const result = await generatePeppolInvoice(noCurr);
      expect(result.invoiceData.documentCurrencyCode).toBe("AUD");
      expect(result.output).toContain("<cbc:DocumentCurrencyCode>AUD</cbc:DocumentCurrencyCode>");
    });
  
    test("should use order.id as buyerReference if customerReference is missing", async () => {
      mockSuccess();
      const noRef = JSON.parse(JSON.stringify(validOrder));
      noRef.order.id = "ORDER-123";
      delete noRef.order.customerReference;
  
      const result = await generatePeppolInvoice(noRef);
      expect(result.invoiceData.buyerReference).toBe("ORDER-123");
      expect(result.output).toContain("<cbc:BuyerReference>ORDER-123</cbc:BuyerReference>");
    });
  
    test("should prioritize customerReference over order.id for buyerReference", async () => {
      mockSuccess();
      const withRef = JSON.parse(JSON.stringify(validOrder));
      withRef.order.id = "ORDER-123";
      withRef.order.customerReference = "CUST-REF-999";
  
      const result = await generatePeppolInvoice(withRef);
      expect(result.invoiceData.buyerReference).toBe("CUST-REF-999");
      expect(result.output).toContain("<cbc:BuyerReference>CUST-REF-999</cbc:BuyerReference>");
    });
  });
});