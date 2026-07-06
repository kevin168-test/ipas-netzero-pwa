import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import Icon from '../components/Icon';
import Dashboard from '../components/Dashboard';

export default function QuizWorkspace() {
  // --- View States ---
  const [view, setView] = useState('home'); // 'home', 'quiz', 'result', 'tag_select', 'settings'
  const [mode, setMode] = useState('practice'); // 'practice', 'exam', 'tag', 'review'
  
  // --- Data States ---
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { index: option }
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(1);
  const [totalWrongDbCount, setTotalWrongDbCount] = useState(0);
  const [totalBookmarkedCount, setTotalBookmarkedCount] = useState(0);

  // --- Accessibility States ---
  const [zoom, setZoom] = useState(() => parseFloat(localStorage.getItem('esg_zoom')) || 1.0);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // --- Quiz Runtime States ---
  const [showExplanation, setShowExplanation] = useState(false);
  const [timer, setTimer] = useState(0); // in seconds
  const [timerActive, setTimerActive] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // --- AI Advisor States ---
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('esg_gemini_key') || '');
  const [showApiInput, setShowApiInput] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  // Sync zoom factor with document HTML root
  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', zoom.toString());
    localStorage.setItem('esg_zoom', zoom.toString());
  }, [zoom]);

  // Sync theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Timer loop for Mock Exam
  useEffect(() => {
    let interval = null;
    if (timerActive) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  // Load tags and counts for dashboard
  useEffect(() => {
    refreshCounters();
  }, [view]);

  // Load bookmark status for current question
  useEffect(() => {
    if (questions.length > 0 && questions[currentIndex]) {
      const q = questions[currentIndex];
      db.progress.get(q.id).then(prog => {
        setIsBookmarked(!!prog?.isBookmarked);
      });
    }
  }, [currentIndex, questions]);

  const refreshCounters = async () => {
    try {
      const allProgress = await db.progress.toArray();
      const wrong = allProgress.filter(p => p.wrongCount > p.correctCount);
      const bookmarks = allProgress.filter(p => p.isBookmarked);
      setTotalWrongDbCount(wrong.length);
      setTotalBookmarkedCount(bookmarks.length);

      // Load all available tags from the questions database
      const allQs = await db.questions.toArray();
      const tagsSet = new Set();
      allQs.forEach(q => {
        if (q.tags) q.tags.forEach(t => tagsSet.add(t));
      });
      setAvailableTags(Array.from(tagsSet));
    } catch (err) {
      console.error(err);
    }
  };

  // --- Weighted Random Sampling Algorithm ---
  const loadWeightedQuestions = async (subId, count = 20, tagFilter = null, onlyWrongs = false, onlyBookmarks = false) => {
    try {
      let candidates = await db.questions.toArray();

      // Filter by subject
      if (subId && !onlyWrongs && !onlyBookmarks) {
        candidates = candidates.filter(q => q.subject === parseInt(subId));
      }

      // Filter by tag
      if (tagFilter) {
        candidates = candidates.filter(q => q.tags && q.tags.includes(tagFilter));
      }

      const progressList = await db.progress.toArray();
      const progressMap = new Map(progressList.map(p => [p.id, p]));

      // Filter for review modes
      if (onlyWrongs) {
        candidates = candidates.filter(q => {
          const prog = progressMap.get(q.id);
          return prog && prog.wrongCount > prog.correctCount;
        });
      } else if (onlyBookmarks) {
        candidates = candidates.filter(q => {
          const prog = progressMap.get(q.id);
          return prog && prog.isBookmarked;
        });
      }

      if (candidates.length === 0) {
        return [];
      }

      // Calculate weights for candidates
      const weightedCandidates = candidates.map(q => {
        const prog = progressMap.get(q.id);
        let weight = 1.0; // Default weight

        if (prog) {
          const corrects = prog.correctCount || 0;
          const wrongs = prog.wrongCount || 0;

          if (corrects > 0 && corrects > wrongs) {
            weight = 0.2; // Mastered: reduce occurrence rate
          } else if (wrongs === 1) {
            weight = 3.0; // Weakness: increase rate
          } else if (wrongs >= 2) {
            weight = 5.0; // Severe weakness: high rate
          }
        }
        return { question: q, weight };
      });

      // Sample without replacement
      const selected = [];
      const items = [...weightedCandidates];
      const targetCount = Math.min(count, items.length);

      for (let i = 0; i < targetCount; i++) {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let randomVal = Math.random() * totalWeight;
        
        let chosenIdx = 0;
        for (let j = 0; j < items.length; j++) {
          randomVal -= items[j].weight;
          if (randomVal <= 0) {
            chosenIdx = j;
            break;
          }
        }

        selected.push(items[chosenIdx].question);
        items.splice(chosenIdx, 1); // Remove to prevent duplicates
      }

      return selected;
    } catch (err) {
      console.error('Sampling error:', err);
      return [];
    }
  };

  const handleStartPractice = async () => {
    const qList = await loadWeightedQuestions(selectedSubject, 20);
    if (qList.length === 0) {
      alert('該科目尚無題目，請先解密初始化數據。');
      return;
    }
    setQuestions(qList);
    setMode('practice');
    setCurrentIndex(0);
    setUserAnswers({});
    setTimer(0);
    setTimerActive(true);
    setShowExplanation(false);
    setView('quiz');
  };

  const handleStartExam = async () => {
    const qList = await loadWeightedQuestions(selectedSubject, 50);
    if (qList.length === 0) {
      alert('該科目題庫為空，請檢查。');
      return;
    }
    setQuestions(qList);
    setMode('exam');
    setCurrentIndex(0);
    setUserAnswers({});
    setTimer(0);
    setTimerActive(true);
    setShowExplanation(false);
    setView('quiz');
  };

  const handleStartTagPractice = async (tag) => {
    const qList = await loadWeightedQuestions(null, 20, tag);
    if (qList.length === 0) {
      alert('此標籤下無可用題目。');
      return;
    }
    setQuestions(qList);
    setMode('tag');
    setCurrentIndex(0);
    setUserAnswers({});
    setTimer(0);
    setTimerActive(true);
    setShowExplanation(false);
    setView('quiz');
  };

  const handleStartReview = async (type) => {
    // type: 'wrongs' or 'bookmarks'
    const onlyWrongs = type === 'wrongs';
    const onlyBookmarks = type === 'bookmarks';
    const qList = await loadWeightedQuestions(null, 100, null, onlyWrongs, onlyBookmarks);
    
    if (qList.length === 0) {
      alert(onlyWrongs ? '目前沒有錯題需要複習！' : '目前沒有收藏題目！');
      return;
    }
    setQuestions(qList);
    setMode('review');
    setCurrentIndex(0);
    setUserAnswers({});
    setTimer(0);
    setTimerActive(true);
    setShowExplanation(false);
    setView('quiz');
  };

  const handleOptionClick = async (option) => {
    if (userAnswers[currentIndex] !== undefined) return; // Answer locked once selected
    
    const currentQ = questions[currentIndex];
    const isCorrect = currentQ.answer === 'FLAWED' ? true : currentQ.answer === option;

    setUserAnswers(prev => ({ ...prev, [currentIndex]: option }));

    // Update Progress in Dexie
    let prog = await db.progress.get(currentQ.id);
    if (!prog) {
      prog = {
        id: currentQ.id,
        correctCount: 0,
        wrongCount: 0,
        isBookmarked: false,
        lastPracticed: Date.now()
      };
    }

    if (isCorrect) {
      prog.correctCount += 1;
    } else {
      prog.wrongCount += 1;
      // Show bottom explanation sheet immediately on incorrect in practice/tag/review modes
      if (mode !== 'exam') {
        setShowExplanation(true);
      }
    }
    prog.lastPracticed = Date.now();
    await db.progress.put(prog);

    // Auto navigate to next question after 1.5 seconds if correct in practice modes
    if (isCorrect && mode !== 'exam') {
      setTimeout(() => {
        // Double check if we are still on the same question
        setCurrentIndex(prev => {
          if (prev < questions.length - 1) {
            setShowExplanation(false);
            setAiResponse('');
            return prev + 1;
          }
          return prev;
        });
      }, 1500);
    }
  };

  const toggleBookmark = async () => {
    const currentQ = questions[currentIndex];
    let prog = await db.progress.get(currentQ.id);
    if (!prog) {
      prog = {
        id: currentQ.id,
        correctCount: 0,
        wrongCount: 0,
        isBookmarked: false,
        lastPracticed: Date.now()
      };
    }
    prog.isBookmarked = !prog.isBookmarked;
    await db.progress.put(prog);
    setIsBookmarked(prog.isBookmarked);
    refreshCounters();
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowExplanation(false);
      setAiResponse('');
    } else if (mode === 'exam') {
      if (confirm('已經是最後一題，確定要提交考卷結算嗎？')) {
        handleSubmitExam();
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowExplanation(false);
      setAiResponse('');
    }
  };

  const handleSubmitExam = () => {
    setTimerActive(false);
    // Find wrong questions
    const wrongs = questions.filter((q, idx) => {
      const userAns = userAnswers[idx];
      return q.answer === 'FLAWED' ? false : userAns !== q.answer;
    });
    setWrongQuestions(wrongs);
    setView('result');
  };

  // --- Call Gemini AI Advisor ---
  const callAIAdvisor = async () => {
    if (!apiKey) {
      setShowApiInput(true);
      return;
    }
    setAiLoading(true);
    setAiResponse('');
    const currentQ = questions[currentIndex];

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `請解析以下這題「IPAS淨零碳規劃管理師」鑑定試題：\n\n【題目】\n${currentQ.question}\n\n【選項】\n(A) ${currentQ.options.A}\n(B) ${currentQ.options.B}\n(C) ${currentQ.options.C}\n(D) ${currentQ.options.D}\n\n【正確答案】\n${currentQ.answer}\n\n【既有解析】\n${currentQ.explanation}`
            }]
          }],
          systemInstruction: {
            parts: [{
              text: "你是一位資深的 ISO 14064 主導查證員與溫室氣體盤查專家。請用淺顯易懂、口語化的方式，向初學者解釋這道考題的觀念。若涉及計算，請一步步拆解公式；若涉及法規，請說明立法精神。回覆時請繁體中文排版整齊。"
            }]
          }
        })
      });

      const resJson = await response.json();
      const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '顧問暫時無法回應，請檢查金鑰或網路連線。';
      setAiResponse(text);
    } catch (err) {
      console.error(err);
      setAiResponse('連線顧問失敗，請確保 API Key 正確且網路連線暢通。');
    } finally {
      setAiLoading(false);
    }
  };

  const saveApiKey = (key) => {
    localStorage.setItem('esg_gemini_key', key);
    setApiKey(key);
    setShowApiInput(false);
  };

  const formatSeconds = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Navbar Header */}
      <header className="flex justify-between items-center py-4 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (view === 'quiz' && !confirm('測驗尚未結束，確定要回首頁嗎？進度將不會保存。')) return;
              setView('home');
              setTimerActive(false);
            }} 
            className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-xl float-leaf"
          >
            <Icon name="leaf" size={20} />
          </button>
          <div>
            <h1 className="font-extrabold text-base md:text-lg bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300">
              IPAS 淨零碳規劃師
            </h1>
            <p className="text-xxs text-slate-400 font-semibold tracking-wider uppercase">PWA Off-line Quiz Master</p>
          </div>
        </div>

        {/* Global Controls Panel */}
        <div className="flex items-center gap-2">
          {/* Zoom scaler */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button 
              onClick={() => setZoom(prev => Math.max(0.8, prev - 0.1))} 
              className="px-2 py-1 text-xs font-black rounded hover:bg-white dark:hover:bg-slate-700 transition"
              title="縮小文字 (A-)"
            >
              A-
            </button>
            <span className="text-xxs px-1.5 font-bold opacity-60">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={() => setZoom(prev => Math.min(2.0, prev + 0.1))} 
              className="px-2 py-1 text-xs font-black rounded hover:bg-white dark:hover:bg-slate-700 transition"
              title="放大文字 (A+)"
            >
              A+
            </button>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition text-sm"
            title="開關暗黑模式"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* VIEW: HOME / DASHBOARD */}
        {view === 'home' && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Quick settings row */}
            <div className="bg-white dark:bg-slate-900/60 p-4 border-b border-slate-200/50 dark:border-slate-800/40 flex flex-wrap gap-4 items-center justify-center shrink-0">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Icon name="settings" size={14} /> 考科設定：</span>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setSelectedSubject(1)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedSubject === 1 ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'}`}
                >
                  第一科：基礎概論
                </button>
                <button
                  onClick={() => setSelectedSubject(2)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedSubject === 2 ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'}`}
                >
                  第二科：盤查規範與程序
                </button>
              </div>
            </div>
            
            <Dashboard 
              onStartPractice={handleStartPractice}
              onStartExam={handleStartExam}
              onStartTagPractice={() => setView('tag_select')}
              onStartReview={() => handleStartReview('wrongs')}
              totalWrong={totalWrongDbCount}
              totalBookmarked={totalBookmarkedCount}
            />
          </div>
        )}

        {/* VIEW: TAG SELECT */}
        {view === 'tag_select' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setView('home')} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                <Icon name="arrow-left" size={20} />
              </button>
              <h3 className="text-lg font-bold">選擇章節標籤特訓</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleStartTagPractice(tag)}
                  className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:text-emerald-500 font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Icon name="tag" size={14} className="text-emerald-500" />
                  <span>#{tag}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: QUIZ WORKSPACE */}
        {view === 'quiz' && questions.length > 0 && (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* Header Status panel */}
            <div className="flex justify-between items-center py-3 px-6 bg-white/40 dark:bg-slate-900/20 border-b border-slate-200/50 dark:border-slate-800/40 shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-500 text-white text-xxs font-extrabold rounded uppercase">
                  {mode === 'exam' ? '考試' : '練習'}
                </span>
                <span className="text-xs font-semibold max-w-[200px] truncate">
                  {mode === 'tag' ? `標籤特訓: #${questions[0]?.tags?.[0]}` : `科目 ${selectedSubject}`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <Icon name="clock" size={14} />
                  {formatSeconds(timer)}
                </span>
                <button
                  onClick={toggleBookmark}
                  className={`p-2 border rounded-xl hover:scale-105 transition-all ${isBookmarked ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-200 dark:border-slate-800 text-slate-400'}`}
                  title="收藏此題"
                >
                  ⭐
                </button>
              </div>
            </div>

            {/* Progress Strip */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 shrink-0">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>

            {/* Main Question + Option Split panel (Allows independent scrolling inside upper area) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Question card */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-850 space-y-4">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-xxs font-bold rounded">
                    第 {currentIndex + 1} 題 / 共 {questions.length} 題
                  </span>
                  {questions[currentIndex].tags && questions[currentIndex].tags.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xxs font-semibold rounded-full border border-emerald-100/50 dark:border-emerald-900/30">
                      #{t}
                    </span>
                  ))}
                </div>
                <h3 className="text-lg md:text-xl font-bold leading-relaxed whitespace-pre-wrap text-slate-900 dark:text-white">
                  {questions[currentIndex].question}
                </h3>
              </div>

              {/* Options Card List */}
              <div className="grid gap-3 pb-12">
                {Object.entries(questions[currentIndex].options).map(([key, val]) => {
                  const isSelected = userAnswers[currentIndex] === key;
                  const isCorrect = questions[currentIndex].answer === 'FLAWED' ? true : questions[currentIndex].answer === key;
                  const showFeedback = mode !== 'exam' && userAnswers[currentIndex] !== undefined;

                  let optionStyle = "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500";
                  if (isSelected) {
                    optionStyle = "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm";
                  }

                  if (showFeedback) {
                    if (isCorrect) {
                      optionStyle = "border-green-500 bg-green-50/30 dark:bg-green-950/20 text-green-700 dark:text-green-400 font-semibold";
                    } else if (isSelected) {
                      optionStyle = "border-red-500 bg-red-50/30 dark:bg-red-950/20 text-red-700 dark:text-red-400 font-semibold";
                    } else {
                      optionStyle = "border-slate-200 dark:border-slate-800 opacity-60 text-slate-400";
                    }
                  }

                  return (
                    <button
                      key={key}
                      disabled={showFeedback}
                      onClick={() => handleOptionClick(key)}
                      className={`w-full p-4.5 rounded-2xl border text-left flex items-start gap-4 text-base md:text-lg leading-relaxed transition-all ${optionStyle}`}
                    >
                      <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bold text-xs border uppercase ${
                        isSelected 
                          ? 'bg-emerald-500 text-white border-emerald-500' 
                          : showFeedback && isCorrect
                            ? 'bg-green-500 text-white border-green-500'
                            : showFeedback && isSelected
                              ? 'bg-red-500 text-white border-red-500'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                      }`}>
                        {key}
                      </span>
                      <span className="whitespace-normal flex-1">{val}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Downward Bottom sheet panel for explanations */}
            {showExplanation && (
              <div className="h-[40vh] md:h-[45vh] w-full md:absolute md:bottom-0 md:left-0 bg-white dark:bg-slate-900 border-t-2 border-emerald-500 dark:border-emerald-600 flex flex-col overflow-hidden shadow-2xl z-10 animate-slide-up">
                
                {/* Bottom Sheet Header */}
                <div className="flex justify-between items-center px-6 py-3 bg-slate-50 dark:bg-slate-850 shrink-0 border-b border-slate-200 dark:border-slate-850">
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    💡 專業解析
                  </span>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={callAIAdvisor}
                      className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                      title="呼叫 AI 淨零顧問獲得詳細解答"
                    >
                      🤖 呼叫淨零顧問
                    </button>
                    <button 
                      onClick={() => setShowExplanation(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      title="關閉解析"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Explanation text container - independent scrolling */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <p className="text-base md:text-lg leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                    {questions[currentIndex].explanation}
                  </p>

                  {/* Dynamic AI advisor response */}
                  {aiLoading && (
                    <div className="flex items-center gap-2 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-emerald-500"></div>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">AI 顧問思考中...</span>
                    </div>
                  )}

                  {aiResponse && (
                    <div className="p-5 bg-teal-50/50 dark:bg-teal-950/20 rounded-2xl border border-teal-200/50 dark:border-teal-900/30 space-y-2">
                      <div className="flex items-center gap-1 text-teal-800 dark:text-teal-400 font-bold text-xs">
                        <Icon name="sparkles" size={14} />
                        <span>AI 淨零顧問回覆</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {aiResponse}
                      </p>
                    </div>
                  )}

                  {/* Gemini API Key input drawer if missing */}
                  {showApiInput && (
                    <div className="p-5 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 space-y-3">
                      <p className="text-xs text-amber-800 dark:text-amber-300 font-bold">請提供 Gemini API Key 以啟用顧問輔導：</p>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="貼上 AI API Key"
                          defaultValue={apiKey}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveApiKey(e.target.value);
                          }}
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg text-xs border border-slate-200 dark:border-slate-700 focus:outline-none"
                        />
                        <button
                          onClick={(e) => {
                            const input = e.target.previousSibling;
                            saveApiKey(input.value);
                          }}
                          className="px-4 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600"
                        >
                          記憶金鑰
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        金鑰會安全的被記錄於您裝置的 localStorage 瀏覽器快取中，不會傳輸給任何第三方。您可至 Google AI Studio 免費申請 API Key。
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Next buttons */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 shrink-0 flex justify-end gap-2">
                  <button 
                    onClick={() => setShowExplanation(false)}
                    className="py-2 px-4 rounded-xl font-bold text-slate-500 text-sm hover:bg-slate-200/50"
                  >
                    關閉
                  </button>
                  <button 
                    onClick={handleNext}
                    disabled={userAnswers[currentIndex] === undefined}
                    className="py-2.5 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition"
                  >
                    下一題
                  </button>
                </div>
              </div>
            )}

            {/* Bottom action controls if no explanation is visible */}
            {!showExplanation && (
              <div className="px-6 py-4.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 flex justify-between items-center gap-4">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="py-2 px-4 rounded-lg font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 text-sm"
                >
                  <Icon name="chevron-left" size={16} />
                  <span>上一題</span>
                </button>

                {mode === 'exam' ? (
                  <button
                    onClick={() => {
                      if (confirm('確定要提前提交考卷結算嗎？')) handleSubmitExam();
                    }}
                    className="py-2 px-4 bg-slate-800 text-white font-bold rounded-lg text-xs"
                  >
                    交卷結算
                  </button>
                ) : (
                  <button
                    onClick={() => setShowExplanation(true)}
                    className="py-2 px-4 text-emerald-500 hover:bg-emerald-50 rounded-lg text-xs font-bold"
                  >
                    查看解析
                  </button>
                )}

                <button
                  onClick={handleNext}
                  disabled={userAnswers[currentIndex] === undefined}
                  className="py-2.5 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl disabled:bg-slate-300 disabled:text-slate-400 disabled:pointer-events-none flex items-center gap-1 text-sm shadow-md"
                >
                  <span>下一題</span>
                  <Icon name="chevron-right" size={16} />
                </button>
              </div>
            )}

          </div>
        )}

        {/* VIEW: RESULT */}
        {view === 'result' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
            <div className="glass-card p-8 rounded-3xl text-center space-y-6">
              <div className="w-32 h-32 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border-4 border-emerald-500 flex flex-col items-center justify-center mx-auto">
                <span className="text-4xl font-black text-emerald-500">
                  {questions.length - wrongQuestions.length}
                </span>
                <span className="text-xxs font-bold text-slate-400 uppercase tracking-widest mt-1">答對題數</span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl md:text-2xl font-black">測驗結束</h3>
                <p className="text-sm text-slate-500">
                  正確率：<strong className="text-emerald-500 text-base">{Math.round(((questions.length - wrongQuestions.length) / questions.length) * 100)}%</strong>
                </p>
                {mode === 'exam' && (
                  <p className="text-lg font-bold">
                    模擬考得分：<strong className="text-cyan-500 text-xl font-black">{ (questions.length - wrongQuestions.length) * 2 } 分</strong> (一題2分)
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setView('home')}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm"
                >
                  返回儀表板
                </button>
                <button
                  onClick={() => {
                    if (mode === 'exam') handleStartExam();
                    else handleStartPractice();
                  }}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm"
                >
                  再測一次
                </button>
              </div>
            </div>

            {/* Exam review list of wrongs */}
            {wrongQuestions.length > 0 && (
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-red-500 flex items-center gap-1">
                    <Icon name="alert-triangle" size={14} />
                    <span>錯題檢討清單</span>
                  </h4>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xxs font-extrabold rounded-full">
                    {wrongQuestions.length} 題答錯
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-900">
                  {wrongQuestions.map((q, idx) => (
                    <div key={idx} className="p-6 space-y-3">
                      <p className="text-sm font-bold text-slate-800 dark:text-white leading-relaxed">
                        第 {questions.indexOf(q) + 1} 題：{q.question}
                      </p>
                      <p className="text-xs text-red-500 font-bold">
                        您選了: {userAnswers[questions.indexOf(q)] || '未作答'} (正確答案為: {q.answer})
                      </p>
                      <div className="bg-amber-50/50 dark:bg-slate-900/60 p-4 rounded-xl border border-amber-200/30 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        <strong>專業解析：</strong>\n{q.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
