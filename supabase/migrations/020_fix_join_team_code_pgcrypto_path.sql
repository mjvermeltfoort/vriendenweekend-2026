-- Make pgcrypto visible to join_team_by_code without relying on the caller's
-- search path. Supabase normally installs pgcrypto in `extensions`, while a
-- plain PostgreSQL installation may install it in `public`.

do $$
declare
  pgcrypto_schema text;
begin
  if pg_catalog.to_regprocedure(
    'public.join_team_by_code(text,uuid,text)'
  ) is null then
    raise exception 'public.join_team_by_code(text,uuid,text) does not exist';
  end if;

  select namespace.nspname
  into pgcrypto_schema
  from pg_catalog.pg_extension extension
  join pg_catalog.pg_namespace namespace
    on namespace.oid = extension.extnamespace
  where extension.extname = 'pgcrypto';

  if pgcrypto_schema is null then
    raise exception 'pgcrypto extension is not installed';
  end if;

  execute pg_catalog.format(
    'alter function public.join_team_by_code(text, uuid, text) '
    'set search_path = pg_catalog, %I',
    pgcrypto_schema
  );
end;
$$;

notify pgrst, 'reload schema';
