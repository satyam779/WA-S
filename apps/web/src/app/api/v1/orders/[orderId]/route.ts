import { prisma } from '@wa/db';
import { apiRoute } from '@/lib/api';
import { ApiError } from '@/lib/errors';

/** GET /api/v1/orders/{order_id}: whether the buyer confirmed or cancelled a cash-on-delivery order. */
export const GET = apiRoute(async (orgId, _body, { orderId = '' }) => {
  const id = decodeURIComponent(orderId);
  const order = await prisma.order.findFirst({
    where: { orgId, OR: [{ externalId: id }, { number: id }] },
    orderBy: { createdAt: 'desc' },
  });
  if (!order) throw new ApiError(404, 'not_found', 'Order not found');
  return {
    order_id: order.externalId,
    number: order.number,
    cod: order.cod,
    cod_status: order.codStatus?.toLowerCase() ?? null,
    created_at: order.createdAt,
  };
});
