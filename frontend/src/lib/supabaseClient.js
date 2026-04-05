// Supabase client stub for frontend realtime.
// Install @supabase/supabase-js and add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// to frontend/.env to enable real-time notifications.

function createStub() {
  return {
    channel: () => ({
      on: function () { return this; },
      subscribe: function () { return this; },
      unsubscribe: () => {}
    }),
    from: () => ({
      select: () => ({ data: null, error: null }),
    })
  };
}

// Replaced at build time if the package and env vars are present.
// For now export a stub so all imports resolve without errors.
export const supabase = createStub();
