
CREATE TABLE public.login_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT,
  logged_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all login logs"
ON public.login_logs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can insert their own login logs"
ON public.login_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
