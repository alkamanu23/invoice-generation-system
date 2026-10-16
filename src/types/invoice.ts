/////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////// Order Document Type ////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////
//done
export interface OrderRequest {
  order: Order;
}

//done
export interface Order {
    id: string,
    salesOrderID?: string,
    UUID?: string,
    issueDate: string, //date that the order was issued
    issueTime?: string, 
    orderTypeCode?: string, //code signifying the type of order
    note?: string[], //ensure this is correct
    requestedInvoiceCurrencyCode?: string,
    documentCurrencyCode?: string,
    pricingCurrencyCode?: string,
    taxCurrencyCode?: string,
    customerReference?: string,
    validityPeriod?: Period[],
    orderDocumentReference?: DocumentReference[],
    originatorDocumentReference?: DocumentReference,
    additionalDocumentReference?: DocumentReference[],
    buyerCustomerParty: CustomerParty,
    sellerSupplierParty: SupplierParty,
    accountingCustomerParty?: CustomerParty,
    delivery?: Delivery[]
    deliveryTerms?: DeliveryTerms[],
    paymentMeans?: PaymentMeans,
    paymentTerms?: PaymentTerms[],
    allowanceCharge?: AllowanceCharge[],
    taxTotal?: TaxTotal[],
    anticipatedMonetaryTotal?: MonetaryTotal,
    orderLine: OrderLine[]
}

export interface Period {
    startDate?: string,
    startTime?: string,
    endDate?: string,
    endTime?: string,
    durationMeasure?: string,
    DescriptionCode?: string[],
    Description?: string[],
}

//Done 
export interface Contract {
    id?: string,
    issueDate?: string,
    issueTime?: string,
    contractTypeCode?: string
    contractType?: string,
    note?: string[],
    versionID?: string,
    description?: string[],
    validityPeriod?: Period,
    contractDocumentReference?: DocumentReference[],

}

//done
export interface DocumentReference {
    id: string,
    copyIndicator?: boolean,
    issueDate?: string,
    issueTime?: string,
    documentTypeCode?: string,
    documentType?: string,
    XPath?: string[],
    languageId?: string,
    localeCode?: string,
    versionID?: string,
    documentStatusCode?: string,
    documentDescription?: string[],
    attachment?: Attachment,
    validityPeriod?: Period,
    issuerParty?: Party,
}

//done
export interface Attachment {
    embeddedDocumentBinaryObject?: string,
    externalReference?: ExternalReference,
}

//done
export interface ExternalReference {
    URI?: string,
    documentHash?: string,
    hashAlgorithmMethod?: string,
    expiryDate?: string,
    mimeCode?: string,
    formatCode?: string,
    fileName?: string, 
    description?: string[]
}

//done
export interface Party {
    websiteURI?: string,
    endpointID?: string,
    endpointSchemeID?: string,
    industryClassificationCode?: string,
    partyIdentification?: PartyIdentification[],
    partyName?: PartyName[],
    language?: Language,
    postalAddress?: Address,
    contact?: Contact,
    PartyTaxScheme?: PartyTaxScheme[]
    PartyLegalEntity?: PartyLegalEntity[]
    Person?: Person[]
}

export interface Person {
    firstName?: string
    familyName?: string
    jobTitle?: string
    Contact?: Contact    
    organizationDepartment?: string
}
//done
export interface PartyTaxScheme {
    TaxScheme: TaxScheme
    companyID?: string
    registrationName?: string  
}

//done
export interface PartyLegalEntity {
    registrationName?: string
    companyID?: string
    RegistrationAddress?: Address
    companyLegalForm?: string
    companyLegalFormCode?: string
}

//done
export interface PartyIdentification {
    id: string,
}

//done
export interface PartyName {
    name: string
}

//done
export interface Language {
    id?: string,
    name?: string,
    localeCode?: string
}

