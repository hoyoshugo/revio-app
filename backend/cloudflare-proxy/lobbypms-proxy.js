export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Verificar secret de autorización
    const authHeader = request.headers.get('X-Proxy-Secret');
    if (authHeader !== env.PROXY_SECRET) {
      return new Response(JSON.stringify({error: 'Unauthorized'}), {
        status: 401,
        headers: {'Content-Type': 'application/json'}
      });
    }

    // Construir URL destino en LobbyPMS
    const targetPath = url.pathname.replace(/^\/proxy/, '');
    const targetUrl = 'https://api.lobbypms.com' + targetPath + url.search;

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    const auth = request.headers.get('Authorization');
    if (auth) headers.set('Authorization', auth);

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });

    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
