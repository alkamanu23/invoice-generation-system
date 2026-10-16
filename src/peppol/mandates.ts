// Peppol mandates
export const PEPPOL: Record<string, string> = {
  invoiceCustomisationId: "urn:cen.eu:en16931:2017",
  invoiceProfileId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
};

// Converts Party structure to be Peppol compliant
export function partyToPeppol(party: any): any {
  if (!party) throw new Error("Missing party data");

  return {
    endpointID: {
      "#text": party.endpointID,
      "@_schemeID": party.endpointSchemeID || "0088"  // global location number 
    },
    partyName: { name: party.partyName?.[0]?.name || party.partyName?.name || "Unknown"},
    postalAddress: {
      streetName: party.postalAddress?.streetName,
      buildingNumber: party.postalAddress?.buildingNumber,
      cityName: party.postalAddress?.cityName,
      postalZone: party.postalAddress?.postalZone,
      country: {
        identificationCode: party.postalAddress?.country?.identificationCode
      }
    }
  };
}