import { apiRoute } from '@/lib/api';
import { sendOtp } from '@/lib/otp';

export const POST = apiRoute((orgId, body) => sendOtp(orgId, body));
