/** The `error` object of a failed Graph API response. */
export interface GraphErrorBody {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  error_data?: { details?: string };
  fbtrace_id?: string;
}

// Temporary failures and rate limits; anything else (bad template, bad number, permissions) won't fix itself.
const RETRYABLE_CODES = new Set([1, 2, 4, 80007, 130429, 131000, 131016, 131056, 133004]);

export class MetaApiError extends Error {
  readonly code: number | undefined;
  readonly subcode: number | undefined;
  readonly fbtraceId: string | undefined;

  constructor(
    readonly httpStatus: number,
    body: GraphErrorBody = {},
  ) {
    super(body.error_user_msg ?? body.error_data?.details ?? body.message ?? `Graph API HTTP ${httpStatus}`);
    this.name = 'MetaApiError';
    this.code = body.code;
    this.subcode = body.error_subcode;
    this.fbtraceId = body.fbtrace_id;
  }

  get retryable(): boolean {
    return this.httpStatus >= 500 || (this.code !== undefined && RETRYABLE_CODES.has(this.code));
  }
}

/** Codes the dashboard explains to the seller instead of showing Meta's raw text. */
export const META_ERROR = {
  accessDenied: 200,
  noPermission: 10,
  invalidParameter: 100,
  pinMismatch: 133005,
  paymentMissing: 131042,
  reEngagementWindow: 131047,
  templateNotFound: 132001,
} as const;
