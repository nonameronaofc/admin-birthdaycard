import { NextResponse } from 'next/server';

type JsonBodyResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: NextResponse };

export async function readJsonBody<T = Record<string, unknown>>(
  req: Request,
  errorMessage = 'Request body tidak valid.'
): Promise<JsonBodyResult<T>> {
  try {
    return { ok: true, body: (await req.json()) as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: errorMessage }, { status: 400 }),
    };
  }
}