//done
export interface Address {
    postbox?: string,
    floor?: string,
    room?: string,
    streetName?: string,
    additionalStreetName?: string,
    blockName?: string,
    buildingName?: string,
    buildingNumber?: string,
    department?: string,
    cityName?: string,
    postalZone?: string,
    countrySubentity?: string,
    countrySubentityCode?: string 
    region?: string,
    district?: string,
    addressLine?: AddressLine[],
    country?: Country,
}

//done
export interface AddressLine {
    line: string
}

//done
export interface Country {
    identificationCode?: string,
    name?: string
}

//done
export interface CustomerParty {
    supplierAssignedAccountID?: string,
    party?: Party,
    deliveryContact?: Contact, 
    accountingContact?: Contact,
    buyerContact?: Contact,
}

//done
export interface Contact {
    id?: string,
    name?: string,
    telephone?: string,
    telefax?: string,
    electronicMail?: string, 
    note?: string[]
}

//done
export interface SupplierParty {
    customerAssignedAccountID?: string,
    dataSendingCapability?: string,
    party?: Party,
    DespatchContact?: Contact,
    accountingContact?: Contact,
    sellerContact?: Contact
}

//done
export interface Delivery {
    id?: string,
    quantity?: number,
    minimumQuantity?: number,
    maximumQuantity?: number,
    actualDeliveryDate?: string,
    actualDeliveryTime?: string,
    latestDeliveryDate?: string,
    latestDeliveryTime?: string,
    releaseID?: string,
    trackingID?: string,
    deliveryAddress?: Address,
    requestedDeliveryPeriod?: Period,
    promisedDeliveryPeriod?: Period,
    estimatedDeliveryPeriod?: Period,
    carrierParty?: Party,
    deliveryParty?: Party,
    notifyParty?: Party[],
    deliveryTerms?: DeliveryTerms,
}

//done
export interface DeliveryTerms {
    id?: string,
    specialTerms?: string[],
    lossRiskResponsibilityCode?: string,
    lossRisk?: string[],
    amount?: string,
}

//done
export interface PaymentMeans {
    id?: string,
    paymentMeansCode: string,
    paymentDueDate?: string,
    instructionNote?: string[],
    paymentID?: string[],
    payerFinancialAccount?: FinancialAccount,
    payeeFinancialAccount?: FinancialAccount,
}

//done
export interface FinancialAccount {
    id?: string,
    name?: string,
    accountTypeCode?: string,
    currenctCode?: string,
    paymentNote?: string[],
    financialInstitutionBranch?: Branch,
    country?: Country
}

//done
export interface Branch {
    id?: string, 
    name?: string,
}

//done
export interface PaymentTerms {
    id?: string,
    note?: string[],
    settlementDiscountPercent?: string[],
    PenaltySurchargePercent?: string,
    SettlementDiscountAmount?: string,
    PaymentDueDate?: string,
    SettlementPeriod?: Period,   
}

//done
export interface AllowanceCharge {
    chargeIndicator: boolean,
    allowanceChargeReasonCode?: string,
    allowanceChargeReason?: string[],
    amount: string,
    taxCategory: TaxCategory[]
}

//done
export interface TaxCategory {
    id?: string,
    percent?: string,
    taxExemptionReasonCode?: string,
    taxExemptionReason?: string[],
    taxScheme: TaxScheme,
}

//done
export interface TaxScheme {
    id?: string,
    name?: string,
    taxTypeCode?: string,
}

//done
export interface TaxTotal {
    taxAmount: string,
    taxIncludedIndicator?: boolean,
    taxSubtotal?: TaxSubtotal[] 
}

//done
export interface TaxSubtotal {
    taxableAmount?: string,
    taxAmount: string,
    percent?: string,
    taxCategory: TaxCategory,
}

//done
export interface MonetaryTotal {
    payableAmount: string
    lineExtensionAmount?: string
    taxExclusiveAmount?: string
    taxInclusiveAmount?: string
    allowanceTotalAmount?: string
    chargeTotalAmount?: string             
    prepaidAmount?: string
    payableRoundingAmount?: string
}

