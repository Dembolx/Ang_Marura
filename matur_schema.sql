-- ============================================================
-- MATURA EN TRENER — Schemat bazy danych (Neon PostgreSQL)
-- ============================================================

-- 1. Tabela kategorii
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  color TEXT,
  level TEXT NOT NULL DEFAULT 'rozszerzony' -- 'rozszerzony' | 'podstawowy'
);

-- 2. Tabela zadań (exercises)
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  -- multiple_choice | fill_blank | true_false_ng | sentence_transform | essay | email | open_answer
  year INT,
  instruction TEXT,
  text TEXT,         -- tekst do przeczytania / transkrypt
  question TEXT,
  options JSONB,     -- ["A. ...", "B. ..."] dla multiple_choice/true_false_ng
  blanks JSONB,      -- [{"num":1,"hint":"...","answer":"..."}] dla fill_blank
  answer TEXT,
  explanation TEXT,
  translation TEXT,  -- opcjonalne tłumaczenie PL (dla poziomu P)
  level TEXT NOT NULL DEFAULT 'rozszerzony',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela postępów użytkownika
CREATE TABLE IF NOT EXISTS user_progress (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',  -- do rozszerzenia o auth
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  attempts INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);

-- 4. Tabela historii sesji
CREATE TABLE IF NOT EXISTS session_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  category_id TEXT NOT NULL,
  score INT NOT NULL,
  total INT NOT NULL,
  duration_seconds INT,
  level TEXT DEFAULT 'rozszerzony',
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela streak (seria dni)
CREATE TABLE IF NOT EXISTS user_streak (
  user_id TEXT PRIMARY KEY DEFAULT 'default',
  streak_count INT NOT NULL DEFAULT 0,
  last_date DATE
);

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category_id);
CREATE INDEX IF NOT EXISTS idx_exercises_level ON exercises(level);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_exercise ON user_progress(exercise_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON session_history(user_id);

-- ============================================================
-- DANE: Kategorie
-- ============================================================
INSERT INTO categories (id, name, icon, description, color, level) VALUES
  ('reading',       'Rozumienie Tekstów',    '📖', 'MCQ, prawda/fałsz/brak, pytania otwarte do tekstów',               '#4fc3f7', 'rozszerzony'),
  ('grammar',       'Gramatyka',             '🔧', 'Uzupełnianie luk, transformacje zdań, czas i tryb',                 '#f06292', 'rozszerzony'),
  ('vocabulary',    'Słownictwo',            '📚', 'Tworzenie wyrazów, dobór leksyki, kolokacje',                       '#a5d6a7', 'rozszerzony'),
  ('use_of_english','Use of English',        '⚙️', 'Luki, parafrazy, word formation, key word transformations',         '#ffb74d', 'rozszerzony'),
  ('writing',       'Wypowiedź Pisemna',     '✍️', 'Esej, e-mail, artykuł, recenzja',                                  '#ce93d8', 'rozszerzony'),
  ('listening_text','Tekst Słuchany',        '🎧', 'Pytania do transkryptów z egzaminów',                               '#80cbc4', 'rozszerzony'),
  ('basic_grammar',    'Gramatyka',          '🔧', 'Czasy, pytania, strona bierna — z wyjaśnieniami po polsku',         '#4caf50', 'podstawowy'),
  ('basic_vocabulary', 'Słownictwo',         '📖', 'Słówka tematyczne, dobór wyrazów, fałszywi przyjaciele',            '#26a69a', 'podstawowy'),
  ('basic_reading',    'Czytanie',           '📰', 'MCQ, prawda/fałsz, nagłówki — krótsze teksty',                     '#42a5f5', 'podstawowy'),
  ('basic_listening',  'Słuchanie',          '🎧', 'Transkrypty nagrań, strategie słuchania',                           '#7e57c2', 'podstawowy'),
  ('basic_writing',    'Pisanie',            '✍️', 'E-mail formalny i nieformalny, krótka wypowiedź',                  '#ef5350', 'podstawowy')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DANE: Zadania (wszystkie z bazy JSON)
-- ============================================================

INSERT INTO exercises (id, category_id, type, year, instruction, text, question, options, blanks, answer, explanation, level)
VALUES

-- ===== READING =====
('r1','reading','multiple_choice',2023,
 'Przeczytaj tekst i zaznacz właściwą odpowiedź A, B, C lub D.',
 'The concept of "rewilding" has gained significant traction in recent years as a conservation strategy aimed at restoring ecosystems to their natural state. Unlike traditional conservation, which often focuses on protecting individual species, rewilding takes a broader approach by reintroducing apex predators and allowing nature to manage itself. In Europe, the reintroduction of wolves to Yellowstone in the 1990s is frequently cited as a landmark example of how predators can trigger a "trophic cascade" — a chain reaction that ultimately benefits the entire ecosystem, including river dynamics.',
 'What distinguishes rewilding from traditional conservation approaches?',
 '["A. It focuses exclusively on protecting endangered plant species.","B. It takes a broader ecosystem view by reintroducing predators.","C. It relies primarily on human management of wildlife populations.","D. It is only applied in North American national parks."]',
 NULL,'B',
 'Tekst mówi, że rewilding "takes a broader approach by reintroducing apex predators", w przeciwieństwie do tradycyjnej ochrony skupionej na gatunkach.',
 'rozszerzony'),

('r2','reading','true_false_ng',2023,
 'Przeczytaj zdania i zdecyduj: TRUE (T), FALSE (F), lub NOT GIVEN (NG).',
 'Remote work has fundamentally altered urban planning considerations. City planners are now grappling with the phenomenon of "donut cities" — urban centres that are losing population to suburban and rural areas as workers no longer need to commute daily. Some economists predict this could lead to a permanent restructuring of real estate markets, with commercial property in city centres losing value while demand for larger homes in less densely populated areas grows. However, critics argue that once pandemic restrictions fully lifted, many workers returned to offices, suggesting the shift may be less permanent than initially feared.',
 'City planners unanimously agree that remote work will permanently change urban areas.',
 '["A. TRUE","B. FALSE","C. NOT GIVEN"]',
 NULL,'B',
 'Tekst mówi, że "critics argue" iż shift może nie być permanentny — co przeczy "unanimously agree". Odpowiedź to FALSE.',
 'rozszerzony'),

('r3','reading','multiple_choice',2022,
 'Przeczytaj tekst i zaznacz właściwą odpowiedź.',
 'Microplastics have now been detected in virtually every environment on Earth, from the deepest ocean trenches to the peaks of remote mountain ranges. What began as research into marine pollution has expanded into a global public health concern as these tiny particles, smaller than 5mm, have been found in human blood, lungs, and even placentas. Scientists are still debating the precise health implications, but initial studies suggest potential links to inflammation and hormonal disruption. The ubiquity of microplastics presents a unique challenge: unlike many pollutants, there is no clear source to shut down or regulate.',
 'According to the text, what makes microplastic pollution particularly difficult to address?',
 '["A. Scientists have not yet detected microplastics in the human body.","B. Microplastics are too small to be studied effectively in laboratories.","C. There is no single identifiable source that can be regulated.","D. The pollution is currently limited to ocean environments."]',
 NULL,'C',
 'Tekst stwierdza: "there is no clear source to shut down or regulate" — to czyni problem wyjątkowo trudnym.',
 'rozszerzony'),

('r4','reading','multiple_choice',2024,
 'Przeczytaj tekst i zaznacz właściwą odpowiedź A, B, C lub D.',
 'The gig economy, characterised by short-term contracts and freelance work as opposed to permanent jobs, has transformed the labour market in ways economists are still trying to fully comprehend. Proponents argue that it offers unprecedented flexibility and autonomy — workers can set their own hours and take on multiple clients. Critics, however, point to the erosion of workers'' rights: no sick pay, no holiday entitlement, and no guaranteed minimum hours. A 2023 report found that gig workers earn on average 25% less per hour than their permanently employed counterparts when accounting for unpaid downtime between gigs.',
 'What is stated in the text about gig workers'' earnings?',
 '["A. They earn 25% more than permanent employees due to flexibility bonuses.","B. Their hourly earnings are comparable to those of permanent employees.","C. When unpaid gaps are factored in, they earn less than permanent workers.","D. The report was unable to establish any reliable data on gig workers'' income."]',
 NULL,'C',
 'Tekst mówi: "gig workers earn on average 25% less per hour than their permanently employed counterparts when accounting for unpaid downtime."',
 'rozszerzony'),

('r001','reading','multiple_choice',2023,
 'Przeczytaj tekst i zaznacz właściwą odpowiedź A, B, C lub D.',
 'The concept of "slow travel" has emerged as a counter-movement to mass tourism. Rather than rushing through a checklist of famous landmarks, slow travellers spend extended periods in fewer locations, immersing themselves in local culture, cuisine and daily life. Advocates argue that this approach is not only more fulfilling for the traveller but also less damaging to fragile ecosystems and local communities. Critics, however, suggest it remains a luxury available only to those with the financial means and time flexibility to stay abroad for weeks or months at a time.',
 'What criticism of slow travel is mentioned in the text?',
 '["A. It causes more environmental damage than conventional tourism.","B. It is inaccessible to most people due to time and financial constraints.","C. It fails to expose travellers to cultural experiences.","D. It is too focused on visiting famous landmarks."]',
 NULL,'B',
 'Tekst stwierdza, że slow travel "remains a luxury available only to those with the financial means and time flexibility".',
 'rozszerzony'),

('r002','reading','true_false_ng',2023,
 'Zdecyduj: TRUE (T), FALSE (F), lub NOT GIVEN (NG) na podstawie tekstu.',
 'Bioluminescence — the ability of living organisms to produce and emit light — has fascinated scientists for centuries. Found in deep-sea creatures, fireflies, and certain fungi, this phenomenon results from a chemical reaction involving a compound called luciferin. While bioluminescence has been studied extensively in marine environments, its applications in medicine and technology are only beginning to be explored. Researchers have recently used bioluminescent markers to track cancer cells in laboratory settings, though clinical applications remain years away.',
 'Bioluminescence has already been successfully used to treat cancer patients in hospitals.',
 '["A. TRUE","B. FALSE","C. NOT GIVEN"]',
 NULL,'B',
 'Tekst mówi, że "clinical applications remain years away" — stosowanie kliniczne jest dopiero w przyszłości, więc twierdzenie jest fałszywe.',
 'rozszerzony'),

('r003','reading','multiple_choice',2022,
 'Przeczytaj tekst i zaznacz właściwą odpowiedź.',
 'The "paradox of choice", a concept popularised by psychologist Barry Schwartz, suggests that an abundance of options can lead to anxiety, indecision, and ultimately dissatisfaction. In consumer contexts, shoppers presented with dozens of varieties of a single product often leave without buying anything, while those given three or four options tend to make a purchase and report higher satisfaction. This has practical implications for everything from product design to public policy — simplifying choices may, counterintuitively, lead to better outcomes for individuals.',
 'According to the text, what happens when consumers are given too many choices?',
 '["A. They become more decisive and choose quickly.","B. They experience anxiety and may not purchase anything.","C. They always select the most expensive option available.","D. They report the highest levels of satisfaction."]',
 NULL,'B',
 'Tekst jasno mówi: zbyt wiele opcji prowadzi do "anxiety, indecision" i może skutkować tym, że klienci "leave without buying anything".',
 'rozszerzony'),

('r004b','reading','multiple_choice',2024,
 'Przeczytaj tekst i zaznacz właściwą odpowiedź A, B, C lub D.',
 'Urban vertical farming — growing crops in stacked layers inside climate-controlled buildings — has been heralded as a solution to food security challenges. Proponents point to its year-round productivity, minimal water use (up to 95% less than conventional farming), and independence from weather conditions. However, the energy costs remain prohibitive. Studies suggest that lettuce grown in vertical farms requires approximately 250 times more electricity per kilogram than field-grown lettuce. Until renewable energy becomes sufficiently cheap and abundant, vertical farming''s environmental credentials are, at best, mixed.',
 'What is the main concern raised about vertical farming in the text?',
 '["A. It uses significantly more water than conventional farming.","B. The crops it produces are of lower nutritional quality.","C. Its high energy consumption undermines its environmental benefits.","D. It cannot produce crops year-round."]',
 NULL,'C',
 'Tekst wskazuje na "energy costs remain prohibitive" i stwierdza, że "environmental credentials are mixed" — główny problem to zużycie energii.',
 'rozszerzony'),

-- ===== GRAMMAR =====
('g1','grammar','sentence_transform',2023,
 'Uzupełnij drugie zdanie tak, aby miało podobne znaczenie do pierwszego. Użyj słowa kluczowego (2–5 wyrazów).',
 NULL,
 'I regret not studying harder for the exam. (WISH)\nI _______ harder for the exam.',
 NULL,NULL,'wish I had studied',
 'Wyrażenie "wish + past perfect" opisuje żal za przeszłością. I wish I had studied harder for the exam.',
 'rozszerzony'),

('g2','grammar','fill_blank',2022,
 'Uzupełnij luki odpowiednimi formami słów.',
 'By the time we arrived at the station, the train ___1___ (already / leave). We had no choice but to wait for the next one, which ___2___ (not announce) yet.',
 NULL,NULL,
 '[{"num":1,"hint":"past perfect","answer":"had already left"},{"num":2,"hint":"past perfect passive","answer":"had not been announced"}]',
 NULL,
 'Zdanie 1: past perfect (had already left) — czynność wcześniejsza. Zdanie 2: past perfect passive (had not been announced).',
 'rozszerzony'),

('g3','grammar','sentence_transform',2023,
 'Uzupełnij drugie zdanie słowem kluczowym (2–5 wyrazów, nie zmieniaj formy słowa).',
 NULL,
 'It was such a boring lecture that most students fell asleep. (SO)\nThe lecture _______ most students fell asleep.',
 NULL,NULL,'was so boring that',
 'Transformacja "such + noun" → "so + adjective": "was so boring that".',
 'rozszerzony'),

('g4','grammar','fill_blank',2024,
 'Wpisz poprawne słowo lub wyrażenie w każdą lukę.',
 'If I ___1___ (know) about the traffic, I would have taken a different route. Had I ___2___ (leave) earlier, I ___3___ (not be) late for the interview.',
 NULL,NULL,
 '[{"num":1,"hint":"conditional past","answer":"had known"},{"num":2,"hint":"inversion conditional","answer":"left"},{"num":3,"hint":"would have","answer":"would not have been"}]',
 NULL,
 'Trzecia kondycjonalis: had known; inwersja Had I left; would not have been.',
 'rozszerzony'),

('g5','grammar','sentence_transform',2024,
 'Uzupełnij drugie zdanie tak, aby zachować sens pierwotnego. Użyj słowa kluczowego (2–5 wyrazów).',
 NULL,
 'People say that she discovered the formula by accident. (SAID)\nShe _______ the formula by accident.',
 NULL,NULL,'is said to have discovered',
 'Reporting verb w stronie biernej: "She is said to have discovered" — pasywna konstrukcja z "to have + past participle" dla przeszłości.',
 'rozszerzony'),

('g001','grammar','sentence_transform',2023,
 'Uzupełnij drugie zdanie używając słowa kluczowego (2–5 wyrazów, nie zmieniaj formy słowa).',
 NULL,
 'It was so cold that we couldn''t go outside. (TOO)\nIt was _______ go outside.',
 NULL,NULL,'too cold to',
 'Transformacja "so...that we couldn''t" → "too...to": It was too cold to go outside.',
 'rozszerzony'),

('g002','grammar','sentence_transform',2022,
 'Uzupełnij drugie zdanie słowem kluczowym (2–5 wyrazów).',
 NULL,
 'The last time I saw her was three years ago. (SEEN)\nI _______ three years.',
 NULL,NULL,'haven''t seen her for',
 'Czas present perfect z "for" opisuje okres, przez który coś nie miało miejsca: I haven''t seen her for three years.',
 'rozszerzony'),

('g003','grammar','sentence_transform',2023,
 'Uzupełnij drugie zdanie słowem kluczowym (2–5 wyrazów).',
 NULL,
 'Someone broke into the office last night. (BROKEN)\nThe office _______ last night.',
 NULL,NULL,'was broken into',
 'Strona bierna czasownika frazowego "break into": The office was broken into.',
 'rozszerzony'),

('g004','grammar','sentence_transform',2024,
 'Uzupełnij drugie zdanie słowem kluczowym (2–5 wyrazów).',
 NULL,
 'I''m sure it was Tom who sent that email. (MUST)\nTom _______ that email.',
 NULL,NULL,'must have sent',
 'Dedukcja o przeszłości: must have + past participle: Tom must have sent that email.',
 'rozszerzony'),

('g005','grammar','sentence_transform',2022,
 'Uzupełnij drugie zdanie słowem kluczowym (2–5 wyrazów).',
 NULL,
 'He started working here five years ago. (FOR)\nHe _______ five years.',
 NULL,NULL,'has been working here for',
 'Present perfect continuous z "for": He has been working here for five years.',
 'rozszerzony'),

('g006','grammar','sentence_transform',2023,
 'Uzupełnij drugie zdanie słowem kluczowym (2–5 wyrazów).',
 NULL,
 '"Don''t touch anything in the lab," the professor told us. (WARNED)\nThe professor _______ anything in the lab.',
 NULL,NULL,'warned us not to touch',
 'Mowa zależna z "warn sb not to do sth": warned us not to touch.',
 'rozszerzony'),

('g007','grammar','sentence_transform',2024,
 'Uzupełnij drugie zdanie słowem kluczowym (2–5 wyrazów).',
 NULL,
 'It wasn''t necessary for her to rewrite the report. (NEED)\nShe _______ the report.',
 NULL,NULL,'needn''t have rewritten',
 '"Needn''t have done" = nie musiała tego robić (ale zrobiła). Wyraża zbędne działanie w przeszłości.',
 'rozszerzony'),

('g008','grammar','sentence_transform',2022,
 'Uzupełnij drugie zdanie słowem kluczowym (2–5 wyrazów).',
 NULL,
 'Despite being tired, she finished the marathon. (ALTHOUGH)\nShe finished the marathon _______ tired.',
 NULL,NULL,'although she was',
 '"Despite + gerund" → "although + clause": although she was tired.',
 'rozszerzony'),

('g009','grammar','fill_blank',2023,
 'Uzupełnij luki właściwą formą gramatyczną słowa w nawiasie.',
 'If only I ___1___ (listen) to my parents'' advice. By now I ___2___ (finish) university and ___3___ (start) a career. It''s high time I ___4___ (take) things more seriously.',
 NULL,NULL,
 '[{"num":1,"hint":"żal za przeszłością","answer":"had listened"},{"num":2,"hint":"wynik hipotetyczny","answer":"would have finished"},{"num":3,"hint":"wynik hipotetyczny","answer":"started"},{"num":4,"hint":"it''s high time + past","answer":"took"}]',
 NULL,
 'If only + past perfect (żal). Would have finished (3rd conditional). It''s high time + past simple: took.',
 'rozszerzony'),

-- ===== USE OF ENGLISH =====
('uoe1','use_of_english','fill_blank',2023,
 'Uzupełnij zdania jednym słowem pasującym do wszystkich luk (key word).',
 '1. She has a real _____ for languages — she picks them up effortlessly.\n2. The board gave the _____ to proceed with the new project.\n3. Common _____ suggests you should save before closing a document.',
 NULL,NULL,
 '[{"num":1,"hint":"jedno słowo do wszystkich 3 zdań","answer":"sense"}]',
 NULL,
 'SENSE: sense for languages (talent), common sense (zdrowy rozsądek), gave the sense/go-ahead.',
 'rozszerzony'),

('uoe001','use_of_english','fill_blank',2023,
 'Uzupełnij każdą lukę jednym słowem.',
 'Climate change is no longer a distant threat — it is something we are already living ___1___. Scientists warn that ___2___ we act immediately, the consequences will be irreversible. ___3___ all the warnings, governments continue to delay meaningful action, which raises the question of ___4___ anyone is truly in charge.',
 NULL,NULL,
 '[{"num":1,"hint":"preposition after ''live through''","answer":"through"},{"num":2,"hint":"spójnik warunkowy","answer":"unless"},{"num":3,"hint":"przyimek ''pomimo''","answer":"Despite"},{"num":4,"hint":"zaimek pytający","answer":"whether"}]',
 NULL,
 'live through (przeżywać), unless (chyba że), despite (pomimo), whether (czy — po raise the question).',
 'rozszerzony'),

('uoe002','use_of_english','fill_blank',2022,
 'Wpisz jedno słowo pasujące do wszystkich trzech zdań.',
 '1. She decided to _____ a stand against the unfair policy.\n2. He couldn''t _____ the pressure any longer and resigned.\n3. How long does it _____ to fly from Warsaw to London?',
 NULL,NULL,
 '[{"num":1,"hint":"jedno słowo do wszystkich zdań","answer":"take"}]',
 NULL,
 'TAKE: take a stand (zająć stanowisko), take the pressure (znosić presję), take time (zajmować czas).',
 'rozszerzony'),

('uoe003','use_of_english','fill_blank',2024,
 'Wpisz jedno słowo pasujące do wszystkich trzech zdań.',
 '1. The company is trying to _____ a good impression on potential investors.\n2. She couldn''t _____ up her mind about which university to choose.\n3. The storm is expected to _____ landfall on Friday evening.',
 NULL,NULL,
 '[{"num":1,"hint":"jedno słowo do wszystkich zdań","answer":"make"}]',
 NULL,
 'MAKE: make an impression, make up one''s mind (zdecydować się), make landfall (dotrzeć do lądu).',
 'rozszerzony'),

('uoe004','use_of_english','sentence_transform',2023,
 'Uzupełnij drugie zdanie słowem kluczowym (2–5 wyrazów), nie zmieniaj formy słowa.',
 NULL,
 'He finds it difficult to concentrate in noisy environments. (DIFFICULTY)\nHe _______ in noisy environments.',
 NULL,NULL,'has difficulty concentrating',
 '"Have difficulty doing sth" = mieć trudności z czymś: He has difficulty concentrating.',
 'rozszerzony'),

('uoe005','use_of_english','sentence_transform',2022,
 'Uzupełnij drugie zdanie słowem kluczowym (2–5 wyrazów).',
 NULL,
 'It''s possible that the flight was delayed due to the storm. (MAY)\nThe flight _______ due to the storm.',
 NULL,NULL,'may have been delayed',
 'Możliwość dotycząca przeszłości: may have been delayed (strona bierna + modal perfect).',
 'rozszerzony'),

-- ===== VOCABULARY =====
('v1','vocabulary','fill_blank',2023,
 'Utwórz wyraz od słowa w nawiasie, aby pasował do kontekstu zdania.',
 'The scientist''s ___1___ (discover) of the new compound was met with ___2___ (skeptic) by the academic community. Nevertheless, her findings proved ___3___ (ground) for future research.',
 NULL,NULL,
 '[{"num":1,"hint":"rzeczownik od discover","answer":"discovery"},{"num":2,"hint":"rzeczownik od skeptic","answer":"skepticism"},{"num":3,"hint":"przymiotnik od ground","answer":"groundbreaking"}]',
 NULL,
 'Tworzenie wyrazów: discovery (noun), skepticism (noun), groundbreaking (adjective).',
 'rozszerzony'),

('v2','vocabulary','fill_blank',2022,
 'Utwórz właściwy wyraz pochodny od słowa w nawiasie.',
 'The documentary explored the ___1___ (environment) consequences of fast fashion. The industry''s ___2___ (rely) on synthetic fibres has proved ___3___ (catastrophe) for ecosystems. Experts call for greater ___4___ (transparent) in supply chains.',
 NULL,NULL,
 '[{"num":1,"hint":"przymiotnik","answer":"environmental"},{"num":2,"hint":"rzeczownik","answer":"reliance"},{"num":3,"hint":"przymiotnik","answer":"catastrophic"},{"num":4,"hint":"rzeczownik","answer":"transparency"}]',
 NULL,
 'environmental (adj), reliance (noun), catastrophic (adj), transparency (noun).',
 'rozszerzony'),

('v3','vocabulary','multiple_choice',2023,
 'Wybierz słowo, które najlepiej pasuje do kontekstu.',
 NULL,
 'The new policy was met with considerable _______ from the opposition party, who argued it would harm the economy.',
 '["A. acclaim","B. resistance","C. indifference","D. enthusiasm"]',
 NULL,'B',
 '"Resistance" (opór, sprzeciw) najlepiej pasuje — opozycja nie zgadza się z polityką.',
 'rozszerzony'),

('v4','vocabulary','sentence_transform',2024,
 'Przeformułuj zdanie, używając podanego słowa kluczowego (2–5 wyrazów).',
 NULL,
 'Despite working overtime, she didn''t finish the project. (MANAGE)\nShe _______ the project despite working overtime.',
 NULL,NULL,'didn''t manage to finish',
 '"Manage to do" = udać się coś zrobić. Negacja: didn''t manage to finish.',
 'rozszerzony'),

('v001','vocabulary','fill_blank',2023,
 'Utwórz właściwy wyraz pochodny od słowa w nawiasie.',
 'The prime minister gave a surprisingly ___1___ (candid) speech about the country''s economic ___2___ (difficult). His ___3___ (acknowledge) of past mistakes was widely praised, though some critics questioned his ___4___ (sincere).',
 NULL,NULL,
 '[{"num":1,"hint":"przysłówek","answer":"candidly"},{"num":2,"hint":"liczba mnoga rzeczownika","answer":"difficulties"},{"num":3,"hint":"rzeczownik od acknowledge","answer":"acknowledgement"},{"num":4,"hint":"rzeczownik od sincere","answer":"sincerity"}]',
 NULL,
 'candid→candidly (adv), difficulty→difficulties (pl noun), acknowledge→acknowledgement, sincere→sincerity.',
 'rozszerzony'),

('v003','vocabulary','multiple_choice',2023,
 'Wybierz słowo, które najlepiej pasuje do kontekstu.',
 NULL,
 'The scientist''s groundbreaking research _______ a new era in genetic medicine.',
 '["A. ushered in","B. pulled off","C. looked into","D. set back"]',
 NULL,'A',
 '"Usher in" = zapoczątkować, inaugurować. To jest właściwe wyrażenie opisujące rozpoczęcie nowej ery.',
 'rozszerzony'),

-- ===== WRITING =====
('w1','writing','essay',2023,
 'Napisz esej (ok. 200–250 słów) na podany temat. Użyj odpowiedniej struktury: wstęp, rozwinięcie (2 argumenty + kontrargument), zakończenie.',
 NULL,
 '"Social media does more harm than good to young people''s mental health." Discuss both sides of this argument and give your own opinion.',
 NULL,NULL,'',
 'Oceń: 1) Struktura (wstęp, teza, argumenty za, przeciw, konkluzja) 2) Spójność i kohezja 3) Zakres słownictwa 4) Poprawność gramatyczna 5) Odpowiednia długość',
 'rozszerzony'),

('w2','writing','email',2022,
 'Napisz e-mail formalny (ok. 150–200 słów) zgodnie z instrukcją.',
 NULL,
 'You saw an advertisement for a summer internship at a technology company. Write an email to the HR department expressing your interest, outlining your relevant skills and experience, and asking about the application process.',
 NULL,NULL,'',
 'Oceń: 1) Odpowiedni rejestr (formalny) 2) Właściwe zwroty otwierające i zamykające 3) Treść merytoryczna 4) Poprawność językowa',
 'rozszerzony'),

('w3','writing','essay',2024,
 'Napisz rozprawkę (200–250 słów).',
 NULL,
 '"Space exploration is a waste of resources that should be invested in solving problems on Earth." Do you agree or disagree? Discuss.',
 NULL,NULL,'',
 'Kryteria CKE: treść (4 pkt), spójność i logika (2 pkt), zakres środków językowych (3 pkt), poprawność (3 pkt).',
 'rozszerzony'),

-- ===== LISTENING =====
('l1','listening_text','multiple_choice',2023,
 'Przeczytaj transkrypt nagrania i odpowiedz na pytania. (W oryginale to zadanie do słuchania.)',
 'INTERVIEWER: Dr. Patel, you''ve been researching urban heat islands for over a decade. Can you explain what exactly makes cities so much hotter than surrounding areas?\nDR. PATEL: Certainly. The phenomenon has several causes. First, dark surfaces like asphalt and rooftops absorb significantly more solar radiation than vegetation. Second, buildings trap heat between them — a canyon effect. Third, there''s the direct heat output from vehicles, air conditioning, and industry. What people don''t often realise is that the absence of trees is perhaps the most important factor, since vegetation cools its surroundings through transpiration.\nINTERVIEWER: Are some cities tackling this effectively?\nDR. PATEL: Singapore is frequently cited as a success story. They''ve integrated greenery into building design at every level — literally growing gardens on facades and rooftops. Their approach has reduced local temperatures by measurable amounts. Rotterdam in the Netherlands is another example, focusing on water management and green roofs.',
 'According to Dr. Patel, which factor does she consider MOST important in causing urban heat islands?',
 '["A. The direct heat output from vehicles and industry.","B. The canyon effect created by tall buildings.","C. The lack of vegetation and its cooling effect.","D. The dark colour of road surfaces."]',
 NULL,'C',
 'Dr. Patel mówi: "the absence of trees is perhaps the most important factor, since vegetation cools its surroundings through transpiration."',
 'rozszerzony'),

('l2','listening_text','true_false_ng',2022,
 'Na podstawie transkryptu zdecyduj: TRUE / FALSE / NOT GIVEN.',
 'PRESENTER: Welcome to Science Today. Today we''re discussing a new study from the University of Edinburgh which examined the relationship between multilingualism and cognitive reserve. The researchers followed 853 participants over 25 years. Their key finding was that people who regularly switch between languages showed significantly slower rates of cognitive decline after the age of 65, compared to monolingual peers. Interestingly, the type of language — whether related or unrelated to the native tongue — seemed to make little difference. The effect was also observed regardless of socioeconomic status.',
 'The study found that learning related languages (like Spanish and Italian) provides fewer cognitive benefits than learning unrelated languages.',
 '["A. TRUE","B. FALSE","C. NOT GIVEN"]',
 NULL,'B',
 'Transkrypt wyraźnie mówi: "the type of language seemed to make little difference" — a więc twierdzenie jest FAŁSZYWE.',
 'rozszerzony'),

('l3','listening_text','multiple_choice',2024,
 'Przeczytaj transkrypt i zaznacz właściwą odpowiedź.',
 'HOST: Today on "Green Futures" we speak with marine biologist Dr. Clara Voss about coral reef restoration. Dr. Voss, how hopeful are you?\nDR. VOSS: Cautiously optimistic. The lab-grown coral techniques we''ve been piloting show a 70% survival rate after transplantation — that''s a significant improvement from the 30% we saw a decade ago. But I want to be honest: we can restore reefs all we like, but if ocean temperatures keep rising due to climate change, those restored corals will bleach again within years. Restoration is a stopgap, not a solution.\nHOST: What''s the most promising development you''ve seen recently?\nDR. VOSS: Thermal-resistant coral strains. Researchers in Hawaii and Australia have been selectively breeding corals that can tolerate warmer temperatures. It''s essentially assisted evolution. If we can scale that up, we might be able to buy enough time for broader climate action to take effect.',
 'What does Dr. Voss say about coral restoration efforts?',
 '["A. They are a permanent solution to the coral reef crisis.","B. They are effective but will not succeed without addressing climate change.","C. The survival rate of transplanted corals has remained unchanged for a decade.","D. She is fully confident that restoration alone will save coral reefs."]',
 NULL,'B',
 'Dr. Voss mówi: "Restoration is a stopgap, not a solution" i ostrzega, że bez działań klimatycznych rafy będą ponownie blaknąć. Odpowiedź B.',
 'rozszerzony')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Widok pomocniczy — statystyki kategorii
-- ============================================================
CREATE OR REPLACE VIEW category_stats AS
SELECT
  c.id,
  c.name,
  c.icon,
  c.color,
  c.level,
  COUNT(e.id) AS total_exercises,
  COUNT(up.exercise_id) AS attempted,
  COALESCE(SUM(up.correct), 0) AS total_correct,
  COALESCE(SUM(up.attempts), 0) AS total_attempts,
  CASE
    WHEN COALESCE(SUM(up.attempts), 0) > 0
    THEN ROUND(SUM(up.correct)::NUMERIC / SUM(up.attempts) * 100, 1)
    ELSE 0
  END AS accuracy_pct
FROM categories c
LEFT JOIN exercises e ON e.category_id = c.id
LEFT JOIN user_progress up ON up.exercise_id = e.id AND up.user_id = 'default'
GROUP BY c.id, c.name, c.icon, c.color, c.level;