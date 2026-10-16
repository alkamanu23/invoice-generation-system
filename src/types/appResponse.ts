import {
  Party,
  Attachment,
  DocumentReference
} from './invoice'

export interface GenerateResponseRequest {
  invoiceId: number;
  responseType: string;
  remarks: string;
}

export interface GenerateResponseResult {
  responseId: string;
  status: string;
  createdAt: string;
}

export interface ApplicationResponseRequest {
  applicationResponse: ApplicationResponse;
}

export interface ApplicationResponse {
  UBLVersionID?: string;
  customizationID?: string;
  profileID?: string;
  profileExecutionID?: string;
  id: string;
  UUID?: string;
  issueDate: string;
  issueTime?: string;
  responseDate?: string;
  responseTime?: string;
  note?: string[];
  versionID?: string;
  signature?: Signature[];
  senderParty: Party;
  receiverParty: Party;
  documentResponse?: DocumentResponse[];
}

export interface DocumentResponse {
  response: Response;
  documentReference: DocumentReference[];
  issuerParty?: Party;
  recipientParty?: Party;
  lineResponse?: LineResponse[];
}

export interface Response {
  referenceID?: string;
  responseCode?: string;
  description?: string[];
  effectiveDate?: string;
  effectiveTime?: string;
  status?: Status[];
}

export interface Signature {
  id: string;
  note?: string[];
  validationDate?: string;
  validationTime?: string;
  validatorID?: string;
  canonicalizationMethod?: string;
  signatureMethod?: string;
  signatoryParty?: Party;
  digitalSignatureAttachment?: Attachment;
  originalDocumentReference?: DocumentReference;
}

export interface LineResponse {
  lineReference: LineReference;
  response: Response[];
}

export interface Status {
  conditionCode?: string;
  referenceDate?: string;
  referenceTime?: string;
  description?: string[];
  statusReasonCode?: string;
  statusReason?: string[];
  sequenceID?: string;
  text?: string[];
  indicationIndicator?: boolean;
  percent?: number;
  reliabilityPercent?: number;
  condition?: Condition[];
}

export interface LineReference {
  lineID: string;
  UUID?: string;
  lineStatusCode?: string;
  documentReference?: DocumentReference;
}

export interface Condition {
  attributeID: string;
  measure?: number;
  description?: string[];
  minimumMeasure?: number;
  maximumMeasure?: number;
}