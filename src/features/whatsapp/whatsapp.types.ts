export interface IncomingMessage {
  messageId: string;
  from: string; // Phone number
  text: string;
  timestamp: Date;
}

export interface OutgoingMessage {
  to: string; // Phone number
  text: string;
}

export interface WebhookEntry {
  id: string;
  changes: Array<{
    field: string;
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      messages?: Array<{
        id: string;
        from: string;
        timestamp: string;
        type: string;
        text?: { body: string };
      }>;
    };
  }>;
}

export interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}
