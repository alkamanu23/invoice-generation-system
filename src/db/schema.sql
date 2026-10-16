CREATE TABLE parties (
  id SERIAL PRIMARY KEY,
  party_data JSONB NOT NULL
);

CREATE TABLE customerParties (
  id SERIAL PRIMARY KEY,
  partyID INT REFERENCES parties(id),
  customer_party_data JSONB NOT NULL
);

CREATE TABLE supplierParties (
  id SERIAL PRIMARY KEY,
  partyID INT REFERENCES parties(id),
  supplier_party_data JSONB NOT NULL
);

CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  item_data JSONB NOT NULL
);

CREATE TABLE lineItems (
  id SERIAL PRIMARY KEY,
  lineItemID VARCHAR(100) NOT NULL,
  itemID INT REFERENCES items(id),
  line_item_data JSONB NOT NULL
);

CREATE TABLE orderLines (
  id SERIAL PRIMARY KEY,
  lineItemID INT REFERENCES lineItems(id),
  order_line_data JSONB NOT NULL
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  orderID VARCHAR(100) NOT NULL,
  issueDate DATE NOT NULL,
  buyerCustomerPartyID INT REFERENCES customerParties(id),
  sellerSupplierPartyID INT REFERENCES supplierParties(id),
  created TIMESTAMP DEFAULT now(),
  modified TIMESTAMP DEFAULT now(),
  order_data JSONB NOT NULL
);

CREATE TABLE orderOrderLines (
  orderID INT REFERENCES orders(id),
  orderLineID INT REFERENCES orderLines(id),
  PRIMARY KEY (orderID, orderLineID)
);

CREATE TABLE monetaryTotals (
  id SERIAL PRIMARY KEY,
  payableAmount NUMERIC(15,2) NOT NULL,
  monetary_total_data JSONB NOT NULL
);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  invoiceID VARCHAR(100) NOT NULL,
  issueDate DATE NOT NULL,
  accountingSupplierPartyID INT REFERENCES supplierParties(id),
  accountingCustomerPartyID INT REFERENCES customerParties(id),
  legalMonetaryTotalID INT REFERENCES monetaryTotals(id),
  created_by VARCHAR(255),
  created TIMESTAMP DEFAULT now(),
  modified TIMESTAMP DEFAULT now(),
  invoice_data JSONB NOT NULL
);

CREATE TABLE invoiceLines (
  id SERIAL PRIMARY KEY,
  invoiceID INT REFERENCES invoices(id),
  invoiceLineID VARCHAR(100) NOT NULL,
  lineExtensionAmount NUMERIC(15,2) NOT NULL,
  itemID INT REFERENCES items(id),
  invoice_line_data JSONB NOT NULL
);

CREATE TABLE credit_note (
  id SERIAL PRIMARY KEY,
  issueDate TIMESTAMP NOT NULL DEFAULT now(),
  accountingSupplierPartyId INT REFERENCES supplierParties(id) NOT NULL,
  accountingCustomerPartyId INT REFERENCES customerParties(id) NOT NULL,
  legalMonetaryTotalID INT REFERENCES monetaryTotals(id) NOT NULL,
  created_by VARCHAR(255),
  credit_note_data JSONB NOT NULL
);

CREATE TABLE creditNoteLine (
  id SERIAL PRIMARY KEY,
  creditNoteId INTEGER REFERENCES credit_note(id) ON DELETE CASCADE,
  itemID INT REFERENCES items(id),
  credit_line_data JSONB NOT NULL
);

CREATE TABLE debit_note (
  id SERIAL PRIMARY KEY,
  issueDate TIMESTAMP NOT NULL DEFAULT now(),
  accountingSupplierPartyId INT REFERENCES supplierParties(id) NOT NULL,
  accountingCustomerPartyId INT REFERENCES customerParties(id) NOT NULL,
  legalMonetaryTotalID INT REFERENCES monetaryTotals(id) NOT NULL,
  created_by VARCHAR(255),
  debit_note_data JSONB NOT NULL
);

CREATE TABLE debitNoteLine (
  id SERIAL PRIMARY KEY,
  debitNoteId INT REFERENCES debit_note(id) ON DELETE CASCADE,
  lineExtensionAmount DECIMAL(15,2) NOT NULL,
  itemID INT REFERENCES items(id),
  debit_line_data JSONB NOT NULL
);

CREATE TABLE responses (
  id SERIAL PRIMARY KEY,
  response_data JSONB
);

CREATE TABLE document_references (
  id SERIAL PRIMARY KEY,
  document_reference_id VARCHAR(100) NOT NULL,
  document_reference_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  modified_at TIMESTAMP DEFAULT now()
);

CREATE TABLE application_responses (
  id SERIAL PRIMARY KEY,
  issue_date DATE NOT NULL,
  sender_party_id INT REFERENCES parties(id),
  receiver_party_id INT REFERENCES parties(id),
  created_by VARCHAR(255),
  application_response_data JSONB,
  created_at TIMESTAMP DEFAULT now(),
  modified_at TIMESTAMP DEFAULT now()
);

CREATE TABLE document_responses (
  id SERIAL PRIMARY KEY,
  application_response_id INT REFERENCES application_responses(id),
  response_id INT REFERENCES responses(id),
  document_reference_id INT REFERENCES document_references(id),
  document_response_data JSONB
);

CREATE TABLE line_references (
  id SERIAL PRIMARY KEY,
  line_id VARCHAR(100) NOT NULL,
  line_reference_data JSONB
);

CREATE TABLE statuses (
  id SERIAL PRIMARY KEY,
  status_data JSONB
);

CREATE TABLE signatures (
  id SERIAL PRIMARY KEY,
  application_response_id INT REFERENCES application_responses(id),
  signature_data JSONB
);

CREATE TABLE line_responses (
  id SERIAL PRIMARY KEY,
  document_response_id INT REFERENCES document_responses(id),
  line_reference_id INT REFERENCES line_references(id),
  response_id INT REFERENCES responses(id),
  line_response_data JSONB
);

CREATE TABLE conditions (
  id SERIAL PRIMARY KEY,
  line_response_id INT REFERENCES line_responses(id),
  attribute_id VARCHAR(100) NOT NULL,
  condition_data JSONB
);