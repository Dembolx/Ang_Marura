MATURA EN TRENER
Aplikacja webowa do nauki angielskiego na poziomie maturalnym (podstawowym i rozszerzonym). System śledzi postępy użytkownika, zapisuje historię odpowiedzi i synchronizuje dane z bazą PostgreSQL (Neon).

https://img.shields.io/badge/status-aktywny-success
https://img.shields.io/badge/database-Neon%2520PostgreSQL-blue
https://img.shields.io/badge/license-MIT-green

APK

https://dembolx.github.io/Ang_Marura/

📋 Spis treści
Funkcje

Technologie

Struktura bazy danych

Konfiguracja

Użycie

Import zadań z JSON

Struktura zadania w JSON

Rozwój projektu

Autor

✨ Funkcje
Dla użytkownika
Dwa poziomy trudności: podstawowy (PP) i rozszerzony (PR)

Kategorie zadań: gramatyka, słownictwo, czytanie, słuchanie, pisanie, Use of English

Różne typy zadań: multiple choice, fill the blank, true/false/not given, transformacje, email, esej

Śledzenie postępów: statystyki skuteczności, liczba wykonanych zadań, seria dni

Historia odpowiedzi: przeglądanie poprzednich odpowiedzi z wyjaśnieniami

Teoria i hacki: kompletne kompendium wiedzy z przykładami i wskazówkami

Import własnych zadań: wgrywanie plików JSON z nowymi zadaniami

Dla developera
Serverless PostgreSQL: połączenie z Neon przez driver @neondatabase/serverless

Automatyczne tworzenie tabel: skrypt SQL tworzy wszystkie potrzebne tabele

Indeksy wydajnościowe: zoptymalizowane zapytania

Responsywny interfejs: działa na desktopie i urządzeniach mobilnych

🛠 Technologie
Frontend: HTML5, CSS3, JavaScript (ES6+), moduły ES6

Backend: Neon PostgreSQL (serverless)

Baza danych: PostgreSQL 15+

