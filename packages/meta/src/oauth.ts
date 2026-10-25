import { MetaApiError, type GraphErrorBody } from './errors';

/**
 * Exchanges the code from Embedded Signup's FB.login for the customer's business token.
 * The code expires about 30 seconds after the popup closes.
 */
export async function exchangeSignupCode(options: {
  appId: string;
  appSecret: string;
  code: string;
  version?: string;
  baseUrl?: string;
}): Promise<string> {
  const url = new URL(`${options.baseUrl ?? 'https://graph.facebook.com'}/${options.version ?? 'v24.0'}/oauth/access_token`);
  url.searchParams.set('client_id', options.appId);
  url.searchParams.set('client_secret', options.appSecret);
  url.searchParams.set('code', options.code);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const json = (await response.json().catch(() => ({}))) as { access_token?: string; error?: GraphErrorBody };
  if (!response.ok || !json.access_token) throw new MetaApiError(response.status, json.error);
  return json.access_token;
}
