import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
});

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type JsonErrorCode = 'INVALID_INPUT' | 'INVALID_JSON' | 'BUILD_ERROR';

interface JsonError {
  error: JsonErrorCode;
  message: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
});
type XmlErrorCode = 'INVALID_INPUT' | 'INVALID_XML' | 'PARSE_ERROR';

interface XmlError {
  error: XmlErrorCode;
  message: string;
}

export function jsonToXml(json: unknown): string {
  if (json === null || json === undefined) {
    throw { error: 'INVALID_INPUT', message: 'No input provided.' } satisfies JsonError;
  }

  if (typeof json !== 'object' || Array.isArray(json)) {
    throw { error: 'INVALID_INPUT', message: 'Input must be a plain object.' } satisfies JsonError;
  }

  if (Object.keys(json).length === 0) {
    throw { error: 'INVALID_INPUT', message: 'Input object cannot be empty.' } satisfies JsonError;
  }

  try {
    return builder.build(json as { [key: string]: JsonValue });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to build XML from given JSON.';
    throw { error: 'BUILD_ERROR', message } satisfies JsonError;
  }
}

export function xmlToJson(xml: string): Record<string, unknown> {

  // no XML is provided
  if (typeof xml !== 'string' || xml.trim() === '') {
    throw { error: 'INVALID_INPUT', message: 'No input provided.' } satisfies XmlError;
  }

  // input validation
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    const message = (validation as any).err?.msg ?? 'XML Validator returned an error. Possibly malformed XML.';
    throw { error: 'INVALID_XML', message } satisfies XmlError;
  }

  // parsing
  try {
    return parser.parse(xml) as Record<string, unknown>;
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Unable to parse given XML.';
    throw { error: 'PARSE_ERROR', message } satisfies XmlError;
  }
}