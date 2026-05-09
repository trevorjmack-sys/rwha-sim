-- ── Migration 0002: Prospects & Draft Picks ───────────────────────────────────

-- Add abbreviation column to teams (farm affiliate city codes used on rwha.net)
ALTER TABLE teams ADD COLUMN abbrev TEXT;

UPDATE teams SET abbrev = 'MAL' WHERE name = 'Aces';
UPDATE teams SET abbrev = 'KOK' WHERE name = 'Bunnies';
UPDATE teams SET abbrev = 'GLA' WHERE name = 'Chiefs';
UPDATE teams SET abbrev = 'WUH' WHERE name = 'Clan';
UPDATE teams SET abbrev = 'CUN' WHERE name = 'Cunts';
UPDATE teams SET abbrev = 'FLE' WHERE name = 'Fletushkas';
UPDATE teams SET abbrev = 'KIE' WHERE name = 'Flyers';
UPDATE teams SET abbrev = 'ULS' WHERE name = 'Giants';
UPDATE teams SET abbrev = 'ATH' WHERE name = 'Gladiators';
UPDATE teams SET abbrev = 'INV' WHERE name = 'Jets';
UPDATE teams SET abbrev = 'MUL' WHERE name = 'Marauders';
UPDATE teams SET abbrev = 'GDA' WHERE name = 'Mariners';
UPDATE teams SET abbrev = 'PRP' WHERE name = 'Meltdown';
UPDATE teams SET abbrev = 'ULA' WHERE name = 'Mongoloids';
UPDATE teams SET abbrev = 'SCH' WHERE name = 'Oilers';
UPDATE teams SET abbrev = 'LIS' WHERE name = 'Phantoms';
UPDATE teams SET abbrev = 'RIV' WHERE name = 'Riots';
UPDATE teams SET abbrev = 'BEL' WHERE name = 'Shitdawgs';
UPDATE teams SET abbrev = 'REY' WHERE name = 'Snowdogs';
UPDATE teams SET abbrev = 'STM' WHERE name = 'Steamers';
UPDATE teams SET abbrev = 'WFB' WHERE name = 'WaffleBots';
UPDATE teams SET abbrev = 'WAR' WHERE name = 'Warheads';

-- ── Prospects table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id         INTEGER NOT NULL REFERENCES teams(id),
  name            TEXT    NOT NULL,
  draft_year      INTEGER,          -- NULL = undrafted / unknown year
  draft_overall   INTEGER           -- NULL = undrafted
);

-- ── Draft picks table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS draft_picks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_team_id   INTEGER NOT NULL REFERENCES teams(id),
  original_abbrev TEXT    NOT NULL,   -- three-letter city code of originating team
  year            INTEGER NOT NULL,
  round           INTEGER NOT NULL
);

-- ── Prospect data ─────────────────────────────────────────────────────────────
-- Team IDs: Aces=1 Bunnies=2 Chiefs=3 Clan=4 Cunts=5 Fletushkas=6 Flyers=7
--           Giants=8 Gladiators=9 Jets=10 Marauders=11 Mariners=12 Meltdown=13
--           Mongoloids=14 Oilers=15 Phantoms=16 Riots=17 Shitdawgs=18
--           Snowdogs=19 Steamers=20 WaffleBots=21 Warheads=22

