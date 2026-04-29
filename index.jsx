// ═══════════════════════════════════════════════════════════════════════════
//  SURVEY APP — SAFE / BACKUP VERSION (v2: one row per participant)
//  ────────────────────────────────────────────────────────────────────────
//  • Sin AI, sin polling, sin endpoints custom
//  • Una fila por participante en Firestore (incremental save)
//  • Preguntas se pueden saltear (queda en blanco)
//  • Si alguien abandona a mitad → queda como `completed: false` en la base
//
//  SETUP: ver README.md
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, doc, setDoc, updateDoc, query, orderBy, serverTimestamp,
} from "firebase/firestore";

// ── 🔑 CONFIG DE FIREBASE ────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "TU_API_KEY",
  authDomain:        "tu-proyecto.firebaseapp.com",
  projectId:         "tu-proyecto",
  storageBucket:     "tu-proyecto.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:xxxxxxxxxxxx",
};
const fb = initializeApp(firebaseConfig);
const db = getFirestore(fb);

// ── 🔒 PASSWORD DE ADMIN — cámbialo ──────────────────────────────────────
const ADMIN_PASSWORD = "admin123";

// ── 🌍 IDIOMAS ────────────────────────────────────────────────────────────
const LANGS = [
  { code:"en", name:"English",      full:"English",      flag:"🇬🇧" },
  { code:"ru", name:"Русский",      full:"Russian",      flag:"🇷🇺" },
  { code:"kk", name:"Қазақша",       full:"Kazakh",       flag:"🇰🇿" },
  { code:"uz", name:"Oʻzbekcha",     full:"Uzbek",        flag:"🇺🇿" },
  { code:"mn", name:"Монгол",        full:"Mongolian",    flag:"🇲🇳" },
  { code:"ka", name:"ქართული",      full:"Georgian",     flag:"🇬🇪" },
  { code:"hy", name:"Հայերեն",       full:"Armenian",     flag:"🇦🇲" },
  { code:"az", name:"Azərbaycan",    full:"Azerbaijani",  flag:"🇦🇿" },
];

const UI = {
  en: { next:"Next",       skip:"Skip",      submit:"Submit",   skipSubmit:"Skip & Finish",  ph:"Share your thoughts here...",     thanks:"Thank you!",          saved:"Your response has been recorded.", newP:"New Participant",  q:"Question",  blank:"You can leave any question blank if you prefer." },
  ru: { next:"Далее",      skip:"Пропустить", submit:"Отправить", skipSubmit:"Пропустить и завершить", ph:"Поделитесь своими мыслями...",    thanks:"Спасибо!",            saved:"Ваш ответ записан.",                newP:"Новый участник",   q:"Вопрос",    blank:"Любой вопрос можно оставить без ответа." },
  kk: { next:"Келесі",     skip:"Өткізу",    submit:"Жіберу",    skipSubmit:"Өткізу және аяқтау", ph:"Ойларыңызбен бөлісіңіз...",       thanks:"Рахмет!",             saved:"Жауабыңыз тіркелді.",               newP:"Жаңа қатысушы",    q:"Сұрақ",     blank:"Қалаған сұрақты жауапсыз қалдыруға болады." },
  uz: { next:"Keyingi",    skip:"O'tkazib", submit:"Yuborish",  skipSubmit:"O'tkazib yuborish", ph:"Fikrlaringiz bilan bo'lishing...", thanks:"Rahmat!",             saved:"Javobingiz qayd etildi.",           newP:"Yangi ishtirokchi", q:"Savol",    blank:"Istalgan savolni bo'sh qoldirishingiz mumkin." },
  mn: { next:"Дараах",     skip:"Алгасах",   submit:"Илгээх",    skipSubmit:"Алгасаж дуусгах", ph:"Бодлоо энд хуваалцаарай...",       thanks:"Баярлалаа!",          saved:"Таны хариу бүртгэгдлээ.",           newP:"Шинэ оролцогч",    q:"Асуулт",    blank:"Аль ч асуултыг хоосон үлдээж болно." },
  ka: { next:"შემდეგი",   skip:"გამოტოვება", submit:"გაგზავნა",   skipSubmit:"გამოტოვება და დასრულება", ph:"გააზიარეთ თქვენი აზრები...",      thanks:"გმადლობთ!",            saved:"თქვენი პასუხი ჩაიწერა.",            newP:"ახალი მონაწილე",  q:"კითხვა",    blank:"ნებისმიერი კითხვა შეგიძლიათ ცარიელი დატოვოთ." },
  hy: { next:"Հաջորդը",   skip:"Բաց թողնել", submit:"Ուղարկել",   skipSubmit:"Բաց թողնել և ավարտել", ph:"Կիսվեք ձեր մտքերով...",          thanks:"Շնորհակալություն!",   saved:"Ձեր պատասխանը գրանցված է.",         newP:"Նոր մասնակից",     q:"Հարց",      blank:"Ցանկացած հարց կարող եք բաց թողնել։" },
  az: { next:"Növbəti",    skip:"Keç",       submit:"Göndər",    skipSubmit:"Keç və bitir", ph:"Fikirlərinizi bölüşün...",        thanks:"Təşəkkür edirik!",    saved:"Cavabınız qeydə alındı.",           newP:"Yeni iştirakçı",   q:"Sual",      blank:"İstənilən sualı boş buraxa bilərsiniz." },
};

