type LogMeta = Record<string, unknown> | undefined;

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return {
    message: typeof error === 'string' ? error : 'Unknown error',
    raw: error,
  };
}

export function logApiError(context: string, error: unknown, meta?: LogMeta) {
  const payload = {
    level: 'error',
    context,
    time: new Date().toISOString(),
    ...normalizeError(error),
    ...(meta ?? {}),
  };

  console.error(JSON.stringify(payload));
}
