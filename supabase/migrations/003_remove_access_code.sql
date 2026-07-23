-- Alleen nodig wanneer een eerdere versie van 001 al met toegangscode is uitgevoerd.
drop function if exists public.get_public_config();
drop function if exists public.register_player(text, text);
drop table if exists private.app_settings;
