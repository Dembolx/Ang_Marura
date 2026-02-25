# 🗄️ Instrukcja: Podłączenie projektu Matura EN do Neon PostgreSQL

## Krok 1 — Uruchomienie SQL w konsoli Neon

1. Otwórz konsolę Neon: `https://console.neon.tech`
2. Wybierz swój projekt i kliknij **SQL Editor**
3. Wgraj plik `matura_schema.sql` lub wklej całą jego zawartość
4. Kliknij **Run** (lub Ctrl+Enter)

> ✅ Powinna pojawić się informacja o sukcesie. Tabele zostaną utworzone:
>
> - `categories` — kategorie zadań
> - `exercises` — wszystkie zadania z bazą wiedzy
> - `user_progress` — postępy użytkownika
> - `session_history` — historia sesji
> - `user_streak` — seria dni

---

## Krok 2 — Włączenie REST API w Neon

Neon udostępnia REST API przez **Neon HTTP API** (PostgREST-style).

**Twój URL REST:**

```
https://ep-old-moon-agtpam3x.apirest.c-2.eu-central-1.aws.neon.tech/neondb/rest/v1
```

Sprawdź czy działa, wchodząc w przeglądarkę:

```
https://ep-old-moon-agtpam3x.apirest.c-2.eu-central-1.aws.neon.tech/neondb/rest/v1/categories
```

Powinnaś zobaczyć JSON z kategoriami.

---

## Krok 3 — Weryfikacja danych

Po wykonaniu SQL sprawdź czy dane są w bazie:

```sql
-- Liczba zadań
SELECT COUNT(*) FROM exercises;

-- Zadania wg kategorii
SELECT category_id, COUNT(*) FROM exercises GROUP BY category_id;

-- Kategorie
SELECT * FROM categories;
```

---

## Krok 4 — Otwórz plik HTML

Plik `matura_neon.html` to gotowy projekt z integracją.

1. Otwórz plik w przeglądarce (dwuklik lub drag & drop)
2. Na dole ekranu pojawi się wskaźnik połączenia:
   - 🟡 **Łączenie** — trwa nawiązywanie połączenia
   - 🟢 **Połączono** — wszystko działa
   - 🔴 **Błąd** — problem z połączeniem

---

## Krok 5 — Konfiguracja (jeśli potrzebna)

Kliknij przycisk **🗄️ Baza danych** w nawigacji.

Wypełnij pola:

- **API Base URL**: `https://ep-old-moon-agtpam3x.apirest.c-2.eu-central-1.aws.neon.tech/neondb/rest/v1`
- **API Key**: pozostaw puste (jeśli baza jest publiczna) lub wpisz token
- **User ID**: dowolny identyfikator, np. `jan` lub `default`

Kliknij **💾 Zapisz i połącz**, a następnie **🔌 Test połączenia**.

---

## Krok 6 — Jak działa integracja

| Akcja w aplikacji   | Zapytanie do Neon                                             |
| ------------------- | ------------------------------------------------------------- |
| Ładowanie kategorii | `GET /categories`                                             |
| Ładowanie zadań     | `GET /exercises?level=eq.rozszerzony`                         |
| Pobranie postępów   | `GET /user_progress?user_id=eq.{user}`                        |
| Zapis odpowiedzi    | `POST /user_progress` (upsert)                                |
| Zapis sesji         | `POST /session_history`                                       |
| Podgląd historii    | `GET /session_history?user_id=eq.{user}&order=played_at.desc` |
| Reset postępów      | `DELETE /user_progress?user_id=eq.{user}`                     |

---

## Krok 7 — Dodawanie nowych zadań

**Metoda 1: SQL Editor w Neon**

```sql
INSERT INTO exercises (id, category_id, type, year, instruction, question, options, answer, explanation, level)
VALUES (
  'moje-zadanie-001',
  'grammar',
  'sentence_transform',
  2024,
  'Uzupełnij drugie zdanie słowem kluczowym.',
  'She was too tired to cook. (ENOUGH)\nShe was not _______ cook.',
  NULL,
  'energetic enough to',
  'Too + adj → not + adj + enough + to-inf',
  'rozszerzony'
);
```

**Metoda 2: Przez API (fetch)**

```javascript
fetch(
  "https://ep-old-moon-agtpam3x.apirest.c-2.eu-central-1.aws.neon.tech/neondb/rest/v1/exercises",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "moje-zadanie-002",
      category_id: "reading",
      type: "multiple_choice",
      // ...
    }),
  },
);
```

---

## Rozwiązywanie problemów

### ❌ "CORS error" w przeglądarce

- Neon REST API może nie zezwalać na żądania z localhost.
- **Rozwiązanie**: Hostuj plik HTML na serwerze (np. GitHub Pages, Netlify, Vercel).

### ❌ "401 Unauthorized"

- Baza wymaga tokenu API.
- Pobierz go z: `Neon Console → Project → Settings → API Keys`
- Wpisz w polu **API Key** w konfiguracji aplikacji.

### ❌ "relation does not exist"

- Tabele nie zostały stworzone — wykonaj ponownie `matura_schema.sql`.

### ❌ Zadania się nie ładują

- Sprawdź czy URL REST jest poprawny.
- Wejdź bezpośrednio: `{URL}/exercises` w przeglądarce.

---

## Struktura plików

```
📁 Projekt
├── matura_neon.html      ← aplikacja z integracją Neon
├── matura_schema.sql     ← schemat bazy + dane wszystkich zadań
└── INSTRUKCJA.md         ← ten plik
```

---

## Typy zadań w bazie danych

| Typ (`type`)         | Opis                        | Pola                       |
| -------------------- | --------------------------- | -------------------------- |
| `multiple_choice`    | Wybór A/B/C/D               | `options` (JSON), `answer` |
| `true_false_ng`      | TRUE/FALSE/NOT GIVEN        | `options` (JSON), `answer` |
| `fill_blank`         | Uzupełnianie luk            | `blanks` (JSON), `text`    |
| `sentence_transform` | Transformacje (KEY WORD)    | `question`, `answer`       |
| `essay`              | Wypowiedź pisemna           | `question`                 |
| `email`              | E-mail formalny/nieformalny | `question`                 |

---

_Aplikacja zapisuje postępy automatycznie po każdej odpowiedzi._
_Wszystkie dane przechowywane są w Neon PostgreSQL na Twoim koncie._
