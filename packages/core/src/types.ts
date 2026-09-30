export interface WebhookEvent {
  id: string;
  provider: string;
  type: string;
  payload: unknown;
}

export interface WebhookObservation {
  status: number;
  body: unknown;
  state?: unknown;
}

export interface WebhookBaseline
  extends WebhookObservation {
  sequentialDuplicates?: WebhookObservation[];
}

export interface WebhookFixture {
  event: WebhookEvent;
  baseline: WebhookBaseline | null;
}