import React, { useState, useMemo } from "react";
import { Volume2, Check, AlertCircle, RefreshCw, Award, Play, ChevronRight, HelpCircle } from "lucide-react";
import { WordItem } from "../predefinedStories";

interface QuizViewProps {
  words: WordItem[];
  onWordMastered?: (word: string) => void;
}

export default function QuizView({ words, onWordMastered }: QuizViewProps) {
  const [quizType, setQuizType] = useState<"match" | "dictation">("match");
  const [activeStep, setActiveStep] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);

  // Filter valid words to prevent crashes
  const validWords = useMemo(() => {
    return words.filter(w => w && w.word);
  }, [words]);

  // Generate 10 random questions or all if words are fewer
  const questions = useMemo(() => {
    if (validWords.length === 0) return [];
    
    const shuffled = [...validWords].sort(() => 0.5 - Math.random());
    const sliceCount = Math.min(10, shuffled.length);
    const selected = shuffled.slice(0, sliceCount);

    return selected.map(q => {
      // Pick 3 random distractors
      const distractors = validWords
        .filter(w => w.word !== q.word)
        .map(w => w.translation)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      
      const options = Array.from(new Set([q.translation, ...distractors])).sort(() => 0.5 - Math.random());

      return {
        word: q.word,
        correctTranslation: q.translation,
        phonetic: q.phonetic || "",
        options
      };
    });
  }, [validWords, quizType, activeStep === 0 && !isQuizCompleted]); // refresh trigger when reset

  const playTTS = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const ut = new SpeechSynthesisUtterance(text);
      ut.lang = "en-US";
      ut.rate = 0.85;
      window.speechSynthesis.speak(ut);
    }
  };

  const currentQuestion = questions[activeStep];

  // TTS Pronunciation on dictation question load
  React.useEffect(() => {
    if (quizType === "dictation" && currentQuestion && !isQuizCompleted) {
      playTTS(currentQuestion.word);
    }
  }, [quizType, activeStep, isQuizCompleted]);

  const handleOptionSelect = (option: string) => {
    if (checked) return;
    setSelectedOption(option);
  };

  const handleCheckAnswer = () => {
    if (checked) return;

    let correct = false;
    if (quizType === "match") {
      correct = selectedOption === currentQuestion.correctTranslation;
    } else {
      correct = userAnswer.trim().toLowerCase() === currentQuestion.word.trim().toLowerCase();
    }

    if (correct) {
      setScore(prev => prev + 1);
      if (onWordMastered) {
        onWordMastered(currentQuestion.word);
      }
    }

    setChecked(true);
  };

  const handleNext = () => {
    setSelectedOption(null);
    setUserAnswer("");
    setChecked(false);

    if (activeStep < questions.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      setIsQuizCompleted(true);
    }
  };

  const handleRestart = () => {
    setActiveStep(0);
    setUserAnswer("");
    setSelectedOption(null);
    setChecked(false);
    setScore(0);
    setIsQuizCompleted(false);
  };

  if (validWords.length === 0) {
    return (
      <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-12 text-center max-w-xl mx-auto text-[#1A1A1A]">
        <HelpCircle size={48} className="mx-auto text-[#1A1A1A]/50 mb-4 animate-bounce" />
        <h3 className="text-lg font-serif font-bold text-[#1A1A1A] mb-2">词库中空空如也</h3>
        <p className="text-[#1A1A1A]/60 text-sm">
          您需要先选择一个包含单词的故事，或通过AI自动生成专属故事后才能开始测验！
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-6 md:p-8 shadow-sm text-[#1A1A1A]">
      {/* Quiz controls header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1A1A1A]/10 pb-5 mb-6">
        <div>
          <h3 className="text-xl font-serif font-bold text-[#1A1A1A]">六级高频记忆自测 QUIZ</h3>
          <p className="text-xs text-[#1A1A1A]/50 mt-1">
            智能测试，每组测验包含随机 {questions.length} 道词汇题。
          </p>
        </div>

        {/* Mode Selector */}
        {!isQuizCompleted && activeStep === 0 && !checked && (
          <div className="flex bg-[#1A1A1A]/5 p-1 rounded-lg border border-[#1A1A1A]/10">
            <button
              onClick={() => setQuizType("match")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                quizType === "match" ? "bg-[#1A1A1A] text-white font-bold" : "text-[#1A1A1A]/65 hover:text-[#1A1A1A]"
              }`}
            >
              英译汉单选
            </button>
            <button
              onClick={() => setQuizType("dictation")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                quizType === "dictation" ? "bg-[#1A1A1A] text-white font-bold" : "text-[#1A1A1A]/65 hover:text-[#1A1A1A]"
              }`}
            >
              英美音听写
            </button>
          </div>
        )}
      </div>

      {!isQuizCompleted ? (
        <div className="space-y-6">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-[#1A1A1A]/50 mb-2 font-sans font-semibold">
              <span>第 {activeStep + 1} / {questions.length} 题</span>
              <span>正确率: {score} / {activeStep + (checked ? 1 : 0)}</span>
            </div>
            <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-[#1A1A1A]/10">
              <div
                className="bg-[#1A1A1A] h-full transition-all duration-300"
                style={{ width: `${((activeStep + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question canvas block */}
          <div className="bg-white p-6 md:p-8 rounded-xl border border-[#1A1A1A]/10 text-center relative overflow-hidden flex flex-col items-center">
            {quizType === "match" ? (
              <div className="space-y-2">
                <p className="text-3xl font-serif font-black text-[#1A1A1A] tracking-wide">{currentQuestion.word}</p>
                <p className="text-[11px] text-[#1A1A1A]/50 font-mono tracking-wider italic font-semibold">{currentQuestion.phonetic}</p>
                <button
                  onClick={() => playTTS(currentQuestion.word)}
                  className="mx-auto mt-2.5 p-2 bg-[#FAF9F6] border border-[#1A1A1A]/10 hover:border-[#1A1A1A] text-[#1A1A1A] rounded-lg flex items-center justify-center cursor-pointer"
                  title="朗读"
                >
                  <Volume2 size={15} />
                </button>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <button
                  className="w-14 h-14 rounded-full bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 text-[#1A1A1A] flex items-center justify-center mx-auto border border-[#1A1A1A]/10 cursor-pointer transition-all duration-200"
                  onClick={() => playTTS(currentQuestion.word)}
                >
                  <Volume2 size={24} />
                </button>
                <div>
                  <p className="text-xs font-bold text-[#1A1A1A]/50 font-sans uppercase tracking-wider">点击喇叭播报美声发音</p>
                  <p className="text-xs text-[#1A1A1A]/70 font-serif italic mt-1.5 leading-relaxed">提示释义: {currentQuestion.correctTranslation}</p>
                </div>
              </div>
            )}
          </div>

          {/* Answer Area */}
          {quizType === "match" ? (
            <div className="grid grid-cols-1 gap-2">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedOption === opt;
                let btnClass = "bg-white border-[#1A1A1A]/10 text-[#1A1A1A]/80 hover:bg-[#FAF9F6] hover:border-[#1A1A1A]/20";

                if (checked) {
                  if (opt === currentQuestion.correctTranslation) {
                    btnClass = "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold";
                  } else if (isSelected) {
                    btnClass = "bg-rose-50 border-rose-300 text-rose-800 font-bold";
                  }
                } else if (isSelected) {
                  btnClass = "bg-[#1A1A1A] border-[#1A1A1A] text-white font-bold scale-101";
                }

                return (
                  <button
                    key={opt}
                    disabled={checked}
                    onClick={() => handleOptionSelect(opt)}
                    className={`w-full p-3.5 text-left text-sm rounded-xl border transition-all duration-200 cursor-pointer ${btnClass}`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{opt}</span>
                      {checked && opt === currentQuestion.correctTranslation && (
                        <Check size={16} className="text-emerald-700 font-bold" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="text"
                disabled={checked}
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && userAnswer.trim()) {
                    handleCheckAnswer();
                  }
                }}
                placeholder="键入核心英文拼写填空..."
                className="w-full bg-white border border-[#1A1A1A]/15 rounded-xl p-4 text-[#1A1A1A] text-center font-serif font-bold text-lg focus:border-[#1A1A1A] outline-none transition-all placeholder:text-[#1A1A1A]/20"
              />

              {checked && (
                <div className={`p-4 rounded-xl border ${
                  userAnswer.trim().toLowerCase() === currentQuestion.word.toLowerCase()
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  <div className="flex gap-2.5">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold font-sans">
                        {userAnswer.trim().toLowerCase() === currentQuestion.word.toLowerCase() ? "拼写正确！" : "拼写有误！"}
                      </p>
                      <p className="text-xs mt-1">
                        标准拼写是: <strong className="font-serif font-bold text-gray-900 underline select-all">{currentQuestion.word}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verification buttons */}
          <div className="pt-4 flex justify-end">
            {!checked ? (
              <button
                disabled={quizType === "match" ? !selectedOption : !userAnswer.trim()}
                onClick={handleCheckAnswer}
                className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-black disabled:opacity-45 disabled:cursor-not-allowed text-white font-sans font-bold uppercase tracking-widest text-xs rounded-lg transition-all cursor-pointer"
              >
                核对校验答案 SUBMIT
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-sans font-bold uppercase tracking-widest text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-all"
              >
                下一题 NEXT <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Completion card */
        <div className="text-center py-8 space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 flex items-center justify-center mx-auto text-[#1A1A1A]">
            <Award size={32} className="animate-pulse" />
          </div>

          <div>
            <h3 className="text-2xl font-serif font-bold text-[#1A1A1A]">恭喜您，完成测验！</h3>
            <p className="text-[#1A1A1A]/60 text-sm mt-1">
              您本次闯关的最终成绩为:
            </p>
          </div>

          <div className="max-w-[260px] mx-auto bg-white border border-[#1A1A1A]/10 rounded-xl p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-[#1A1A1A]/45 font-bold mb-1 font-sans">测验成绩 SCORE</p>
            <p className="text-3xl font-bold text-[#1A1A1A] font-mono">
              <span className="text-[#1A1A1A]">{score}</span> <span className="text-[#1A1A1A]/30">/</span> <span className="text-[#1A1A1A]/50">{questions.length}</span>
            </p>
            <div className="mt-3.5 w-full bg-[#FAF9F6] h-1.5 rounded-full overflow-hidden border border-[#1A1A1A]/10">
              <div
                className="bg-[#1A1A1A] h-full"
                style={{ width: `${(score / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={handleRestart}
              className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-black text-white font-sans font-bold uppercase tracking-widest text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw size={12} /> 重新测一轮 RETRY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
