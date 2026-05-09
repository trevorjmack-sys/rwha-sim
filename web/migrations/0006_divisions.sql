-- Add division column and rename conferences to Honey / Sturdy
ALTER TABLE teams ADD COLUMN division TEXT NOT NULL DEFAULT 'Jofa';

-- ── Honey Conference (West) ───────────────────────────────────────────────────
-- Jofa Division
UPDATE teams SET conference = 1, division = 'Jofa'  WHERE name IN ('Flyers','Giants','Warheads','Steamers','Riots','Meltdown');
-- Titan Division
UPDATE teams SET conference = 1, division = 'Titan' WHERE name IN ('Marauders','WaffleBots','Snowdogs','Oilers','Bunnies');

-- ── Sturdy Conference (East) ──────────────────────────────────────────────────
-- Cooper Division
UPDATE teams SET conference = 2, division = 'Cooper' WHERE name IN ('Aces','Chiefs','Jets','Gladiators','Phantoms','Mariners');
-- CCM Division
UPDATE teams SET conference = 2, division = 'CCM'    WHERE name IN ('Clan','Cunts','Fletushkas','Mongoloids','Shitdawgs');
