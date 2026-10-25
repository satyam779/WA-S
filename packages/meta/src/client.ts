import { MetaApiError, type GraphErrorBody } from './errors';
import type { SendPayload } from './messages';

export interface GraphClientOptions {
  /** System-user token of our business portfolio; client WABAs are shared to us as a partner. */
  accessToken: string;
  version?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

type Query = Record<string, string | number | undefined>;

export interface WabaInfo {
  id: string;
  name: string;
  currency?: string;
  timezone_id?: string;
  account_review_status?: string;
}

export interface PhoneNumberInfo {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  platform_type?: string;
  status?: string;
  name_status?: string;
  messaging_limit_tier?: string;
}

export interface TemplateInfo {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: unknown[];
}

export interface SendResult {
  contacts?: { input: string; wa_id: string }[];
  messages: { id: string; message_status?: string }[];
}

type CanSend = 'AVAILABLE' | 'LIMITED' | 'BLOCKED';

/** Whether Meta lets a node send, covering the node and everything above it (WABA, business, app). */
export interface HealthStatus {
  can_send_message: CanSend;
  entities: {
    entity_type: string;
    id: string;
    can_send_message: CanSend;
    errors?: { error_code: number; error_description: string; possible_solution?: string }[];
  }[];
}

interface Page<T> {
  data: T[];
  paging?: { cursors?: { after?: string }; next?: string };
}

const PHONE_FIELDS =
  'id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,status,name_status,messaging_limit_tier';

export class GraphClient {
  private readonly base: string;

  constructor(private readonly options: GraphClientOptions) {
    this.base = `${options.baseUrl ?? 'https://graph.facebook.com'}/${options.version ?? 'v24.0'}`;
  }

  async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, query: Query = {}, body?: unknown): Promise<T> {
    const url = new URL(`${this.base}/${path}`);
    for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));

    const response = await (this.options.fetch ?? fetch)(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: GraphErrorBody };
    if (!response.ok || json.error) throw new MetaApiError(response.status, json.error);
    return json as T;
  }

  getWaba(wabaId: string) {
    return this.request<WabaInfo>('GET', wabaId, { fields: 'id,name,currency,timezone_id,account_review_status' });
  }

  getPhoneNumber(phoneNumberId: string) {
    return this.request<PhoneNumberInfo>('GET', phoneNumberId, { fields: PHONE_FIELDS });
  }

  /** Sending status of a phone number, WABA or template, with Meta's reasons when it's limited or blocked. */
  async getHealth(nodeId: string) {
    return (await this.request<{ health_status: HealthStatus }>('GET', nodeId, { fields: 'health_status' })).health_status;
  }

  async listPhoneNumbers(wabaId: string) {
    return (await this.request<Page<PhoneNumberInfo>>('GET', `${wabaId}/phone_numbers`, { fields: PHONE_FIELDS })).data;
  }

  /** Gives our system user access to a WABA the seller shared with our business as a partner. */
  assignSystemUser(wabaId: string, systemUserId: string, tasks: string[] = ['MANAGE']) {
    return this.request<{ success: boolean }>('POST', `${wabaId}/assigned_users`, {}, { user: systemUserId, tasks });
  }

  /** Routes the WABA's webhooks to our app. */
  subscribeApp(wabaId: string) {
    return this.request<{ success: boolean }>('POST', `${wabaId}/subscribed_apps`);
  }

  /** Registers the number on Cloud API; `pin` becomes (or must match) its two-step verification PIN. */
  registerPhone(phoneNumberId: string, pin: string) {
    return this.request<{ success: boolean }>('POST', `${phoneNumberId}/register`, {}, { messaging_product: 'whatsapp', pin });
  }

  async listTemplates(wabaId: string): Promise<TemplateInfo[]> {
    const templates: TemplateInfo[] = [];
    let after: string | undefined;
    do {
      const page = await this.request<Page<TemplateInfo>>('GET', `${wabaId}/message_templates`, {
        fields: 'id,name,language,status,category,components',
        limit: 100,
        after,
      });
      templates.push(...page.data);
      after = page.paging?.next ? page.paging.cursors?.after : undefined;
    } while (after);
    return templates;
  }

  createTemplate(wabaId: string, template: object) {
    return this.request<{ id: string; status: string; category: string }>('POST', `${wabaId}/message_templates`, {}, template);
  }

  send(phoneNumberId: string, payload: SendPayload) {
    return this.request<SendResult>('POST', `${phoneNumberId}/messages`, {}, payload);
  }
}
