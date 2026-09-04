export interface WebhookEvent {
  id: string;
  provider: string;
  type: string;
  payload: unknown;
}

export interface WebhookBaseline {
  status: number;
  body: unknown;
}

export interface WebhookFixture {
  event: WebhookEvent;
  baseline: WebhookBaseline;
}