INSERT INTO prospects (team_id, name, draft_year, draft_overall) VALUES
-- Aces
(1, 'Cole McKinney',        2025, 79),
(1, 'Cole Reschny',         2025, 13),
(1, 'Conrad Fondrk',        2025, 123),
(1, 'Isaac Howard',         NULL, NULL),
(1, 'Jack Ivankovic',       2025, 35),
(1, 'Julius Miettinen',     2024, 47),
(1, 'Kamil Bednarik',       2024, 113),
(1, 'Theodor Hallquisth',   2025, 101),
-- Chiefs
(3, 'Alexander Zharovsky',  2025, 45),
(3, 'Bruno Idzan',          2025, 74),
(3, 'Charlie Stramel',      NULL, NULL),
(3, 'Cole Eiserman',        2024, 16),
(3, 'Cooper Simpson',       2025, 67),
(3, 'Linus Eriksson',       2024, 38),
(3, 'Matthew Wood',         2023, 15),
(3, 'Maxim Schafer',        2025, 89),
(3, 'Michael Misa',         2025, 1),
(3, 'Owen Martin',          2025, 111),
(3, 'Tomas Lavoie',         2024, 126),
-- Clan
(4, 'Adam Kleber',          2024, 92),
(4, 'Brady Martin',         2025, 9),
(4, 'Colin Ralph',          2024, 87),
(4, 'Dean Letourneau',      2024, 26),
(4, 'Elias Petterson',      NULL, NULL),
(4, 'Evan Gardner',         2024, 114),
(4, 'Jimmy Lombardi',       2025, 122),
(4, 'Lynden Lakovic',       2025, 34),
(4, 'Michal Pradel',        2025, 78),
(4, 'Roger McQueen',        2025, 12),
-- Cunts
(5, 'Alex Huang',           2025, 116),
(5, 'Brady Cleveland',      NULL, NULL),
(5, 'Bryce Pickford',       2025, 72),
(5, 'Carter Bear',          2025, 15),
(5, 'Daimon Gardner',       NULL, NULL),
(5, 'Eemil Vinni',          2024, 95),
(5, 'Eriks Mateiko',        2024, 123),
(5, 'Filip Nordberg',       NULL, NULL),
(5, 'Jackson Kunz',         NULL, NULL),
(5, 'Jay O''Brien',         NULL, NULL),
(5, 'Jesse Kiiskinen',      NULL, NULL),
(5, 'Kasper Pikkarainen',   2024, 117),
(5, 'Liam Pettersson',      2025, 94),
(5, 'Logan Hensler',        2025, 28),
(5, 'Miroslav Satan',       2024, 125),
(5, 'Olof Glifford',        NULL, NULL),
(5, 'Philiip Nyberg',       NULL, NULL),
(5, 'Sacha Boisvert',       2024, 29),
(5, 'Vilmer Alriksson',     NULL, NULL),
(5, 'Zach Nehring',         NULL, NULL),
-- Fletushkas
(6, 'Alex Bump',            2024, 115),
(6, 'Carter Amico',         2025, 71),
(6, 'Charlie Trethewey',    2025, 119),
(6, 'Danny Nelson',         NULL, NULL),
(6, 'Dmitri Buchelnikov',   NULL, NULL),
(6, 'Matthew Gard',         2025, 85),
(6, 'Maxim Shabanov',       NULL, NULL),
(6, 'Noah Powell',          2024, 84),
(6, 'Noah Read',            2025, 130),
(6, 'Pyotr Andreyanov',     2025, 31),
(6, 'Ryan Greene',          NULL, NULL),
(6, 'Ryan Leonard',         NULL, NULL),
(6, 'Shane Vansaghi',       2025, 69),
(6, 'Yegor Zavragin',       2024, 107),
-- Flyers
(7, 'Andrew Basha',         2024, 31),
(7, 'Cameron Schmidt',      2025, 38),
(7, 'Cole Hutson',          2024, 27),
(7, 'Daniel Salonen',       2025, 125),
(7, 'Ethan Czata',          2025, 103),
(7, 'Gracyn Sawchyn',       NULL, NULL),
(7, 'Nikita Artamonov',     2024, 78),
(7, 'Will Moore',           2025, 56),
-- Giants
(8, 'A.J. Spellacy',        2024, 122),
(8, 'Alexis Bernier',       2024, 127),
(8, 'Brodie Ziemer',        2024, 121),
(8, 'Eddie Genborg',        2025, 84),
(8, 'Ethan Procyszyn',      2024, 111),
(8, 'Ian Moore',            NULL, NULL),
(8, 'Jack Murtagh',         2025, 40),
(8, 'Jack Nesbitt',         2025, 17),
(8, 'Jake O''Brien',        2025, 10),
(8, 'Linus Funck',          2025, 50),
(8, 'Nathan Behm',          2025, 62),
(8, 'Roman Kansterov',      NULL, NULL),
(8, 'Tarin Smith',          2024, 131),
(8, 'Tinus-Luc Koblar',     2025, 112),
(8, 'Tom Willander',        NULL, NULL),
(8, 'Viggo Gustafsson',     2024, 110),
-- Gladiators
(9, 'Cullen Potter',        2025, 30),
(9, 'Eric Nilson',          2025, 66),
(9, 'Henry Brzustewicz',    2025, 44),
(9, 'Ty Smilanic',          NULL, NULL),
-- Jets
(10, 'Alfons Freij',        2024, 46),
(10, 'Aron Kiviharju',      2024, 35),
(10, 'Cayden Lindstrom',    2024, 4),
(10, 'Charlie Cerrato',     2025, 46),
(10, 'Elias Salomomsson',   NULL, NULL),
(10, 'Elijah Neuenschwander', 2025, 129),
(10, 'Kieron Walton',       2024, 187),
(10, 'Luca Del Del Belluz', NULL, NULL),
(10, 'Maxim Masse',         2024, 51),
(10, 'Sascha Boumedienne',  2025, 20),
-- Marauders
(11, 'Adam Jiricek',        2024, 17),
(11, 'Cameron Reid',        2025, 27),
(11, 'Daniil But',          NULL, NULL),
(11, 'Daniil Prokhorov',    2025, 54),
(11, 'Danila Yurov',        NULL, NULL),
(11, 'Gabe Perreault',      NULL, NULL),
(11, 'Ivan Ryabkin',        2025, 41),
(11, 'Jackson Smith',       2025, 18),
(11, 'James Hagens',        2025, 3),
(11, 'Ryker Lee',           2025, 23),
(11, 'Sam Rinzel',          NULL, NULL),
(11, 'Trevor Connelly',     2024, 20),
(11, 'Vaclav Nestrasil',    2025, 39),
(11, 'Victor Eklund',       2025, 16),
(11, 'William Zellers',     2024, 103),
(11, 'Yegor Surin',         2024, 23),
(11, 'Zeev Buium',          2024, 8),
-- Mariners
(12, 'Kasper Simontaival',  NULL, NULL),
(12, 'Lucas Beckman',       2025, 59),
(12, 'Mikkel Eriksen',      2025, 37),
(12, 'Milos Roman',         NULL, NULL),
(12, 'Oliver Tarnstrom',    NULL, NULL),
(12, 'Serron Noel',         NULL, NULL),
-- Meltdown
(13, 'Artyom Duda',         NULL, NULL),
(13, 'Jacob Battaglia',     2024, 102),
(13, 'Jacob Rombach',       2025, 87),
(13, 'Jakob Ihs-Wozniak',   2025, 65),
(13, 'Kashawn Aitcheson',   2025, 19),
(13, 'Kevin He',            2024, 124),
(13, 'Max Plante',          2024, 58),
(13, 'Milton Gastrin',      2025, 43),
(13, 'Teddy Stiga',         2024, 36),
(13, 'Vinzenz Rohrer',      NULL, NULL),
(13, 'Vojtech Cihar',       2025, 109),
-- Mongoloids
(14, 'Aydar Suniev',        NULL, NULL),
(14, 'Francesco Dell''elce', 2025, 102),
(14, 'Gage Concalves',      NULL, NULL),
(14, 'Kevin Reidler',       NULL, NULL),
(14, 'Logan Sawyer',        2024, 112),
(14, 'Mason West',          2025, 24),
(14, 'Matthew Schaefer',    2025, 2),
(14, 'Sam O''Reilly',       2024, 24),
(14, 'Spencer Gill',        2024, 101),
(14, 'Topias Leinonen',     NULL, NULL),
(14, 'Will Horcoff',        2025, 22),
-- Oilers
(15, 'Braedon Cootes',      2025, 15),
(15, 'Charlie Elick',       2024, 85),
(15, 'David Lewandowski',   2025, 107),
(15, 'David Tomasek',       NULL, NULL),
(15, 'Mikhail Gulyayev',    2023, 31),
(15, 'Nathan Villeneuve',   2024, 116),
(15, 'Nikita Nedopyokin',   NULL, NULL),
(15, 'Noel Fransen',        2024, 118),
(15, 'Oliver Moore',        2023, 19),
(15, 'Viktor Klingsell',    2025, 156),
-- Phantoms
(16, 'Alexei Medvedev',     2025, 33),
(16, 'Benjamin Kindel',     2025, 11),
(16, 'Blake Fiddler',       2025, 55),
(16, 'Eric Portillo',       NULL, NULL),
(16, 'Lucas Pettersson',    2024, 54),
(16, 'Maceo Phillips',      2025, 121),
(16, 'Noah Dower Nilsson',  NULL, NULL),
(16, 'Oscar Fisker Molgaard', NULL, NULL),
(16, 'William Whitelaw',    NULL, NULL),
-- Riots
(17, 'Aatos Koivu',         2024, 59),
(17, 'Adam Benak',          2025, 49),
(17, 'Caleb Desnoyers',     2025, 6),
(17, 'Connor Geekie',       NULL, NULL),
(17, 'Eric Pohlkamp',       NULL, NULL),
(17, 'Ivan Demidov',        2024, 3),
(17, 'Jackson Parson',      NULL, NULL),
(17, 'Jayden Perron',       NULL, NULL),
(17, 'John Mustard',        2024, 86),
(17, 'Larry Keenan',        NULL, NULL),
(17, 'Mateo Nobert',        2025, 98),
(17, 'Max Psenicka',        2025, 57),
(17, 'Michael Hage',        2024, 10),
(17, 'Miguel Marques',      2024, 98),
(17, 'Ryder Ritchie',       2024, 43),
(17, 'Taige Harding',       NULL, NULL),
(17, 'Trenten Bennett',     2025, 100),
-- Shitdawgs
(18, 'Alexander Nikishin',  NULL, NULL),
(18, 'Anton Silayev',       2024, 12),
(18, 'Arseny Gritsyuk',     NULL, NULL),
(18, 'Bradley Nadeau',      NULL, NULL),
(18, 'Carlos Handel',       2025, 97),
(18, 'Hampton Slukynsky',   2023, 118),
(18, 'Joshua Ravensbergen', 2025, 26),
(18, 'Justin Carbonneau',   2025, 21),
(18, 'Kiril Gerasimyuk',    2021, 152),
(18, 'Kurban Limatov',      2025, 83),
(18, 'L.J. Mooney',         2025, 48),
(18, 'Leo Sahlin-Wallenius', 2024, 99),
(18, 'Malcom Spence',       2025, 32),
(18, 'Mans Goos',           2025, 120),
(18, 'Matvei Shuravin',     2024, 97),
(18, 'Porter Martone',      2025, 4),
(18, 'Stanislav Berezhnoi', NULL, NULL),
(18, 'Theo Stockselius',    2025, 75),
-- Snowdogs
(19, 'Aartu Karki',         NULL, NULL),
(19, 'Adam Jecho',          2024, 128),
(19, 'Anton Frondell',      2025, 5),
(19, 'Bill Zonnon',         2025, 36),
(19, 'Devin Kaplan',        NULL, NULL),
(19, 'Dmitriy Simashev',    NULL, NULL),
(19, 'Dylan MacKinnon',     NULL, NULL),
(19, 'Gabriel Eliasson',    2024, 62),
(19, 'Gavin McCarthy',      NULL, NULL),
(19, 'Hayden Paupanekis',   2025, 113),
(19, 'Hoaxi Wang',          2025, 53),
(19, 'Maxim Strbak',        NULL, NULL),
(19, 'Michael Hrabal',      NULL, NULL),
(19, 'Tommy Lafreniere',    2025, 91),
(19, 'Will Skahan',         2024, 106),
-- Steamers
(20, 'Jack Devine',         2022, 221),
(20, 'Timur Mukhanov',      NULL, NULL),
(20, 'Tyson Jugnauth',      2022, 100),
-- WaffleBots
(21, 'Atte Joki',           2025, 128),
(21, 'Dans Locmelis',       NULL, NULL),
(21, 'Dylan James',         NULL, NULL),
(21, 'Graham Sward',        NULL, NULL),
(21, 'Jonathan Toews',      NULL, NULL),
(21, 'Loke Johansson',      2024, 132),
(21, 'Malte Vass',          2025, 124),
(21, 'Melvin Fernstrom',    2024, 130),
-- Warheads
(22, 'Adam Gajan',          NULL, NULL),
(22, 'E.J. Emery',          2024, 56),
(22, 'Henry Mews',          2024, 49),
(22, 'Ilya Nabokov',        2024, 28),
(22, 'Jimmy Snuggerud',     NULL, NULL),
(22, 'Kieren Dervin',       2025, 95),
(22, 'Mikhail Yegorov',     2024, 50),
(22, 'Peyton Kettles',      2025, 73),
(22, 'Radim Mrtka',         2025, 7),
(22, 'Ryan Chesley',        NULL, NULL),
(22, 'Trey Augustine',      NULL, NULL);

