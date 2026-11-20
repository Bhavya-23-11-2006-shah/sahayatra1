export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SahayYatra Accessible Transit API',
    version: '1.0.0',
    description:
      'Accessible government-bus booking, Smart Time Alternatives, Gemini voice assistant, Socket.IO tracking, SOS dispatch, and fallback SMS/IVR APIs.',
  },
  servers: [{url: '/'}],
  components: {
    securitySchemes: {
      BearerAuth: {type: 'http', scheme: 'bearer', bearerFormat: 'JWT'},
    },
  },
  paths: {
    '/api/health': {
      get: {summary: 'Health check', responses: {'200': {description: 'Healthy'}}},
    },
    '/api/auth/otp/request': {
      post: {summary: 'Request mock SMS OTP', responses: {'200': {description: 'OTP sent'}}},
    },
    '/api/auth/otp/verify': {
      post: {summary: 'Verify OTP and receive JWT tokens', responses: {'200': {description: 'JWT pair'}}},
    },
    '/api/auth/guest': {
      post: {summary: 'Create guest or companion booking session', responses: {'200': {description: 'Guest token'}}},
    },
    '/api/auth/refresh': {
      post: {summary: 'Refresh access JWT', responses: {'200': {description: 'New access token'}}},
    },
    '/api/profile': {
      get: {summary: 'Get decrypted accessibility profile', security: [{BearerAuth: []}], responses: {'200': {description: 'Profile'}}},
      patch: {summary: 'Update needs, language, and DPDP consent flags', security: [{BearerAuth: []}], responses: {'200': {description: 'Updated'}}},
      delete: {summary: 'Right to delete account & PII (DPDP Act)', security: [{BearerAuth: []}], responses: {'200': {description: 'Deleted'}}},
    },
    '/api/profile/export': {
      get: {summary: 'Right to export personal data (DPDP Act)', security: [{BearerAuth: []}], responses: {'200': {description: 'JSON export'}}},
    },
    '/api/profile/udid/verify': {
      post: {summary: 'Verify UDID card for 50% concession fare', security: [{BearerAuth: []}], responses: {'200': {description: 'Verification result'}}},
    },
    '/api/stops': {
      get: {summary: 'List stops with tactile/ramp accessibility metadata', responses: {'200': {description: 'Stops list'}}},
    },
    '/api/routes': {
      get: {summary: 'List transit corridors', responses: {'200': {description: 'Routes list'}}},
    },
    '/api/trips/search': {
      get: {
        summary: 'Search trips with Smart Time Alternatives & ranking score',
        parameters: [
          {name: 'from', in: 'query', schema: {type: 'string'}},
          {name: 'to', in: 'query', schema: {type: 'string'}},
          {name: 'time', in: 'query', schema: {type: 'string'}},
          {name: 'needs', in: 'query', schema: {type: 'string'}},
        ],
        responses: {'200': {description: 'Exact + earlier + later ranked trips'}},
      },
    },
    '/api/bookings': {
      post: {summary: 'Create transaction-safe booking with row lock & idempotency key', security: [{BearerAuth: []}], responses: {'201': {description: 'Created'}}},
    },
    '/api/bookings/{id}/cancel': {
      post: {summary: 'Cancel booking with refund & waitlist promotion', security: [{BearerAuth: []}], responses: {'200': {description: 'Cancelled'}}},
    },
    '/api/bookings/{id}/undo': {
      post: {summary: 'Undo booking within 30s window', security: [{BearerAuth: []}], responses: {'200': {description: 'Undone'}}},
    },
    '/api/bookings/{id}/check-in': {
      post: {summary: 'Passenger at-stop check-in', security: [{BearerAuth: []}], responses: {'200': {description: 'Checked in'}}},
    },
    '/api/conductor/manifest/{tripId}': {
      get: {summary: 'Consent-aware PwD passenger manifest for conductor', security: [{BearerAuth: []}], responses: {'200': {description: 'Manifest'}}},
    },
    '/api/sos': {
      post: {summary: 'Trigger SOS emergency dispatch', security: [{BearerAuth: []}], responses: {'201': {description: 'SOS active'}}},
    },
    '/api/voice/intent': {
      post: {summary: 'Gemini-powered voice intent & slot-filling endpoint', responses: {'200': {description: 'Validated voice JSON'}}},
    },
    '/api/voice/stream': {
      post: {summary: 'SSE streamed voice intent response', responses: {'200': {description: 'text/event-stream'}}},
    },
    '/api/voice/tts-text': {
      post: {summary: 'Convert text to clean SSML speech string', responses: {'200': {description: 'SSML payload'}}},
    },
    '/api/channels/sms': {
      post: {summary: 'SMS command webhook ("BOOK <from> <to> <time>")', responses: {'200': {description: 'SMS reply'}}},
    },
    '/api/channels/ivr': {
      post: {summary: 'IVR DTMF + speech webhook', responses: {'200': {description: 'IVR prompt'}}},
    },
    '/api/admin/analytics': {
      get: {summary: 'Accessible transit analytics', responses: {'200': {description: 'Metrics'}}},
    },
  },
};