// ── 🎨 Paleta verde ──────────────────────────────────────────────────────
const G  = "#27ae60";
const DG = "#1a6b3a";
const LG = "#f0faf4";
const BD = "#d5ede0";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body,button,input,textarea{font-family:'Plus Jakarta Sans',sans-serif;}
.app{min-height:100vh;background:#f0faf4;color:#1a3a26;}
.center{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 20px;background:linear-gradient(160deg,#e8f8ee,#f0faf4);}
.lb:hover{border-color:#27ae60!important;transform:translateY(-2px)!important;box-shadow:0 6px 20px rgba(39,174,96,.12)!important;}
.nb:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(39,174,96,.4)!important;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.fade{animation:fadeUp .3s ease;}
`;

// ── 🔘 Botones ────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, style={}, outline=false, className }) {
  const base = {
    padding:"14px 24px", borderRadius:"10px", fontWeight:"700", fontSize:"14px",
    cursor:disabled?"not-allowed":"pointer", border:"none", transition:"all .2s",
    opacity:disabled?0.4:1,
    background:outline?"#fff":`linear-gradient(135deg,${DG},${G})`,
    color:outline?DG:"#fff",
    border:outline?`2px solid ${BD}`:"none",
    boxShadow:outline?"none":"0 4px 15px rgba(39,174,96,.25)",
    ...style,
  };
  return <button className={className} onClick={onClick} disabled={disabled} style={base}>{children}</button>;
}

function SmallBtn({ children, onClick, disabled, color="green" }) {
  const colors = {
    green:  { bg:"#f0faf4", border:BD,     text:DG },
    red:    { bg:"#fff2f2", border:"#faa", text:"#c0392b" },
    white:  { bg:"#fff",    border:BD,     text:"#3a6a4a" },
  };
  const c = colors[color] || colors.green;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:"6px 12px", borderRadius:"7px", fontSize:"11px", fontWeight:"700",
      cursor:disabled?"not-allowed":"pointer", border:`2px solid ${c.border}`,
      background:c.bg, color:c.text, opacity:disabled?.4:1, transition:"all .2s",
    }}>{children}</button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const QUESTIONS_COL    = collection(db, "questions");
const PARTICIPANTS_COL = collection(db, "participants");

async function fbLoadQuestions() {
  const snap = await getDocs(QUESTIONS_COL);
  const arr = [];
  snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
  arr.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  return arr;
}

async function fbSaveQuestion(q) {
  if (q.id && typeof q.id === "string" && q.id.length > 5) {
    const ref = doc(db, "questions", q.id);
    const { id, ...data } = q;
    await setDoc(ref, data);
    return q.id;
  } else {
    const { id, ...data } = q;
    const ref = await addDoc(QUESTIONS_COL, data);
    return ref.id;
  }
}

async function fbDeleteQuestion(id) {
  await deleteDoc(doc(db, "questions", id));
}

// Crea un nuevo doc de participante. Retorna su ID.
async function fbCreateParticipant(meta) {
  const ref = await addDoc(PARTICIPANTS_COL, {
    ...meta,
    answers: {},
    question_snapshots: {},
    completed: false,
    started_at: serverTimestamp(),
    last_updated: serverTimestamp(),
  });
  return ref.id;
}

// Guarda UNA respuesta dentro del doc del participante (merge).
// Si markCompleted=true, también marca la encuesta como terminada.
async function fbSaveAnswer(participantId, qId, qSnapshot, answer, markCompleted=false) {
  const ref = doc(db, "participants", participantId);
  const updates = {
    [`answers.${qId}`]: answer || "",
    [`question_snapshots.${qId}`]: qSnapshot || "",
    last_updated: serverTimestamp(),
  };
  if (markCompleted) {
    updates.completed = true;
    updates.completed_at = serverTimestamp();
  }
  await updateDoc(ref, updates);
}

async function fbLoadParticipants() {
  const q = query(PARTICIPANTS_COL, orderBy("started_at", "desc"));
  const snap = await getDocs(q);
  const arr = [];
  snap.forEach(d => {
    const data = d.data();
    arr.push({
      id: d.id,
      ...data,
      started_at_display: data.started_at?.toDate
        ? data.started_at.toDate().toLocaleString()
        : "",
      completed_at_display: data.completed_at?.toDate
        ? data.completed_at.toDate().toLocaleString()
        : "",
    });
  });
  return arr;
}

async function fbDeleteParticipant(id) {
  await deleteDoc(doc(db, "participants", id));
}

async function fbDeleteAllParticipants() {
  const snap = await getDocs(PARTICIPANTS_COL);
  await Promise.all([...snap.docs].map(d => deleteDoc(doc(db, "participants", d.id))));
}

// ═══════════════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const [screen,    setScreen]    = useState("lang");
  const [lang,      setLang]      = useState("en");
  const [qIdx,      setQIdx]      = useState(0);
  const [answers,   setAnswers]   = useState({});      // {qId: text} — local
  const [questions, setQuestions] = useState([]);
  const [loadingQs, setLoadingQs] = useState(true);

  // Survey session
  const [participantId, setParticipantId] = useState(null);
  const [surveyQs,      setSurveyQs]      = useState([]);  // snapshot — no cambia mid-survey
  const [saving,        setSaving]        = useState(false);
  const [submitErr,     setSubmitErr]     = useState(null);

  // Admin
  const [pw,           setPw]           = useState("");
  const [pwErr,        setPwErr]        = useState(false);
  const [tab,          setTab]          = useState("responses");
  const [participants, setParticipants] = useState([]);
  const [editQ,        setEditQ]        = useState(null);
  const [newQText,     setNewQText]     = useState("");
  const [savingQ,      setSavingQ]      = useState(false);
  const [copied,       setCopied]       = useState(false);

  const t = UI[lang] || UI.en;
  const activeQs = questions.filter(q => q.active !== false);

  const getLang = (q, lang) => {
    if (!q) return "";
    if (lang === "en") return q.en || "";
    return (q.translations || {})[lang] || q.en || "";
  };

  // ── Load questions on mount ──
  useEffect(() => {
    (async () => {
      try {
        const qs = await fbLoadQuestions();
        setQuestions(qs);
      } catch (e) { console.error("Error loading questions:", e); }
      finally { setLoadingQs(false); }
    })();
  }, []);

  // ── Load participants when entering admin or switching tab ──
  useEffect(() => {
    if (screen !== "admin") return;
    (async () => {
      try {
        const ps = await fbLoadParticipants();
        setParticipants(ps);
      } catch (e) { console.error(e); }
    })();
  }, [screen, tab]);

  // ── Survey flow ──
  const pickLang = async (code) => {
    if (!activeQs.length) return;
    setLang(code);
    setQIdx(0);
    setAnswers({});
    setSubmitErr(null);
    const info = LANGS.find(l => l.code === code);
    // Snapshot active questions — no cambian mid-survey aunque admin las edite
    const snap = activeQs.slice();
    setSurveyQs(snap);
    // Crear el doc del participante AHORA (vacío). Si falla, abortar.
    try {
      const id = await fbCreateParticipant({
        lang: code,
        lang_name: info?.full || code,
        flag: info?.flag || "",
      });
      setParticipantId(id);
      setScreen("survey");
    } catch (e) {
      alert("Could not start survey: " + e.message);
    }
  };

  const changeAnswer = (val) => {
    const q = surveyQs[qIdx];
    if (!q) return;
    setAnswers(prev => ({ ...prev, [q.id]: val }));
  };

  const handleNext = async () => {
    const q = surveyQs[qIdx];
    if (!q || !participantId) return;
    const isLast = qIdx === surveyQs.length - 1;
    const txt = (answers[q.id] || "").trim();

    setSaving(true);
    setSubmitErr(null);
    try {
      await fbSaveAnswer(participantId, q.id, q.en, txt, isLast);
      if (isLast) {
        setScreen("complete");
      } else {
        setQIdx(qIdx + 1);
      }
    } catch (e) {
      setSubmitErr(e.message || "Could not save — please try again");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setAnswers({});
    setQIdx(0);
    setParticipantId(null);
    setSurveyQs([]);
    setSubmitErr(null);
    setScreen("lang");
  };

  // ── Admin login ──
  const tryLogin = () => {
    if (pw !== ADMIN_PASSWORD) {
      setPwErr(true);
      setTimeout(() => setPwErr(false), 1600);
      return;
    }
    setPw("");
    setScreen("admin");
  };

  // ── Admin: questions ──
  const addQuestion = async () => {
    if (!newQText.trim() || questions.length >= 20) return;
    setSavingQ(true);
    try {
      const newQ = {
        en: newQText.trim(),
        translations: {},
        active: true,
        order: questions.length,
      };
      const id = await fbSaveQuestion(newQ);
      setQuestions(prev => [...prev, { id, ...newQ }]);
      setNewQText("");
    } catch (e) { alert("Error: " + e.message); }
    finally { setSavingQ(false); }
  };

  const toggleQ = async (q) => {
    const updated = { ...q, active: q.active === false };
    setQuestions(prev => prev.map(x => x.id === q.id ? updated : x));
    try { await fbSaveQuestion(updated); } catch (e) { alert("Error: " + e.message); }
  };

  const deleteQ = async (q) => {
    if (!window.confirm(`¿Borrar la pregunta?\n\n"${q.en}"`)) return;
    try {
      await fbDeleteQuestion(q.id);
      setQuestions(prev => prev.filter(x => x.id !== q.id));
    } catch (e) { alert("Error: " + e.message); }
  };

  const saveEdit = async () => {
    if (!editQ?.en?.trim()) return;
    setSavingQ(true);
    try {
      await fbSaveQuestion(editQ);
      setQuestions(prev => prev.map(x => x.id === editQ.id ? editQ : x));
      setEditQ(null);
    } catch (e) { alert("Error: " + e.message); }
    finally { setSavingQ(false); }
  };

  // ── Admin: participants ──
  const deletePart = async (id) => {
    if (!window.confirm("¿Borrar este participante y todas sus respuestas?")) return;
    try {
      await fbDeleteParticipant(id);
      setParticipants(prev => prev.filter(p => p.id !== id));
    } catch (e) { alert("Error: " + e.message); }
  };

  const deleteAll = async () => {
    if (!window.confirm("¿BORRAR TODOS los participantes y respuestas? No se puede deshacer.")) return;
    try {
      await fbDeleteAllParticipants();
      setParticipants([]);
    } catch (e) { alert("Error: " + e.message); }
  };

  const reload = async () => {
    try {
      const ps = await fbLoadParticipants();
      setParticipants(ps);
    } catch (e) { alert("Error: " + e.message); }
  };

  // Construye filas para CSV/TSV: una línea por participante,
  // una columna por pregunta viva (más columnas para respuestas huérfanas si hay).
  const buildExportRows = () => {
    const liveIds = new Set(questions.map(q => q.id));
    const orphans = new Map();
    for (const p of participants) {
      for (const qId of Object.keys(p.answers || {})) {
        if (!liveIds.has(qId)) {
          orphans.set(qId, (p.question_snapshots || {})[qId] || `(deleted ${qId})`);
        }
      }
    }
    const orphanIds = Array.from(orphans.keys());

    const headers = [
      "id", "started", "completed_at", "status", "language",
      ...questions.map((q, i) => `Q${i+1}: ${q.en.slice(0, 60)}`),
      ...orphanIds.map(qid => `(deleted) ${orphans.get(qid).slice(0, 60)}`),
    ];

    const rows = participants.map(p => [
      p.id,
      p.started_at_display || "",
      p.completed_at_display || "",
      p.completed ? "completed" : "incomplete",
      p.lang_name || p.lang || "",
      ...questions.map(q => (p.answers || {})[q.id] || ""),
      ...orphanIds.map(qid => (p.answers || {})[qid] || ""),
    ]);

    return { headers, rows };
  };

  const exportCSV = () => {
    if (!participants.length) return;
    const { headers, rows } = buildExportRows();
    const esc = c => `"${String(c).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyTable = () => {
    if (!participants.length) return;
    const { headers, rows } = buildExportRows();
    const tsv = [headers, ...rows].map(r => r.join("\t")).join("\n");
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const totalCompleted   = participants.filter(p => p.completed).length;
  const totalIncomplete  = participants.length - totalCompleted;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="app">
      <style>{css}</style>

      {/* ── LANG SELECT ── */}
      {screen === "lang" && (
        <div className="center">
          <div style={{maxWidth:"720px",width:"100%"}}>
            <div style={{textAlign:"center",marginBottom:"32px"}}>
              <h1 style={{fontSize:"32px",fontWeight:"800",color:"#1a3a26",marginBottom:"10px"}}>Welcome</h1>
              <p style={{color:"#7aaa88",fontSize:"15px"}}>Choose your language to begin</p>
            </div>

            {loadingQs ? (
              <p style={{textAlign:"center",color:"#7aaa88"}}>Loading...</p>
            ) : activeQs.length === 0 ? (
              <p style={{textAlign:"center",color:"#7aaa88",padding:"30px",
                background:"#fff",border:`2px dashed ${BD}`,borderRadius:"14px"}}>
                No active questions yet.<br/>
                <span style={{fontSize:"12px"}}>Admin needs to add questions first.</span>
              </p>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px"}}>
                {LANGS.map(l => (
                  <button key={l.code} className="lb" onClick={() => pickLang(l.code)} style={{
                    background:"#fff", border:`2px solid ${BD}`, borderRadius:"14px",
                    padding:"24px 10px", cursor:"pointer", textAlign:"center",
                    color:"#1a3a26", boxShadow:"0 2px 8px rgba(27,107,58,.06)",
                    transition:"all .2s",
                  }}>
                    <span style={{fontSize:"32px",display:"block",marginBottom:"8px"}}>{l.flag}</span>
                    <span style={{fontSize:"13px",fontWeight:"700",display:"block"}}>{l.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{textAlign:"center",marginTop:"32px"}}>
              <button onClick={() => setScreen("adminLogin")} style={{
                background:"none",border:"none",color:"#b0d4b8",
                fontSize:"12px",cursor:"pointer",
              }}>Admin →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SURVEY ── */}
      {screen === "survey" && surveyQs[qIdx] && (
        <div className="center">
          <div style={{maxWidth:"600px",width:"100%"}}>
            {/* Progress */}
            <div style={{marginBottom:"32px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"10px"}}>
                <span style={{fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",color:"#7aaa88",fontWeight:"600"}}>
                  {t.q} {qIdx+1} / {surveyQs.length}
                </span>
                <span style={{fontSize:"12px",color:G,fontWeight:"700"}}>
                  {Math.round(((qIdx+1)/surveyQs.length)*100)}%
                </span>
              </div>
              <div style={{height:"6px",background:BD,borderRadius:"6px",overflow:"hidden"}}>
                <div style={{
                  height:"100%", width:`${((qIdx+1)/surveyQs.length)*100}%`,
                  background:`linear-gradient(90deg,${DG},${G})`,
                  borderRadius:"6px",transition:"width .5s ease",
                }} />
              </div>
            </div>

            <p style={{fontSize:"11px",letterSpacing:"3px",textTransform:"uppercase",color:G,marginBottom:"14px",fontWeight:"700"}}>
              {t.q} {String(qIdx+1).padStart(2,"0")}
            </p>
            <h2 style={{fontSize:"24px",fontWeight:"700",lineHeight:"1.5",marginBottom:"26px"}}>
              {getLang(surveyQs[qIdx], lang)}
            </h2>

            <textarea value={answers[surveyQs[qIdx].id] || ""} onChange={e => changeAnswer(e.target.value)}
              placeholder={t.ph} rows={6}
              style={{
                width:"100%",background:"#fff",border:`2px solid ${BD}`,
                borderRadius:"12px",padding:"20px",color:"#1a3a26",
                fontSize:"15px",lineHeight:"1.7",resize:"vertical",outline:"none",
              }}
              onFocus={e => e.target.style.borderColor = G}
              onBlur={e => e.target.style.borderColor = BD}
            />

            {submitErr && (
              <div style={{
                marginTop:"12px",padding:"12px 14px",background:"#fff2f2",
                border:"2px solid #faa",borderRadius:"10px",
                color:"#c0392b",fontSize:"13px",fontWeight:"600",
              }}>⚠️ {submitErr}</div>
            )}

            {(() => {
              const isLast = qIdx === surveyQs.length - 1;
              const hasText = (answers[surveyQs[qIdx].id] || "").trim().length > 0;
              const label = isLast
                ? (hasText ? `${t.submit} ✓` : `${t.skipSubmit} →`)
                : (hasText ? `${t.next} →`   : `${t.skip} →`);
              return (
                <Btn className="nb" onClick={handleNext} disabled={saving}
                  style={{
                    width:"100%",marginTop:"16px",padding:"17px",fontSize:"14px",
                    background: hasText ? `linear-gradient(135deg,${DG},${G})` : "#fff",
                    color: hasText ? "#fff" : DG,
                    border: hasText ? "none" : `2px solid ${BD}`,
                    boxShadow: "none",
                  }}>
                  {saving ? "..." : label}
                </Btn>
              );
            })()}

            <p style={{textAlign:"center",fontSize:"11px",color:"#b0d4b8",marginTop:"12px"}}>
              {t.blank}
            </p>
          </div>
        </div>
      )}

      {/* ── COMPLETE ── */}
      {screen === "complete" && (
        <div className="center">
          <div style={{maxWidth:"420px",width:"100%",textAlign:"center"}}>
            <div style={{
              width:"80px",height:"80px",background:`linear-gradient(135deg,${DG},${G})`,
              borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:"34px",margin:"0 auto 24px",boxShadow:"0 8px 24px rgba(39,174,96,.3)",
            }}>✓</div>
            <h2 style={{fontSize:"34px",fontWeight:"800",marginBottom:"10px"}}>{t.thanks}</h2>
            <p style={{color:"#7aaa88",fontSize:"15px",marginBottom:"32px"}}>{t.saved}</p>
            <Btn onClick={reset}>{t.newP} →</Btn>
          </div>
        </div>
      )}

      {/* ── ADMIN LOGIN ── */}
      {screen === "adminLogin" && (
        <div className="center">
          <div style={{maxWidth:"380px",width:"100%",textAlign:"center"}}>
            <div style={{
              width:"70px",height:"70px",background:`linear-gradient(135deg,${DG},${G})`,
              borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:"30px",margin:"0 auto 20px",boxShadow:"0 8px 24px rgba(39,174,96,.3)",
            }}>🔒</div>
            <h2 style={{fontSize:"26px",fontWeight:"800",marginBottom:"8px"}}>Admin Access</h2>
            <p style={{color:"#7aaa88",fontSize:"14px",marginBottom:"24px"}}>Enter password</p>
            <input type="password" value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && tryLogin()}
              placeholder="Password"
              style={{
                width:"100%",padding:"14px 18px",
                border:`2px solid ${pwErr ? "#e74c3c" : BD}`,
                borderRadius:"10px",fontSize:"15px",outline:"none",
                marginBottom:"8px",textAlign:"center",letterSpacing:"4px",
                background: pwErr ? "#fdf0ee" : "#fff",
              }}/>
            {pwErr
              ? <p style={{color:"#e74c3c",fontSize:"12px",marginBottom:"14px",fontWeight:"600"}}>❌ Incorrect password</p>
              : <div style={{height:"20px",marginBottom:"14px"}} />
            }
            <Btn onClick={tryLogin} style={{width:"100%"}}>Unlock →</Btn>
            <button onClick={() => setScreen("lang")} style={{
              marginTop:"14px",background:"none",border:"none",
              color:"#b0d4b8",fontSize:"12px",cursor:"pointer",
            }}>← Back to Survey</button>
          </div>
        </div>
      )}

      {/* ── ADMIN ── */}
      {screen === "admin" && (
        <div style={{padding:"24px 16px",maxWidth:"1100px",margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
            <h1 style={{fontSize:"24px",fontWeight:"800",color:"#1a3a26"}}>📊 Admin Dashboard</h1>
            <button onClick={() => setScreen("lang")} style={{
              background:"none",border:"none",color:"#7aaa88",
              fontSize:"13px",cursor:"pointer",
            }}>← Back to Survey</button>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",gap:"8px",marginBottom:"20px",borderBottom:`2px solid ${BD}`}}>
            {[
              {id:"responses", label:`📥 Responses (${participants.length})`},
              {id:"questions", label:`❓ Questions (${questions.length})`},
            ].map(x => (
              <button key={x.id} onClick={() => setTab(x.id)} style={{
                padding:"10px 18px",background:"none",border:"none",
                borderBottom: tab === x.id ? `3px solid ${G}` : "3px solid transparent",
                color: tab === x.id ? DG : "#7aaa88",
                fontSize:"13px",fontWeight:"700",cursor:"pointer",
                marginBottom:"-2px",
              }}>{x.label}</button>
            ))}
          </div>

          {/* RESPONSES TAB */}
          {tab === "responses" && (
            <div>
              {/* Stats */}
              {participants.length > 0 && (
                <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}}>
                  <div style={{
                    padding:"10px 16px",background:"#fff",border:`2px solid ${BD}`,
                    borderRadius:"10px",fontSize:"12px",
                  }}>
                    <span style={{color:"#7aaa88"}}>Total: </span>
                    <strong style={{color:DG}}>{participants.length}</strong>
                  </div>
                  <div style={{
                    padding:"10px 16px",background:"#fff",border:`2px solid ${BD}`,
                    borderRadius:"10px",fontSize:"12px",
                  }}>
                    <span style={{color:"#7aaa88"}}>✓ Completed: </span>
                    <strong style={{color:DG}}>{totalCompleted}</strong>
                  </div>
                  <div style={{
                    padding:"10px 16px",background:"#fff",border:`2px solid ${BD}`,
                    borderRadius:"10px",fontSize:"12px",
                  }}>
                    <span style={{color:"#7aaa88"}}>⏳ Incomplete: </span>
                    <strong style={{color:"#c0620b"}}>{totalIncomplete}</strong>
                  </div>
                </div>
              )}

              <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"20px"}}>
                <SmallBtn onClick={exportCSV} disabled={!participants.length}>📥 Export CSV</SmallBtn>
                <SmallBtn onClick={copyTable} disabled={!participants.length}>
                  {copied ? "✓ Copied!" : "📋 Copy as table"}
                </SmallBtn>
                <SmallBtn onClick={reload}>🔄 Reload</SmallBtn>
                <div style={{flex:1}} />
                <SmallBtn onClick={deleteAll} disabled={!participants.length} color="red">
                  🗑 Delete all
                </SmallBtn>
              </div>

              {!participants.length ? (
                <div style={{
                  textAlign:"center",padding:"60px 20px",
                  background:"#fff",border:`2px dashed ${BD}`,borderRadius:"14px",
                  color:"#7aaa88",
                }}>No responses yet.</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                  {participants.map((p, idx) => {
                    const liveIds = new Set(questions.map(q => q.id));
                    const orphanItems = Object.keys(p.answers || {})
                      .filter(qId => !liveIds.has(qId))
                      .map(qId => ({
                        qId,
                        text: (p.question_snapshots || {})[qId] || "(deleted question)",
                        answer: p.answers[qId],
                      }));
                    return (
                      <div key={p.id} style={{
                        background:"#fff",border:`2px solid ${BD}`,borderRadius:"14px",
                        padding:"18px",boxShadow:"0 2px 8px rgba(27,107,58,.05)",
                      }}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px",gap:"10px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                            <span style={{fontSize:"22px"}}>{p.flag || "🏳️"}</span>
                            <div>
                              <div style={{fontSize:"15px",fontWeight:"800",color:DG}}>
                                #{idx+1} · {p.lang_name || p.lang}
                              </div>
                              <div style={{fontSize:"11px",color:"#7aaa88"}}>
                                Started: {p.started_at_display}
                              </div>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                            <span style={{
                              fontSize:"10px",fontWeight:"700",letterSpacing:"1px",
                              padding:"4px 9px",borderRadius:"6px",
                              background: p.completed ? LG : "#fff8f0",
                              color: p.completed ? DG : "#c0620b",
                              border: `1px solid ${p.completed ? BD : "#fcc"}`,
                            }}>
                              {p.completed ? "✓ COMPLETED" : "⏳ INCOMPLETE"}
                            </span>
                            <button onClick={() => deletePart(p.id)} title="Delete participant" style={{
                              background:"none",border:"none",color:"#c0392b",
                              cursor:"pointer",fontSize:"16px",padding:"0 4px",
                            }}>🗑</button>
                          </div>
                        </div>

                        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                          {questions.map((q, qi) => {
                            const a = (p.answers || {})[q.id];
                            return (
                              <div key={q.id} style={{
                                padding:"12px 14px",
                                background: a ? LG : "#fafafa",
                                borderRadius:"10px",
                                borderLeft: a ? `3px solid ${G}` : `3px solid #ddd`,
                              }}>
                                <div style={{fontSize:"12px",color:"#7aaa88",fontWeight:"600",marginBottom:"6px"}}>
                                  Q{qi+1}: {q.en}
                                </div>
                                <div style={{
                                  fontSize:"14px",lineHeight:"1.55",
                                  color: a ? "#1a3a26" : "#bbb",
                                  fontStyle: a ? "normal" : "italic",
                                }}>
                                  {a || "(no answer)"}
                                </div>
                              </div>
                            );
                          })}

                          {orphanItems.length > 0 && (
                            <div style={{
                              marginTop:"6px",padding:"10px 12px",
                              background:"#fff8f0",border:`1px dashed #fcc`,borderRadius:"8px",
                            }}>
                              <div style={{fontSize:"10px",color:"#c0620b",fontWeight:"700",letterSpacing:"1px",textTransform:"uppercase",marginBottom:"6px"}}>
                                Orphan answers (questions deleted from survey)
                              </div>
                              {orphanItems.map(o => (
                                <div key={o.qId} style={{marginBottom:"6px"}}>
                                  <div style={{fontSize:"11px",color:"#7aaa88"}}>{o.text}</div>
                                  <div style={{fontSize:"13px",color:"#3a5a46"}}>{o.answer}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* QUESTIONS TAB */}
          {tab === "questions" && (
            <div>
              <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:"24px"}}>
                {questions.length === 0 && (
                  <p style={{color:"#7aaa88",textAlign:"center",padding:"30px"}}>
                    No questions yet. Add one below.
                  </p>
                )}

                {questions.map((q, i) => (
                  <div key={q.id} style={{
                    background:"#fff",border:`2px solid ${BD}`,borderRadius:"12px",padding:"14px 16px",
                  }}>
                    {editQ?.id === q.id ? (
                      <div>
                        <label style={{fontSize:"11px",color:"#7aaa88",fontWeight:"700",letterSpacing:"1px",textTransform:"uppercase"}}>
                          🇬🇧 English (canonical)
                        </label>
                        <textarea value={editQ.en} rows={2}
                          onChange={e => setEditQ({...editQ, en: e.target.value})}
                          style={{
                            width:"100%",padding:"10px",marginTop:"6px",marginBottom:"14px",
                            border:`2px solid ${BD}`,borderRadius:"8px",fontSize:"14px",
                            resize:"vertical",outline:"none",
                          }}/>

                        <label style={{fontSize:"11px",color:"#7aaa88",fontWeight:"700",letterSpacing:"1px",textTransform:"uppercase"}}>
                          🌐 Translations (optional — leave empty to fall back to English)
                        </label>
                        <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"8px",marginBottom:"14px"}}>
                          {LANGS.filter(l => l.code !== "en").map(l => (
                            <div key={l.code} style={{display:"flex",gap:"8px",alignItems:"center"}}>
                              <span style={{fontSize:"18px",width:"24px"}}>{l.flag}</span>
                              <span style={{fontSize:"11px",width:"80px",color:"#7aaa88",fontWeight:"600"}}>{l.full}</span>
                              <input type="text"
                                value={editQ.translations?.[l.code] || ""}
                                placeholder={`(empty = use English)`}
                                onChange={e => setEditQ({
                                  ...editQ,
                                  translations: { ...(editQ.translations || {}), [l.code]: e.target.value },
                                })}
                                style={{
                                  flex:1,padding:"6px 10px",
                                  border:`1px solid ${BD}`,borderRadius:"6px",
                                  fontSize:"13px",outline:"none",
                                }}/>
                            </div>
                          ))}
                        </div>

                        <div style={{display:"flex",gap:"8px"}}>
                          <SmallBtn onClick={saveEdit} disabled={savingQ}>
                            {savingQ ? "Saving..." : "✓ Save"}
                          </SmallBtn>
                          <SmallBtn onClick={() => setEditQ(null)} color="white">Cancel</SmallBtn>
                        </div>
                      </div>
                    ) : (
                      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                        <span style={{
                          fontSize:"11px",fontWeight:"800",color:DG,
                          background:LG,padding:"4px 8px",borderRadius:"6px",
                        }}>Q{i+1}</span>
                        <div style={{flex:1,fontSize:"14px",color:"#1a3a26"}}>{q.en}</div>
                        <SmallBtn onClick={() => toggleQ(q)}
                          color={q.active === false ? "white" : "green"}>
                          {q.active === false ? "○ Off" : "● On"}
                        </SmallBtn>
                        <SmallBtn onClick={() => setEditQ({
                          ...q,
                          translations: { ...(q.translations || {}) },
                        })}>✏️ Edit</SmallBtn>
                        <SmallBtn onClick={() => deleteQ(q)} color="red">🗑</SmallBtn>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {questions.length < 20 ? (
                <div style={{
                  background:"#fff",border:`2px dashed ${BD}`,borderRadius:"12px",padding:"16px",
                }}>
                  <p style={{fontSize:"12px",color:"#7aaa88",fontWeight:"700",marginBottom:"10px",letterSpacing:"1px",textTransform:"uppercase"}}>
                    ➕ Add question (in English)
                  </p>
                  <textarea value={newQText} rows={3}
                    placeholder="Type your question..."
                    onChange={e => setNewQText(e.target.value)}
                    style={{
                      width:"100%",padding:"12px",
                      border:`2px solid ${BD}`,borderRadius:"10px",
                      fontSize:"14px",resize:"vertical",outline:"none",marginBottom:"10px",
                    }}/>
                  <SmallBtn onClick={addQuestion} disabled={!newQText.trim() || savingQ}>
                    {savingQ ? "Adding..." : "✨ Add"}
                  </SmallBtn>
                  <p style={{fontSize:"11px",color:"#7aaa88",marginTop:"8px"}}>
                    Tip: After adding, click ✏️ Edit to add translations for other languages.
                  </p>
                </div>
              ) : (
                <p style={{textAlign:"center",fontSize:"12px",color:"#7aaa88"}}>
                  Maximum 20 questions reached.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