-- ── Draft pick data ───────────────────────────────────────────────────────────
INSERT INTO draft_picks (owner_team_id, original_abbrev, year, round) VALUES
-- Aces (id=1) — own all picks 2026-2030
(1,'MAL',2026,1),(1,'MAL',2026,2),(1,'MAL',2026,3),(1,'MAL',2026,4),(1,'MAL',2026,5),(1,'MAL',2026,6),
(1,'MAL',2027,1),(1,'MAL',2027,2),(1,'MAL',2027,3),(1,'MAL',2027,4),(1,'MAL',2027,5),(1,'MAL',2027,6),
(1,'MAL',2028,1),(1,'MAL',2028,2),(1,'MAL',2028,3),(1,'MAL',2028,4),(1,'MAL',2028,5),(1,'MAL',2028,6),
(1,'MAL',2029,1),(1,'MAL',2029,2),(1,'MAL',2029,3),(1,'MAL',2029,4),(1,'MAL',2029,5),(1,'MAL',2029,6),
(1,'MAL',2030,1),(1,'MAL',2030,2),(1,'MAL',2030,3),(1,'MAL',2030,4),(1,'MAL',2030,5),(1,'MAL',2030,6),
-- Bunnies (id=2)
(2,'BEL',2026,6),
(2,'KOK',2027,5),(2,'KOK',2027,6),
(2,'KOK',2028,1),(2,'KOK',2028,2),(2,'KOK',2028,3),(2,'KOK',2028,5),(2,'KOK',2028,6),
(2,'KOK',2029,1),(2,'KOK',2029,2),(2,'KOK',2029,3),(2,'KOK',2029,4),(2,'KOK',2029,5),(2,'KOK',2029,6),
(2,'KOK',2030,1),(2,'KOK',2030,2),(2,'KOK',2030,3),(2,'KOK',2030,4),(2,'KOK',2030,5),(2,'KOK',2030,6),
-- Chiefs (id=3)
(3,'GLA',2026,1),(3,'WAR',2026,2),(3,'GLA',2026,4),(3,'SCH',2026,4),(3,'GLA',2026,5),(3,'GLA',2026,6),
(3,'GLA',2027,1),(3,'GLA',2027,3),(3,'GLA',2027,4),(3,'SCH',2027,4),(3,'GLA',2027,5),(3,'GLA',2027,6),
(3,'GLA',2028,1),(3,'GLA',2028,2),(3,'GLA',2028,3),(3,'GLA',2028,4),(3,'GLA',2028,5),(3,'GLA',2028,6),
(3,'GLA',2029,1),(3,'GLA',2029,2),(3,'GLA',2029,3),(3,'GLA',2029,4),(3,'GLA',2029,5),(3,'GLA',2029,6),
(3,'GLA',2030,1),(3,'GLA',2030,2),(3,'GLA',2030,3),(3,'GLA',2030,4),(3,'GLA',2030,5),(3,'GLA',2030,6),
-- Clan (id=4) — own all picks 2026-2030
(4,'WUH',2026,1),(4,'WUH',2026,2),(4,'WUH',2026,3),(4,'WUH',2026,4),(4,'WUH',2026,5),(4,'WUH',2026,6),
(4,'WUH',2027,1),(4,'WUH',2027,2),(4,'WUH',2027,3),(4,'WUH',2027,4),(4,'WUH',2027,5),(4,'WUH',2027,6),
(4,'WUH',2028,1),(4,'WUH',2028,2),(4,'WUH',2028,3),(4,'WUH',2028,4),(4,'WUH',2028,5),(4,'WUH',2028,6),
(4,'WUH',2029,1),(4,'WUH',2029,2),(4,'WUH',2029,3),(4,'WUH',2029,4),(4,'WUH',2029,5),(4,'WUH',2029,6),
(4,'WUH',2030,1),(4,'WUH',2030,2),(4,'WUH',2030,3),(4,'WUH',2030,4),(4,'WUH',2030,5),(4,'WUH',2030,6),
-- Cunts (id=5)
(5,'CUN',2026,2),(5,'FLE',2026,2),(5,'CUN',2026,4),(5,'CUN',2026,5),(5,'CUN',2026,6),
(5,'CUN',2027,1),(5,'CUN',2027,3),(5,'CUN',2027,4),(5,'CUN',2027,5),(5,'CUN',2027,6),
(5,'CUN',2028,1),(5,'CUN',2028,2),(5,'CUN',2028,3),(5,'CUN',2028,4),(5,'CUN',2028,5),(5,'CUN',2028,6),
(5,'CUN',2029,1),(5,'CUN',2029,2),(5,'CUN',2029,3),(5,'CUN',2029,4),(5,'CUN',2029,5),(5,'CUN',2029,6),
(5,'CUN',2030,1),(5,'CUN',2030,2),(5,'CUN',2030,3),(5,'CUN',2030,4),(5,'CUN',2030,5),(5,'CUN',2030,6),
-- Fletushkas (id=6)
(6,'FLE',2026,1),(6,'ATH',2026,2),(6,'GLA',2026,3),(6,'FLE',2026,6),
(6,'CUN',2027,2),(6,'MUL',2027,2),(6,'FLE',2027,3),(6,'FLE',2027,5),(6,'FLE',2027,6),
(6,'FLE',2028,1),(6,'FLE',2028,2),(6,'FLE',2028,3),(6,'MUL',2028,4),(6,'FLE',2028,4),(6,'FLE',2028,5),(6,'FLE',2028,6),
(6,'FLE',2029,1),(6,'FLE',2029,2),(6,'FLE',2029,3),(6,'FLE',2029,4),(6,'FLE',2029,5),(6,'FLE',2029,6),
(6,'FLE',2030,1),(6,'FLE',2030,2),(6,'FLE',2030,3),(6,'FLE',2030,4),(6,'FLE',2030,5),(6,'FLE',2030,6),
-- Flyers (id=7)
(7,'KIE',2026,1),(7,'KIE',2026,2),(7,'KIE',2026,3),(7,'KIE',2026,4),(7,'KIE',2026,5),
(7,'KIE',2027,1),(7,'KIE',2027,2),(7,'KIE',2027,3),(7,'KIE',2027,4),(7,'KIE',2027,5),(7,'KIE',2027,6),
(7,'KIE',2028,1),(7,'KIE',2028,2),(7,'KIE',2028,3),(7,'KIE',2028,4),(7,'KIE',2028,5),(7,'KIE',2028,6),
(7,'KIE',2029,2),(7,'KIE',2029,3),(7,'KIE',2029,4),(7,'KIE',2029,5),(7,'KIE',2029,6),
(7,'KIE',2030,1),(7,'KIE',2030,2),(7,'KIE',2030,3),(7,'KIE',2030,4),(7,'KIE',2030,5),(7,'KIE',2030,6),
-- Giants (id=8)
(8,'ULS',2026,1),(8,'ULS',2026,2),(8,'ULS',2026,3),(8,'ULS',2026,4),(8,'ULS',2026,5),(8,'ULS',2026,6),
(8,'ULS',2027,1),(8,'WFB',2027,2),(8,'ULS',2027,2),(8,'ULS',2027,3),(8,'ULS',2027,4),(8,'ULS',2027,5),(8,'ULS',2027,6),
(8,'ULS',2028,1),(8,'ULS',2028,2),(8,'ULS',2028,3),(8,'ULS',2028,4),(8,'ULS',2028,5),(8,'ULS',2028,6),
(8,'ULS',2029,1),(8,'ULS',2029,2),(8,'ULS',2029,3),(8,'ULS',2029,4),(8,'ULS',2029,5),(8,'ULS',2029,6),
(8,'ULS',2030,1),(8,'ULS',2030,2),(8,'ULS',2030,3),(8,'ULS',2030,4),(8,'ULS',2030,5),(8,'ULS',2030,6),
-- Gladiators (id=9)
(9,'ATH',2026,1),(9,'BEL',2026,2),(9,'STM',2026,3),(9,'ATH',2026,4),(9,'ATH',2026,5),(9,'ATH',2026,6),
(9,'ATH',2027,1),(9,'ATH',2027,2),(9,'ATH',2027,3),(9,'ATH',2027,4),(9,'ATH',2027,5),(9,'ATH',2027,6),
(9,'ATH',2028,1),(9,'ATH',2028,2),(9,'ATH',2028,3),(9,'ATH',2028,4),(9,'ATH',2028,5),(9,'ATH',2028,6),
(9,'ATH',2029,1),(9,'ATH',2029,2),(9,'ATH',2029,3),(9,'ATH',2029,4),(9,'ATH',2029,5),(9,'ATH',2029,6),
(9,'ATH',2030,1),(9,'ATH',2030,2),(9,'ATH',2030,3),(9,'ATH',2030,4),(9,'ATH',2030,5),(9,'ATH',2030,6),
-- Jets (id=10)
(10,'CUN',2026,1),(10,'WFB',2026,1),(10,'SCH',2026,2),(10,'INV',2026,3),(10,'INV',2026,4),(10,'MUL',2026,5),(10,'INV',2026,5),(10,'INV',2026,6),
(10,'INV',2027,1),(10,'INV',2027,2),(10,'INV',2027,3),(10,'MUL',2027,4),(10,'INV',2027,4),(10,'MUL',2027,5),(10,'INV',2027,5),(10,'INV',2027,6),
(10,'INV',2028,1),(10,'INV',2028,2),(10,'INV',2028,3),(10,'INV',2028,4),(10,'INV',2028,5),(10,'INV',2028,6),
(10,'INV',2029,1),(10,'INV',2029,2),(10,'INV',2029,3),(10,'INV',2029,4),(10,'INV',2029,5),(10,'INV',2029,6),
(10,'INV',2030,1),(10,'INV',2030,2),(10,'INV',2030,3),(10,'INV',2030,4),(10,'INV',2030,5),(10,'INV',2030,6),
-- Marauders (id=11)
(11,'MUL',2026,1),(11,'INV',2026,1),(11,'STM',2026,1),(11,'STM',2026,2),(11,'INV',2026,2),(11,'KOK',2026,2),(11,'MUL',2026,4),(11,'MUL',2026,6),(11,'GDA',2026,6),
(11,'MUL',2027,1),(11,'FLE',2027,1),(11,'MUL',2027,3),(11,'FLE',2027,4),(11,'MUL',2027,6),
(11,'MUL',2028,1),(11,'MUL',2028,2),(11,'MUL',2028,3),(11,'MUL',2028,5),(11,'MUL',2028,6),
(11,'MUL',2029,1),(11,'MUL',2029,2),(11,'MUL',2029,3),(11,'MUL',2029,4),(11,'MUL',2029,5),(11,'MUL',2029,6),
(11,'MUL',2030,1),(11,'MUL',2030,2),(11,'MUL',2030,3),(11,'MUL',2030,4),(11,'MUL',2030,5),(11,'MUL',2030,6),
-- Mariners (id=12)
(12,'GDA',2026,1),(12,'GDA',2026,3),(12,'GDA',2026,4),(12,'GDA',2026,5),(12,'KIE',2026,6),
(12,'GDA',2027,1),(12,'GDA',2027,2),(12,'GDA',2027,3),(12,'GDA',2027,4),(12,'GDA',2027,5),(12,'GDA',2027,6),
(12,'GDA',2028,1),(12,'GDA',2028,2),(12,'GDA',2028,3),(12,'GDA',2028,4),(12,'GDA',2028,5),(12,'GDA',2028,6),
(12,'GDA',2029,1),(12,'GDA',2029,2),(12,'GDA',2029,3),(12,'GDA',2029,4),(12,'GDA',2029,5),(12,'GDA',2029,6),
(12,'GDA',2030,1),(12,'GDA',2030,2),(12,'GDA',2030,3),(12,'GDA',2030,4),(12,'GDA',2030,5),(12,'GDA',2030,6),
-- Meltdown (id=13) — own all picks 2026-2030
(13,'PRP',2026,1),(13,'PRP',2026,2),(13,'PRP',2026,3),(13,'PRP',2026,4),(13,'PRP',2026,5),(13,'PRP',2026,6),
(13,'PRP',2027,1),(13,'PRP',2027,2),(13,'PRP',2027,3),(13,'PRP',2027,4),(13,'PRP',2027,5),(13,'PRP',2027,6),
(13,'PRP',2028,1),(13,'PRP',2028,2),(13,'PRP',2028,3),(13,'PRP',2028,4),(13,'PRP',2028,5),(13,'PRP',2028,6),
(13,'PRP',2029,1),(13,'PRP',2029,2),(13,'PRP',2029,3),(13,'PRP',2029,4),(13,'PRP',2029,5),(13,'PRP',2029,6),
(13,'PRP',2030,1),(13,'PRP',2030,2),(13,'PRP',2030,3),(13,'PRP',2030,4),(13,'PRP',2030,5),(13,'PRP',2030,6),
-- Mongoloids (id=14)
(14,'ULA',2026,1),(14,'ULA',2026,2),(14,'ULA',2026,3),(14,'ULA',2026,4),(14,'ULA',2026,5),(14,'ULA',2026,6),
(14,'ULA',2027,1),(14,'WFB',2027,1),(14,'ULA',2027,2),(14,'ULA',2027,3),(14,'ULA',2027,4),(14,'ULA',2027,5),(14,'ULA',2027,6),
(14,'ULA',2028,1),(14,'ULA',2028,2),(14,'ULA',2028,3),(14,'ULA',2028,4),(14,'ULA',2028,5),(14,'ULA',2028,6),
(14,'ULA',2029,1),(14,'ULA',2029,2),(14,'ULA',2029,3),(14,'ULA',2029,4),(14,'ULA',2029,5),(14,'ULA',2029,6),
(14,'ULA',2030,1),(14,'ULA',2030,2),(14,'ULA',2030,3),(14,'ULA',2030,4),(14,'ULA',2030,5),(14,'ULA',2030,6),
-- Oilers (id=15)
(15,'SCH',2026,1),(15,'GLA',2026,2),(15,'GDA',2026,2),(15,'SCH',2026,6),
(15,'SCH',2027,1),(15,'STM',2027,1),(15,'SCH',2027,2),(15,'REY',2027,2),(15,'GLA',2027,2),(15,'SCH',2027,3),(15,'SCH',2027,5),(15,'SCH',2027,6),
(15,'SCH',2028,1),(15,'SCH',2028,2),(15,'SCH',2028,3),(15,'SCH',2028,4),(15,'SCH',2028,5),(15,'SCH',2028,6),
(15,'SCH',2029,1),(15,'SCH',2029,2),(15,'SCH',2029,3),(15,'SCH',2029,4),(15,'SCH',2029,5),(15,'SCH',2029,6),
(15,'SCH',2030,1),(15,'SCH',2030,2),(15,'SCH',2030,3),(15,'SCH',2030,4),(15,'SCH',2030,5),(15,'SCH',2030,6),
-- Phantoms (id=16) — own all picks 2026-2030
(16,'LIS',2026,1),(16,'LIS',2026,2),(16,'LIS',2026,3),(16,'LIS',2026,4),(16,'LIS',2026,5),(16,'LIS',2026,6),
(16,'LIS',2027,1),(16,'LIS',2027,2),(16,'LIS',2027,3),(16,'LIS',2027,4),(16,'LIS',2027,5),(16,'LIS',2027,6),
(16,'LIS',2028,1),(16,'LIS',2028,2),(16,'LIS',2028,3),(16,'LIS',2028,4),(16,'LIS',2028,5),(16,'LIS',2028,6),
(16,'LIS',2029,1),(16,'LIS',2029,2),(16,'LIS',2029,3),(16,'LIS',2029,4),(16,'LIS',2029,5),(16,'LIS',2029,6),
(16,'LIS',2030,1),(16,'LIS',2030,2),(16,'LIS',2030,3),(16,'LIS',2030,4),(16,'LIS',2030,5),(16,'LIS',2030,6),
-- Riots (id=17)
(17,'RIV',2026,1),(17,'RIV',2026,2),(17,'RIV',2026,3),(17,'KOK',2026,3),(17,'RIV',2026,4),(17,'SCH',2026,5),(17,'RIV',2026,5),(17,'RIV',2026,6),
(17,'RIV',2027,1),(17,'RIV',2027,2),(17,'RIV',2027,3),(17,'RIV',2027,4),(17,'RIV',2027,5),(17,'RIV',2027,6),
(17,'RIV',2028,1),(17,'RIV',2028,2),(17,'RIV',2028,3),(17,'RIV',2028,4),(17,'RIV',2028,5),(17,'RIV',2028,6),
(17,'RIV',2029,1),(17,'RIV',2029,2),(17,'RIV',2029,3),(17,'RIV',2029,4),(17,'RIV',2029,5),(17,'RIV',2029,6),
(17,'RIV',2030,1),(17,'RIV',2030,2),(17,'RIV',2030,3),(17,'RIV',2030,4),(17,'RIV',2030,5),(17,'RIV',2030,6),
-- Shitdawgs (id=18)
(18,'BEL',2026,1),(18,'KOK',2026,1),(18,'WFB',2026,2),(18,'MUL',2026,3),(18,'ATH',2026,3),(18,'WFB',2026,3),(18,'KOK',2026,4),(18,'KOK',2026,5),(18,'KOK',2026,6),
(18,'BEL',2027,1),(18,'KOK',2027,1),(18,'STM',2027,2),(18,'BEL',2027,2),(18,'FLE',2027,2),(18,'BEL',2027,3),(18,'BEL',2027,4),(18,'BEL',2027,5),(18,'BEL',2027,6),
(18,'BEL',2028,1),(18,'STM',2028,1),(18,'BEL',2028,2),(18,'BEL',2028,3),(18,'BEL',2028,4),(18,'KOK',2028,4),(18,'BEL',2028,5),(18,'BEL',2028,6),
(18,'BEL',2029,1),(18,'KIE',2029,1),(18,'BEL',2029,2),(18,'BEL',2029,3),(18,'BEL',2029,4),(18,'STM',2029,4),(18,'BEL',2029,5),(18,'BEL',2029,6),
(18,'BEL',2030,1),(18,'BEL',2030,2),(18,'BEL',2030,3),(18,'BEL',2030,4),(18,'BEL',2030,5),(18,'BEL',2030,6),
-- Snowdogs (id=19)
(19,'REY',2026,1),(19,'REY',2026,2),(19,'REY',2026,3),(19,'REY',2026,4),(19,'REY',2026,6),
(19,'REY',2027,1),(19,'REY',2027,3),(19,'REY',2027,4),(19,'REY',2027,5),(19,'REY',2027,6),
(19,'REY',2028,1),(19,'REY',2028,2),(19,'REY',2028,3),(19,'REY',2028,4),(19,'REY',2028,5),(19,'REY',2028,6),
(19,'REY',2029,1),(19,'REY',2029,2),(19,'REY',2029,3),(19,'REY',2029,4),(19,'REY',2029,5),(19,'REY',2029,6),
(19,'REY',2030,1),(19,'REY',2030,2),(19,'REY',2030,3),(19,'REY',2030,4),(19,'REY',2030,5),(19,'REY',2030,6),
-- Steamers (id=20)
(20,'BEL',2026,3),(20,'STM',2026,4),(20,'FLE',2026,5),(20,'STM',2026,5),(20,'REY',2026,5),
(20,'STM',2027,3),(20,'STM',2027,4),(20,'STM',2027,5),(20,'STM',2027,6),
(20,'STM',2028,2),(20,'STM',2028,3),(20,'STM',2028,4),(20,'STM',2028,5),(20,'STM',2028,6),
(20,'STM',2029,1),(20,'STM',2029,2),(20,'STM',2029,3),(20,'STM',2029,5),(20,'STM',2029,6),
(20,'STM',2030,1),(20,'STM',2030,2),(20,'STM',2030,3),(20,'STM',2030,4),(20,'STM',2030,5),(20,'STM',2030,6),
-- WaffleBots (id=21)
(21,'FLE',2026,3),(21,'CUN',2026,3),(21,'SCH',2026,3),(21,'WFB',2026,4),(21,'BEL',2026,4),(21,'FLE',2026,4),(21,'WFB',2026,5),(21,'BEL',2026,5),(21,'STM',2026,6),(21,'WFB',2026,6),
(21,'WFB',2027,3),(21,'KOK',2027,3),(21,'WFB',2027,4),(21,'WFB',2027,5),(21,'WFB',2027,6),
(21,'WFB',2028,1),(21,'WFB',2028,2),(21,'WFB',2028,3),(21,'WFB',2028,4),(21,'WFB',2028,5),(21,'WFB',2028,6),
(21,'WFB',2029,1),(21,'WFB',2029,2),(21,'WFB',2029,3),(21,'WFB',2029,4),(21,'WFB',2029,5),(21,'WFB',2029,6),
(21,'WFB',2030,1),(21,'WFB',2030,2),(21,'WFB',2030,3),(21,'WFB',2030,4),(21,'WFB',2030,5),(21,'WFB',2030,6),
-- Warheads (id=22)
(22,'WAR',2026,1),(22,'MUL',2026,2),(22,'WAR',2026,3),(22,'WAR',2026,4),(22,'WAR',2026,5),(22,'WAR',2026,6),
(22,'WAR',2027,1),(22,'WAR',2027,2),(22,'KOK',2027,2),(22,'WAR',2027,3),(22,'WAR',2027,4),(22,'KOK',2027,4),(22,'WAR',2027,5),(22,'WAR',2027,6),
(22,'WAR',2028,1),(22,'WAR',2028,2),(22,'WAR',2028,3),(22,'WAR',2028,4),(22,'WAR',2028,5),(22,'WAR',2028,6),
(22,'WAR',2029,1),(22,'WAR',2029,2),(22,'WAR',2029,3),(22,'WAR',2029,4),(22,'WAR',2029,5),(22,'WAR',2029,6),
(22,'WAR',2030,1),(22,'WAR',2030,2),(22,'WAR',2030,3),(22,'WAR',2030,4),(22,'WAR',2030,5),(22,'WAR',2030,6);
