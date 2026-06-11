import React, { useState, useMemo } from "react";
import { Search, Bookmark, CheckCircle, Volume2, HelpCircle, Layers } from "lucide-react";
import { WordItem } from "../predefinedStories";

interface WordListProps {
  words: WordItem[];
  onBookmarkToggle: (word: string) => void;
  isBookmarked: (word: string) => boolean;
  onWordMasteredToggle: (word: string) => void;
  isMastered: (word: string) => boolean;
}

export default function WordList({
  words,
  onBookmarkToggle,
  isBookmarked,
  onWordMasteredToggle,
  isMastered
}: WordListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "bookmarked" | "mastered" | "unmastered">("all");
  const [viewMode, setViewMode] = useState<"list" | "flashcard">("list");
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  // TTS Voice
  const playTTS = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const ut = new SpeechSynthesisUtterance(text);
      ut.lang = "en-US";
      ut.rate = 0.85;
      window.speechSynthesis.speak(ut);
    }
  };

  // Filter word collection
  const filteredWords = useMemo(() => {
    return words.filter((item) => {
      // Search matching
      const matchesSearch =
        item.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.translation.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Category filter matching
      const bmed = isBookmarked(item.word);
      const learned = isMastered(item.word);

      switch (filter) {
        case "bookmarked":
          return bmed;
        case "mastered":
          return learned;
        case "unmastered":
          return !learned;
        default:
          return true;
      }
    });
  }, [words, searchQuery, filter, isBookmarked, isMastered]);

  const toggleFlip = (word: string) => {
    setFlippedCards((prev) => ({
      ...prev,
      [word]: !prev[word]
    }));
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilter("all");
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      {/* Control panel & options */}
      <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
              <Layers size={18} className="text-[#1A1A1A]" />
              大学英语六级记词账本 INDEX
            </h3>
            <p className="text-xs text-[#1A1A1A]/50 mt-1">
              可对本书已解锁的计 {words.length} 个单词进行自定义筛选、检索和闪卡背诵。
            </p>
          </div>

          {/* Flashcard vs List Switcher */}
          <div className="flex bg-[#1A1A1A]/5 p-1 rounded-lg border border-[#1A1A1A]/10">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "list" ? "bg-[#1A1A1A] text-white font-bold" : "text-[#1A1A1A]/60 hover:text-[#1A1A1A]"
              }`}
            >
              列表视图
            </button>
            <button
              onClick={() => setViewMode("flashcard")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "flashcard" ? "bg-[#1A1A1A] text-white font-bold" : "text-[#1A1A1A]/60 hover:text-[#1A1A1A]"
              }`}
            >
              经典闪卡 (背诵模式)
            </button>
          </div>
        </div>

        {/* Search Input and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search size={15} className="absolute left-3.5 top-3.5 text-[#1A1A1A]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索英文单词或中文解释..."
              className="w-full bg-white border border-[#1A1A1A]/15 focus:border-[#1A1A1A] rounded-xl py-2.5 pl-10 pr-4 text-[#1A1A1A] text-sm outline-none transition-all placeholder:text-[#1A1A1A]/30"
            />
          </div>

          <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-xl border border-[#1A1A1A]/15 md:col-span-2 text-xs font-semibold">
            {[
              { id: "all", label: "全部" },
              { id: "bookmarked", label: "收藏" },
              { id: "mastered", label: "已掌握" },
              { id: "unmastered", label: "未熟记" }
            ].map((cfg) => (
              <button
                key={cfg.id}
                onClick={() => setFilter(cfg.id as any)}
                className={`py-1.5 px-0.5 text-center rounded-lg transition-all cursor-pointer ${
                  filter === cfg.id ? "bg-[#1A1A1A] text-white font-bold" : "text-[#1A1A1A]/50 hover:text-[#1A1A1A]"
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === "list" ? (
        /* List Mode View */
        filteredWords.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredWords.map((item) => {
              const bmed = isBookmarked(item.word);
              const learned = isMastered(item.word);
              
              return (
                <div
                  key={item.word}
                  className="bg-white border border-[#1A1A1A]/10 hover:border-[#1A1A1A]/25 hover:bg-[#FAF9F6]/50 rounded-2xl p-4 transition-all duration-200 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-serif font-bold text-[#1A1A1A] tracking-wide">{item.word}</h4>
                        <button
                          onClick={() => playTTS(item.word)}
                          className="p-1 hover:bg-[#1A1A1A]/5 text-[#1A1A1A]/40 hover:text-[#1A1A1A] rounded transition-all cursor-pointer"
                        >
                          <Volume2 size={13} />
                        </button>
                      </div>
                      <p className="text-[10px] text-[#1A1A1A]/40 font-mono tracking-wide italic mt-0.5 font-semibold">{item.phonetic}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onBookmarkToggle(item.word)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          bmed 
                            ? "bg-[#1A1A1A] border-[#1A1A1A] text-white" 
                            : "bg-white border-[#1A1A1A]/10 text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                        }`}
                        title="添加到收藏"
                      >
                        <Bookmark size={11} className={bmed ? "fill-current" : ""} />
                      </button>
                      <button
                        onClick={() => onWordMasteredToggle(item.word)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          learned 
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold" 
                            : "bg-white border-[#1A1A1A]/10 text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                        }`}
                        title="标为已熟记"
                      >
                        <CheckCircle size={11} className={learned ? "fill-current" : ""} />
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-[#1A1A1A] text-sm font-serif font-bold">{item.translation}</p>
                  
                  {item.example && (
                    <p className="mt-2.5 text-[11px] text-[#1A1A1A]/50 bg-[#FAF9F6] p-2 border border-[#1A1A1A]/10 rounded-lg select-all leading-relaxed font-serif">
                      {item.example}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl py-12 text-center max-w-md mx-auto text-[#1A1A1A]">
            <HelpCircle size={40} className="mx-auto text-[#1A1A1A]/40 mb-3" />
            <p className="text-sm font-bold font-sans">无匹配的单词</p>
            <p className="text-xs text-[#1A1A1A]/50 mt-1.5">您可能还未解锁本类目词汇，或搜索关键词不存在。</p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white font-sans font-bold uppercase tracking-widest text-xs rounded-lg cursor-pointer transition-all"
            >
              重置筛选 RE-FILTER
            </button>
          </div>
        )
      ) : (
        /* Flashcard背诵模式 */
        filteredWords.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredWords.map((item) => {
              const bmed = isBookmarked(item.word);
              const learned = isMastered(item.word);
              const isFlipped = flippedCards[item.word] || false;

              return (
                <div
                  key={item.word}
                  onClick={() => toggleFlip(item.word)}
                  style={{ perspective: "1000px" }}
                  className="h-44 group cursor-pointer relative"
                >
                  <div
                    className={`relative w-full h-full transition-transform duration-500 ease-out preserve-3d ${
                      isFlipped ? "rotate-y-180" : ""
                    }`}
                  >
                    {/* Front side (English) */}
                    <div className="absolute w-full h-full backface-hidden bg-white border border-[#1A1A1A]/10 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[9px] text-[#1A1A1A]/40 uppercase tracking-widest font-bold font-sans">单词闪卡 FRONT</p>
                          <h4 className="text-2xl font-serif font-bold text-[#1A1A1A] mt-1 tracking-wide">{item.word}</h4>
                          <p className="text-xs text-[#1A1A1A]/60 font-mono tracking-wider italic font-semibold">{item.phonetic || "[美声发音]"}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playTTS(item.word);
                          }}
                          className="p-2.5 bg-[#FAF9F6] border border-[#1A1A1A]/10 hover:border-[#1A1A1A] text-[#1A1A1A] rounded-xl cursor-pointer"
                        >
                          <Volume2 size={14} />
                        </button>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2 border-t border-[#1A1A1A]/10 mt-auto">
                        <span className="text-[10px] text-[#1A1A1A]/50 group-hover:text-[#1A1A1A] transition-colors font-sans">点击翻转词义卡 REVERSE</span>
                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onBookmarkToggle(item.word)}
                            className={`p-1.5 rounded-lg border cursor-pointer ${
                              bmed ? "bg-[#1A1A1A] border-[#1A1A1A] text-white" : "bg-white border-[#1A1A1A]/15 text-[#1A1A1A]/40"
                            }`}
                          >
                            <Bookmark size={11} className={bmed ? "fill-current" : ""} />
                          </button>
                          <button
                            onClick={() => onWordMasteredToggle(item.word)}
                            className={`p-1.5 rounded-lg border cursor-pointer ${
                              learned ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-[#1A1A1A]/15 text-[#1A1A1A]/40"
                            }`}
                          >
                            <CheckCircle size={11} className={learned ? "fill-current" : ""} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Back side (Translation) */}
                    <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-[#1A1A1A] border border-[#1A1A1A] rounded-2xl p-5 flex flex-col justify-between shadow-md text-white">
                      <div>
                        <p className="text-[9px] text-white/50 uppercase tracking-widest font-sans font-bold">词义卡 BACK</p>
                        <h4 className="text-lg font-serif font-bold text-white mt-1.5">{item.translation}</h4>
                      </div>

                      {item.example && (
                        <p className="text-[11px] text-white/75 font-serif italic bg-white/10 p-2 rounded-lg leading-relaxed max-h-16 overflow-y-auto mt-2">
                          {item.example}
                        </p>
                      )}

                      <div className="text-[10px] text-white/40 pt-2 border-t border-white/10 mt-auto font-sans">
                        再次点击卡片翻回正页 BACK TO TEXT
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl py-12 text-center max-w-md mx-auto text-[#1A1A1A]">
            <HelpCircle size={40} className="mx-auto text-[#1A1A1A]/40 mb-3" />
            <p className="text-sm font-bold font-sans">无匹配的背诵闪卡</p>
            <p className="text-xs text-[#1A1A1A]/50 mt-1">您可以重设筛选，查看未掌握或已收藏背诵卡片。</p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white font-sans font-bold uppercase tracking-widest text-xs rounded-lg cursor-pointer transition-all"
            >
              重置筛选 CLEAR FILTERS
            </button>
          </div>
        )
      )}
    </div>
  );
}
