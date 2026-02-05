import type { ContentfulStatusCode } from 'hono/utils/http-status';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public type: string,
    public title: string,
    public detail?: string
  ) {
    super(title);
    this.name = 'ApiError';
  }

  toProblemDetails(instance?: string): ProblemDetails {
    return {
      type: `https://blockbot.dev/errors/${this.type}`,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance,
    };
  }
}
