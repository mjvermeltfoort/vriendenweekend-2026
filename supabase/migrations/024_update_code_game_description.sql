-- The code game now generates a random 4-digit code on every start/replay,
-- so the old "clues from earlier games" description no longer applies.
update private.games
set description = 'Kraak de viercijferige code met logisch redeneren.'
where id = 'code';
