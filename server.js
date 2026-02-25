// server.js — Serwer proxy dla Neon PostgreSQL
// Uruchom: node server.js
// Wymagane pakiety: npm install express cors @neondatabase/serverless

const express = require('express');
const cors    = require('cors');
const { neon } = require('@neondatabase/serverless');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ✅ Poprawny connection string (host: agtpam3x, nie agtpm3x)
const sql = neon(
  'postgresql://neondb_owner:npg_w4bAGP3HiZYa@ep-old-moon-agtpam3x-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require'
);

app.post('/api/query', async (req, res) => {
  const { query, params } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Brak zapytania SQL' });
  }

  console.log('SQL:', query.substring(0, 80).replace(/\n/g, ' '));

  try {
    // neon() taguje template literals; dla dynamicznych zapytań używamy sql.query()
    const result = await sql.query(query, params ?? []);

    // neon zwraca obiekt { rows, fields, rowCount }
    // Wysyłamy tylko rows — frontend obsługuje tablicę bezpośrednio
    res.json(result.rows ?? result);
  } catch (err) {
    console.error('Błąd bazy:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serwer proxy działa na http://localhost:${PORT}`);
  console.log(`   Frontend łączy się z: http://localhost:${PORT}/api/query`);
});