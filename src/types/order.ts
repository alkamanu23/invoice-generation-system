import { AllowanceCharge, CustomerParty, Delivery, DeliveryTerms, DocumentReference, MonetaryTotal, OrderLine, PaymentMeans, PaymentTerms, Period, SupplierParty, TaxTotal } from "./invoice"

export interface Order {
    id: string,                                             //done
    salesOrderID?: string,                                  //done
    UUID?: string,                                          //done
    issueDate: string,                                      //done
    issueTime?: string,                                     //done
    orderTypeCode?: string,                                 //done
    note?: string[],                                        //done
    requestedInvoiceCurrencyCode?: string,                  //done
    documentCurrencyCode?: string,                          //done
    pricingCurrencyCode?: string,                           //done
    taxCurrencyCode?: string,                               //done
    customerReference?: string,                             //done
    validityPeriod?: Period[],                              //done
    orderDocumentReference?: DocumentReference[],           //done
    originatorDocumentReference?: DocumentReference,        //done
    additionalDocumentReference?: DocumentReference[],      //done
    buyerCustomerParty: CustomerParty,                      //done
    sellerSupplierParty: SupplierParty,                     //done
    accountingCustomerParty?: CustomerParty,                //done
    delivery?: Delivery[]                                   //done
    deliveryTerms?: DeliveryTerms[],                        //done
    paymentMeans?: PaymentMeans,                            //done
    paymentTerms?: PaymentTerms[],                          //done
    allowanceCharge?: AllowanceCharge[],                    //done
    taxTotal?: TaxTotal[],                                  //done
    anticipatedMonetaryTotal?: MonetaryTotal,               //done
    orderLine: OrderLine[]                                  //done
}