-- 010_remove_auth.sql
-- Verwijdert de verplichting tot anonieme Supabase-authenticatie voor spelersgerichte functies.
-- Spelers worden voortaan geïdentificeerd op basis van hun (genormaliseerde) naam in plaats van auth.uid().
-- De beheerdersgerichte functies (check_admin_access, get_dashboard_data) vereisen nog steeds authenticatie.

-- ============================================================
-- 1. Verwijder de foreign key van private.players.user_id → auth.users(id)
-- ============================================================
ALTER TABLE private.players DROP CONSTRAINT IF EXISTS players_user_id_fkey;

-- ============================================================
-- 2. register_player: geen auth vereist, upsert op basis van naam
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_player(p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name text;
  v_normalized text;
BEGIN
  v_name := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[<>[:cntrl:]]', '', 'g'), '\s+', ' ', 'g'));
  IF char_length(v_name) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Vul een naam van maximaal 40 tekens in.';
  END IF;
  v_normalized := lower(v_name);
  INSERT INTO private.players (user_id, name, normalized_name)
    VALUES (gen_random_uuid(), v_name, v_normalized)
    ON CONFLICT (normalized_name) DO UPDATE SET name = v_name, last_seen_at = now();
  RETURN jsonb_build_object('playerName', v_name);
END $$;

-- ============================================================
-- 3. get_app_state: accepteert optionele spelernaam
-- ============================================================
DROP FUNCTION IF EXISTS public.get_app_state();
CREATE FUNCTION public.get_app_state(p_player_name text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF p_player_name <> '' THEN
    SELECT user_id INTO v_uid FROM private.players WHERE normalized_name = lower(btrim(p_player_name));
    IF v_uid IS NOT NULL THEN
      UPDATE private.players SET last_seen_at = now() WHERE user_id = v_uid;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'games', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', g.id, 'title', g.title, 'description', g.description,
        'status', g.status, 'state', private.game_state(g),
        'openFrom', g.open_from, 'closeAt', g.close_at,
        'hint', CASE WHEN s.id IS NULL THEN '' ELSE g.hint END,
        'maxPoints', g.max_points, 'order', g.display_order,
        'completed', CASE WHEN s.id IS NULL THEN NULL ELSE
          jsonb_build_object('gameId', s.game_id, 'title', g.title, 'score', s.score, 'seconds', s.seconds, 'attempts', s.attempts)
        END
      ) ORDER BY g.display_order)
      FROM private.games g
      LEFT JOIN private.scores s ON s.game_id = g.id AND s.user_id = v_uid
    ), '[]'::jsonb),
    'leaderboard', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', x.name, 'score', x.score, 'games', x.games, 'seconds', x.seconds)
        ORDER BY x.score DESC, x.seconds ASC, x.name ASC)
      FROM (
        SELECT min(player_name) name, sum(score)::integer score, count(*)::integer games, sum(seconds)::integer seconds
        FROM private.scores GROUP BY user_id ORDER BY sum(score) DESC, sum(seconds), min(player_name) LIMIT 50
      ) x
    ), '[]'::jsonb),
    'activePlayers', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', p.name, 'gameId', a.game_id, 'gameTitle', g.title, 'startedAt', a.started_at)
        ORDER BY a.last_seen_at DESC)
      FROM private.active_players a
      JOIN private.players p ON p.user_id = a.user_id
      JOIN private.games g ON g.id = a.game_id
      WHERE a.last_seen_at >= now() - interval '30 seconds'
    ), '[]'::jsonb)
  );
END $$;

