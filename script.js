import { neon } from 'https://esm.sh/@neondatabase/serverless@1.0.0';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_w4bAGP3HiZYa@ep-old-moon-agtpam3x-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const _db = neon(CONNECTION_STRING);

const CONFIG = {
  get user() { return localStorage.getItem('neon_user') || 'default'; },
};

async function sql(query, params = []) {
  const result = await _db.query(query, params);
  if (Array.isArray(result)) return result;
  return result.rows ?? result;
}

function setDBStatus(state, text) {
  const bar = document.getElementById('db-status-bar');
  const txt = document.getElementById('db-status-text');
  bar.className = state;
  txt.textContent = text;
}

// =====================================================
// STATE
// =====================================================
let exercises    = [];
let progress     = {};
let streak       = 0;
let currentLevel = localStorage.getItem('matura_level') || 'rozszerzony';
let answerHistory = []; // {exerciseId, isCorrect, userAnswer, timestamp}

const CATEGORIES = {
  // Rozszerzone
  reading:        { name:'Rozumienie Tekstów',   icon:'📖', color:'#4fc3f7', level:'rozszerzony' },
  grammar:        { name:'Gramatyka',             icon:'🔧', color:'#f06292', level:'rozszerzony' },
  vocabulary:     { name:'Słownictwo',            icon:'📚', color:'#a5d6a7', level:'rozszerzony' },
  use_of_english: { name:'Use of English',        icon:'⚙️', color:'#ffb74d', level:'rozszerzony' },
  writing:        { name:'Wypowiedź Pisemna',     icon:'✍️', color:'#ce93d8', level:'rozszerzony' },
  listening_text: { name:'Tekst Słuchany',        icon:'🎧', color:'#80cbc4', level:'rozszerzony' },
  
  // Podstawowe
  basic_grammar:    { name:'Gramatyka',           icon:'🔧', color:'#4caf50', level:'podstawowy' },
  basic_vocabulary: { name:'Słownictwo',          icon:'📖', color:'#26a69a', level:'podstawowy' },
  basic_reading:    { name:'Czytanie',            icon:'📰', color:'#42a5f5', level:'podstawowy' },
  basic_listening:  { name:'Słuchanie',           icon:'🎧', color:'#7e57c2', level:'podstawowy' },
  basic_writing:    { name:'Pisanie',              icon:'✍️', color:'#ef5350', level:'podstawowy' },
};

const SESSION = { exercises:[], current:0, correct:0, wrong:0, startTime:null, category:null, answered:false };

function setLevel(lvl) {
  currentLevel = lvl;
  localStorage.setItem('matura_level', lvl);
  document.getElementById('btn-lvl-r').className = lvl==='rozszerzony' ? 'active' : '';
  document.getElementById('btn-lvl-p').className = lvl==='podstawowy' ? 'active' : '';
  init();
}

// =====================================================
// INIT
// =====================================================
async function init() {
  setDBStatus('loading','Łączenie z bazą...');
  try {
    exercises = await sql('SELECT * FROM exercises WHERE level=$1 ORDER BY id',[currentLevel]);
    const prog = await sql('SELECT * FROM user_progress WHERE user_id=$1',[CONFIG.user]);
    progress = {};
    prog.forEach(p => { progress[p.exercise_id] = {attempts:p.attempts, correct:p.correct}; });

    try {
      const s = await sql('SELECT streak_count FROM user_streak WHERE user_id=$1',[CONFIG.user]);
      streak = s[0]?.streak_count || 0;
    } catch(e) { streak = 0; }

    // Load answer history from DB
    try {
      const h = await sql(`SELECT ah.*, e.question, e.answer, e.explanation, e.category_id, e.type
        FROM answer_history ah
        LEFT JOIN exercises e ON e.id = ah.exercise_id
        WHERE ah.user_id=$1 ORDER BY ah.answered_at DESC LIMIT 30`,[CONFIG.user]);
      answerHistory = h;
    } catch(e) {
      answerHistory = [];
    }

    setDBStatus('connected', `Połączono · ${exercises.length} zadań · ${currentLevel==='rozszerzony'?'PR':'PP'}`);
    renderHome();
  } catch(e) {
    setDBStatus('error','Błąd połączenia');
    showFallback(e.message);
  }
}

function showFallback(err) {
  document.getElementById('categories-grid').innerHTML = `
  <div style="grid-column:1/-1;background:rgba(239,83,80,.08);border:1px solid rgba(239,83,80,.25);border-radius:12px;padding:2rem;text-align:center">
    <div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>
    <div style="font-weight:600;color:var(--error);margin-bottom:.5rem">Brak połączenia z bazą</div>
    <div style="color:var(--text-muted);font-size:.85rem;margin-bottom:1rem">${err}</div>
    <button class="btn btn-primary" onclick="init()">🔄 Spróbuj ponownie</button>
  </div>`;
}

// =====================================================
// HOME
// =====================================================

