/**
 * Cloudflare Worker — Proxy para LobbyPMS API
 *
 * PROPÓSITO:
 *   Railway cambia su IP pública en cada redeploy, rompiendo el whitelist de LobbyPMS.
 *   Este Worker actúa como intermediario con IP fija de Cloudflare.
 *   Los IPs de Cloudflare Workers son estables y están documentados en:
 *   https://www.cloudflare.com/ips/
 *
 * DEPLOY:
 *   1. Ir a dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. Pegar este código
 *   3. Agregar variable de entorno: LOBBYPMS_SECRET (token secreto compartido con Revio)
 *   4. URL del worker: https://lobbypms-proxy.TU_SUBDOMINIO.workers.dev
 *   5. En Railway: LOBBYPMS_PROXY_URL=https://lobbypms-proxy.TU_SUBDOMINIO.workers.dev
 *   6. Dar las IPs de Cloudflare a LobbyPMS:
 *      - Rango IPv4: https://www.cloudflare.com/ips-v4
 *      - Rango IPv6: https://www.cloudflare.com/ips-v6
 *
 * SEGURIDAD:
 *   - El Worker valida el header X-Proxy-Secret contra LOBBYPMS_SECRET
 *   - Solo permite requests a api.lobbypms.com
 *   - No expone tokens de LobbyPMS — solo reenvía el Authorization header que manda Revio
 *
 * GRATIS hasta 100,000 requests/día en el plan Free de Cloudflare.
 */

export default {
  async fetch(request, env) {
    // Validar secret compartido
    const proxySecret = request.headers.get('X-Proxy-Secret');
    if (!proxySecret || proxySecret !== env.LOBBYPMS_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Solo permitir requests a LobbyPMS
    const url = new URL(request.url);
    const targetPath = url.pathname.replace('/proxy', ''); // /proxy/api/v2/... → /api/v2/...
    const targetUrl = `https://api.lobbypms.com${targetPath}${url.search}`;

    // Reenviar la request con todos los headers originales (excepto el secret)
    const headers = new Headers(request.headers);
    headers.delete('X-Proxy-Secret');
    headers.set('Host', 'api.lobbypms.com');

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      });

      // Copiar la respuesta tal cual
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
