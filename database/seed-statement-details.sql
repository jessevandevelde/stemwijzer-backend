-- Korte titels en thema's voor de voorbeeldstellingen; overschrijft niets wat in het CMS al is ingevuld.
-- Toelichting en argumenten worden bewust niet meegeleverd: die vult een beheerder in via het CMS.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

CREATE TEMP TABLE seed_statement_details (text TEXT PRIMARY KEY, title TEXT NOT NULL, theme TEXT NOT NULL);

INSERT INTO seed_statement_details (text, title, theme) VALUES
    ('De overheid moet meer geld investeren in betaalbare woningen.', 'Betaalbare woningen', 'Wonen & huisvesting'),
    ('Nederland moet strengere regels invoeren voor immigratie.', 'Strengere immigratieregels', 'Migratie & asiel'),
    ('Het minimumloon moet verder worden verhoogd.', 'Hoger minimumloon', 'Werk & inkomen'),
    ('De belastingen voor hoge inkomens moeten omhoog.', 'Belasting hoge inkomens', 'Economie & belastingen'),
    ('Nederland moet meer geld uitgeven aan defensie.', 'Meer geld voor defensie', 'Veiligheid & defensie'),
    ('Kernenergie moet een belangrijk onderdeel worden van de Nederlandse energievoorziening.', 'Kernenergie', 'Klimaat & energie'),
    ('De overheid moet sneller stoppen met het gebruik van fossiele brandstoffen.', 'Stoppen met fossiel', 'Klimaat & energie'),
    ('Boeren moeten strengere milieuregels krijgen om stikstofuitstoot te verminderen.', 'Stikstofregels voor boeren', 'Landbouw & natuur'),
    ('Het openbaar vervoer moet goedkoper worden.', 'Goedkoper openbaar vervoer', 'Verkeer & mobiliteit'),
    ('Studenten moeten meer financiële ondersteuning krijgen van de overheid.', 'Steun voor studenten', 'Onderwijs'),
    ('De overheid moet meer geld investeren in de zorg.', 'Meer geld voor de zorg', 'Gezondheidszorg'),
    ('Het eigen risico in de zorg moet worden afgeschaft.', 'Eigen risico afschaffen', 'Gezondheidszorg'),
    ('Nederland moet meer vluchtelingen opvangen.', 'Meer vluchtelingenopvang', 'Migratie & asiel'),
    ('De politie moet meer bevoegdheden krijgen om criminaliteit te bestrijden.', 'Bevoegdheden politie', 'Veiligheid & rechtsstaat'),
    ('Cannabis moet volledig worden gelegaliseerd.', 'Cannabis legaliseren', 'Veiligheid & rechtsstaat'),
    ('De maximumsnelheid op snelwegen moet overdag weer naar 130 km/u.', '130 km/u op de snelweg', 'Verkeer & mobiliteit'),
    ('Bedrijven moeten meer belasting betalen.', 'Belasting voor bedrijven', 'Economie & belastingen'),
    ('Nederland moet meer bevoegdheden overdragen aan de Europese Unie.', 'Meer macht voor de EU', 'Europa & buitenland'),
    ('Er moet een bindend referendum komen waarmee burgers direct over wetten kunnen stemmen.', 'Bindend referendum', 'Democratie & bestuur'),
    ('De overheid moet harder optreden tegen bedrijven die veel CO₂ uitstoten.', 'Aanpak CO₂-uitstoters', 'Klimaat & energie'),
    ('Vlees moet duurder worden om milieuschade te verminderen.', 'Duurder vlees', 'Landbouw & natuur'),
    ('De overheid moet gratis kinderopvang aanbieden.', 'Gratis kinderopvang', 'Werk & inkomen'),
    ('Er moet meer geld naar onderwijs, ook als daarvoor andere overheidsuitgaven moeten worden verlaagd.', 'Meer geld voor onderwijs', 'Onderwijs'),
    ('Sociale media moeten strenger worden gereguleerd.', 'Regels voor sociale media', 'Digitaal & privacy'),
    ('Nederland moet de verkoop van nieuwe benzine- en dieselauto’s sneller verbieden.', 'Verbod op benzineauto''s', 'Verkeer & mobiliteit'),
    ('Mensen met een uitkering moeten verplicht worden om passend werk te accepteren.', 'Werkplicht bij uitkering', 'Werk & inkomen'),
    ('De overheid moet meer geld besteden aan ontwikkelingshulp.', 'Ontwikkelingshulp', 'Europa & buitenland'),
    ('De inkomstenbelasting moet omlaag.', 'Lagere inkomstenbelasting', 'Economie & belastingen'),
    ('Nederland moet minder afhankelijk worden van andere landen voor energie en grondstoffen.', 'Minder afhankelijk van het buitenland', 'Klimaat & energie'),
    ('De overheid moet gezichtsherkenning mogen gebruiken om ernstige criminaliteit te bestrijden.', 'Gezichtsherkenning', 'Digitaal & privacy');

UPDATE statements
SET title = (SELECT title FROM seed_statement_details WHERE seed_statement_details.text = statements.text)
WHERE title IS NULL AND text IN (SELECT text FROM seed_statement_details);

UPDATE statements
SET theme = (SELECT theme FROM seed_statement_details WHERE seed_statement_details.text = statements.text)
WHERE theme IS NULL AND text IN (SELECT text FROM seed_statement_details);

DROP TABLE seed_statement_details;

COMMIT;
