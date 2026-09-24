const REDACTED_VALUE = "[REDACTED]";

const REDACTED_FIELDS = new Set([
  "customer_email",
  "customer_name",
  "customer_phone",
  "receipt_email"
]);

const REDACTED_OBJECTS = new Set([
  "customer_address"
]);

const CUSTOMER_CONTEXTS = new Set([
  "billing_details",
  "customer_details",
  "shipping"
]);

const CUSTOMER_CONTEXT_FIELDS = new Set([
  "name",
  "email",
  "phone"
]);

export function redactStripeEvent(
  value: unknown
): unknown {
  return redactValue(value);
}

function redactValue(
  value: unknown,
  context?: string
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      (item) => redactValue(item, context)
    );
  }

  if (!isRecord(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    if (REDACTED_FIELDS.has(key)) {
      result[key] = REDACTED_VALUE;
      continue;
    }

    if (REDACTED_OBJECTS.has(key)) {
      result[key] = redactAllValues(child);
      continue;
    }

    if (
      context !== undefined &&
      CUSTOMER_CONTEXTS.has(context) &&
      CUSTOMER_CONTEXT_FIELDS.has(key)
    ) {
      result[key] = REDACTED_VALUE;
      continue;
    }

    if (
      context !== undefined &&
      CUSTOMER_CONTEXTS.has(context) &&
      key === "address"
    ) {
      result[key] = redactAllValues(child);
      continue;
    }

    result[key] = redactValue(
      child,
      key
    );
  }

  return result;
}

function redactAllValues(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value.map(redactAllValues);
  }

  if (isRecord(value)) {
    const result: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
      result[key] = redactAllValues(child);
    }

    return result;
  }

  return REDACTED_VALUE;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null;
}