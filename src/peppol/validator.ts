// "Schema of rules" to detect invalid input
export interface Validator {
  path: string;
  validate: (value: any) => boolean;
  errorMessage: string;
}

//Validates Peppol mandated fields
export const rules: Validator[] = [
  { path: "id", 
    validate: (value) => typeof value === 'string' && value.trim().length > 0,
    errorMessage: "Invoice ID must be a non-empty string." },

    //Invoice validation (done after converting order fields into invoice)
  { path: "accountingSupplierParty.party.endpointID", 
    validate: (value) => typeof value === "string" && value.trim().length > 0,
    errorMessage: "Supplier EndpointID is mandatory." },
  { path: "accountingSupplierParty.party.endpointSchemeID", 
    validate: (value) => !value || /^\d{4}$/.test(value?.toString()),
    errorMessage: "Supplier EndpointSchemeID must be a valid 4-digit number." },
  { path: "accountingSupplierParty.party.postalAddress.cityName", 
    validate: (value) => typeof value === 'string' && value.trim().length > 0,
    errorMessage: "Supplier City is mandatory for Peppol." },
  { path: "accountingSupplierParty.party.postalAddress.country.identificationCode", 
    validate: (value) => /^[A-Z]{2}$/.test(value),
    errorMessage: "Supplier Country Code (e.g. AU) is mandatory." },
  { path: "accountingCustomerParty.party.endpointID", 
    validate: (value) => /^[A-Za-z0-9_-]{5,}$/.test(value?.toString()),
    errorMessage: "Customer EndpointID must be valid." },
  { path: "legalMonetaryTotal.payableAmount", 
    validate: (value) => !isNaN(Number(value)) && Number(value) >= 0,
    errorMessage: "Payable amount must be a positive number." },
  { path: "invoiceLine",
    validate: (value) => Array.isArray(value) && value.length > 0,
    errorMessage: "Must contain at least one line item." },
  { path: "documentCurrencyCode",
    validate: (value) => /^[A-Z]{3}$/.test(value),
    errorMessage: "Currency code must be a 3-letter ISO format (e.g., AUD)." },
  { path: "buyerReference", 
    validate: (value) => typeof value === 'string' && value.trim().length > 0,
    errorMessage: "Buyer Reference is mandatory for PEPPOL (mapped from Customer Reference or Order ID)." }
];

// Detects missing/incorrect input for Peppol conversion + returns appropriately
export function validateInput(rules: Validator[], input: any): string[] {
  const errors = [];

  for (const rule of rules) {
    const value = getValueAtPath(input, rule.path);
    let pass = false;
    if (rule.validate) {
      if (rule.validate(value)) {
        pass = true;
        continue;
      }
    } else {
      if (value !== undefined && value !== null) {
        pass = true;
        continue;
      }
    }

    if (!pass) {
      errors.push(rule.errorMessage);
    }
  }
  return errors;
}

function getValueAtPath(input: any, path: string) {
  return path.split('.').reduce((data, part) => data && data[part], input);
}