import { NextResponse } from "next/server";
import type { ZodError, ZodType } from "zod";

export type ValidationErrorBody = {
  error: "validation_error";
  message: string;
  issues: Array<{ path: string; message: string }>;
};

export function formatZodIssues(error: ZodError): ValidationErrorBody["issues"] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

export function validationErrorResponse(
  error: ZodError,
  status = 400
): NextResponse<ValidationErrorBody> {
  const issues = formatZodIssues(error);
  return NextResponse.json(
    {
      error: "validation_error",
      message: issues[0]?.message ?? "Invalid request.",
      issues,
    },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export function validationErrorJson(
  error: ZodError
): ValidationErrorBody {
  const issues = formatZodIssues(error);
  return {
    error: "validation_error",
    message: issues[0]?.message ?? "Invalid request.",
    issues,
  };
}

export async function parseJsonWithSchema<T>(
  request: Request,
  schema: ZodType<T>
): Promise<
  | { ok: true; data: T }
  | { ok: false; response: NextResponse<ValidationErrorBody> }
> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "validation_error",
          message: "Invalid JSON body",
          issues: [{ path: "(root)", message: "Invalid JSON body" }],
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

export function parseSearchParamsWithSchema<T>(
  searchParams: URLSearchParams,
  schema: ZodType<T>
):
  | { ok: true; data: T }
  | { ok: false; response: NextResponse<ValidationErrorBody> } {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}
