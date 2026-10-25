import { GraphClient } from '@wa/meta';
import { decrypt } from './crypto';
import { env } from './env';

const client = (accessToken: string) =>
  new GraphClient({
    accessToken,
    version: env.metaGraphVersion,
    // Local testing against a mock Graph server
    baseUrl: process.env.META_GRAPH_BASE_URL || undefined,
  });

let system: GraphClient | undefined;

/** Our system-user token: used for accounts shared with us as a partner. */
export const graph = () => (system ??= client(env.metaSystemUserToken));

/** Accounts connected through Embedded Signup use their own business token. */
export const graphFor = (waba: { accessToken: string | null }) => (waba.accessToken ? client(decrypt(waba.accessToken)) : graph());

export const graphWithToken = client;
