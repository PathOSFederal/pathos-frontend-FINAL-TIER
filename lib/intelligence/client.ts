import type {
  CareerReadinessSnapshot,
  ResumeReadinessSnapshot,
} from '@pathos/ui';
import type {
  CareerReadinessRequestPayload,
  ResumeReadinessRequestPayload,
} from './mappers';

interface IntelligenceErrorPayload {
  error?: string;
  detail?: string | { message?: string | null } | null;
}

export interface IntelligenceClientResult<TSnapshot> {
  ok: boolean;
  unavailable: boolean;
  errorMessage: string | null;
  snapshot: TSnapshot | null;
}

function readJsonPayload(response: Response): Promise<unknown> {
  return response.text().then(function (text) {
    if (text.trim() === '') {
      return null;
    }
    return JSON.parse(text) as unknown;
  });
}

function extractErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (payload === null || payload === undefined) {
    return fallbackMessage;
  }
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload;
  }
  if (typeof payload !== 'object') {
    return fallbackMessage;
  }
  const typedPayload = payload as IntelligenceErrorPayload;
  if (
    typeof typedPayload.error === 'string' &&
    typedPayload.error.trim().length > 0
  ) {
    return typedPayload.error;
  }
  if (
    typeof typedPayload.detail === 'string' &&
    typedPayload.detail.trim().length > 0
  ) {
    return typedPayload.detail;
  }
  if (
    typedPayload.detail !== null &&
    typedPayload.detail !== undefined &&
    typeof typedPayload.detail === 'object' &&
    typeof typedPayload.detail.message === 'string' &&
    typedPayload.detail.message.trim().length > 0
  ) {
    return typedPayload.detail.message;
  }
  return fallbackMessage;
}

async function fetchIntelligenceSnapshot<TSnapshot>(
  route: string,
  request: CareerReadinessRequestPayload | ResumeReadinessRequestPayload,
  fallbackMessage: string
): Promise<IntelligenceClientResult<TSnapshot>> {
  try {
    const response = await fetch(route, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify(request),
    });
    const payload = await readJsonPayload(response);

    if (!response.ok) {
      return {
        ok: false,
        unavailable: response.status >= 500,
        errorMessage: extractErrorMessage(payload, fallbackMessage),
        snapshot: null,
      };
    }

    return {
      ok: true,
      unavailable: false,
      errorMessage: null,
      snapshot: payload as TSnapshot,
    };
  } catch (error) {
    return {
      ok: false,
      unavailable: true,
      errorMessage:
        error instanceof Error
          ? error.message
          : fallbackMessage,
      snapshot: null,
    };
  }
}

export function fetchCareerReadinessSnapshot(
  request: CareerReadinessRequestPayload
): Promise<IntelligenceClientResult<CareerReadinessSnapshot>> {
  return fetchIntelligenceSnapshot<CareerReadinessSnapshot>(
    '/api/intelligence/career-readiness',
    request,
    'The career readiness service is unavailable right now.'
  );
}

export function fetchResumeReadinessSnapshot(
  request: ResumeReadinessRequestPayload
): Promise<IntelligenceClientResult<ResumeReadinessSnapshot>> {
  return fetchIntelligenceSnapshot<ResumeReadinessSnapshot>(
    '/api/intelligence/resume-readiness',
    request,
    'The resume readiness service is unavailable right now.'
  );
}
