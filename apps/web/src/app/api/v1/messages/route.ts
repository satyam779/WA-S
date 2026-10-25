import { apiRoute } from '@/lib/api';
import { publicMessage, sendMessage } from '@/lib/send';

export const POST = apiRoute(async (orgId, body) => publicMessage(await sendMessage(orgId, body as never)));
