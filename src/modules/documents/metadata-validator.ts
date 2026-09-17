// DocuFlow AI - Document & Folder Metadata Validation Engine
import type { DocumentFieldDefinition, FieldType } from '../../types/index.ts';
import { ValidationError } from '../../lib/errors.ts';

export function validateFieldValue(
  field: DocumentFieldDefinition,
  value: unknown
): { isValid: boolean; error?: string; normalizedValue?: unknown } {
  // Required check
  if (value === undefined || value === null || value === '') {
    if (field.required) {
      return { isValid: false, error: `Field "${field.name}" is required` };
    }
    return { isValid: true, normalizedValue: null };
  }

  switch (field.type) {
    case 'TEXT': {
      if (typeof value !== 'string') {
        return { isValid: false, error: `Field "${field.name}" must be a string` };
      }
      return { isValid: true, normalizedValue: value.trim() };
    }

    case 'NUMBER': {
      const num = Number(value);
      if (isNaN(num)) {
        return { isValid: false, error: `Field "${field.name}" must be a valid number` };
      }
      return { isValid: true, normalizedValue: num };
    }

    case 'DATE': {
      const date = new Date(value as string);
      if (isNaN(date.getTime())) {
        return { isValid: false, error: `Field "${field.name}" must be a valid ISO date string` };
      }
      return { isValid: true, normalizedValue: date.toISOString() };
    }

    case 'BOOLEAN': {
      if (typeof value !== 'boolean') {
        if (value === 'true' || value === '1') return { isValid: true, normalizedValue: true };
        if (value === 'false' || value === '0') return { isValid: true, normalizedValue: false };
        return { isValid: false, error: `Field "${field.name}" must be a boolean` };
      }
      return { isValid: true, normalizedValue: value };
    }

    case 'SELECT': {
      if (typeof value !== 'string') {
        return { isValid: false, error: `Field "${field.name}" must be a selected string option` };
      }
      if (field.options && field.options.length > 0) {
        if (!field.options.includes(value)) {
          return {
            isValid: false,
            error: `Value "${value}" is not valid for "${field.name}". Allowed: ${field.options.join(', ')}`,
          };
        }
      }
      return { isValid: true, normalizedValue: value };
    }

    case 'MULTI_SELECT': {
      if (!Array.isArray(value)) {
        return { isValid: false, error: `Field "${field.name}" must be an array of selected options` };
      }
      if (field.options && field.options.length > 0) {
        for (const item of value) {
          if (!field.options.includes(item)) {
            return {
              isValid: false,
              error: `Option "${item}" is invalid for "${field.name}". Allowed: ${field.options.join(', ')}`,
            };
          }
        }
      }
      return { isValid: true, normalizedValue: value };
    }

    default:
      return { isValid: true, normalizedValue: value };
  }
}

export function validateMetadataRecord(
  definitions: DocumentFieldDefinition[],
  metadataInput: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Check required fields
  for (const def of definitions) {
    const val = metadataInput[def.key];
    const validation = validateFieldValue(def, val);
    if (!validation.isValid) {
      throw new ValidationError(validation.error || `Invalid value for metadata field "${def.name}"`);
    }
    if (validation.normalizedValue !== undefined && validation.normalizedValue !== null) {
      result[def.key] = validation.normalizedValue;
    }
  }

  // Also retain any extra user-defined metadata keys if passed
  for (const [key, value] of Object.entries(metadataInput)) {
    if (!definitions.some((d) => d.key === key)) {
      result[key] = value;
    }
  }

  return result;
}