// =====================================================
// HOME
// =====================================================
function renderHome() {
  const total = exercises.length;
  const done  = Object.keys(progress).length;
  const allAtt  = Object.values(progress).reduce((a,p)=>a+p.attempts,0);
  const allCorr = Object.values(progress).reduce((a,p)=>a+p.correct,0);
  const score = allAtt>0 ? Math.round(allCorr/allAtt*100) : 0;

  document.getElementById('stat-total').textContent  = total;
  document.getElementById('stat-done').textContent   = done;
  document.getElementById('stat-score').textContent  = score+'%';
  document.getElementById('stat-streak').textContent = streak;

  const grid = document.getElementById('categories-grid');
  grid.innerHTML = '';
  
  // Filtruj kategorie na podstawie wybranego poziomu
  const filteredCategories = Object.entries(CATEGORIES).filter(([key, cat]) => {
    // Dla poziomu rozszerzonego pokaż tylko kategorie bez prefiksu 'basic_'
    if (currentLevel === 'rozszerzony') {
      return !key.startsWith('basic_');
    } 
    // Dla poziomu podstawowego pokaż tylko kategorie z prefiksem 'basic_'
    else {
      return key.startsWith('basic_');
    }
  });

  if (filteredCategories.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem 0">
      <div style="font-size:2rem;margin-bottom:.5rem">📭</div>
      Brak kategorii dla poziomu ${currentLevel === 'rozszerzony' ? 'rozszerzonego' : 'podstawowego'}
    </div>`;
    return;
  }

  filteredCategories.forEach(([key, cat]) => {
    const catExs  = exercises.filter(e=>e.category_id===key);
    const catDone = catExs.filter(e=>progress[e.id]).length;
    const catAtt  = catExs.reduce((a,e)=>a+(progress[e.id]?.attempts||0),0);
    const catCorr = catExs.reduce((a,e)=>a+(progress[e.id]?.correct||0),0);
    const catScore= catAtt>0 ? Math.round(catCorr/catAtt*100) : 0;
    const pct     = catExs.length>0 ? Math.round(catDone/catExs.length*100) : 0;

    const card = document.createElement('div');
    card.className='cat-card'; card.style.setProperty('--cat-color',cat.color);
    card.innerHTML=`
      <div class="cat-icon">${cat.icon}</div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-desc">${catExs.length} zadań · ${currentLevel==='rozszerzony'?'Poziom rozszerzony':'Poziom podstawowy'}</div>
      <div class="cat-progress"><div class="cat-progress-fill" style="width:${pct}%;background:${cat.color}"></div></div>
      <div class="cat-stats">
        <span>${catDone}/${catExs.length} zrobionych</span>
        <span style="color:${catScore>=70?'var(--success)':catScore>=50?'var(--warn)':'var(--text-muted)'}">${catScore}% trafnych</span>
      </div>`;
    card.onclick=()=>startSession(key);
    grid.appendChild(card);
  });
}

// =====================================================
// SESSION & EXERCISES
// =====================================================
function startSession(category) {
  const all = exercises.filter(e=>e.category_id===category);
  if (!all.length) { alert('Brak zadań w tej kategorii dla poziomu ' + (currentLevel==='rozszerzony'?'rozszerzonego':'podstawowego') + '.'); return; }
  all.sort((a,b)=>{
    const pa=progress[a.id],pb=progress[b.id];
    if(!pa&&!pb) return 0; if(!pa) return -1; if(!pb) return 1;
    const ra=pa.attempts>0?pa.correct/pa.attempts:0, rb=pb.attempts>0?pb.correct/pb.attempts:0;
    return ra-rb;
  });
  Object.assign(SESSION,{exercises:all,current:0,correct:0,wrong:0,startTime:Date.now(),category,answered:false});
  showView('exercise');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('ex-cat-name').textContent = CATEGORIES[category]?.name||category;
  const lb = document.getElementById('ex-level-badge');
  if(lb){ lb.textContent=currentLevel==='rozszerzony'?'PR':'PP'; lb.className='level-badge '+(currentLevel==='rozszerzony'?'level-r':'level-p'); }
  renderExercise();
}

function renderExercise() {
  const ex = SESSION.exercises[SESSION.current];
  if (!ex) { showSessionResults(); return; }
  SESSION.answered = false;
  const total=SESSION.exercises.length, idx=SESSION.current+1;
  document.getElementById('ex-counter').textContent = idx+'/'+total;
  document.getElementById('ex-progress-fill').style.width = ((idx-1)/total*100)+'%';

  const TYPE_LABELS={multiple_choice:'Wielokrotny wybór',fill_blank:'Uzupełnij luki',true_false_ng:'Prawda / Fałsz / Brak',sentence_transform:'Transformacja zdań',essay:'Wypowiedź pisemna',email:'E-mail',open_answer:'Odpowiedź otwarta'};
  const options = ex.options ? (typeof ex.options==='string'?JSON.parse(ex.options):ex.options) : null;
  const blanks  = ex.blanks  ? (typeof ex.blanks==='string' ?JSON.parse(ex.blanks) :ex.blanks)  : null;

  // Build hint section for PP
  let hintHTML = '';
  if (currentLevel==='podstawowy') {
    hintHTML = `<div style="background:rgba(79,195,247,.06);border:1px solid rgba(79,195,247,.2);border-radius:8px;padding:.6rem .9rem;margin-bottom:1rem;font-size:.8rem;color:var(--accent2)">
      💡 <strong>Wskazówka:</strong> ${getTaskHint(ex.type, ex.category_id)}
    </div>`;
  }

  let inputHTML='';
  if(ex.type==='multiple_choice'||ex.type==='true_false_ng'){
    inputHTML='<div class="options">'+(options||[]).map((o,i)=>{
      const letter=String.fromCharCode(65+i);
      return `<button class="option-btn" onclick="checkOption(this,'${letter}','${ex.answer}')" data-letter="${letter}"><span class="opt-letter">${letter}</span>${o.replace(/^[A-D]\.\s*/,'')}</button>`;
    }).join('')+'</div>';
  } else if(ex.type==='fill_blank'&&blanks?.length){
    inputHTML='<div class="fill-blanks">'+blanks.map(b=>`
      <div class="blank-row">
        <span class="blank-num">${b.num}.</span>
        <input class="blank-input" type="text" id="blank-${b.num}" placeholder="${b.hint||'odpowiedź'}" autocomplete="off">
        <span class="blank-hint" id="blank-hint-${b.num}"></span>
      </div>`).join('')+'</div>';
  } else if(ex.type==='fill_blank'){
    inputHTML=`<input class="ex-input" type="text" id="single-input" placeholder="Wpisz odpowiedź..." autocomplete="off">`;
  } else if(ex.type==='sentence_transform'||ex.type==='open_answer'){
    inputHTML=`<input class="ex-input" type="text" id="single-input" placeholder="Wpisz odpowiedź (2–5 wyrazów)..." autocomplete="off">`;
  } else if(ex.type==='essay'||ex.type==='email'){
    inputHTML=`<textarea class="ex-input" id="essay-input" placeholder="Napisz swoją wypowiedź tutaj..."></textarea>`;
  }

  document.getElementById('exercise-area').innerHTML=`
  <div class="exercise-card">
    <span class="ex-type-badge">${TYPE_LABELS[ex.type]||ex.type}${ex.year?' · '+ex.year:''}</span>
    ${hintHTML}
    ${ex.instruction?`<div class="ex-instruction">${ex.instruction}</div>`:''}
    ${ex.text?`<div class="ex-text">${ex.text.replace(/\n/g,'<br>')}</div>`:''}
    <div class="ex-question">${(ex.question||'').replace(/\n/g,'<br>')}</div>
    ${inputHTML}
    <div class="feedback-box" id="feedback-box"></div>
    <div class="action-row">
      ${ex.type==='essay'||ex.type==='email'
        ?`<button class="btn btn-secondary" onclick="selfGrade(true)">✅ Poprawne</button>
           <button class="btn btn-secondary" onclick="selfGrade(false)" style="border-color:var(--error);color:var(--error)">❌ Do poprawy</button>`
        :`<button class="btn btn-primary" id="check-btn" onclick="checkAnswer()">Sprawdź</button>`}
      <button class="btn btn-secondary" id="next-btn" onclick="nextExercise()" style="display:none">Następne →</button>
    </div>
  </div>`;
}

function getTaskHint(type, cat) {
  const hints = {
    multiple_choice: 'Przeczytaj uważnie wszystkie opcje. Wyeliminuj błędne odpowiedzi.',
    true_false_ng: 'NOT GIVEN = informacja NIE POJAWIA SIĘ w tekście. Nie wnioskuj!',
    fill_blank: 'Sprawdź kontekst zdania. Zwróć uwagę na formę gramatyczną.',
    sentence_transform: 'Zmień formę, zachowaj znaczenie. Użyj 2–5 wyrazów z podanym słowem.',
    essay: 'Wstęp → 2 akapity z argumentami → zakończenie z własną opinią.',
    email: 'Formalny: Dear Sir/Madam, Yours faithfully. Nieformalny: Hi, Take care!'
  };
  return hints[type] || 'Przeczytaj uważnie pytanie i odpowiedz precyzyjnie.';
}

function checkOption(btn, letter, correct) {
  if(SESSION.answered) return;
  SESSION.answered=true;
  const ex=SESSION.exercises[SESSION.current];
  const isCorrect=letter===correct;
  document.querySelectorAll('.option-btn').forEach(b=>{
    b.disabled=true;
    if(b.dataset.letter===correct) b.classList.add('correct');
    if(b===btn&&!isCorrect) b.classList.add('wrong');
  });
  showFeedback(isCorrect,ex.explanation,correct,letter);
  recordResult(ex.id,isCorrect,letter);
  document.getElementById('next-btn').style.display='inline-flex';
}

function checkAnswer() {
  if(SESSION.answered) return;
  const ex=SESSION.exercises[SESSION.current];
  const blanks=ex.blanks?(typeof ex.blanks==='string'?JSON.parse(ex.blanks):ex.blanks):null;
  let isCorrect=false, userAnswer='';

  if(ex.type==='fill_blank'&&blanks?.length){
    let allOk=true;
    blanks.forEach(b=>{
      const inp=document.getElementById('blank-'+b.num);
      if(!inp) return;
      const ok=inp.value.trim().toLowerCase()===b.answer.toLowerCase();
      inp.classList.add(ok?'correct':'wrong');
      const hint=document.getElementById('blank-hint-'+b.num);
      if(hint) hint.textContent=ok?'✓':'✗ '+b.answer;
      if(!ok) allOk=false;
    });
    isCorrect=allOk;
    userAnswer=blanks.map(b=>document.getElementById('blank-'+b.num)?.value||'').join(' | ');
  } else {
    const inp=document.getElementById('single-input');
    if(inp){
      userAnswer=inp.value.trim();
      isCorrect=userAnswer.toLowerCase()===ex.answer?.toLowerCase();
      inp.classList.add(isCorrect?'correct':'wrong');
      inp.disabled=true;
    }
  }
  SESSION.answered=true;
  showFeedback(isCorrect,ex.explanation,ex.answer,userAnswer);
  recordResult(ex.id,isCorrect,userAnswer);
  const cb=document.getElementById('check-btn');
  if(cb) cb.style.display='none';
  document.getElementById('next-btn').style.display='inline-flex';
}

function selfGrade(passed) {
  SESSION.answered=true;
  const ex=SESSION.exercises[SESSION.current];
  showFeedback(passed,ex.explanation||'Oceń strukturę, spójność i poprawność językową.',null,passed?'correct':'incorrect');
  recordResult(ex.id,passed,passed?'self:correct':'self:incorrect');
  document.getElementById('next-btn').style.display='inline-flex';
}

function showFeedback(isCorrect,explanation,correct,userAnswer) {
  const fb=document.getElementById('feedback-box');
  fb.className='feedback-box '+(isCorrect?'correct':'wrong');
  fb.style.display='block';
  fb.innerHTML=`<strong>${isCorrect?'✅ Poprawnie!':'❌ Niepoprawnie'}</strong>
  ${!isCorrect&&correct?`<div>Poprawna odpowiedź: <strong>${correct}</strong>${userAnswer?` (Twoja: ${userAnswer})`:''}</div>`:''}
  ${explanation?`<div style="margin-top:.5rem;color:var(--text-muted);font-size:.88rem">${explanation}</div>`:''}`;
  if(isCorrect) SESSION.correct++; else SESSION.wrong++;
}

async function recordResult(exerciseId, isCorrect, userAnswer='') {
  const cur=progress[exerciseId]||{attempts:0,correct:0};
  const newAtt=cur.attempts+1, newCorr=cur.correct+(isCorrect?1:0);
  progress[exerciseId]={attempts:newAtt,correct:newCorr};

  // Save progress
  try {
    await sql(`INSERT INTO user_progress(user_id,exercise_id,attempts,correct,last_seen) VALUES($1,$2,$3,$4,NOW())
      ON CONFLICT(user_id,exercise_id) DO UPDATE SET attempts=$3,correct=$4,last_seen=NOW()`,
      [CONFIG.user,exerciseId,newAtt,newCorr]);
  } catch(e){ console.warn('progress:',e.message); }

  // Save to answer_history
  try {
    await sql(`INSERT INTO answer_history(user_id,exercise_id,is_correct,user_answer,answered_at)
      VALUES($1,$2,$3,$4,NOW())`,
      [CONFIG.user,exerciseId,isCorrect,String(userAnswer).substring(0,500)]);
  } catch(e){ console.warn('history:',e.message); }

  // Update streak
  try {
    const today=new Date().toISOString().slice(0,10);
    await sql(`INSERT INTO user_streak(user_id,last_date,streak_count) VALUES($1,$2,1)
      ON CONFLICT(user_id) DO UPDATE SET
        streak_count=CASE WHEN user_streak.last_date=($2::date-1) THEN user_streak.streak_count+1
          WHEN user_streak.last_date=$2::date THEN user_streak.streak_count ELSE 1 END,
        last_date=$2`,[CONFIG.user,today]);
  } catch(e){ console.warn('streak:',e.message); }

  // Add to local answerHistory for immediate display
  answerHistory.unshift({ exercise_id:exerciseId, is_correct:isCorrect, user_answer:String(userAnswer), answered_at:new Date().toISOString() });
  if(answerHistory.length>30) answerHistory.pop();
}

function nextExercise(){ SESSION.current++; renderExercise(); }
function endSession(){ showView('home'); renderHome(); }

function showSessionResults() {
  const elapsed=Math.round((Date.now()-SESSION.startTime)/1000);
  const mins=Math.floor(elapsed/60), secs=elapsed%60;
  const total=SESSION.correct+SESSION.wrong;
  const pct=total>0?Math.round(SESSION.correct/total*100):0;
  sql(`INSERT INTO session_history(user_id,category_id,score,total,duration_seconds,level) VALUES($1,$2,$3,$4,$5,$6)`,
    [CONFIG.user,SESSION.category,SESSION.correct,total,elapsed,currentLevel]).catch(()=>{});
  const scoreColor=pct>=70?'var(--success)':pct>=50?'var(--warn)':'var(--error)';
  const emoji=pct>=90?'🏆':pct>=70?'🎉':pct>=50?'💪':'📚';
  document.getElementById('exercise-area').innerHTML=`
  <div class="session-results">
    <div style="font-size:1.4rem">${emoji}</div>
    <div class="session-score" style="color:${scoreColor}">${pct}<span>%</span></div>
    <div style="color:var(--text-muted);margin-bottom:1.5rem">${CATEGORIES[SESSION.category]?.name||SESSION.category}</div>
    <div class="session-breakdown">
      <div class="sb-item"><div class="sb-val" style="color:var(--success)">${SESSION.correct}</div><div class="sb-lbl">Poprawnych</div></div>
      <div class="sb-item"><div class="sb-val" style="color:var(--error)">${SESSION.wrong}</div><div class="sb-lbl">Błędnych</div></div>
      <div class="sb-item"><div class="sb-val" style="color:var(--accent2)">${mins}m ${secs}s</div><div class="sb-lbl">Czas</div></div>
    </div>
    <div class="action-row" style="justify-content:center;gap:1rem;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="startSession('${SESSION.category}')">🔄 Ćwicz ponownie</button>
      <button class="btn btn-secondary" onclick="showView('history')">📋 Historia</button>
      <button class="btn btn-secondary" onclick="endSession()">← Kategorie</button>
    </div>
  </div>`;
}

// =====================================================
// HISTORIA ZADAŃ
// =====================================================
let historyFilter = 'all';

async function renderHistory() {
  const el=document.getElementById('history-list');
  el.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:2rem">Ładowanie...</div>';
  try {
    const h = await sql(`SELECT ah.*, e.question, e.answer, e.explanation, e.category_id, e.type, e.text
      FROM answer_history ah
      LEFT JOIN exercises e ON e.id = ah.exercise_id
      WHERE ah.user_id=$1 ORDER BY ah.answered_at DESC LIMIT 30`,[CONFIG.user]);
    answerHistory = h;
    renderHistoryList();
  } catch(e) {
    // table might not exist yet
    el.innerHTML=`<div style="color:var(--text-muted);text-align:center;padding:2rem">
      Historia niedostępna. Tabela answer_history może nie istnieć.<br>
      <small>Wykonaj zadanie — historia zacznie się zapełniać automatycznie.</small>
    </div>`;
  }
}

function filterHistory(f) {
  historyFilter=f;
  ['all','wrong','correct'].forEach(x=>{
    const btn=document.getElementById('hf-'+x);
    if(btn){ btn.style.borderColor=x===f?'var(--accent)':''; btn.style.color=x===f?'var(--accent)':''; }
  });
  renderHistoryList();
}

function renderHistoryList() {
  const el=document.getElementById('history-list');
  let items=answerHistory;
  if(historyFilter==='wrong')   items=items.filter(h=>!h.is_correct);
  if(historyFilter==='correct') items=items.filter(h=>h.is_correct);

  if(!items.length){
    el.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:3rem">Brak wyników dla wybranego filtra.<br>Zacznij ćwiczyć!</div>';
    return;
  }

  el.innerHTML = items.map(h=>{
    const d=new Date(h.answered_at);
    const dateStr=d.toLocaleDateString('pl-PL')+' '+d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
    const catName=CATEGORIES[h.category_id]?.name||h.category_id||'—';
    const catIcon=CATEGORIES[h.category_id]?.icon||'•';
    const q=(h.question||'').replace(/\n/g,' ').substring(0,120)+(h.question?.length>120?'...':'');
    const resultColor=h.is_correct?'var(--success)':'var(--error)';
    const resultText=h.is_correct?'✅ Poprawnie':'❌ Błędnie';
    const wrongInfo=!h.is_correct&&h.answer?`<div style="margin-top:.4rem;font-size:.82rem">
      Poprawna: <strong style="color:var(--success)">${h.answer}</strong>
      ${h.user_answer?` &nbsp;·&nbsp; Twoja: <strong style="color:var(--error)">${h.user_answer}</strong>`:''}
    </div>`:'';

    return `<div class="history-item ${h.is_correct?'correct-item':'wrong-item'}">
      <div class="hi-top">
        <span class="hi-id">${h.exercise_id||'—'} · ${catIcon} ${catName}</span>
        <span class="hi-result" style="color:${resultColor}">${resultText}</span>
      </div>
      <div class="hi-question">${q||'(brak pytania)'}</div>
      ${wrongInfo}
      ${h.explanation?`<details><summary>📖 Wyjaśnienie</summary><p>${h.explanation}</p></details>`:''}
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:.4rem">${dateStr}</div>
    </div>`;
  }).join('');
}

// =====================================================
// STATS VIEW
// =====================================================
async function renderStats() {
  const el=document.getElementById('stats-content');
  el.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:2rem">Ładowanie...</div>';
  try {
    const history=await sql('SELECT * FROM session_history WHERE user_id=$1 ORDER BY played_at DESC LIMIT 20',[CONFIG.user]);
    let html='<div style="font-family:\'Playfair Display\',serif;font-size:1.2rem;margin-bottom:1rem">Historia sesji</div>';
    if(!history.length){
      html+='<div style="color:var(--text-muted)">Brak historii. Zacznij ćwiczyć!</div>';
    } else {
      html+=`<table style="width:100%;border-collapse:collapse;font-size:.88rem">
        <thead><tr>${['Data','Kat.','Poziom','Wynik','%'].map(h=>
          `<th style="text-align:left;padding:.75rem 1rem;border-bottom:1px solid var(--border);color:var(--text-muted);font-family:'DM Mono',monospace;font-size:.75rem;text-transform:uppercase">${h}</th>`
        ).join('')}</tr></thead><tbody>`;
      history.forEach(h=>{
        const pct=h.total>0?Math.round(h.score/h.total*100):0;
        const cls=pct>=70?'var(--success)':pct>=50?'var(--warn)':'var(--error)';
        const lvlBadge=h.level==='rozszerzony'?'<span class="level-badge level-r">PR</span>':'<span class="level-badge level-p">PP</span>';
        html+=`<tr>
          <td style="padding:.75rem 1rem;border-bottom:1px solid rgba(42,45,58,.5)">${new Date(h.played_at).toLocaleDateString('pl-PL')}</td>
          <td style="padding:.75rem 1rem;border-bottom:1px solid rgba(42,45,58,.5)">${CATEGORIES[h.category_id]?.icon||''} ${CATEGORIES[h.category_id]?.name||h.category_id}</td>
          <td style="padding:.75rem 1rem;border-bottom:1px solid rgba(42,45,58,.5)">${lvlBadge}</td>
          <td style="padding:.75rem 1rem;border-bottom:1px solid rgba(42,45,58,.5)">${h.score}/${h.total}</td>
          <td style="padding:.75rem 1rem;border-bottom:1px solid rgba(42,45,58,.5);color:${cls};font-family:'DM Mono',monospace">${pct}%</td>
        </tr>`;
      });
      html+='</tbody></table>';
    }

    // Per-category bars
    html+='<div style="font-family:\'Playfair Display\',serif;font-size:1.2rem;margin:2rem 0 1rem">Wyniki wg kategorii</div>';
    Object.entries(CATEGORIES).forEach(([key,cat])=>{
      const catExs=exercises.filter(e=>e.category_id===key);
      const att=catExs.reduce((a,e)=>a+(progress[e.id]?.attempts||0),0);
      const corr=catExs.reduce((a,e)=>a+(progress[e.id]?.correct||0),0);
      const pct=att>0?Math.round(corr/att*100):0;
      html+=`<div style="display:flex;align-items:center;gap:1rem;margin-bottom:.75rem">
        <span style="min-width:180px;font-size:.85rem;color:var(--text-muted)">${cat.icon} ${cat.name}</span>
        <div style="flex:1;height:20px;background:var(--surface2);border-radius:6px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cat.color};border-radius:6px;transition:width .6s"></div>
        </div>
        <span style="font-family:'DM Mono',monospace;font-size:.82rem;min-width:40px;color:${pct>=70?'var(--success)':pct>=50?'var(--warn)':'var(--error)'}">${pct}%</span>
      </div>`;
    });
    el.innerHTML=html;
  } catch(e) {
    el.innerHTML=`<div style="color:var(--error)">Błąd: ${e.message}</div>`;
  }
}

// =====================================================
// TEORIA
// =====================================================
const THEORY_TOPICS = [
  { id:'tenses', icon:'⏰', title:'Czasy angielskie', desc:'Wszystkie 12 czasów z formami i przykładami', color:'#4fc3f7' },
  { id:'conditionals', icon:'🔀', title:'Okresy warunkowe', desc:'0, 1, 2, 3 i mieszane + inwersja', color:'#f06292' },
  { id:'passive', icon:'🔄', title:'Strona bierna', desc:'Passive voice we wszystkich czasach', color:'#a5d6a7' },
  { id:'reported', icon:'💬', title:'Mowa zależna', desc:'Reported speech — zasady i czasowniki', color:'#ffb74d' },
  { id:'modals', icon:'🎯', title:'Modals — czasowniki modalne', desc:'Must, should, could, may i perfect modals', color:'#ce93d8' },
  { id:'word_formation', icon:'🏗️', title:'Słowotwórstwo', desc:'Prefiksy, sufiksy, tworzenie wyrazów', color:'#80cbc4' },
  { id:'collocations', icon:'🔗', title:'Kolokacje i idiomy', desc:'Make/do/take/have + typowe wyrażenia', color:'#ffcc80' },
  { id:'linking', icon:'🧵', title:'Spójniki i łączniki', desc:'Contrast, cause, result, addition...', color:'#ef9a9a' },
  { id:'essay_writing', icon:'✍️', title:'Pisanie esejów', desc:'Struktura, zwroty, argumentacja', color:'#b39ddb' },
  { id:'email_writing', icon:'📧', title:'Pisanie e-maili', desc:'Formalny i nieformalny — szablony', color:'#80deea' },
  { id:'reading_hacks', icon:'📖', title:'Hacki do czytania', desc:'Strategia T/F/NG i multiple choice', color:'#e6ee9c' },
  { id:'exam_tips', icon:'🏆', title:'Taktyka na egzaminie', desc:'Jak nie stracić punktów — checklist', color:'#ffab91' },
];

const THEORY_CONTENT = {
  tenses: `
<h2>⏰ Czasy angielskie — Kompletny Przewodnik</h2>
<div class="hack">Na maturze najczęściej testowane: Present Perfect vs Past Simple, Past Perfect w 3rd conditional, Present Perfect Continuous vs Present Perfect Simple</div>

<h3>PRESENT SIMPLE</h3>
<p>Użycie: czynności regularne, prawdy ogólne, rozkłady. Tworzone: V (+ s/es dla he/she/it).</p>
<div class="example">I work every day. / She works in a hospital. / Water boils at 100°C.</div>

<h3>PRESENT CONTINUOUS</h3>
<p>Użycie: czynności teraz, plany na przyszłość, czynności tymczasowe.</p>
<div class="example">I am studying right now. / We are meeting tomorrow. / She is always complaining! (irytacja)</div>
<div class="hack">Stative verbs NIE używają continuous: know, believe, understand, want, love, have (posiadanie), see, smell, taste</div>

<h3>PRESENT PERFECT SIMPLE</h3>
<p>Użycie: czynności z efektem teraz, doświadczenia, niedawne zdarzenia. Signal words: already, yet, just, ever, never, recently, so far.</p>
<div class="example">I have just finished. / Have you ever been to Paris? / She hasn't called yet.</div>

<h3>PRESENT PERFECT CONTINUOUS</h3>
<p>Użycie: czynność trwała do teraz (nacisk na czas trwania). Signal: for, since, how long.</p>
<div class="example">I have been waiting for 2 hours. / She has been working here since 2020.</div>
<div class="hack">PPS = wynik ważny (I have painted the wall — ściana jest pomalowana) | PPC = czas trwania ważny (I have been painting — jestem zmęczony)</div>

<h3>PAST SIMPLE</h3>
<p>Użycie: zakończone czynności w przeszłości, czas określony. V2 (ed dla regularnych).</p>
<div class="example">She left yesterday. / We met in 2019. / I didn't sleep well.</div>

<h3>PAST CONTINUOUS</h3>
<p>Użycie: czynność w toku w pewnym momencie przeszłości, tło dla innej czynności.</p>
<div class="example">While I was sleeping, she called. / At 8pm we were having dinner.</div>

<h3>PAST PERFECT SIMPLE</h3>
<p>Użycie: czynność wcześniejsza od innej czynności w przeszłości (3rd conditional!).</p>
<div class="example">By the time I arrived, she had already left. / If I had studied, I would have passed.</div>

<h3>FUTURE — WILL vs GOING TO vs PRESENT CONTINUOUS</h3>
<table><tr><th>Czas</th><th>Użycie</th><th>Przykład</th></tr>
<tr><td>will</td><td>decyzja w tej chwili, obietnica, przepowiednia</td><td>I'll help you. It will rain.</td></tr>
<tr><td>going to</td><td>plan wcześniej podjęty, coś widoczne że nastąpi</td><td>I'm going to study medicine. Look — it's going to fall!</td></tr>
<tr><td>Present Continuous</td><td>aranżacja z innymi, plan z datą/godziną</td><td>I'm meeting Tom at 6pm tomorrow.</td></tr>
</table>

<h3>FUTURE PERFECT & FUTURE CONTINUOUS</h3>
<div class="example">By next year I will have graduated. (FP — zakończone przed momentem)
I will be working at 9pm. (FC — w toku o danej godzinie)</div>`,

  conditionals: `
<h2>🔀 Okresy Warunkowe — Zero do Mistrzowskiego</h2>
<div class="hack">Najczęściej na maturze: 3rd conditional (żal za przeszłością) i inwersja (Had I known..., Were it...)</div>

<h3>0 CONDITIONAL — ogólne prawdy</h3>
<div class="example">If + Present Simple → Present Simple
If you heat water to 100°C, it boils. / If it rains, the ground gets wet.</div>

<h3>1ST CONDITIONAL — realna możliwość</h3>
<div class="example">If + Present Simple → will + V
If I study hard, I will pass. / If she calls, I'll tell her.</div>

<h3>2ND CONDITIONAL — nierealna/mało prawdopodobna</h3>
<div class="example">If + Past Simple → would + V
If I were rich, I would travel the world. / If she had a car, she would drive to work.</div>
<div class="hack">Po "if" zawsze "were" (nie was) — nawet dla I/he/she: "If I WERE you..."</div>

<h3>3RD CONDITIONAL — niemożliwa (przeszłość)</h3>
<div class="example">If + Past Perfect → would have + Past Participle
If I had studied, I would have passed. / If she hadn't left, we would have met.</div>

<h3>MIESZANE (Mixed Conditional)</h3>
<div class="example">If I had studied medicine (past), I would be a doctor now (present).
Przeszłość → efekt teraz</div>

<h3>INWERSJA — bez "if"</h3>
<table><tr><th>Zwykłe</th><th>Inwersja</th></tr>
<tr><td>If I had known</td><td>Had I known</td></tr>
<tr><td>If I were you</td><td>Were I you</td></tr>
<tr><td>If it should happen</td><td>Should it happen</td></tr>
</table>
<div class="hack">Inwersja = warunkowe + bardziej formalne/literackie. Na maturze: "Had I known he was ill, I would have visited him."</div>

<h3>UNLESS, PROVIDED THAT, AS LONG AS</h3>
<div class="example">Unless = if...not: Unless you leave now, you'll miss the train.
Provided/As long as = pod warunkiem że: I'll help you provided you keep it secret.</div>`,

  passive: `
<h2>🔄 Strona Bierna — Passive Voice</h2>
<div class="hack">Tworzenie: odpowiednia forma BE + Past Participle. Podmiot zdania czynnego = "by + agent" (opcjonalnie)</div>

<h3>TABELA WSZYSTKICH CZASÓW</h3>
<table><tr><th>Czas</th><th>Aktywna</th><th>Bierna</th></tr>
<tr><td>Pres. Simple</td><td>They build it</td><td>It is built</td></tr>
<tr><td>Pres. Continuous</td><td>They are building it</td><td>It is being built</td></tr>
<tr><td>Pres. Perfect</td><td>They have built it</td><td>It has been built</td></tr>
<tr><td>Past Simple</td><td>They built it</td><td>It was built</td></tr>
<tr><td>Past Continuous</td><td>They were building it</td><td>It was being built</td></tr>
<tr><td>Past Perfect</td><td>They had built it</td><td>It had been built</td></tr>
<tr><td>Future Simple</td><td>They will build it</td><td>It will be built</td></tr>
<tr><td>Modal</td><td>They must build it</td><td>It must be built</td></tr>
<tr><td>Modal Perfect</td><td>They must have built it</td><td>It must have been built</td></tr>
</table>

<h3>PASYWNE KONSTRUKCJE REPORTINGOWE</h3>
<p>Bardzo często na maturze! Schemat: It is said that... → He is said to V...</p>
<div class="example">People believe that he stole the money.
→ It is believed that he stole the money.
→ He is believed to have stolen the money.

People say he is a genius.
→ He is said to be a genius.</div>
<div class="hack">Czasowniki: say, believe, think, report, claim, know, expect, suppose, allege + to be / to have done</div>

<h3>PHRASAL VERBS W STRONIE BIERNEJ</h3>
<div class="example">Someone broke into the office. → The office was broken into.
They looked after the children. → The children were looked after.</div>
<div class="hack">Phrasal verb traktuj jako całość — nie rozdzielaj!</div>`,

  reported: `
<h2>💬 Mowa Zależna — Reported Speech</h2>
<div class="hack">Kluczowe: backshift czasów + zmiana zaimków + zmiana wyrażeń czasu</div>

<h3>BACKSHIFT CZASÓW</h3>
<table><tr><th>Mowa niezależna</th><th>Mowa zależna</th></tr>
<tr><td>Present Simple</td><td>Past Simple</td></tr>
<tr><td>Present Continuous</td><td>Past Continuous</td></tr>
<tr><td>Present Perfect</td><td>Past Perfect</td></tr>
<tr><td>Past Simple</td><td>Past Perfect</td></tr>
<tr><td>will</td><td>would</td></tr>
<tr><td>can</td><td>could</td></tr>
<tr><td>may</td><td>might</td></tr>
<tr><td>must</td><td>had to / must (nakaz zewnętrzny)</td></tr>
</table>

<h3>CZASOWNIKI REPORTING + WZORZEC</h3>
<table><tr><th>Wzorzec</th><th>Czasowniki</th></tr>
<tr><td>+ to-inf</td><td>agree, offer, refuse, promise, threaten, decide</td></tr>
<tr><td>sb + to-inf</td><td>tell, ask, warn, advise, invite, order, encourage, remind</td></tr>
<tr><td>+ gerund / that</td><td>admit, deny, suggest, recommend</td></tr>
<tr><td>sb + that</td><td>inform, remind, warn, promise, assure</td></tr>
</table>
<div class="example">"Don't touch anything!" → The professor warned us not to touch anything.
"Why don't you take a break?" → His colleague suggested (that) he take/should take a break.
"I didn't do it." → She denied doing it / denied that she had done it.</div>

<h3>ZMIANY WYRAŻEŃ CZASU</h3>
<div class="example">now → then | today → that day | yesterday → the day before
tomorrow → the next day | last week → the week before | here → there</div>`,

  modals: `
<h2>🎯 Czasowniki Modalne</h2>
<div class="hack">Modal perfect (modal + have + PP) = ocena, dedukcja lub żal dotyczący PRZESZŁOŚCI</div>

<h3>PRESENT / FUTURE MODALS</h3>
<table><tr><th>Modal</th><th>Znaczenie</th><th>Przykład</th></tr>
<tr><td>must</td><td>obowiązek, dedukcja (+)</td><td>You must study. / He must be tired.</td></tr>
<tr><td>mustn't</td><td>zakaz</td><td>You mustn't smoke here.</td></tr>
<tr><td>don't have to</td><td>brak obowiązku</td><td>You don't have to come.</td></tr>
<tr><td>should/ought to</td><td>rada, powinność</td><td>You should see a doctor.</td></tr>
<tr><td>can/could</td><td>umiejętność, możliwość, prośba</td><td>Can you help? / Could you...? (grzeczniej)</td></tr>
<tr><td>may/might</td><td>możliwość (may=50%, might=30%)</td><td>It may rain. / She might be late.</td></tr>
<tr><td>would rather</td><td>wolenie</td><td>I'd rather stay home.</td></tr>
<tr><td>had better</td><td>rada z ostrzeżeniem</td><td>You'd better leave now.</td></tr>
</table>

<h3>MODAL PERFECT — o PRZESZŁOŚCI</h3>
<table><tr><th>Modal</th><th>Znaczenie</th><th>Przykład</th></tr>
<tr><td>must have done</td><td>pewna dedukcja (+)</td><td>He must have left already.</td></tr>
<tr><td>can't have done</td><td>pewna dedukcja (-)</td><td>She can't have said that.</td></tr>
<tr><td>may/might have done</td><td>możliwość</td><td>They may have missed the bus.</td></tr>
<tr><td>should have done</td><td>krytyka — powinieneś był</td><td>You should have called me.</td></tr>
<tr><td>shouldn't have done</td><td>krytyka — nie powinieneś był</td><td>He shouldn't have said that.</td></tr>
<tr><td>needn't have done</td><td>niepotrzebne działanie</td><td>You needn't have bought flowers.</td></tr>
<tr><td>could have done</td><td>możliwość nierealizowana</td><td>She could have won if she had tried.</td></tr>
</table>`,

  word_formation: `
<h2>🏗️ Słowotwórstwo — Word Formation</h2>
<div class="hack">Naucz się grup sufiksów na pamięć. Na maturze ZAWSZE jest Word Formation — przeważnie 4 wyrazy pochodne.</div>

<h3>SUFIKSY — RZECZOWNIKI</h3>
<div class="example">-tion/-sion: information, decision, education, pollution
-ment: government, employment, achievement, improvement
-ness: happiness, weakness, awareness, consciousness
-ity: ability, possibility, creativity, equality
-ance/-ence: importance, intelligence, difference, performance
-er/-or: teacher, actor, visitor, employer
-ist: scientist, journalist, pianist
-ism: capitalism, racism, criticism
-ship: friendship, leadership, relationship</div>

<h3>SUFIKSY — PRZYMIOTNIKI</h3>
<div class="example">-ful: beautiful, careful, helpful, successful
-less: careless, useless, homeless, hopeless
-ous/-ious: dangerous, famous, mysterious, ambitious
-al/-ial: national, financial, industrial
-ic: scientific, historic, economic
-ive: creative, attractive, competitive
-able/-ible: comfortable, responsible, reliable
-ing/-ed: interesting/interested, boring/bored (czynny/bierny!)</div>

<h3>PREFIKSY</h3>
<table><tr><th>Prefiks</th><th>Znaczenie</th><th>Przykłady</th></tr>
<tr><td>un-</td><td>nie-</td><td>unhappy, unusual, unexpected, unconvinced</td></tr>
<tr><td>in-/im-/ir-/il-</td><td>nie-</td><td>incorrect, impossible, irregular, illegal</td></tr>
<tr><td>dis-</td><td>przeciwieństwo</td><td>disagree, dishonest, disappear</td></tr>
<tr><td>mis-</td><td>źle</td><td>misunderstand, mislead, misuse</td></tr>
<tr><td>over-</td><td>za dużo</td><td>overweight, overlook, overestimate</td></tr>
<tr><td>under-</td><td>za mało</td><td>underestimate, underpaid, undermine</td></tr>
<tr><td>re-</td><td>ponownie</td><td>rewrite, rebuild, reconsider</td></tr>
<tr><td>pre-</td><td>przed</td><td>preview, prehistoric, preoccupied</td></tr>
</table>

<h3>SUFIKSY — PRZYSŁÓWKI I CZASOWNIKI</h3>
<div class="example">Przysłówki: adjective + -ly: quickly, carefully, surprisingly
Czasowniki: -ify: simplify, clarify, modify | -ize/-ise: organize, realize, emphasize
-en: widen, strengthen, deepen, sharpen</div>`,

  collocations: `
<h2>🔗 Kolokacje i Wyrażenia Stałe</h2>
<div class="hack">Make/do/take/have — najczęstsze pomyłki na maturze. Ucz się całych wyrażeń, nie pojedynczych słów!</div>

<h3>MAKE vs DO</h3>
<table><tr><th>MAKE (tworzyć, produkować)</th><th>DO (czynność, praca)</th></tr>
<tr><td>make a decision / mistake / effort</td><td>do homework / research / damage</td></tr>
<tr><td>make progress / an impression</td><td>do your best / a favour</td></tr>
<tr><td>make a complaint / suggestion</td><td>do business / an exercise</td></tr>
<tr><td>make friends / money / a profit</td><td>do the dishes / shopping / cleaning</td></tr>
<tr><td>make up your mind</td><td>do well / badly / without</td></tr>
</table>

<h3>TAKE</h3>
<div class="example">take a risk / chance / break / photo / exam / responsibility
take part in / place / advantage of / care of
take sb by surprise / into account / for granted</div>

<h3>HAVE</h3>
<div class="example">have a look / rest / shower / argument / conversation
have an impact / influence / effect on
have difficulty doing sth / trouble doing sth</div>

<h3>PHRASAL VERBS — NAJWAŻNIEJSZE</h3>
<table><tr><th>Phrasal verb</th><th>Znaczenie</th></tr>
<tr><td>bring up</td><td>wychować / poruszyć temat</td></tr>
<tr><td>call off</td><td>odwołać</td></tr>
<tr><td>come across</td><td>natknąć się na</td></tr>
<tr><td>give up</td><td>poddać się / rzucić</td></tr>
<tr><td>look into</td><td>zbadać, dochodzić</td></tr>
<tr><td>make up</td><td>wymyślić / pogodzić się</td></tr>
<tr><td>put off</td><td>odłożyć na później</td></tr>
<tr><td>set up</td><td>założyć (firmę)</td></tr>
<tr><td>take over</td><td>przejąć kontrolę</td></tr>
<tr><td>turn down</td><td>odrzucić (propozycję)</td></tr>
<tr><td>usher in</td><td>zapoczątkować</td></tr>
<tr><td>spark off</td><td>wywołać, zainicjować</td></tr>
</table>`,

  linking: `
<h2>🧵 Spójniki i Wyrażenia Łączące</h2>
<div class="hack">Różnorodność spójników = wyższy wynik za writing. Nie używaj ciągle "because" i "but"!</div>

<h3>CONTRAST (kontrast)</h3>
<div class="example">but, however, nevertheless, nonetheless, yet, still
Although / Even though + clause: Although she was tired, she continued.
Despite / In spite of + noun/gerund: Despite being tired, she continued.
while, whereas: While cities grew, rural areas declined.</div>

<h3>CAUSE & REASON (przyczyna)</h3>
<div class="example">because, since, as, due to, owing to, because of
as a result of, on account of, given that</div>

<h3>RESULT & CONSEQUENCE (skutek)</h3>
<div class="example">so, therefore, consequently, as a result, hence, thus
so...that, such...that: It was so cold that we couldn't go out.</div>

<h3>ADDITION (dodanie)</h3>
<div class="example">furthermore, moreover, in addition, besides, what is more
not only...but also, as well as, both...and</div>

<h3>EXEMPLIFICATION (przykłady)</h3>
<div class="example">for example, for instance, such as, namely, including</div>

<h3>CONCESSION (ustępstwo)</h3>
<div class="example">admittedly, granted, it is true that...however
even if, even though, regardless of</div>

<h3>CONDITION</h3>
<div class="example">if, unless, provided that, as long as, on condition that
given that, in case, suppose/supposing</div>`,

  essay_writing: `
<h2>✍️ Pisanie Esejów — Strategia i Zwroty</h2>
<div class="hack">Struktura: WSTĘP (teza) → ARGUMENT ZA → ARGUMENT PRZECIW → KONTRARGUMENT → ZAKOŃCZENIE (opinia)</div>

<h3>STRUKTURA ESEJU (200–250 słów)</h3>
<div class="example">§1 WSTĘP (2-3 zdania): Wprowadź temat, sformułuj tezę
§2 ARGUMENT ZA (4-5 zdań): główny argument + rozwinięcie + przykład
§3 ARGUMENT PRZECIW (4-5 zdań): kontrargument + rozwinięcie
§4 ZAKOŃCZENIE (2-3 zdania): podsumowanie + własna opinia</div>

<h3>ZWROTY — WSTĘP</h3>
<div class="example">The question of whether... has long been debated.
In recent years, the issue of... has gained increasing attention.
It is widely believed that... / Many people argue that...
This essay will examine both sides of the argument regarding...</div>

<h3>ZWROTY — ARGUMENTY</h3>
<div class="example">First and foremost, / To begin with, / One of the main arguments in favour...
Furthermore, / Moreover, / In addition to this, / What is more,
On the other hand, / However, / Conversely, / By contrast,
It could be argued that... / Critics of this view point out that...</div>

<h3>ZWROTY — WŁASNA OPINIA</h3>
<div class="example">In my view, / In my opinion, / From my perspective,
I firmly believe that... / I am convinced that...
Taking everything into consideration, / All things considered,
On balance, I would argue that...</div>

<h3>ZAKOŃCZENIE</h3>
<div class="example">To sum up, / In conclusion, / To conclude,
Having considered both sides, I believe...
While there are valid arguments on both sides, ultimately...</div>

<h3>SŁOWNICTWO DO ESEJÓW (unikaj powtórzeń)</h3>
<table><tr><th>Zamiast</th><th>Użyj</th></tr>
<tr><td>good</td><td>beneficial, advantageous, positive, favourable</td></tr>
<tr><td>bad</td><td>detrimental, harmful, negative, adverse</td></tr>
<tr><td>big</td><td>significant, substantial, considerable, major</td></tr>
<tr><td>show</td><td>demonstrate, reveal, indicate, highlight</td></tr>
<tr><td>help</td><td>facilitate, enable, assist, support</td></tr>
<tr><td>think</td><td>argue, contend, maintain, assert, claim</td></tr>
</table>`,

  email_writing: `
<h2>📧 Pisanie E-maili — Szablony</h2>
<div class="hack">Najczęstszy błąd: mieszanie stylu formalnego z nieformalnym. Decyduj na początku i trzymaj się konsekwentnie!</div>

<h3>E-MAIL FORMALNY</h3>
<div class="example">NAGŁÓWEK:
Dear Mr/Ms [Nazwisko],
Dear Sir or Madam, (gdy nie znamy nazwiska)
Dear Hiring Manager, (aplikacja o pracę)

OTWARCIE:
I am writing to... (apply for / enquire about / express my concern regarding / complain about)
I am contacting you in connection with...
With reference to your advertisement / your email of [date]...

ZAKOŃCZENIE:
I look forward to hearing from you.
I would be grateful if you could...
Please do not hesitate to contact me should you require any further information.

FORMUŁA KOŃCOWA:
Yours sincerely, [gdy znamy nazwisko]
Yours faithfully, [gdy pisaliśmy Dear Sir/Madam]</div>

<h3>E-MAIL NIEFORMALNY</h3>
<div class="example">NAGŁÓWEK:
Hi [Imię]! / Hey [Imię], / Dear [Imię],

OTWARCIE:
Thanks so much for your email! / Great to hear from you!
How are things? / I hope you're doing well!
I'm writing because... / I just wanted to let you know that...

PYTANIA (3 punkty zadania = 3 pytania!):
I was wondering if... / Could you let me know...?
What would you recommend...? / Do you think...?

ZAKOŃCZENIE:
Can't wait to hear from you! / Drop me a line soon!
Let me know what you think! / Hope to hear from you soon!
Take care, / Best wishes, / Lots of love,</div>

<h3>APLIKACJA O PRACĘ</h3>
<div class="example">I am writing to apply for the position of [stanowisko] as advertised in [źródło].
I have [X years of] experience in... / I am currently studying...
I am particularly interested in this role because...
I am a motivated / dedicated / enthusiastic [przymiotnik] individual who...
I am available for interview at your earliest convenience.
I have attached my CV for your consideration.</div>`,

  reading_hacks: `
<h2>📖 Hacki do Zadań Czytania</h2>
<div class="hack">Przeczytaj PYTANIA zanim przeczytasz tekst. Zakreśl kluczowe słowa w pytaniach!</div>

<h3>TRUE / FALSE / NOT GIVEN — STRATEGIA</h3>
<div class="example">TRUE   = informacja JEST w tekście i potwierdza zdanie
FALSE  = informacja JEST w tekście i ZAPRZECZA zdaniu
NOT GIVEN = informacja NIE POJAWIA SIĘ w tekście</div>
<div class="hack">NOT GIVEN ≠ False! Nie wnioskuj, nie domyślaj się. Jeśli tekst nie wspomina → NOT GIVEN</div>

<p><strong>Pułapki NG:</strong></p>
<ul>
<li>Zdanie używa logiki zdroworozsądkowej, ale tekst tego nie stwierdza</li>
<li>Zdanie mówi o czymś powiązanym, ale nie tożsamym z tekstem</li>
<li>Tekst mówi A, zdanie mówi B (które logicznie wynikałoby z A, ale nie jest powiedziane)</li>
</ul>

<h3>MULTIPLE CHOICE — STRATEGIA</h3>
<ul>
<li>Znajdź fragment w tekście odpowiadający każdemu pytaniu</li>
<li>Wyeliminuj 2 błędne odpowiedzi (za mocne stwierdzenia, fakty niezgodne)</li>
<li>Parafrazuj — poprawna odpowiedź to zazwyczaj parafraz tekstu, nie dosłowny cytat</li>
<li>Uważaj na DISTRAKTORY: słowa z tekstu, które brzmią dobrze, ale są w złym kontekście</li>
</ul>

<h3>TYPOWE PUŁAPKI W OPCJACH</h3>
<div class="example">❌ "always", "never", "all", "only" — zazwyczaj błędne (za mocne)
❌ Opcja brana z zupełnie innej części tekstu
❌ Opcja zawiera słowa z tekstu, ale zmienia sens
✅ Synonim lub parafraza zdania z tekstu = zazwyczaj poprawna</div>`,

  exam_tips: `
<h2>🏆 Taktyka na Egzaminie — Checklist</h2>

<h3>PRZED EGZAMINEM</h3>
<ul>
<li>✅ Przejrzyj najczęstsze struktury gramatyczne (transformacje)</li>
<li>✅ Naucz się szablonów email formalny/nieformalny + essay</li>
<li>✅ Powtórz prefiksy/sufiksy i kolokacje</li>
<li>✅ Przećwicz T/F/NG na tekstach — strategia czytania</li>
</ul>

<h3>PODCZAS EGZAMINU — ROZUMIENIE TEKSTÓW</h3>
<ul>
<li>Przeczytaj pytania PRZED tekstem — zakreśl kluczowe słowa</li>
<li>Pierwsze czytanie szybkie — ogólne zrozumienie</li>
<li>Drugie czytanie — szukaj fragmentów odpowiadających pytaniom</li>
<li>T/F/NG: nie zgaduj, znajdź DOWÓD w tekście</li>
</ul>

<h3>TRANSFORMACJE ZDAŃ — HACKS</h3>
<div class="example">so...that → too...to / such...that
although + clause → despite + gerund
it's the first time → Present Perfect
last time + Past Simple → Present Perfect + since/for
active → passive (zwróć uwagę na czas)
wish/if only + Past Perfect → żal za przeszłością</div>

<h3>PISANIE — CHECKLIST PRZED ODDANIEM</h3>
<ul>
<li>✅ Czy napisałem odpowiednią liczbę słów? (esej 200–250, email 150–200)</li>
<li>✅ Czy mam wstęp, rozwinięcie i zakończenie?</li>
<li>✅ Czy użyłem różnorodnych czasów i struktur?</li>
<li>✅ Czy użyłem spójników (however, moreover, despite)?</li>
<li>✅ Czy nie powtarzam tych samych słów?</li>
<li>✅ Czy email ma odpowiedni nagłówek i formułę końcową?</li>
</ul>

<h3>PUNKTACJA — CO OCENIAJĄ EGZAMINATORZY</h3>
<table><tr><th>Kryterium</th><th>Opis</th></tr>
<tr><td>Treść</td><td>Czy odpowiedź na temat? Wszystkie punkty z polecenia?</td></tr>
<tr><td>Spójność</td><td>Logika, łączniki, akapity</td></tr>
<tr><td>Zakres językowy</td><td>Bogactwo słownictwa, różnorodność struktur</td></tr>
<tr><td>Poprawność</td><td>Gramatyka, interpunkcja, ortografia</td></tr>
</table>

<h3>NAJCZĘSTSZE BŁĘDY NA MATURZE</h3>
<div class="example">❌ Mieszanie styli (formalny + nieformalny w jednym emailu)
❌ Za krótkie odpowiedzi (poniżej minimum słów)
❌ Powtarzanie "very", "good", "bad", "because"
❌ Nie odpowiadanie na wszystkie punkty w poleceniu
❌ Brak akapitów w wypowiedzi pisemnej</div>`
};

function renderTheoryGrid() {
  const grid = document.getElementById('theory-grid');
  grid.innerHTML = THEORY_TOPICS.map(t=>`
    <div class="theory-card" style="--cat-color:${t.color}" onclick="openTheory('${t.id}')">
      <div class="t-icon">${t.icon}</div>
      <div class="t-title">${t.title}</div>
      <div class="t-desc">${t.desc}</div>
    </div>`).join('');
}

function openTheory(id) {
  const content = THEORY_CONTENT[id];
  if(!content) return;
  document.getElementById('theory-grid-wrap').style.display='none';
  const wrap=document.getElementById('theory-article-wrap');
  wrap.style.display='block';
  document.getElementById('theory-article').innerHTML=content;
}

function closeTheory() {
  document.getElementById('theory-grid-wrap').style.display='block';
  document.getElementById('theory-article-wrap').style.display='none';
}

// =====================================================
// IMPORT JSON
// =====================================================
let importData=[];

function toggleJSONPaste(){
  const t=document.getElementById('json-paste');
  t.style.display=t.style.display==='none'?'block':'none';
}

function loadJSONFile(event){
  const file=event.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=(e)=>{ try{ importData=JSON.parse(e.target.result); if(!Array.isArray(importData)) importData=[importData]; renderImportPreview(); }catch(err){ alert('Błąd JSON: '+err.message); } };
  reader.readAsText(file);
}

function parseJSONPaste(){
  const val=document.getElementById('json-paste').value.trim(); if(!val) return;
  try{ importData=JSON.parse(val); if(!Array.isArray(importData)) importData=[importData]; renderImportPreview(); }catch(e){}
}

function clearImport(){
  importData=[];
  document.getElementById('import-preview').style.display='none';
  document.getElementById('import-action').style.display='none';
  document.getElementById('push-log').innerHTML='';
  document.getElementById('json-paste').value='';
  document.getElementById('json-file-input').value='';
}

async function renderImportPreview(){
  const preview=document.getElementById('import-preview'), action=document.getElementById('import-action');
  if(!importData.length){ preview.style.display='none'; action.style.display='none'; return; }
  let existingIds=new Set();
  try{ const rows=await sql('SELECT id FROM exercises'); rows.forEach(r=>existingIds.add(r.id)); }catch(e){}
  const newItems=importData.filter(e=>!existingIds.has(e.id));
  const catCounts={};
  importData.forEach(e=>{ const cat=e.category||'?'; catCounts[cat]=(catCounts[cat]||0)+1; });
  document.getElementById('import-summary').textContent=
    'Łącznie: '+importData.length+' zadań\nNowe: '+newItems.length+'  Duplikaty: '+(importData.length-newItems.length)+
    '\n\nKategorie:\n'+Object.entries(catCounts).map(([k,v])=>'  '+(CATEGORIES[k]?.icon||'•')+' '+k+': '+v).join('\n');
  let tbl='<table style="width:100%;border-collapse:collapse;font-size:.78rem"><thead><tr>'+
    ['ID','Kategoria','Typ','Rok','Poziom','Status'].map(h=>'<th style="text-align:left;padding:.4rem .75rem;border-bottom:1px solid var(--border);color:var(--text-muted)">'+h+'</th>').join('')+
    '</tr></thead><tbody>';
  importData.slice(0,60).forEach(e=>{
    const isDup=existingIds.has(e.id);
    tbl+='<tr style="opacity:'+(isDup?.6:1)+'">'+
      '<td style="padding:.35rem .75rem;border-bottom:1px solid rgba(42,45,58,.4);font-family:\'DM Mono\',monospace;color:var(--accent2)">'+e.id+'</td>'+
      '<td style="padding:.35rem .75rem;border-bottom:1px solid rgba(42,45,58,.4)">'+(e.category||'—')+'</td>'+
      '<td style="padding:.35rem .75rem;border-bottom:1px solid rgba(42,45,58,.4);color:var(--text-muted)">'+(e.type||'—')+'</td>'+
      '<td style="padding:.35rem .75rem;border-bottom:1px solid rgba(42,45,58,.4);color:var(--text-muted)">'+(e.year||'—')+'</td>'+
      '<td style="padding:.35rem .75rem;border-bottom:1px solid rgba(42,45,58,.4)">'+(e.level||'rozszerzony')+'</td>'+
      '<td style="padding:.35rem .75rem;border-bottom:1px solid rgba(42,45,58,.4);color:'+(isDup?'var(--warn)':'var(--success)')+'">'+( isDup?'duplikat':'nowe')+'</td>'+
      '</tr>';
  });
  if(importData.length>60) tbl+='<tr><td colspan="6" style="padding:.5rem .75rem;color:var(--text-muted)">...i '+(importData.length-60)+' więcej</td></tr>';
  tbl+='</tbody></table>';
  document.getElementById('import-table-wrap').innerHTML=tbl;
  preview.style.display='block'; action.style.display='block';
  document.getElementById('push-log').innerHTML='';
}

async function pushToDB(){
  const skipDups=document.getElementById('skip-duplicates').checked;
  const btn=document.getElementById('push-btn'); btn.disabled=true; btn.textContent='⏳ Importuję...';
  let inserted=0,errors=0;
  logPush('🚀 Importuję '+importData.length+' zadań...','info');
  for(let i=0;i<importData.length;i++){
    const e=importData[i];
    const conflict=skipDups?'ON CONFLICT(id) DO NOTHING':
      'ON CONFLICT(id) DO UPDATE SET category_id=EXCLUDED.category_id,level=EXCLUDED.level,type=EXCLUDED.type,year=EXCLUDED.year,instruction=EXCLUDED.instruction,text=EXCLUDED.text,question=EXCLUDED.question,answer=EXCLUDED.answer,explanation=EXCLUDED.explanation,options=EXCLUDED.options,blanks=EXCLUDED.blanks';
    try{
      await sql('INSERT INTO exercises(id,category_id,level,type,year,instruction,text,question,answer,explanation,options,blanks) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) '+conflict,
        [e.id,e.category||null,e.level||'rozszerzony',e.type||null,e.year||null,e.instruction||null,e.text||null,e.question||null,e.answer||null,e.explanation||null,
         e.options?JSON.stringify(e.options):null,e.blanks?JSON.stringify(e.blanks):null]);
      if(i%10===0||i===importData.length-1) logPush('['+( i+1)+'/'+importData.length+'] '+e.id+' OK','ok');
      inserted++;
    }catch(err){ logPush('[' +(i+1)+'] '+e.id+': '+err.message,'error'); errors++; }
  }
  try{ exercises=await sql('SELECT * FROM exercises WHERE level=$1 ORDER BY id',[currentLevel]); }catch(e){}
  logPush('✅ Zakończono! Dodano: '+inserted+'  Błędów: '+errors, errors===0?'done':'warn');
  setDBStatus('connected','Połączono · '+exercises.length+' zadań');
  btn.disabled=false; btn.textContent='🚀 Push do bazy';
}

function logPush(msg,type){
  const el=document.getElementById('push-log'); if(!el) return;
  const colors={info:'var(--text-muted)',ok:'var(--success)',error:'var(--error)',done:'var(--accent)',warn:'var(--warn)'};
  const d=document.createElement('div'); d.style.color=colors[type]||'var(--text)'; d.textContent=msg;
  el.appendChild(d); el.scrollTop=el.scrollHeight;
}

// =====================================================
// DB CONFIG
// =====================================================
function saveConfig(){
  localStorage.setItem('neon_user',document.getElementById('cfg-user').value.trim());
  showMsg('cfg-msg','✅ Zapisano.','success'); init();
}

async function testConnection(){
  const det=document.getElementById('conn-details'); det.textContent='Testowanie...';
  try{
    const data=await sql('SELECT COUNT(*) as cnt FROM exercises');
    det.innerHTML='<span style="color:var(--success)">✅ Połączono!</span>\nUser: '+CONFIG.user+'\nZadań: '+data[0]?.cnt;
    setDBStatus('connected','Połączono');
  }catch(e){ det.innerHTML='<span style="color:var(--error)">❌ '+e.message+'</span>'; setDBStatus('error','Błąd'); }
}

async function resetProgress(){
  if(!confirm('Usunąć WSZYSTKIE postępy?')) return;
  try{
    await sql('DELETE FROM user_progress WHERE user_id=$1',[CONFIG.user]);
    await sql('DELETE FROM session_history WHERE user_id=$1',[CONFIG.user]);
    try{ await sql('DELETE FROM answer_history WHERE user_id=$1',[CONFIG.user]); }catch(e){}
    progress={}; answerHistory=[];
    showMsg('cfg-msg','✅ Reset wykonany.','success'); renderHome();
  }catch(e){ showMsg('cfg-msg','❌ '+e.message,'error'); }
}

async function loadSessionHistory(){
  const el=document.getElementById('session-history-list');
  try{
    const data=await sql('SELECT * FROM session_history WHERE user_id=$1 ORDER BY played_at DESC LIMIT 10',[CONFIG.user]);
    if(!data.length){ el.textContent='Brak historii.'; return; }
    el.innerHTML=data.map(h=>{
      const pct=h.total>0?Math.round(h.score/h.total*100):0;
      const lvl=h.level==='rozszerzony'?'PR':'PP';
      return `<div style="padding:.4rem 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-size:.82rem">
        <span>${new Date(h.played_at).toLocaleDateString('pl-PL')}</span>
        <span style="color:var(--text-muted)">${CATEGORIES[h.category_id]?.name||h.category_id} · ${lvl}</span>
        <span style="color:${pct>=70?'var(--success)':pct>=50?'var(--warn)':'var(--error)'};font-family:'DM Mono',monospace">${pct}%</span>
      </div>`;
    }).join('');
  }catch(e){ el.textContent='Ładowanie...'; }
}

function showMsg(id,text,type){
  const el=document.getElementById(id); if(!el) return;
  el.style.color=type==='success'?'var(--success)':'var(--error)'; el.textContent=text;
  setTimeout(()=>el.textContent='',4000);
}

// =====================================================
// VIEWS
// =====================================================
function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('view-'+name)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>{
    if(b.getAttribute('onclick')==="showView('"+name+"')") b.classList.add('active');
  });
  if(name==='home')      renderHome();
  if(name==='stats')     renderStats();
  if(name==='history')   renderHistory();
  if(name==='theory')  { renderTheoryGrid(); document.getElementById('theory-grid-wrap').style.display='block'; document.getElementById('theory-article-wrap').style.display='none'; }
  if(name==='db-config'){ document.getElementById('cfg-user').value=CONFIG.user; loadSessionHistory(); }
  window.scrollTo({top:0,behavior:'smooth'});
}

// =====================================================
// CREATE answer_history TABLE IF NOT EXISTS
// =====================================================
async function ensureTables(){
  try{
    await sql(`CREATE TABLE IF NOT EXISTS answer_history (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL,
      user_answer TEXT,
      answered_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  }catch(e){ console.warn('ensure tables:',e.message); }
}

// =====================================================
// BOOT
// =====================================================
ensureTables().then(()=>init());

Object.assign(window,{
  init, showView, setLevel,
  saveConfig, testConnection, resetProgress, loadSessionHistory,
  startSession, endSession, nextExercise,
  checkAnswer, checkOption, selfGrade,
  renderStats, renderHistory, filterHistory,
  openTheory, closeTheory,
  loadJSONFile, parseJSONPaste, toggleJSONPaste, clearImport, pushToDB
});
