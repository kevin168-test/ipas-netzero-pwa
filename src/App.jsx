import React, { useEffect, useState } from 'react';
import QuizWorkspace from './views/QuizWorkspace';
import { initializeQuestionDatabase } from './services/cryptoService';
import Icon from './components/Icon';

export default function App() {
  const [initStatus, setInitStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [qCount, setQCount] = useState(0);

  useEffect(() => {
    // 1. Initialize Dexie DB and decrypt database
    initializeQuestionDatabase()
      .then(count => {
        setQCount(count);
        setInitStatus('success');
      })
      .catch(err => {
        console.error('Failed to load database:', err);
        setInitStatus('error');
      });

    // 2. Prevent right-click context menu (Data protection)
    const preventContextMenu = (e) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', preventContextMenu);

    // 3. Prevent standard inspection hotkeys (F12, Ctrl+Shift+I, Ctrl+U)
    const preventInspectKeys = (e) => {
      if (
        e.keyCode === 123 || // F12
        (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
        (e.ctrlKey && e.keyCode === 85) // Ctrl+U (View Source)
      ) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', preventInspectKeys);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventInspectKeys);
    };
  }, []);

  if (initStatus === 'loading') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div>
        <p className="text-sm font-semibold tracking-wider text-emerald-400">
          安全環境初始化與解密題庫中...
        </p>
      </div>
    );
  }

  if (initStatus === 'error') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4 p-6 text-center">
        <div className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/20">
          <Icon name="alert-triangle" size={32} />
        </div>
        <h3 className="text-xl font-bold">資料庫初始化失敗</h3>
        <p className="text-sm text-slate-400 max-w-md">
          無法解密或載入離線題庫資源。請重新整理頁面，或檢查伺服器是否正確放置了編譯加密後的題庫檔案。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm"
        >
          重新整理頁面
        </button>
      </div>
    );
  }

  return <QuizWorkspace />;
}
