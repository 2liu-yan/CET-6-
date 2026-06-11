import React, { useState, useEffect, useMemo } from "react";
import { PREDEFINED_STORIES, Story, WordItem } from "./predefinedStories";
import StoryReader from "./components/StoryReader";
import StoryCreator from "./components/StoryCreator";
import QuizView from "./components/QuizView";
import WordList from "./components/WordList";
import { BookOpen, Sparkles, Notebook, HelpCircle, GraduationCap, Flame, Star, StarOff, Grid, List, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<"stories" | "ai-creator" | "notebook" | "quiz">("stories");

  // Unlocked / Library Stories: Predefined + User's Custom Stories
  const [stories, setStories] = useState<Story[]>(() => {
    const saved = localStorage.getItem("cet6_stories");
    if (saved) {
      try {
        const decoded = JSON.parse(saved);
        if (Array.isArray(decoded) && decoded.length > 0) {
          // Merge to ensure predefined are always there
          const custom = decoded.filter((s: Story) => !PREDEFINED_STORIES.some((p) => p.id === s.id));
          return [...PREDEFINED_STORIES, ...custom];
        }
      } catch (e) {
        console.error("LocalStories restore error:", e);
      }
    }
    return PREDEFINED_STORIES;
  });

  // Mastered Words list state
  const [masteredWords, setMasteredWords] = useState<string[]>(() => {
    const saved = localStorage.getItem("cet6_mastered_words");
    return saved ? JSON.parse(saved) : [];
  });

  // Bookmarked Words list state
  const [bookmarkedWords, setBookmarkedWords] = useState<string[]>(() => {
    const saved = localStorage.getItem("cet6_bookmarked_words");
    return saved ? JSON.parse(saved) : [];
  });

  // Currently playing / Studying story selection
  const [selectedStoryId, setSelectedStoryId] = useState<string>("pres_boyfriend");

  // Daily Streak
  const [streak, setStreak] = useState<number>(() => {
    const saved = localStorage.getItem("study_streak") || "1";
    return parseInt(saved, 10);
  });

  // Synchronize localStorage
  useEffect(() => {
    localStorage.setItem("cet6_stories", JSON.stringify(stories));
  }, [stories]);

  useEffect(() => {
    localStorage.setItem("cet6_mastered_words", JSON.stringify(masteredWords));
  }, [masteredWords]);

  useEffect(() => {
    localStorage.setItem("cet6_bookmarked_words", JSON.stringify(bookmarkedWords));
  }, [bookmarkedWords]);

  // Aggregate global vocabulary list from ALL currently loaded stories
  const globalWords = useMemo(() => {
    const map = new Map<string, WordItem>();
    stories.forEach((s) => {
      s.words.forEach((w) => {
        if (w && w.word) {
          map.set(w.word.toLowerCase(), w);
        }
      });
    });
    return Array.from(map.values());
  }, [stories]);

  // Word interactions
  const handleBookmarkToggle = (word: string) => {
    const wLower = word.toLowerCase();
    setBookmarkedWords((prev) =>
      prev.includes(wLower) ? prev.filter((item) => item !== wLower) : [...prev, wLower]
    );
  };

  const isBookmarked = (word: string) => bookmarkedWords.includes(word.toLowerCase());

  const handleWordMasteredToggle = (word: string) => {
    const wLower = word.toLowerCase();
    setMasteredWords((prev) =>
      prev.includes(wLower) ? prev.filter((item) => item !== wLower) : [...prev, wLower]
    );
  };

  const isMastered = (word: string) => masteredWords.includes(word.toLowerCase());

  // Action: Add new story generated from AI
  const handleNewStoryGenerated = (newStory: Story) => {
    setStories((prev) => [newStory, ...prev]);
    setSelectedStoryId(newStory.id);
    setActiveTab("stories");
    // Increment study streak conceptually
    setStreak((prev) => {
      const next = prev + 1;
      localStorage.setItem("study_streak", next.toString());
      return next;
    });
  };

  const activeStory = useMemo(() => {
    return stories.find((s) => s.id === selectedStoryId) || stories[0];
  }, [stories, selectedStoryId]);

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#1A1A1A] selection:text-white">
      {/* Dynamic Editorial Header */}
      <header className="bg-[#FDFCFB] border-b border-[#1A1A1A]/10 sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 h-20 flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-black text-[#1A1A1A]/40 mb-1">Level: CET-6 Elite Edition</span>
            <h1 className="text-3xl sm:text-4xl font-serif italic tracking-tight text-[#1A1A1A]">Vocab Chronicles.</h1>
          </div>

          {/* Quick study metrics widgets */}
          <div className="flex items-center gap-8 sm:gap-12">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/40">掌握进度 Progress</div>
              <div className="text-lg sm:text-xl font-serif tracking-tighter text-[#1A1A1A]">
                {masteredWords.length} <span className="text-xs sm:text-sm italic opacity-50">/ {globalWords.length} 词</span>
              </div>
            </div>
            
            <div className="w-px h-8 bg-[#1A1A1A]/20"></div>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/40">连续学习 Streak</div>
              <div className="text-lg sm:text-xl font-serif tracking-tighter text-[#1A1A1A] flex items-center justify-end gap-1 leading-none pt-0.5">
                <Flame size={15} className="text-amber-600 fill-current" />
                <span>{streak} <span className="text-[11px] font-sans font-bold uppercase tracking-normal not-italic text-[#1A1A1A]/40">Days</span></span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Area */}
      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Navigation Selector Rail */}
        <div className="flex flex-wrap gap-2 border-b border-[#1A1A1A]/10 pb-0.5">
          {[
            { id: "stories", label: "故事记忆橱窗", icon: <BookOpen size={15} /> },
            { id: "ai-creator", label: "AI 造梦故事机", icon: <Sparkles size={15} /> },
            { id: "notebook", label: "词卡笔记本", icon: <Notebook size={15} /> },
            { id: "quiz", label: "核心能力自测", icon: <HelpCircle size={15} /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}-btn`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 sm:px-6 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
                  isActive
                    ? "border-[#1A1A1A] text-[#1A1A1A]"
                    : "border-transparent text-[#1A1A1A]/40 hover:text-[#1A1A1A] hover:border-[#1A1A1A]/30"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Panel Renderer */}
        <div id="tab-panel-container" className="min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === "stories" && (
              <motion.div
                key="stories-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Story selection carousel */}
                <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-5 md:p-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/50 mb-4 flex items-center gap-2">
                    <span className="w-6 h-px bg-[#1A1A1A]/40"></span> 已解锁故事章节 ({stories.length})
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {stories.map((item) => {
                      const isSelected = selectedStoryId === item.id;
                      
                      // Calculate story mastering percentage
                      const count = item.words.filter(w => isMastered(w.word)).length;
                      const percent = Math.round((count / item.words.length) * 100);

                      return (
                        <button
                          key={item.id}
                          id={`story-card-${item.id}`}
                          onClick={() => setSelectedStoryId(item.id)}
                          className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between group cursor-pointer h-28 ${
                            isSelected
                              ? "bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-md"
                              : "bg-white border-[#1A1A1A]/10 hover:border-[#1A1A1A] text-[#1A1A1A]"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xl">{item.emoji}</span>
                              {item.tags.includes("AI 智能生成") && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                                  isSelected ? "bg-white/20 text-white" : "bg-[#1A1A1A]/15 text-[#1A1A1A]"
                                }`}>
                                  AI
                                </span>
                              )}
                            </div>
                            <h4 className={`text-sm font-serif font-bold truncate max-w-[150px] ${isSelected ? "text-white" : "text-[#1A1A1A]"}`}>
                              {item.title}
                            </h4>
                          </div>

                          <div className="w-full">
                            <div className="flex justify-between items-center text-[9px] font-mono mb-1 tracking-wide">
                              <span className={isSelected ? "text-white/60" : "text-[#1A1A1A]/55"}>掌握度: {percent}%</span>
                              <span className={isSelected ? "text-white/60" : "text-[#1A1A1A]/55"}>{item.words.length} 词</span>
                            </div>
                            <div className={`w-full h-1 rounded-full overflow-hidden ${isSelected ? "bg-white/10" : "bg-[#1A1A1A]/10"}`}>
                              <div
                                className={`h-full transition-all ${isSelected ? "bg-white" : "bg-[#1A1A1A]"}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Interactive Reader */}
                <StoryReader
                  story={activeStory}
                  onBookmarkToggle={handleBookmarkToggle}
                  isBookmarked={isBookmarked}
                  onWordMasteredToggle={handleWordMasteredToggle}
                  isMastered={isMastered}
                />
              </motion.div>
            )}

            {activeTab === "ai-creator" && (
              <motion.div
                key="ai-creator-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <StoryCreator onStoryGenerated={handleNewStoryGenerated} />
              </motion.div>
            )}

            {activeTab === "notebook" && (
              <motion.div
                key="notebook-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <WordList
                  words={globalWords}
                  onBookmarkToggle={handleBookmarkToggle}
                  isBookmarked={isBookmarked}
                  onWordMasteredToggle={handleWordMasteredToggle}
                  isMastered={isMastered}
                />
              </motion.div>
            )}

            {activeTab === "quiz" && (
              <motion.div
                key="quiz-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <QuizView
                  words={globalWords}
                  onWordMastered={handleWordMasteredToggle}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Styled humbler footer */}
      <footer className="bg-white border-t border-[#1A1A1A]/15 text-[#1A1A1A]/50 text-xs py-10 mt-16">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <p className="font-serif italic text-[#1A1A1A] text-sm">Vocab Chronicles.</p>
          <div className="flex justify-center gap-6 text-[10px] uppercase tracking-widest font-bold opacity-60">
            <span>© 2026 CET-6 词汇故事记忆法</span>
            <span>·</span>
            <span>极致细节雕琢</span>
            <span>·</span>
            <span>智能交互式伴侣</span>
          </div>
          <p className="text-[#1A1A1A]/50 text-xs max-w-md mx-auto leading-relaxed font-sans">
            小诀窍：长按或双击单词能唤起手机或PC系统自带查词词典，祝您高分顺利通关六级考试！
          </p>
        </div>
      </footer>
    </div>
  );
}
