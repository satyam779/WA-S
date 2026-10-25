import { apiRoute } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { publicMessage, sendMessage } from '@/lib/send';
import { apiCodConfirmation } from '@/lib/store';
import { LANGUAGE, USE_CASES, useCase, variablesFor } from '@/lib/use-cases';

/** POST /api/v1/notify/order_confirmed { phone, name, order_id, amount } — no template knowledge needed. */
export const POST = apiRoute(async (orgId, body, params) => {
  const u = useCase(params.useCase ?? '');
  if (!u) throw new ApiError(404, 'unknown_use_case', `Use one of: ${USE_CASES.map((x) => x.key).join(', ')}`);
  // COD questions are tracked as orders, so the buyer's Confirm/Cancel tap can be read back from GET /api/v1/orders/{order_id}.
  if (u.key === 'cod_confirmation') return publicMessage(await apiCodConfirmation(orgId, body));
  const message = await sendMessage(orgId, {
    to: body.phone,
    template: { name: u.template, language: LANGUAGE, variables: variablesFor(u, body) },
    idempotencyKey: body.idempotencyKey,
  });
  return publicMessage(message);
});
