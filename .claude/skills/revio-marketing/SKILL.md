---
name: revio-marketing
description: |
  Modulo Marketing IA de Revio. 0% completo. Agencia de marketing digital integrada.
  Meta API review: 2-4 semanas de espera (iniciar proceso antes de desarrollar).
  Activar cuando se trabaje en campanas Meta, Google Ads, contenido IA, analytics.
triggers:
  - marketing
  - Meta Ads
  - Google Ads
  - redes sociales
  - campana
  - contenido
  - analytics
  - estrategia marketing
  - ROI marketing
  - Instagram
  - Facebook Ads
status: sin-iniciar
priority: P2
---

# Revio Marketing IA

## Estado: 0% completo

## Funcionalidades

### 1. Meta Marketing API (Instagram + Facebook Ads)
```javascript
// Requiere: Meta Business app + review para marketing
// SDK: npm install facebook-nodejs-business-sdk
const { FacebookAdsApi, Campaign } = require('facebook-nodejs-business-sdk');

FacebookAdsApi.init(process.env.META_ACCESS_TOKEN);

// Crear campana automaticamente
const createCampaign = async (adAccountId, params) => {
  const campaign = new Campaign(null, adAccountId);
  return await campaign.create({
    name: params.name,
    objective: 'OUTCOME_LEADS', // Para hoteleria: conseguir leads de reservas
    status: 'PAUSED',
    special_ad_categories: [],
  });
};
```

### 2. Generacion de contenido con Anthropic
```javascript
// Integra con el mismo cliente Anthropic del Revenue Agent
const generateContent = async (property, contentType) => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    messages: [{
      role: 'user',
      content: `Crea un post para Instagram sobre ${property.name}.
                Tipo: ${contentType}. Tono: calido y aventurero.
                Max 150 palabras. Incluir 5 hashtags relevantes.`
    }]
  });
  return response.content[0].text;
};
```

### 3. Analytics integrado con PMS
```javascript
// Medir ROI real: campana -> click -> reserva
// JOIN entre marketing_conversions y pms_reservations
const getCampaignROI = async (campaignId) => {
  const { data } = await supabase.rpc('calculate_campaign_roi', { campaign_id: campaignId });
  return data; // { spend, revenue, roi_pct, reservas_generadas }
};
```

## Bloqueantes
1. Meta Marketing API: requiere revision de app (2-4 semanas)
   - Crear app en developers.facebook.com
   - Solicitar permisos: ads_management, ads_read
   - Enviar para revision
2. Google Ads API: requiere cuenta con credito minimo y aprobacion

## Tablas necesarias
```sql
CREATE TABLE marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid, platform text, -- meta, google, email, whatsapp
  external_id text, -- ID en la plataforma
  name text, status text,
  budget_daily numeric, spend_total numeric DEFAULT 0,
  impressions int DEFAULT 0, clicks int DEFAULT 0, conversions int DEFAULT 0,
  started_at date, ended_at date
);

CREATE TABLE marketing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid, type text, -- post, story, ad, email
  content text, media_urls jsonb,
  scheduled_at timestamptz, published_at timestamptz,
  platform text, status text
);
```

## Accion inmediata HOY
Ir a developers.facebook.com y crear la app de marketing
para que el review de 2-4 semanas corra mientras se desarrolla.
