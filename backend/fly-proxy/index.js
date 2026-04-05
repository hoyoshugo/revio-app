import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 8080;
const PROXY_SECRET = process.env.PROXY_SECRET || '';

// Auth middleware
app.use((req, res, next) => {
  if (req.headers['x-proxy-secret'] !== PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Proxy /proxy/* → LobbyPMS API
app.use('/proxy', createProxyMiddleware({
  target: 'https://api.lobbypms.com',
  changeOrigin: true,
  pathRewrite: { '^/proxy': '' },
  on: {
    proxyReq: (proxyReq, req) => {
      // Remove proxy secret header before forwarding
      proxyReq.removeHeader('x-proxy-secret');
    },
    error: (err, req, res) => {
      res.status(502).json({ error: 'Proxy error', message: err.message });
    }
  }
}));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`LobbyPMS proxy running on port ${PORT}`));
