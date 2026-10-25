import { prisma } from '@wa/db';
import { apiRoute } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { publicMessage } from '@/lib/send';

export const GET = apiRoute(async (orgId, _body, { id }) => {
  const message = await prisma.message.findFirst({ where: { id, orgId } });
  if (!message) throw new ApiError(404, 'not_found', 'Message not found');
  return publicMessage(message);
});
