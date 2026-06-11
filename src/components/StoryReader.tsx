import React, { useState, useMemo } from "react";
import { Play, Volume2, Bookmark, CheckCircle, Info, RefreshCw, Award, ArrowRight } from "lucide-react";
import { Story, WordItem } from "../predefinedStories";
import { motion, AnimatePresence } from "motion/react";

interface StoryReaderProps {
  story: Story;
  onBookmarkToggle: (word: string) => void;
  isBookmarked: (word: string) => boolean;
  onWordMasteredToggle: (word: string) => void;
  isMastered: (word: string) => boolean;
}

export function parseStoryLines(text: string) {
  const regex = /\{([a-zA-Z\s\-\/']+)\}\(([^)]+)\)/g;
  const lines = text.split("\n");
  
  return lines.map((line, lineIndex) => {
    const parts: { id: string; type: "text" | "word"; value: string; translation?: string }[] = [];
    let lastIndex = 0;
    let match;
    let partCounter = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          id: `line-${lineIndex}-p-${partCounter++}`,
          type: "text",
          value: line.slice(lastIndex, match.index)
        });
      }
      parts.push({
        id: `line-${lineIndex}-p-${partCounter++}`,
        type: "word",
        value: match[1],
        translation: match[2]
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push({
        id: `line-${lineIndex}-p-${partCounter++}`,
        type: "text",
        value: line.slice(lastIndex)
      });
    }

    return { lineIndex, parts };
  });
}

export default function StoryReader({
  story,
  onBookmarkToggle,
  isBookmarked,
  onWordMasteredToggle,
  isMastered
}: StoryReaderProps) {
  const [selectedWord, setSelectedWord] = useState<WordItem | null>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  // Parse lines for interactive display
  const parsedLines = useMemo(() => parseStoryLines(story.text), [story.text]);

  // TTS Pronunciation Action
  const playTTS = (wordText: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(wordText);
      utterance.lang = "en-US";
      utterance.rate = 0.85; // Slightly slower for better learning
      window.speechSynthesis.speak(utterance);
    } else {
      alert("您的浏览器暂不支持语音播报");
    }
  };

  // Find a word's detail definition or generate fallback
  const getWordDetails = (wordText: string, translationText: string): WordItem => {
    const found = story.words.find(w => w.word.toLowerCase() === wordText.toLowerCase());
    return found || {
      word: wordText,
      translation: translationText,
      phonetic: "[暂无音标]",
      example: `No context sentence. But it means: ${translationText}.`
    };
  };

  // Handle word clicking
  const handleWordClick = (wordText: string, translationText: string) => {
    const details = getWordDetails(wordText, translationText);
    setSelectedWord(details);
    playTTS(wordText);
  };

  // Generates 4 items for quiz options
  const quizQuestions = useMemo(() => {
    return story.words.slice(0, 5).map((w, index) => {
      // Pick 3 wrong options from other words or generic
      const wrongOptions = story.words
        .filter(item => item.word !== w.word)
        .map(item => item.translation)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      
      const options = Array.from(new Set([w.translation, ...wrongOptions])).sort(() => 0.5 - Math.random());
      
      return {
        word: w.word,
        correct: w.translation,
        options
      };
    });
  }, [story.words]);

  const handleSelectQuizOption = (word: string, value: string) => {
    setQuizAnswers(prev => ({ ...prev, [word]: value }));
  };

  const handleCheckAnswers = () => {
    setShowQuizResults(true);
  };

  const handleResetQuiz = () => {
    setQuizAnswers({});
    setShowQuizResults(false);
    setQuizMode(false);
  };

  const completedCount = useMemo(() => {
    return story.words.filter(w => isMastered(w.word)).length;
  }, [story.words, isMastered]);

  const masteryPercent = Math.round((completedCount / story.words.length) * 100);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start text-[#1A1A1A]">
      {/* Narrative Section */}
      <div className="md:col-span-7 lg:col-span-8 space-y-6">
        <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-8 border-b border-[#1A1A1A]/10 pb-6">
            <div className="flex items-start gap-4">
              <span className="text-4xl">{story.emoji}</span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-[#1A1A1A] text-white">
                  STORY CHAPTER
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#1A1A1A] mt-2">
                  {story.title}
                </h2>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {story.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] rounded font-semibold font-sans">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Quick Stats in Editorial Mode */}
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-[#1A1A1A]/10">
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider font-bold text-[#1A1A1A]/40 font-sans">记忆进度 Progress</p>
                <p className="text-xs font-bold text-emerald-800 font-sans">{completedCount} / {story.words.length} ({masteryPercent}%)</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-800 font-serif italic text-sm font-bold font-mono">
                {masteryPercent}%
              </div>
            </div>
          </div>

          {/* Render Text Body */}
          <div className="space-y-6 text-[#1A1A1A] leading-relaxed text-base md:text-[18px] tracking-wide font-serif">
            {parsedLines.map((line, li) => {
              if (line.parts.length === 0 || (line.parts.length === 1 && line.parts[0].value.trim() === "")) {
                return <div key={li} className="h-2"></div>;
              }
              return (
                <p key={li} className="relative hover:opacity-90 transition-opacity duration-200 leading-loose">
                  {line.parts.map((p) => {
                    if (p.type === "word") {
                      const learned = isMastered(p.value);
                      const bmed = isBookmarked(p.value);
                      const isSelected = selectedWord?.word.toLowerCase() === p.value.toLowerCase();

                      return (
                        <button
                          key={p.id}
                          id={`word-btn-${p.value}`}
                          onClick={() => handleWordClick(p.value, p.translation || "")}
                          className={`inline-flex flex-col items-start mx-1 my-0.5 px-2.5 py-1 rounded transition-all duration-300 text-[15px] md:text-[16px] cursor-pointer align-middle ${
                            isSelected
                              ? "bg-[#1A1A1A] text-white border-l-4 border-l-amber-400 scale-102 shadow-sm"
                              : learned
                              ? "bg-emerald-50/70 border-b-2 border-emerald-500/70 text-[#1A1A1A] hover:bg-emerald-50"
                              : "bg-white border border-[#1A1A1A]/10 border-b-2 border-b-[#1A1A1A]/30 text-[#1A1A1A] hover:bg-white/80 hover:border-[#1A1A1A]/30"
                          }`}
                        >
                          <span className="font-bold tracking-wide">
                            {p.value}
                          </span>
                          <span className="text-[10px] md:text-[10.5px] font-sans font-medium tracking-tight opacity-80 leading-tight">
                            {p.translation}
                          </span>
                        </button>
                      );
                    }
                    return <span key={p.id} className="align-middle">{p.value}</span>;
                  })}
                </p>
              );
            })}
          </div>

          {/* Quick Quiz trigger in Editorial Mode */}
          <div className="mt-8 pt-6 border-t border-[#1A1A1A]/10 flex flex-wrap gap-4 items-center justify-between">
            <span className="text-[11px] text-[#1A1A1A]/50 flex items-center gap-1.5 font-sans">
              <Info size={14} className="text-[#1A1A1A]/60" />
              点击文中带外边框的学术核心生词，即可随听专业朗读，同时查阅极简例句与真题备考释义。
            </span>
            <button
              id="start-quick-quiz-btn"
              onClick={() => setQuizMode(!quizMode)}
              className="px-5 py-2.5 bg-[#1A1A1A] text-white hover:bg-black font-sans font-bold uppercase tracking-widest text-xs transition-all cursor-pointer rounded-lg"
            >
              {quizMode ? "显示故事正文 SHOW TEXT" : "本章快速自测 TAKE QUIZ"}
            </button>
          </div>
        </div>

        {/* Dynamic Quiz Card */}
        <AnimatePresence mode="wait">
          {quizMode && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-white border-l-4 border-l-[#1A1A1A] border border-[#1A1A1A]/10 rounded-xl p-6 md:p-8 shadow-sm"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-serif italic font-bold text-[#1A1A1A] flex items-center gap-2">
                  <span className="text-[#1A1A1A] font-mono font-bold">⚡</span>
                  本章核心单词五题快测 Quick Quiz
                </h3>
                <button
                  onClick={handleResetQuiz}
                  className="px-3 py-1.5 text-xs bg-[#FAF9F6] hover:bg-[#FAF9F6]/80 text-[#1A1A1A] border border-[#1A1A1A]/10 rounded-lg flex items-center gap-1.5 cursor-pointer font-bold"
                >
                  <RefreshCw size={12} /> 重设测验
                </button>
              </div>

              <div className="space-y-6">
                {quizQuestions.map((q, idx) => {
                  const savedAnswer = quizAnswers[q.word];
                  const isCorrect = savedAnswer === q.correct;
                  
                  return (
                    <div key={q.word} className="pb-5 border-b border-[#1A1A1A]/10 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="w-5 h-5 rounded bg-[#1A1A1A] text-[10px] text-white font-mono flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <p className="text-[#1A1A1A] font-serif font-bold text-base">{q.word}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt) => {
                          const isSelected = savedAnswer === opt;
                          let btnStyle = "bg-[#FAF9F6] text-[#1A1A1A] border-[#1A1A1A]/10 hover:bg-white hover:border-[#1A1A1A]/30";
                          
                          if (isSelected) {
                            if (showQuizResults) {
                              btnStyle = isCorrect 
                                ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-bold" 
                                : "bg-rose-50 border-rose-500 text-rose-800 font-bold";
                            } else {
                              btnStyle = "bg-[#1A1A1A] border-[#1A1A1A] text-white font-bold";
                            }
                          } else if (showQuizResults && opt === q.correct) {
                            btnStyle = "bg-emerald-50/60 border-2 border-emerald-400 text-emerald-800";
                          }

                          return (
                            <button
                              key={opt}
                              disabled={showQuizResults}
                              onClick={() => handleSelectQuizOption(q.word, opt)}
                              className={`p-3 text-left text-sm rounded-xl border transition-all duration-200 cursor-pointer ${btnStyle}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!showQuizResults ? (
                <button
                  onClick={handleCheckAnswers}
                  disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                  className="mt-6 w-full py-3.5 bg-[#1A1A1A] hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed text-white uppercase tracking-widest font-sans font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer rounded-lg"
                >
                  提交核对答案 SUBMIT ANSWERS
                </button>
              ) : (
                <div className="mt-6 p-4 rounded-xl bg-[#FAF9F6] border border-[#1A1A1A]/10 flex flex-wrap items-center justify-between gap-4">
                  <span className="text-sm font-bold text-[#1A1A1A] font-serif">
                    成绩报告 Score:{" "}
                    <strong className="text-emerald-700 font-bold font-mono text-base">
                      {quizQuestions.filter(q => quizAnswers[q.word] === q.correct).length} / {quizQuestions.length}
                    </strong>
                  </span>
                  <button
                    onClick={handleResetQuiz}
                    className="px-4 py-2 bg-[#1A1A1A] text-white hover:bg-black font-sans font-bold text-xs uppercase tracking-widest rounded flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    重来一次 RETRY <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Vocabulary Detail Panel / Selection Card */}
      <div className="md:col-span-5 lg:col-span-4 space-y-6">
        <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-6 shadow-sm sticky top-24">
          <h3 className="text-xs font-bold text-[#1A1A1A] font-serif uppercase tracking-widest mb-4 pb-2 border-b border-[#1A1A1A]/10 flex items-center gap-2">
            <span className="w-5 h-px bg-[#1A1A1A]"></span> 词卡详释 Repository
          </h3>

          <AnimatePresence mode="wait">
            {selectedWord ? (
              <motion.div
                key={selectedWord.word}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-5"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-2xl font-serif font-bold text-[#1A1A1A]">{selectedWord.word}</h4>
                    <button
                      onClick={() => playTTS(selectedWord.word)}
                      className="p-2.5 bg-white border border-[#1A1A1A]/10 hover:border-[#1A1A1A] text-[#1A1A1A] rounded-lg transition-all cursor-pointer"
                      title="朗读发音"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                  {selectedWord.phonetic && (
                    <p className="text-xs text-[#1A1A1A]/50 font-mono tracking-wider italic font-semibold">
                      {selectedWord.phonetic}
                    </p>
                  )}
                </div>

                {/* Translation definition block */}
                <div className="bg-white p-4 rounded-xl border border-[#1A1A1A]/10 border-l-4 border-l-[#1A1A1A]">
                  <p className="text-[10px] uppercase font-bold text-[#1A1A1A]/40 tracking-wider font-sans mb-1">大类释义 Definition</p>
                  <p className="text-[#1A1A1A] font-bold text-[15px] leading-relaxed">
                    {selectedWord.translation}
                  </p>
                </div>

                {/* Micro Context / Example Sentence */}
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#1A1A1A]/40 tracking-wider font-sans mb-1.5">考点学堂 Examples</p>
                  <div className="bg-white p-3.5 rounded-xl border border-[#1A1A1A]/10 text-[#1A1A1A] text-xs font-serif italic leading-relaxed">
                    {selectedWord.example || "正在搜集本词典型高分搭配或例句..."}
                  </div>
                </div>

                {/* Action Controls for this Word */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    id={`bookmark-toggle-${selectedWord.word}`}
                    onClick={() => onBookmarkToggle(selectedWord.word)}
                    className={`py-2.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                      isBookmarked(selectedWord.word)
                        ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                        : "bg-white border-[#1A1A1A]/10 text-[#1A1A1A]/80 hover:bg-[#FAF9F6] hover:text-[#1A1A1A]"
                    }`}
                  >
                    <Bookmark size={13} className={isBookmarked(selectedWord.word) ? "fill-current" : ""} />
                    {isBookmarked(selectedWord.word) ? "已收藏" : "加收藏"}
                  </button>

                  <button
                    id={`master-toggle-${selectedWord.word}`}
                    onClick={() => onWordMasteredToggle(selectedWord.word)}
                    className={`py-2.5 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                      isMastered(selectedWord.word)
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-bold"
                        : "bg-white border-[#1A1A1A]/10 text-[#1A1A1A]/80 hover:bg-[#FAF9F6]"
                    }`}
                  >
                    <CheckCircle size={13} className={isMastered(selectedWord.word) ? "fill-current" : ""} />
                    {isMastered(selectedWord.word) ? "已熟记 ✔" : "标记掌握"}
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="py-12 text-center text-[#1A1A1A]/40 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full border border-[#1A1A1A]/10 flex items-center justify-center text-[#1A1A1A]/60">
                  <Info size={18} />
                </div>
                <div className="max-w-[210px] text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/60">请点击文中的加粗单词</p>
                  <p className="text-[11px] text-[#1A1A1A]/40 mt-1.5">即可在这里调用经典词卡释义、纯正TTS发音跟掌握状态打标记。</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Word index list quick overview */}
        <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-[#1A1A1A]/50 uppercase tracking-widest mb-3 font-sans flex items-center gap-2">
            <span className="w-4 h-px bg-[#1A1A1A]/40"></span> 本章生词索引 ({story.words.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {story.words.map((w) => {
              const learned = isMastered(w.word);
              return (
                <button
                  key={w.word}
                  onClick={() => handleWordClick(w.word, w.translation)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono transition-all duration-200 cursor-pointer ${
                    learned
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-white border-[#1A1A1A]/10 text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white hover:border-[#1A1A1A]"
                  }`}
                >
                  {w.word}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
