/**
 * Google Business Profile — OAuth2 callback routes
 *
 * GET /api/google/auth/:propertyId  → redirect user to Google consent screen
 * GET /api/google/callback          → handle OAuth2 callback, save tokens
 */
import { Router } from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';
import { saveSetting } from '../services/connectionService.js';

const router = Router();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage';
const MY_BUSINESS_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';

function getRedirectUri() {
  const base = process.env.BASE_URL || 'https://revio-app-production.up.railway.app';
  return `${base}/api/google/callback`;
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

// ============================================================
// GET /api/google/auth/:propertyId — Generate OAuth2 URL
// ============================================================
router.get('/auth/:propertyId', requireAuth, (req, res) => {
  try {
    const { propertyId } = req.params;
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured on server' });
    }

    // Encode propertyId + userId in state for the callback
    const state = Buffer.from(JSON.stringify({
      propertyId,
      userId: req.user.id || req.user.sub,
    })).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      response_type: 'code',
      scope: GBP_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    res.json({ url: authUrl });
  } catch (err) {
    console.error('[GoogleAuth] Error generating auth URL:', err.message);
    res.status(500).json({ error: 'Failed to generate Google auth URL' });
  }
});

// ============================================================
// GET /api/google/callback — Handle OAuth2 callback
// ============================================================
router.get('/callback', async (req, res) => {
  const frontendUrl = getFrontendUrl();

  try {
    const { code, state, error: authError } = req.query;

    if (authError) {
      console.error('[GoogleAuth] Auth error from Google:', authError);
      return res.redirect(`${frontendUrl}/settings/connections?google=error&reason=${authError}`);
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/settings/connections?google=error&reason=missing_params`);
    }

    // Decode state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return res.redirect(`${frontendUrl}/settings/connections?google=error&reason=invalid_state`);
    }

    const { propertyId, userId } = stateData;
    if (!propertyId) {
      return res.redirect(`${frontendUrl}/settings/connections?google=error&reason=missing_property`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.redirect(`${frontendUrl}/settings/connections?google=error&reason=server_config`);
    }

    // 1. Exchange code for tokens
    const tokenResponse = await axios.post(GOOGLE_TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token } = tokenResponse.data;

    if (!refresh_token) {
      console.error('[GoogleAuth] No refresh_token received — user may have already authorized');
      return res.redirect(`${frontendUrl}/settings/connections?google=error&reason=no_refresh_token`);
    }

    // 2. List accounts to get account_id
    let accountId = null;
    try {
      const accountsRes = await axios.get(`${MY_BUSINESS_API}/accounts`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const accounts = Array.isArray(accountsRes.data.accounts) ? accountsRes.data.accounts : [];
      if (accounts.length > 0) {
        // Use first account — name is like "accounts/123456789"
        accountId = accounts[0].name?.replace('accounts/', '') || null;
      }
    } catch (err) {
      console.error('[GoogleAuth] Error listing accounts:', err.response?.data || err.message);
    }

    // 3. List locations to get location_id
    let locationId = null;
    if (accountId) {
      try {
        const locationsRes = await axios.get(
          `${MY_BUSINESS_API}/accounts/${accountId}/locations`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        const locations = Array.isArray(locationsRes.data.locations) ? locationsRes.data.locations : [];
        if (locations.length > 0) {
          // Use first location — name is like "locations/123456789"
          locationId = locations[0].name || null;
          // Build full resource name if needed
          if (locationId && !locationId.startsWith('accounts/')) {
            locationId = `accounts/${accountId}/${locationId}`;
          }
        }
      } catch (err) {
        console.error('[GoogleAuth] Error listing locations:', err.response?.data || err.message);
      }
    }

    // 4. Save config to settings table
    const googleConfig = {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token,
      account_id: accountId,
      location_id: locationId,
      connected_at: new Date().toISOString(),
    };

    await saveSetting(propertyId, 'google_config', googleConfig, userId || null);

    console.log(JSON.stringify({
      level: 'info',
      event: 'google_business_connected',
      propertyId,
      accountId,
      locationId,
    }));

    // Redirect to frontend with success
    const successParams = new URLSearchParams({
      google: 'success',
      account: accountId || '',
      location: locationId ? 'found' : 'missing',
    });
    res.redirect(`${frontendUrl}/settings/connections?${successParams.toString()}`);
  } catch (err) {
    console.error('[GoogleAuth] Callback error:', err.response?.data || err.message);
    res.redirect(`${frontendUrl}/settings/connections?google=error&reason=token_exchange_failed`);
  }
});

export default router;
