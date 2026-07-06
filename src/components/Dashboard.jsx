import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import Icon from './Icon';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Register ChartJS elements
ChartJS.register(ArcElement, Tooltip, Legend);

export default function Dashboard({ onStartPractice, onStartExam, onStartTagPractice, onStartReview, totalWrong, totalBookmarked }) {
  const [stats, setStats] = useState({
    coveragePercent: 0,
    accuracyPercent: 0,
    attemptedCount: 0,
    correctCount: 0,
    wrongCount: 0
  });

  const [daysRemaining, setDaysRemaining] = useState(0);

  // Load stats from Dexie IndexedDB
  useEffect(() => {
    async function loadStats() {
      try {
        const totalQs = 819; // Subject 1 (427) + Subject 2 (392)
        const progressList = await db.progress.toArray();
        
        const attempted = progressList.length;
        const coverage = totalQs > 0 ? Math.round((attempted / totalQs) * 100) : 0;
        
        let totalCorrect = 0;
        let totalWrong = 0;
        
        progressList.forEach(p => {
          totalCorrect += p.correctCount || 0;
          totalWrong += p.wrongCount || 0;
        });
        
        const totalAttempts = totalCorrect + totalWrong;
        const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

        setStats({
          coveragePercent: coverage,
          accuracyPercent: accuracy,
          attemptedCount: attempted,
          correctCount: totalCorrect,
          wrongCount: totalWrong
        });
      } catch (err) {
        console.error('Error loading stats:', err);
      }
    }
    loadStats();
  }, [totalWrong, totalBookmarked]);

  // Exam Countdown (Target: Minguo 115/08/15 -> August 15, 2026)
  useEffect(() => {
    const examDate = new Date('2026-08-15T00:00:00').getTime();
    
    function updateCountdown() {
      const now = new Date().getTime();
      const diff = examDate - now;
      
      if (diff <= 0) {
        setDaysRemaining(0);
        return;
      }
      
      const d = Math.ceil(diff / (1000 * 60 * 60 * 24));
      setDaysRemaining(d);
    }
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 3600000); // Update once an hour
    return () => clearInterval(interval);
  }, []);

  // Data for ChartJS
  const chartOptions = {
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    maintainAspectRatio: false
  };

  const coverageData = {
    labels: ['已練習', '未練習'],
    datasets: [{
      data: [stats.attemptedCount, Math.max(0, 819 - stats.attemptedCount)],
      backgroundColor: ['#10b981', '#334155'],
      borderWidth: 0
    }]
  };

  const accuracyData = {
    labels: ['答對', '答錯'],
    datasets: [{
      data: [stats.correctCount, stats.wrongCount],
      backgroundColor: ['#06b6d4', '#ef4444'],
      borderWidth: 0
    }]
  };

  return (
    <div className="space-y-8 animate-fade-in p-6 md:p-8 overflow-y-auto max-w-5xl mx-auto">
      
      {/* Welcome & Countdown Banner */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 dark:from-emerald-950/80 dark:to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="space-y-3 max-w-lg z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-200 text-xs font-semibold rounded-full border border-emerald-500/35">
            <Icon name="sparkles" size={12} />
            <span>離線 PWA 本地智慧硬體加速模式</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold leading-tight">
            IPAS 淨零碳規劃管理師
          </h2>
          <p className="text-sm text-emerald-100/90 leading-relaxed">
            此系統已在本地 IndexedDB 快取 **819 題雙科精選考題**。基於加權抽題演算法，會針對您的弱點自動加強出題。
          </p>
        </div>

        {/* Countdown Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 text-center shrink-0 w-full sm:w-auto z-10 shadow-lg">
          <p className="text-xs font-bold tracking-wider uppercase opacity-80">距離 115/08/15(六) 鑑定考剩餘</p>
          <div className="flex justify-center items-center gap-1.5 mt-3">
            <span className="text-4xl font-black">{daysRemaining}</span>
            <span className="text-sm font-bold opacity-90 mt-1.5">天</span>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-10 translate-y-10 float-animation">
          <Icon name="leaf" size={200} />
        </div>
      </div>

      {/* Progress Charts Grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Coverage Chart */}
        <div className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-800/40 flex items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="database" size={16} className="text-emerald-500" />
              <span>題庫覆蓋率</span>
            </h3>
            <p className="text-3xl font-extrabold text-slate-800 dark:text-white">
              {stats.coveragePercent}%
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              已練習 {stats.attemptedCount} 題 / 共 819 題
            </p>
          </div>
          <div className="w-24 h-24 relative flex-shrink-0">
            <Doughnut data={coverageData} options={chartOptions} />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-emerald-500">
              {stats.coveragePercent}%
            </div>
          </div>
        </div>

        {/* Accuracy Chart */}
        <div className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-800/40 flex items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="check-circle" size={16} className="text-cyan-500" />
              <span>整體答對率</span>
            </h3>
            <p className="text-3xl font-extrabold text-slate-800 dark:text-white">
              {stats.accuracyPercent}%
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              正確 {stats.correctCount} 次 / 總做題 {stats.correctCount + stats.wrongCount} 次
            </p>
          </div>
          <div className="w-24 h-24 relative flex-shrink-0">
            <Doughnut data={accuracyData} options={chartOptions} />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-cyan-500">
              {stats.accuracyPercent}%
            </div>
          </div>
        </div>
      </div>

      {/* Core Practice Modes Dashboard */}
      <div className="space-y-4">
        <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <Icon name="play-circle" size={22} className="text-emerald-500" />
          <span>五大精準備考模式</span>
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Mode 1: Mock Exam */}
          <button
            onClick={() => onStartExam()}
            className="glass-card p-6 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex items-start gap-4 border border-slate-200/50 dark:border-slate-850 hover:border-emerald-500/50 group"
          >
            <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/10 group-hover:scale-105 transition-transform">
              <Icon name="file-text" size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                [模式 1] 正式模擬考
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                比照官考 75 分鐘 / 50 題。作答時不提示答案，交卷後進行檢討與計分。
              </p>
            </div>
          </button>

          {/* Mode 2: Quick Practice */}
          <button
            onClick={() => onStartPractice()}
            className="glass-card p-6 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex items-start gap-4 border border-slate-200/50 dark:border-slate-850 hover:border-emerald-500/50 group"
          >
            <div className="p-3 bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-500/10 group-hover:scale-105 transition-transform">
              <Icon name="zap" size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                [模式 2] 快速刷題 (20 題)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                答對自動跳轉 (1.5s)，答錯立即彈出底部「防老花解析面板」並引導精熟。
              </p>
            </div>
          </button>

          {/* Mode 3: Tag Special Training */}
          <button
            onClick={() => onStartTagPractice()}
            className="glass-card p-6 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex items-start gap-4 border border-slate-200/50 dark:border-slate-850 hover:border-emerald-500/50 group"
          >
            <div className="p-3 bg-cyan-500 text-white rounded-xl shadow-lg shadow-cyan-500/10 group-hover:scale-105 transition-transform">
              <Icon name="tag" size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                [模式 3] 章節 / 標籤特訓
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                篩選如 ISO 14064, CBAM, 碳稅等特定單元，進行高強度、針對性的章節加強。
              </p>
            </div>
          </button>

          {/* Mode 4: Review Mode */}
          <button
            onClick={() => onStartReview()}
            className="glass-card p-6 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex items-start gap-4 border border-slate-200/50 dark:border-slate-850 hover:border-emerald-500/50 group"
          >
            <div className="p-3 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/10 group-hover:scale-105 transition-transform">
              <Icon name="heart-pulse" size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                [模式 4] 錯題與收藏複習
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                無限輪迴複習。包含錯題累積 ({totalWrong} 題) 或手動收藏 ({totalBookmarked} 題)，直到弱點徹底清除。
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
