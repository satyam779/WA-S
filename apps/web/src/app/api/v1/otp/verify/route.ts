import { apiRoute } from '@/lib/api';
import { verifyOtp } from '@/lib/otp';

export const POST = apiRoute((orgId, body) => verifyOtp(orgId, body));