-- ============================================================
-- 4. get_game_access: accepteert spelernaam
-- ============================================================
DROP FUNCTION IF EXISTS public.get_game_access(text);
CREATE FUNCTION public.get_game_access(p_game_id text, p_player_name text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid;
  v_game private.games;
  v_score private.scores;
  v_state text;
BEGIN
  IF p_player_name <> '' THEN
    SELECT user_id INTO v_uid FROM private.players WHERE normalized_name = lower(btrim(p_player_name));
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Open dit spel via de startpagina en sla eerst je naam op.';
  END IF;
  SELECT * INTO v_game FROM private.games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Onbekend spel.'; END IF;
  SELECT * INTO v_score FROM private.scores WHERE user_id = v_uid AND game_id = p_game_id;
  v_state := private.game_state(v_game);
  RETURN jsonb_build_object(
    'allowed', v_state = 'open' AND v_score.id IS NULL,
    'state', v_state,
    'completed', CASE WHEN v_score.id IS NULL THEN NULL ELSE
      jsonb_build_object('gameId', v_score.game_id, 'title', v_game.title, 'score', v_score.score, 'seconds', v_score.seconds, 'attempts', v_score.attempts)
    END,
    'game', jsonb_build_object(
      'id', v_game.id, 'title', v_game.title, 'description', v_game.description,
      'status', v_game.status, 'state', v_state, 'openFrom', v_game.open_from, 'closeAt', v_game.close_at,
      'hint', CASE WHEN v_score.id IS NULL THEN '' ELSE v_game.hint END,
      'maxPoints', v_game.max_points, 'order', v_game.display_order
    )
  );
END $$;

-- ============================================================
-- 5. register_game_start: accepteert spelernaam
-- ============================================================
DROP FUNCTION IF EXISTS public.register_game_start(text, text, text);
CREATE FUNCTION public.register_game_start(p_game_id text, p_player_name text DEFAULT '', p_source text DEFAULT '', p_user_agent text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid;
  v_game private.games;
BEGIN
  IF p_player_name <> '' THEN
    SELECT user_id INTO v_uid FROM private.players WHERE normalized_name = lower(btrim(p_player_name));
  END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sla eerst je naam op.'; END IF;
  IF char_length(coalesce(p_source, '')) > 100 OR char_length(coalesce(p_user_agent, '')) > 250 THEN
    RAISE EXCEPTION 'Startgegevens zijn te lang.';
  END IF;
  SELECT * INTO v_game FROM private.games WHERE id = p_game_id;
  IF NOT FOUND OR private.game_state(v_game) <> 'open' THEN RAISE EXCEPTION 'Dit spel is niet vrijgegeven.'; END IF;
  IF EXISTS(SELECT 1 FROM private.scores WHERE user_id = v_uid AND game_id = p_game_id) THEN
    RETURN jsonb_build_object('registered', false, 'reason', 'completed');
  END IF;
  INSERT INTO private.game_starts(user_id, player_name, game_id, source, user_agent)
    SELECT user_id, name, p_game_id, coalesce(p_source, ''), coalesce(p_user_agent, '')
    FROM private.players WHERE user_id = v_uid;
  INSERT INTO private.active_players(user_id, game_id) VALUES(v_uid, p_game_id)
    ON CONFLICT(user_id) DO UPDATE SET
      game_id = excluded.game_id,
      started_at = CASE WHEN private.active_players.game_id = excluded.game_id
                        THEN private.active_players.started_at ELSE now() END,
      last_seen_at = now();
  RETURN jsonb_build_object('registered', true);
END $$;

-- ============================================================
-- 6. register_game_heartbeat: accepteert spelernaam
-- ============================================================
DROP FUNCTION IF EXISTS public.register_game_heartbeat(text);
CREATE FUNCTION public.register_game_heartbeat(p_game_id text, p_player_name text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid;
  v_game private.games;
BEGIN
  IF p_player_name <> '' THEN
    SELECT user_id INTO v_uid FROM private.players WHERE normalized_name = lower(btrim(p_player_name));
  END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sla eerst je naam op.'; END IF;
  SELECT * INTO v_game FROM private.games WHERE id = p_game_id;
  IF NOT FOUND OR private.game_state(v_game) <> 'open' THEN RAISE EXCEPTION 'Dit spel is niet actief.'; END IF;
  IF EXISTS(SELECT 1 FROM private.scores WHERE user_id = v_uid AND game_id = p_game_id) THEN
    DELETE FROM private.active_players WHERE user_id = v_uid;
    RETURN jsonb_build_object('active', false, 'reason', 'completed');
  END IF;
  INSERT INTO private.active_players(user_id, game_id) VALUES(v_uid, p_game_id)
    ON CONFLICT(user_id) DO UPDATE SET game_id = excluded.game_id, last_seen_at = now();
  RETURN jsonb_build_object('active', true);
END $$;

-- ============================================================
-- 7. reset_game_progress: accepteert spelernaam
-- ============================================================
DROP FUNCTION IF EXISTS public.reset_game_progress(text);
CREATE FUNCTION public.reset_game_progress(p_game_id text, p_player_name text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid;
  v_game private.games;
  v_count integer;
BEGIN
  IF p_player_name <> '' THEN
    SELECT user_id INTO v_uid FROM private.players WHERE normalized_name = lower(btrim(p_player_name));
  END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Je sessie ontbreekt.'; END IF;
  SELECT * INTO v_game FROM private.games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Onbekend spel.'; END IF;
  IF private.game_state(v_game) <> 'open' THEN RAISE EXCEPTION 'Dit spel kan nu niet opnieuw worden gestart.'; END IF;
  DELETE FROM private.scores WHERE user_id = v_uid AND game_id = p_game_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM private.active_players WHERE user_id = v_uid;
  RETURN jsonb_build_object('reset', v_count > 0, 'gameId', p_game_id, 'removedScores', v_count);
END $$;

-- ============================================================
-- 8. submit_score: accepteert spelernaam
-- ============================================================
DROP FUNCTION IF EXISTS public.submit_score(text, integer, integer, jsonb);
CREATE FUNCTION public.submit_score(p_game_id text, p_seconds integer, p_attempts integer, p_detail jsonb DEFAULT '{}'::jsonb, p_player_name text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid;
  v_game private.games;
  v_score private.scores;
  v_score_value integer;
  v_inserted boolean := false;
BEGIN
  IF p_player_name <> '' THEN
    SELECT user_id INTO v_uid FROM private.players WHERE normalized_name = lower(btrim(p_player_name));
  END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sla eerst je naam op.'; END IF;
  IF p_seconds IS NULL OR p_seconds NOT BETWEEN 0 AND 86400 OR
     p_attempts IS NULL OR p_attempts NOT BETWEEN 0 AND 10000 OR
     p_detail IS NULL OR octet_length(p_detail::text) > 5120 THEN
    RAISE EXCEPTION 'Ongeldige scoregegevens.';
  END IF;
  SELECT * INTO v_game FROM private.games WHERE id = p_game_id;
  IF NOT FOUND OR private.game_state(v_game) <> 'open' THEN RAISE EXCEPTION 'Dit spel is niet vrijgegeven.'; END IF;
  v_score_value := private.score_for(p_game_id, v_game.max_points, p_seconds, p_attempts);
  INSERT INTO private.scores(user_id, player_name, game_id, score, seconds, attempts, detail)
    SELECT user_id, name, p_game_id, v_score_value, p_seconds, p_attempts, p_detail
    FROM private.players WHERE user_id = v_uid
    ON CONFLICT(user_id, game_id) DO NOTHING
    RETURNING * INTO v_score;
  v_inserted := found;
  IF NOT v_inserted THEN
    SELECT * INTO v_score FROM private.scores WHERE user_id = v_uid AND game_id = p_game_id;
  END IF;
  DELETE FROM private.active_players WHERE user_id = v_uid;
  RETURN jsonb_build_object(
    'alreadySubmitted', NOT v_inserted,
    'result', jsonb_build_object(
      'gameId', v_score.game_id, 'title', v_game.title,
      'score', v_score.score, 'seconds', v_score.seconds, 'attempts', v_score.attempts,
      'hint', v_game.hint
    )
  );
END $$;

-- ============================================================
-- 9. Machtigingen: ook toegankelijk voor de anon-rol
-- ============================================================
REVOKE ALL ON FUNCTION public.register_player(text) FROM public;
REVOKE ALL ON FUNCTION public.get_app_state(text) FROM public;
REVOKE ALL ON FUNCTION public.get_game_access(text, text) FROM public;
REVOKE ALL ON FUNCTION public.register_game_start(text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.register_game_heartbeat(text, text) FROM public;
REVOKE ALL ON FUNCTION public.reset_game_progress(text, text) FROM public;
REVOKE ALL ON FUNCTION public.submit_score(text, integer, integer, jsonb, text) FROM public;

GRANT EXECUTE ON FUNCTION public.register_player(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_app_state(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_game_access(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.register_game_start(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.register_game_heartbeat(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.reset_game_progress(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_score(text, integer, integer, jsonb, text) TO anon;