//done
export interface OrderLine {
    lineItem: LineItem,
    note?: string[],  
}

//done
export interface LineItem {
    id: string 
    note?: string[]      
    delivery?: Delivery[]        
    item: Item            
    quantity?: number
    lineExtensionAmount?: string
    price?: Price                    
    taxTotal?: TaxTotal[]
    allowanceCharge?: AllowanceCharge[]
}

//done
export interface Item {
    name?: string
    description?: string[]
    sellersItemIdentification?: ItemIdentification
    buyersItemIdentification?: ItemIdentification
    standardItemIdentification?: ItemIdentification
    classifiedTaxCategory?: TaxCategory[]
}

//done
export interface ItemIdentification {
    id: string
    extendedID?: string
    barcodeSymbologyID?: string   
}

//done
export interface Price {
    priceAmount: string
    baseQuantity?: string
    baseQuantityUnitCode?: string
    allowanceCharge?: AllowanceCharge[]
    priceTypeCode?: string
    priceType?: string
}
/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////// Invoice Type ////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

export interface Invoice {
    id: string,                                             //done
    UUID?: string,                                          //done
    issueDate: string,                                      //done
    issueTime?: string,                                     //done
    dueDate?: string,                                       //done
    invoiceTypeCode?: string,                               //done
    note?: string[],                                        //done
    taxPointDate?: string,                                  //done
    documentCurrencyCode?: string,                          //done
    taxCurrencyCode?: string,                               //done
    pricingCurrencyCode?: string,                           //done
    paymentCurrencyCode?: string,                           //done
    accountingCostCode?: string,                            //done 
    accountingCost?: string,                                //done
    buyerReference?: string,                                //done
    invoicePeriod?: Period[],                               //done
    orderReference?: DocumentReference,                     //done                    
    billingReference?: DocumentReference[],                 //done   
    despatchDocumentReference?: DocumentReference[],        //done 
    receiptDocumentReference?: DocumentReference[],         //done
    originatorDocumentReference?: DocumentReference[],      //done
    contractDocumentReference?: DocumentReference[],        //done
    additionalDocumentReference?: DocumentReference[],      //done
    accountingSupplierParty: SupplierParty,                 //done
    accountingCustomerParty: CustomerParty,                 //done
    payeeParty?: Party,                                     //done
    buyerCustomerParty?: CustomerParty,                     //done
    sellerSupplierParty?: SupplierParty,                    //done
    delivery?: Delivery[],                                  //done
    deliveryTerms?: DeliveryTerms,                          //done
    paymentMeans?: PaymentMeans[],                          //done
    paymentTerms?: PaymentTerms[],                          //done
    allowanceCharge?: AllowanceCharge[],                    //done
    taxExchangeRate?: ExchangeRate,                         //done
    pricingExchangeRate?: ExchangeRate,                     //done
    paymentExchangeRate?: ExchangeRate,                     //done
    taxTotal?: TaxTotal[],                                  //done
    legalMonetaryTotal: MonetaryTotal,                      //done
    invoiceLine: InvoiceLine[]
}

export interface ExchangeRate {
    sourceCurrencyCode: string,
    targetCurrencyCode: string,
    calculationRate?: number,
    date?: string,
}

export interface InvoiceLine {
    id: string,
    UUID?: string,
    note?: string[],
    invoicedQuantity?: number,
    lineExtensionAmount: string,
    taxPointDate?: string,
    accountingCostCode?: string,
    accountingCost?: string,
    freeOfChargeIndicator?: boolean,
    invoicePeriod?: Period[],
    orderLineReference?: OrderLineReference[],
    documentReference?: DocumentReference[],
    allowanceCharge?: AllowanceCharge[],
    taxTotal?: TaxTotal[],
    item: Item,
    price?: Price,
    deliveryTerms?: DeliveryTerms,
}

export interface OrderLineReference {
    lineID: string,
    salesOrderLineID?: string,
}