export function withInviteCors(handler, origin) {
  return async (request) => {
    const requestedOrigin = request.headers.get('origin');
    if (requestedOrigin && requestedOrigin !== origin) {
      return Response.json({ outcome: 'forbidden_origin' }, { status: 403 });
    }
    if (request.method === 'OPTIONS') {
      if (!requestedOrigin || !origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
        'Vary': 'Origin',
      }});
    }
    const result = await handler(request);
    if (requestedOrigin && origin) {
      const headers = new Headers(result.headers);
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
      return new Response(result.body, { status: result.status, headers });
    }
    return result;
  };
}
