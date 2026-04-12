import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import App from "./App.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import "./index.css";

function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;
  return session ? <App /> : <LoginPage />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