Driver: @neondatabase/serverless (https://esm.sh/)

Czcionki: Google Fonts (Playfair Display, DM Mono, DM Sans)

🗄 Struktura bazy danych
Tabele główne
categories
sql

- id: TEXT PRIMARY KEY
- name: TEXT
- icon: TEXT
- description: TEXT
- color: TEXT
- level: TEXT DEFAULT 'rozszerzony'
  exercises
  sql
- id: TEXT PRIMARY KEY
- category_id: TEXT REFERENCES categories(id)
- type: TEXT (multiple_choice, fill_blank, true_false_ng, sentence_transform, essay, email, open_answer)
- year: INT
- instruction: TEXT
- text: TEXT
- question: TEXT
- options: JSONB
- blanks: JSONB
- answer: TEXT
- explanation: TEXT
- translation: TEXT
- level: TEXT DEFAULT 'rozszerzony'
- created_at: TIMESTAMPTZ DEFAULT NOW()
  user_progress
  sql
- id: SERIAL PRIMARY KEY
- user_id: TEXT DEFAULT 'default'
- exercise_id: TEXT REFERENCES exercises(id)
- attempts: INT DEFAULT 0
- correct: INT DEFAULT 0
- last_seen: TIMESTAMPTZ DEFAULT NOW()
  answer_history
  sql
- id: SERIAL PRIMARY KEY
- user_id: TEXT NOT NULL
- exercise_id: TEXT NOT NULL
- is_correct: BOOLEAN NOT NULL
- user_answer: TEXT
- answered_at: TIMESTAMPTZ DEFAULT NOW()
  session_history
  sql
- id: SERIAL PRIMARY KEY
- user_id: TEXT DEFAULT 'default'
- category_id: TEXT NOT NULL
- score: INT NOT NULL
- total: INT NOT NULL
- duration_seconds: INT
- level: TEXT DEFAULT 'rozszerzony'
- played_at: TIMESTAMPTZ DEFAULT NOW()
  user_streak
  sql
- user_id: TEXT PRIMARY KEY DEFAULT 'default'
- streak_count: INT DEFAULT 0
- last_date: DATE
  ⚙️ Konfiguracja

1. Połączenie z bazą Neon
   Aplikacja korzysta z gotowego połączenia do Neon PostgreSQL:

javascript
const CONNECTION_STRING = 'postgresql://neondb_owner:npg_w4bAGP3HiZYa@ep-old-moon-agtpam3x-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const \_db = neon(CONNECTION_STRING); 2. Inicjalizacja bazy
Skrypt SQL do stworzenia wszystkich tabel znajduje się w pliku schema.sql. Możesz go wykonać w konsoli Neon lub automatycznie przez aplikację (funkcja ensureTables()).

3. Konfiguracja użytkownika
   W panelu "Baza" możesz ustawić własny identyfikator użytkownika (domyślnie 'default'):

Kliknij zakładkę 🗄️ Baza

Wpisz nazwę użytkownika (np. "jan_kowalski")

Kliknij 💾 Zapisz

🚀 Użycie
Uruchomienie
Otwórz plik index.html w przeglądarce (przez serwer lokalny, np. Live Server)

Aplikacja automatycznie połączy się z bazą danych

Wybierz poziom (Podstawowy/Rozszerzony)

Kliknij kategorię i rozpocznij naukę!

Tryb nauki
Wybór poziomu: kliknij "Podstawowy (PP)" lub "Rozszerzony (PR)"

Wybór kategorii: wybierz interesującą Cię kategorię

Rozwiązywanie zadań: pojawia się losowe zadanie z wybranej kategorii

Odpowiedź: wybierz opcję, wpisz odpowiedź lub napisz tekst

Informacja zwrotna: system pokazuje czy odpowiedź jest poprawna + wyjaśnienie

Postępy: dane zapisują się automatycznie w bazie

Statystyki
W zakładce 📊 Postępy znajdziesz:

Historię sesji treningowych

Wykresy skuteczności według kategorii

Procent poprawnych odpowiedzi

Teoria
Zakładka 📖 Teoria zawiera kompletne kompendium:

Czasy angielskie

Okresy warunkowe

Strona bierna

Mowa zależna

Czasowniki modalne

Słowotwórstwo

Kolokacje

Spójniki

Pisanie esejów i e-maili

Hacki do czytania

Taktyka egzaminacyjna

📥 Import zadań z JSON
Format pliku JSON
json
[
{
"id": "p_gram_001",
"category": "basic_grammar",
"type": "fill_blank",
"level": "podstawowy",
"year": 2023,
"instruction": "Uzupełnij zdanie poprawną formą czasownika.",
"question": "She **\_\_\_** (to work) in a hospital.",
"answer": "works",
"explanation": "Dla trzeciej osoby liczby pojedynczej dodajemy końcówkę -s.",
"translation": "Ona pracuje w szpitalu."
},
{
"id": "p_read_001",
"category": "basic_reading",
"type": "true_false_ng",
"level": "podstawowy",
"instruction": "Przeczytaj tekst i zdecyduj TRUE/FALSE.",
"text": "Tom lives in London with his family.",
"question": "Tom lives in Paris.",
"options": ["A. TRUE", "B. FALSE"],
"answer": "B",
"explanation": "Tekst mówi, że Tom mieszka w Londynie.",
"translation": "Tom mieszka w Londynie z rodziną."
}
]
Pola zadania
Pole Typ Wymagane Opis
id string ✅ Unikalny identyfikator
category string ✅ ID kategorii (z categories.id)
type string ✅ Typ zadania
level string ✅ 'podstawowy' lub 'rozszerzony'
year number ❌ Rok matury
instruction string ❌ Instrukcja
text string ❌ Tekst do czytania/słuchania
question string ✅ Treść pytania
options array ❌ Opcje (dla multiple_choice)
answer string ✅ Poprawna odpowiedź
explanation string ❌ Wyjaśnienie
translation string ❌ Tłumaczenie na polski
Typy zadań
multiple_choice - wielokrotny wybór (wymaga options)

fill_blank - uzupełnianie luk (może wymagać blanks)

true_false_ng - prawda/fałsz/not given (wymaga options)

sentence_transform - transformacje zdań

essay - wypowiedź pisemna (esej)

email - e-mail

open_answer - odpowiedź otwarta

🧪 Rozwój projektu
Dodawanie nowych kategorii
Dodaj kategorię do tabeli categories

Dodaj wpis w obiekcie CATEGORIES w pliku HTML/JS

Utwórz zadania z odpowiednim category_id

Modyfikacja schematu bazy
Jeśli potrzebujesz dodać kolumnę do tabeli:

sql
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS new_column TEXT;
Środowisko deweloperskie
bash

# Uruchom lokalny serwer

python3 -m http.server 8000

# lub

npx live-server
👨‍💻 Autor
Projekt stworzony na potrzeby nauki języka angielskiego do matury.

Matura EN Trener - Twoja droga do zdanej matury z angielskiego! 🎓
