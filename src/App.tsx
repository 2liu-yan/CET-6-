import React, { useState, useEffect, useMemo } from "react";
import { PREDEFINED_STORIES, Story, WordItem } from "./predefinedStories";
import StoryReader from "./components/StoryReader";
import StoryCreator, { CustomBoard } from "./components/StoryCreator";
import QuizView from "./components/QuizView";
import WordList from "./components/WordList";
import { 
  BookOpen, Sparkles, Notebook, HelpCircle, GraduationCap, Flame, Star, RefreshCw, 
  StarOff, Grid, List, CheckCircle, Smartphone, Monitor, QrCode, 
  Copy, Check, Share2, Tablet, AlertCircle, Info, ChevronRight, X 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<"stories" | "ai-creator" | "notebook" | "quiz">("stories");

  // WeChat Mini Program / Tablet / Web layout display emulator modes ("fluid" defaults to host client's real viewport)
  const [deviceDisplayMode, setDeviceDisplayMode] = useState<"phone" | "tablet" | "fluid">("fluid");

  // Multi-device sync scanning helper popup
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fallback to active metadata url, then dynamically resolve to current window location on mount
  const [sharedProductionUrl, setSharedProductionUrl] = useState("https://ais-pre-jvwezet5vityj72lp4fnjx-565245898863.asia-northeast1.run.app");

  useEffect(() => {
    if (typeof window !== "undefined" && window.location) {
      // Dynamically resolve to the exact active domain preview/shared path
      const activeUrl = window.location.origin + window.location.pathname;
      setSharedProductionUrl(activeUrl);
    }
  }, []);

  // Wordbook Custom Boards State
  const [customBoards, setCustomBoards] = useState<CustomBoard[]>(() => {
    try {
      const saved = localStorage.getItem("cet6_custom_boards");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse cet6_custom_boards:", e);
      return [];
    }
  });

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(() => {
    const saved = localStorage.getItem("cet6_selected_board_id");
    if (saved === "null" || saved === "undefined") return null;
    return saved || null;
  });

  const [activePageNum, setActivePageNum] = useState<number>(1);
  const [customTopic, setCustomTopic] = useState<string>("霸道总裁恋爱");
  const [isGeneratingPage, setIsGeneratingPage] = useState(false);
  const [pageGenError, setPageGenError] = useState("");

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
    try {
      const saved = localStorage.getItem("cet6_mastered_words");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse cet6_mastered_words:", e);
      return [];
    }
  });

  // Bookmarked Words list state
  const [bookmarkedWords, setBookmarkedWords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("cet6_bookmarked_words");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse cet6_bookmarked_words:", e);
      return [];
    }
  });

  // Currently playing / Studying story selection (For Predefined Default Book)
  const [selectedStoryId, setSelectedStoryId] = useState<string>("pres_boyfriend");

  // Daily Streak
  const [streak, setStreak] = useState<number>(() => {
    const saved = localStorage.getItem("study_streak") || "1";
    return parseInt(saved, 10);
  });

  // Active wordbook metadata memoizer
  const activeBoard = useMemo(() => {
    if (!selectedBoardId) return null;
    return customBoards.find(b => b.id === selectedBoardId) || null;
  }, [customBoards, selectedBoardId]);

  // Group active custom board words by pageNumber (if from PDF) or chunks of 10
  const segments = useMemo(() => {
    if (!activeBoard) return [];
    
    // Check if any word has pageNumber
    const hasPages = activeBoard.words.some(w => w.pageNumber && w.pageNumber > 0);
    const groups: { pageNum: number; words: WordItem[] }[] = [];
    
    if (hasPages) {
      const map: Record<number, WordItem[]> = {};
      activeBoard.words.forEach(w => {
        const pageIdx = w.pageNumber || 1;
        if (!map[pageIdx]) map[pageIdx] = [];
        map[pageIdx].push(w);
      });
      Object.keys(map).forEach(pStr => {
        const pNum = parseInt(pStr, 10);
        groups.push({ pageNum: pNum, words: map[pNum] });
      });
    } else {
      // Chunk into segments of 10 words
      const chunkSize = 10;
      for (let i = 0; i < activeBoard.words.length; i += chunkSize) {
        const chunkNum = Math.floor(i / chunkSize) + 1;
        groups.push({
          pageNum: chunkNum,
          words: activeBoard.words.slice(i, i + chunkSize)
        });
      }
    }
    
    return groups.sort((a, b) => a.pageNum - b.pageNum);
  }, [activeBoard]);

  // Synchronize localStorage
  useEffect(() => {
    localStorage.setItem("cet6_custom_boards", JSON.stringify(customBoards));
  }, [customBoards]);

  useEffect(() => {
    if (selectedBoardId) {
      localStorage.setItem("cet6_selected_board_id", selectedBoardId);
    } else {
      localStorage.removeItem("cet6_selected_board_id");
    }
    // Always fallback page to page 1 on board swap
    setActivePageNum(1);
  }, [selectedBoardId]);

  useEffect(() => {
    localStorage.setItem("cet6_stories", JSON.stringify(stories));
  }, [stories]);

  useEffect(() => {
    localStorage.setItem("cet6_mastered_words", JSON.stringify(masteredWords));
  }, [masteredWords]);

  useEffect(() => {
    localStorage.setItem("cet6_bookmarked_words", JSON.stringify(bookmarkedWords));
  }, [bookmarkedWords]);

  // Aggregate global vocabulary list (Notebook indexes) dynamically based on selected wordbook
  const globalWords = useMemo(() => {
    if (selectedBoardId === null) {
      // Official book: extract unique words across ALL predefined stories
      const map = new Map<string, WordItem>();
      PREDEFINED_STORIES.forEach((s) => {
        s.words.forEach((w) => {
          if (w && w.word) {
            map.set(w.word.toLowerCase(), w);
          }
        });
      });
      return Array.from(map.values());
    } else {
      // Custom uploaded board words
      return activeBoard ? activeBoard.words : [];
    }
  }, [activeBoard, selectedBoardId]);

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

  // Action: Add new story generated from AI uploader subtabs
  const handleNewStoryGenerated = (newStory: Story) => {
    // Inject custom board tagging if we have a custom board selected
    const fixedStory = {
      ...newStory,
      boardId: selectedBoardId || undefined
    };
    
    setStories((prev) => [fixedStory, ...prev]);
    setSelectedStoryId(fixedStory.id);
    setActiveTab("stories");
    // Increment study streak conceptually
    setStreak((prev) => {
      const next = prev + 1;
      localStorage.setItem("study_streak", next.toString());
      return next;
    });
  };

  // Helper generator to compose funny speed mnemonic stories locally
  const generateLocalSpeedStory = (boardName: string, pageNum: number, words: WordItem[]): Story => {
    const title = `《${boardName} · 第 ${pageNum} 页：梦境狂想》`;
    
    // Create a fun, readable mnemonic paragraph
    const sentenceParts = words.map((w, index) => {
      const connectors = [
        `为了通过考试，主角随身携带着核心考词 {word}(translation)，`,
        `紧接着，这个生词像被激活了一样，在黑板上演变成极其具有代表性的 {word}(translation) 图标，`,
        `周围的人看了一脸震撼，认为这绝非寻常，其背后隐藏着关于 {word}(translation) 的神秘寓意，`,
        `她嘴里嘟囔着：万事不如拼一把，用它指代高水准的 {word}(translation) 再合适不过，`,
        `一刹那，她的思维境界成功引发了生动的 {word}(translation) 强力共鸣，`,
        `哪怕前方的险阻依然犹如浓烟般带有些许 {word}(translation)，他仍昂首向前，`,
        `他走上讲台，自豪地分享着针对多端互通的 {word}(translation) 终极论断。`
      ];
      
      const template = connectors[index % connectors.length];
      return template
        .replace("{word}", `{${w.word.toLowerCase()}}`)
        .replace("translation", w.translation);
    });
    
    const text = `《${boardName} · 第 ${pageNum} 页剧情》\n\n在本节中，我们探寻名为《${boardName}》的脑洞法典，激活第 ${pageNum} 页极速背词法术：\n\n${sentenceParts.join("")}\n\n伴随着这一组生动、奇妙的文字纽带，画面感的记忆被同步固化，点击下方各单词，平板与微信即可跟读发音！`;
    
    return {
      id: `custom_local_${Date.now()}_p${pageNum}_${Math.random().toString(36).substr(2, 5)}`,
      title,
      emoji: "📖",
      tags: ["本地极速联想", `第 ${pageNum} 页`],
      text,
      words: words.map(w => ({
        ...w,
        phonetic: w.phonetic || "[英美发音]",
        example: w.example || "来自于您的自选词表。"
      })),
      boardId: selectedBoardId!,
      pageNumber: pageNum
    };
  };

  // Dynamic story picker
  const activeStory = useMemo(() => {
    if (selectedBoardId === null) {
      // Predefined default book story selection
      return stories.find((s) => s.id === selectedStoryId) || stories[0];
    } else {
      // Find custom story for current custom book and active pageNumber
      const found = stories.find(s => s.boardId === selectedBoardId && s.pageNumber === activePageNum);
      if (found) return found;
      
      // Return a virtual "not_generated" story placeholder
      const pageWords = segments.find(seg => seg.pageNum === activePageNum)?.words || [];
      return {
        id: `not_yet_generated_${selectedBoardId}_p${activePageNum}`,
        title: `第 ${activePageNum} 页等待脑洞爆更`,
        text: "",
        emoji: "🌌",
        tags: ["待脑洞"],
        words: pageWords
      } as Story;
    }
  }, [stories, selectedBoardId, selectedStoryId, activePageNum, segments]);

  // Action: Single page AI Generation
  const handleGeneratePageStory = async (pageNum: number, topic: string) => {
    if (!activeBoard) return;
    const segment = segments.find(seg => seg.pageNum === pageNum);
    if (!segment) return;
    
    setIsGeneratingPage(true);
    setPageGenError("");
    
    try {
      const wordList = segment.words.map(w => w.word);
      const response = await fetch("/api/stories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          words: wordList,
          topic: topic,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "剧情网络造梦失败，请确保密钥配置正确。");
      }

      if (data.storyText) {
        const titleMatch = data.storyText.match(/《([^》]+)》/) || data.storyText.match(/📖\s*([^\n]+)/);
        const title = titleMatch ? titleMatch[1].trim() : `第 ${pageNum} 页 · AI精选梦境`;

        let emoji = "📖";
        if (topic.includes("总裁")) emoji = "👑";
        else if (topic.includes("仙侠")) emoji = "🧙‍♂️";
        else if (topic.includes("科幻")) emoji = "🧟";
        else if (topic.includes("校园")) emoji = "🏫";
        else if (topic.includes("悬疑")) emoji = "🕵️";

        const newStory: Story = {
          id: `custom_ai_${Date.now()}_p${pageNum}`,
          title,
          emoji,
          tags: ["AI 智能主笔", topic, `Page ${pageNum}`],
          text: data.storyText,
          words: segment.words.map(w => ({
            ...w,
            phonetic: w.phonetic || "[英美发音]",
            example: w.example || "AI在文句语境中完美配合理解。"
          })),
          boardId: activeBoard.id,
          pageNumber: pageNum
        };

        setStories(prev => [newStory, ...prev]);
        
        // Success increment Study Streak
        setStreak(prev => {
          const next = prev + 1;
          localStorage.setItem("study_streak", next.toString());
          return next;
        });
      } else {
        throw new Error("AI未能输出故事内容，推荐一键极速本地合并！");
      }
    } catch (err: any) {
      console.error(err);
      setPageGenError(err.message || "剧情造梦出差错！建议点击左侧“1秒本地极速联想合成”免密钥飞跃！");
    } finally {
      setIsGeneratingPage(false);
    }
  };

  // Action: Single page Speed Local Generation
  const handleGenerateLocalSingleStory = (pageNum: number) => {
    if (!activeBoard) return;
    const segment = segments.find(seg => seg.pageNum === pageNum);
    if (!segment) return;
    
    const localStory = generateLocalSpeedStory(activeBoard.name, pageNum, segment.words);
    setStories(prev => [localStory, ...prev]);
  };

  // Action: Bulk auto-generator for the whole Custom Book
  const handleBulkGenerateStories = () => {
    if (!activeBoard) return;
    
    const listToAdd: Story[] = [];
    segments.forEach(segment => {
      // Skip if exists
      const exists = stories.some(s => s.boardId === activeBoard.id && s.pageNumber === segment.pageNum);
      if (!exists) {
        const localStory = generateLocalSpeedStory(activeBoard.name, segment.pageNum, segment.words);
        listToAdd.push(localStory);
      }
    });

    if (listToAdd.length > 0) {
      setStories(prev => [...listToAdd, ...prev]);
      setActivePageNum(1);
    }
  };

  const currentBookStories = useMemo(() => {
    if (selectedBoardId === null) {
      return stories.filter(s => !s.boardId);
    } else {
      return stories.filter(s => s.boardId === selectedBoardId);
    }
  }, [stories, selectedBoardId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sharedProductionUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // WeChat/Tablet Scan Qr Code generator URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(sharedProductionUrl)}`;

  // Emulation container styling wrapper helper
  const AppContent = (
    <div className={`flex flex-col flex-1 ${
      deviceDisplayMode === "phone" 
        ? "max-h-[780px] overflow-y-auto" 
        : deviceDisplayMode === "tablet" 
        ? "max-h-[890px] overflow-y-auto" 
        : ""
    }`}>
      {/* WeChat Mini Program Capsule Header Mockup on mobile, standard editorial on larger viewports */}
      <header className="bg-[#FDFCFB] border-b border-[#1A1A1A]/10 sticky top-0 z-40 transition-all">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[9px] uppercase tracking-widest font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                微信小程序微端 · 已连接
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif italic tracking-tight text-[#1A1A1A] mt-1 pr-2">
              六级背词脑洞账本.
            </h1>
          </div>

          {/* Quick study metrics widgets */}
          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40">已熟记</div>
              <div className="text-sm font-serif font-black text-emerald-800">
                {masteredWords.length}<span className="text-[10px] text-[#1A1A1A]/40 italic">/{globalWords.length}词</span>
              </div>
            </div>

            <div className="w-px h-6 bg-[#1A1A1A]/15"></div>

            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40">连续 study</div>
              <div className="text-sm font-serif font-black flex items-center justify-end gap-0.5">
                <Flame size={12} className="text-amber-500 fill-current animate-bounce" />
                <span>{streak}天</span>
              </div>
            </div>

            <div className="w-px h-6 bg-[#1A1A1A]/15"></div>

            {/* WeChat original control pill emulated for 100% genuine mini-program feel */}
            <div className="hidden sm:flex items-center gap-2.5 bg-black/[0.04] border border-[#1A1A1A]/10 px-3 py-1.5 rounded-full shrink-0">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]/60"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]/60"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]/30"></span>
              </div>
              <div className="w-px h-3.5 bg-[#1A1A1A]/20"></div>
              <button 
                onClick={() => setShowSyncModal(true)} 
                className="w-4 h-4 rounded-full border border-[#1A1A1A]/40 hover:bg-black/5 flex items-center justify-center cursor-pointer text-xs"
                title="小程序说明与多端扫码"
              >
                o
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Cross-device instant scan sync header invitation */}
      <div className="bg-[#1A1A1A] text-white py-2.5 px-4 text-xs">
        <div className="w-full max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-medium">
            <span className="bg-emerald-600 px-1.5 py-0.5 rounded text-[10px] font-bold">微信/平板实机运行</span>
            <span>由于电脑 preview clipboard 部分受限，推荐点按右侧，直接扫码在平板、手机及微信中使用！</span>
          </p>
          <button 
            onClick={() => setShowSyncModal(true)}
            className="bg-white hover:bg-white/95 text-[#1A1A1A] font-bold px-3 py-1 rounded-lg text-[11px] tracking-wide flex items-center gap-1.5 transition-all cursor-pointer grow-0 shrink-0"
          >
            <QrCode size={13} />
            <span>获得极速扫码链</span>
          </button>
        </div>
      </div>

      {/* Main Container Area */}
      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-5 pb-24 md:py-8 space-y-6">
        
        {/* Navigation Selector Bar (Desktop top tabs, hidden on responsive bottom) */}
        <div className="hidden md:flex flex-wrap gap-1 border-b border-[#1A1A1A]/10 pb-0.5">
          {[
            { id: "stories", label: "故事记忆橱窗", icon: <BookOpen size={14} /> },
            { id: "ai-creator", label: "AI 科学脑洞造梦", icon: <Sparkles size={14} /> },
            { id: "notebook", label: "大学六级账本 INDEX", icon: <Notebook size={14} /> },
            { id: "quiz", label: "六级生词能力评估", icon: <GraduationCap size={14} /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}-btn`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
                  isActive
                    ? "border-[#1A1A1A] text-[#1A1A1A]"
                    : "border-transparent text-[#1A1A1A]/40 hover:text-[#1A1A1A] hover:border-[#1A1A1A]/35"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Informational Prompt confirming creator's behavior */}
        {activeTab === "ai-creator" && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1 max-w-4xl mx-auto">
            <p className="font-bold flex items-center gap-1.5 shrink-0"><Info size={14} /> 亲，在此处上传/生成的脑洞故事：</p>
            <p className="opacity-90 leading-relaxed pl-5">
              会自动灌注并即时解锁存入 <strong>“故事记忆橱窗”</strong> 中！
              生成完成后，工坊将为您秒级飞跃跳转，直接带其在背词大厅显示。所有单词、掌握背诵状态将完美自动同步。
            </p>
          </div>
        )}

        {/* Dynamic Panel Renderer */}
        <div id="tab-panel-container" className="min-h-[480px]">
          <AnimatePresence mode="wait">
            {activeTab === "stories" && (
              <motion.div
                key="stories-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Wordbook Library Selector & Active Status Hub */}
                <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg shrink-0">
                      📚
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#1A1A1A]/45 tracking-widest font-sans">当前激活学习词书 Active Wordbook</p>
                      <h3 className="text-sm font-serif font-black flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span>{selectedBoardId === null ? "🎯 大学英语六级官方核心高频词书 (默认)" : `📂 自定义：${activeBoard?.name || "未知自选词书"}`}</span>
                        <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          {selectedBoardId === null ? "200 词" : `${activeBoard?.words.length || 0} 词`}
                        </span>
                      </h3>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#1A1A1A]/50 font-bold font-sans">快速切书:</span>
                    <button
                      onClick={() => setSelectedBoardId(null)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        selectedBoardId === null
                          ? "bg-[#1A1A1A] border-[#1A1A1A] text-white"
                          : "bg-white border-[#1A1A1A]/10 text-[#1A1A1A]/80 hover:border-black"
                      }`}
                    >
                      官方核心词书
                    </button>
                    {customBoards.map(b => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBoardId(b.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                          selectedBoardId === b.id
                            ? "bg-[#1A1A1A] border-[#1A1A1A] text-white"
                            : "bg-white border-[#1A1A1A]/10 text-[#1A1A1A]/80 hover:border-black"
                        }`}
                      >
                        <span className="truncate max-w-[90px]">{b.name}</span>
                        <span className="text-[9px] opacity-60">({b.words.length}词)</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setActiveTab("ai-creator")}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 flex items-center gap-1"
                    >
                      <span>+ 上载/管理专区</span>
                    </button>
                  </div>
                </div>

                {/* Chapters Carousel: Dynamic based on Selected Book */}
                <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-4 md:p-6">
                  {selectedBoardId === null ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/50 flex items-center gap-2 font-sans">
                          <span className="w-5 h-px bg-[#1A1A1A]/40"></span> 本书已解锁脑洞章节 ({currentBookStories.length})
                        </h3>
                        <p className="text-[10px] text-[#1A1A1A]/40 font-bold hidden sm:block">点击切换背诵对应剧情故事</p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-60 sm:max-h-none overflow-y-auto pr-1">
                        {currentBookStories.map((item) => {
                          const isSelected = selectedStoryId === item.id;
                          
                          // Calculate story mastering percentage
                          const count = item.words.filter(w => isMastered(w.word)).length;
                          const percent = Math.round((count / item.words.length) * 100);

                          return (
                            <button
                              key={item.id}
                              id={`story-card-${item.id}`}
                              onClick={() => setSelectedStoryId(item.id)}
                              className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between group cursor-pointer h-24 ${
                                isSelected
                                  ? "bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-sm scale-[0.98]"
                                  : "bg-white border-[#1A1A1A]/10 hover:border-black text-[#1A1A1A] hover:bg-[#FAF9F6]/30"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-lg">{item.emoji}</span>
                                  {item.tags.includes("AI 智能生成") ? (
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                                      isSelected ? "bg-white/20 text-white" : "bg-[#1A1A1A]/15 text-[#1A1A1A]"
                                    }`}>
                                      AI
                                    </span>
                                  ) : (
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                                      isSelected ? "bg-white/10 text-white/50" : "bg-[#1A1A1A]/5 text-[#1A1A1A]/40"
                                    }`}>
                                      经典
                                    </span>
                                  )}
                                </div>
                                <h4 className={`text-xs font-serif font-black truncate max-w-[130px] ${isSelected ? "text-white" : "text-[#1A1A1A]"}`}>
                                  {item.title}
                                </h4>
                              </div>

                              <div className="w-full">
                                <div className="flex justify-between items-center text-[9px] font-mono mb-1">
                                  <span className={isSelected ? "text-white/60" : "text-[#1A1A1A]/55"}>{percent}%记熟</span>
                                  <span className={isSelected ? "text-white/60" : "text-[#1A1A1A]/55"}>{item.words.length}词</span>
                                </div>
                                <div className={`w-full h-1 rounded-full overflow-hidden ${isSelected ? "bg-white/10" : "bg-[#1A1A1A]/10"}`}>
                                  <div
                                    className={`h-full transition-all ${isSelected ? "bg-white" : "bg-emerald-600"}`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      {/* Page-by-page auto story composer bulk triggers */}
                      {segments.some(seg => !stories.some(s => s.boardId === selectedBoardId && s.pageNumber === seg.pageNum)) ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl gap-3">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                              <Sparkles size={13} className="text-emerald-700 animate-spin" />
                              <span>根据 PDF 页面自动分成了章节 (共 {segments.length} 页)！</span>
                            </p>
                            <p className="text-[10px] text-[#1A1A1A]/60 font-sans">对应每一页都可以生成独立的记忆故事，点击右下角按钮直接一键对全书进行极速合成故事橱窗：</p>
                          </div>
                          <button
                            onClick={handleBulkGenerateStories}
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer justify-center self-start sm:self-auto shrink-0"
                          >
                            <Sparkles size={11} />
                            <span>⚡ 一键极速合成所有页面故事</span>
                          </button>
                        </div>
                      ) : (
                        <div className="pb-3 border-b border-[#1A1A1A]/5 flex items-center justify-between">
                          <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                            <CheckCircle size={14} />
                            <span>🎉 恭喜！当前词书的所有分页故事均已灌注完成！</span>
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/50 flex items-center gap-2 font-sans">
                          <span className="w-5 h-px bg-[#1A1A1A]/40"></span> 本书已解锁脑洞章节 ({segments.length})
                        </h3>
                        <p className="text-[10px] text-[#1A1A1A]/40 font-bold">点击选择阅读/生成对应页面背词剧情</p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-60 sm:max-h-none overflow-y-auto pr-1">
                        {segments.map((seg) => {
                          const matchingStory = stories.find(s => s.boardId === selectedBoardId && s.pageNumber === seg.pageNum);
                          const isSelected = activePageNum === seg.pageNum;
                          
                          const count = seg.words.filter(w => isMastered(w.word)).length;
                          const percent = Math.round((count / seg.words.length) * 100);

                          return (
                            <button
                              key={seg.pageNum}
                              onClick={() => setActivePageNum(seg.pageNum)}
                              className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between group cursor-pointer h-24 ${
                                isSelected
                                  ? "bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-sm scale-[0.98]"
                                  : "bg-white border-[#1A1A1A]/10 hover:border-black text-[#1A1A1A]"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-lg">{matchingStory ? matchingStory.emoji : "🌌"}</span>
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                                    isSelected 
                                      ? "bg-white/20 text-white" 
                                      : matchingStory 
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                                      : "bg-[#1A1A1A]/5 text-[#1A1A1A]/40"
                                  }`}>
                                    {matchingStory ? "已生成" : "待脑洞"}
                                  </span>
                                </div>
                                <h4 className={`text-xs font-serif font-black truncate max-w-[130px] ${isSelected ? "text-white" : "text-[#1A1A1A]"}`}>
                                  {matchingStory ? matchingStory.title : `第 ${seg.pageNum} 页单词舱`}
                                </h4>
                              </div>

                              <div className="w-full">
                                <div className="flex justify-between items-center text-[9px] font-mono mb-1">
                                  <span className={isSelected ? "text-white/60" : "text-[#1A1A1A]/55"}>{percent}%记熟</span>
                                  <span className={isSelected ? "text-white/60" : "text-[#1A1A1A]/55"}>{seg.words.length}词</span>
                                </div>
                                <div className={`w-full h-1 rounded-full overflow-hidden ${isSelected ? "bg-white/20" : "bg-[#1A1A1A]/10"}`}>
                                  <div
                                    className={`h-full transition-all ${isSelected ? "bg-white" : matchingStory ? "bg-emerald-600" : "bg-neutral-300"}`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Interactive Reader OR Dynamic Page Story Creator Panel */}
                {!activeStory.id.startsWith("not_yet_generated_") ? (
                  <StoryReader
                    story={activeStory}
                    onBookmarkToggle={handleBookmarkToggle}
                    isBookmarked={isBookmarked}
                    onWordMasteredToggle={handleWordMasteredToggle}
                    isMastered={isMastered}
                  />
                ) : (
                  <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-6 md:p-8 animate-[fadeIn_0.3s_ease] space-y-6">
                    <div className="flex items-start gap-4 border-b border-[#1A1A1A]/10 pb-5">
                      <div className="text-3xl p-2 bg-[#1A1A1A]/5 rounded-xl border border-[#1A1A1A]/10 animate-pulse">🌌</div>
                      <div>
                        <span className="text-[10px] font-bold tracking-widest bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-sans uppercase">第 {activePageNum} 页 / 节 故事尚未孵化</span>
                        <h4 className="text-lg font-serif font-black text-[#1A1A1A] mt-1">智能背词剧情舱：唤醒这批干巴英文生词</h4>
                        <p className="text-xs text-[#1A1A1A]/60 flex items-center gap-1.5 mt-1 font-sans">
                          导入词书会在“记忆橱窗”形成对应分页，您可以用 AI 或本地秒级智能联想让这一页的硬核生词幻化成精彩故事，轻松背诵。
                        </p>
                      </div>
                    </div>

                    {/* Word layout preview on this page */}
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/55 mb-2 font-sans">本章节包含的单词与释义 ({activeStory.words.length}):</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        {activeStory.words.map(w => (
                          <div key={w.word} className="bg-white border border-[#1A1A1A]/10 p-3 rounded-xl shadow-2xs">
                            <span className="font-serif font-black text-sm block text-[#1A1A1A]">{w.word}</span>
                            <span className="text-xs font-sans text-[#1A1A1A]/60 mt-0.5 block">{w.translation}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Choose dynamic parameters */}
                    <div className="pt-4 border-t border-[#1A1A1A]/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#1A1A1A]/60 font-sans">设定造梦风格 Theme:</span>
                        <select
                          value={customTopic}
                          onChange={(e) => setCustomTopic(e.target.value)}
                          className="bg-white border border-[#1A1A1A]/10 text-xs font-bold text-[#1A1A1A] rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
                        >
                          <option value="霸道总裁恋爱">👑 霸道总裁爱上我</option>
                          <option value="仙侠修真冒险">🧙‍♂️ 东方修仙与渡劫</option>
                          <option value="科幻末日生存">🧟 废土狂潮与异形防线</option>
                          <option value="校园轻喜剧本">🏫 中学那点儿搞笑事</option>
                          <option value="硬核惊悚悬疑">🕵️ 密室暗雷烧脑神探</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Option 1: Local Speed story generator (Super reliable, no API key needed, Instant) */}
                        <button
                          onClick={() => handleGenerateLocalSingleStory(activePageNum)}
                          className="px-4 py-2.5 border border-[#1A1A1A]/10 hover:border-black text-[#1A1A1A] font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer bg-white"
                        >
                          <span>⚡ 1秒本地极速合成背词法典 (推荐)</span>
                        </button>

                        {/* Option 2: AI Gemini backend story generator */}
                        <button
                          onClick={() => handleGeneratePageStory(activePageNum, customTopic)}
                          disabled={isGeneratingPage}
                          className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-black text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          {isGeneratingPage ? (
                            <>
                              <RefreshCw size={13} className="animate-spin" />
                              <span>AI 正在联想中...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} />
                              <span>🔮 召唤 AI 脑洞创作 (需要配Key)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {pageGenError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
                        {pageGenError}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "ai-creator" && (
              <motion.div
                key="ai-creator-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <StoryCreator 
                  onStoryGenerated={handleNewStoryGenerated}
                  customBoards={customBoards}
                  setCustomBoards={setCustomBoards}
                  selectedBoardId={selectedBoardId}
                  setSelectedBoardId={setSelectedBoardId}
                />
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
      <footer className="bg-white border-t border-[#1A1A1A]/15 text-[#1A1A1A]/50 text-xs py-8 mt-12 bg-white pb-32">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 text-center space-y-4">
          <p className="font-serif italic text-sm text-[#1A1A1A]">六级背词脑洞账本 · 极致微信小程序体验</p>
          <div className="flex justify-center gap-6 text-[9px] uppercase tracking-widest font-bold opacity-60">
            <span>© 2026 记词脑洞工坊</span>
            <span>·</span>
            <span>免安装即扫即用</span>
            <span>·</span>
            <span>微信完美运行</span>
          </div>
          <p className="text-[#1A1A1A]/50 text-[11px] max-w-md mx-auto leading-relaxed font-sans">
            小程序小绝招：单击或长按单词可直接调用内置TTS美式发音！由于支持微信环境，可随时通过 File Helper 转发，添加至微信浮窗(Mini-program widget)随时随地开始背诵。
          </p>
        </div>
      </footer>

      {/* Elegant Native Look Bottom Tab Bar for Mobile & Emulated Viewports */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FDFCFB]/95 backdrop-blur border-t border-[#1A1A1A]/10 py-2.5 px-3 flex justify-around items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        {[
          { id: "stories", label: "故事橱窗", icon: <BookOpen size={18} /> },
          { id: "ai-creator", label: "造梦故事机", icon: <Sparkles size={18} /> },
          { id: "notebook", label: "记词账本", icon: <Notebook size={18} /> },
          { id: "quiz", label: "能力测试", icon: <GraduationCap size={18} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex flex-col items-center gap-1 text-[10px] font-bold cursor-pointer relative"
              style={{ width: "22%" }}
            >
              <div className={`p-1.5 rounded-xl transition-all ${
                isActive ? "bg-[#1A1A1A] text-white scale-110" : "text-[#1A1A1A]/40"
              }`}>
                {tab.icon}
              </div>
              <span className={`text-[10px] tracking-wide ${isActive ? "text-[#1A1A1A] font-black" : "text-[#1A1A1A]/40"}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F3F2EE] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#1A1A1A] selection:text-white">
      {/* Desktop Helper Panel: Emulate WeChat / Smartphone / Tablet viewports */}
      <div className="bg-white border-b border-[#1A1A1A]/10 px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-semibold z-50 gap-4">
        <div className="flex items-center gap-2 text-[#1A1A1A]/60">
          <Tablet size={13} className="text-emerald-700 animate-pulse" />
          <span>小程序自适应多端适配：已全方位优化自适应支持 Android 安卓平板、手机与全大屏设备</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Segment display controls */}
          <div className="flex items-center bg-black/[0.04] p-1 rounded-xl border border-black/[0.08]">
            <button
              onClick={() => setDeviceDisplayMode("phone")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-bold text-[11px] ${
                deviceDisplayMode === "phone"
                  ? "bg-white text-emerald-800 shadow-xs border border-[#1A1A1A]/10"
                  : "text-[#1A1A1A]/65 hover:text-black"
              }`}
            >
              <Smartphone size={13} />
              <span>手机视图 (1:1)</span>
            </button>
            
            <button
              onClick={() => setDeviceDisplayMode("tablet")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-bold text-[11px] ${
                deviceDisplayMode === "tablet"
                  ? "bg-white text-emerald-800 shadow-xs border border-[#1A1A1A]/10"
                  : "text-[#1A1A1A]/65 hover:text-black"
              }`}
            >
              <Tablet size={13} />
              <span>安卓平板模拟 (840px)</span>
            </button>

            <button
              onClick={() => setDeviceDisplayMode("fluid")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-bold text-[11px] ${
                deviceDisplayMode === "fluid"
                  ? "bg-white text-emerald-800 shadow-xs border border-[#1A1A1A]/10"
                  : "text-[#1A1A1A]/65 hover:text-black"
              }`}
            >
              <Monitor size={13} />
              <span>自动流式 (Fluid)</span>
            </button>
          </div>

          <button
            onClick={() => setShowSyncModal(true)}
            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold rounded-xl border border-emerald-300 transition-all cursor-pointer flex items-center gap-1.5 text-[11px]"
          >
            <QrCode size={12} />
            <span>极速手机/平板扫码同步</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex justify-center items-center py-4 md:py-6 relative overflow-x-hidden">
        {deviceDisplayMode === "phone" ? (
          /* Phone/Mini Program mockup style shell envelope */
          <div className="relative w-[395px] h-[820px] bg-[#FAF9F6] border-8 border-black rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-[fadeIn_0.5s_ease]">
            {/* Phone speaker/camera pill */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-full z-50 flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-gray-900 rounded-full"></span>
            </div>
            
            {/* Native Wechat status line mockup */}
            <div className="bg-[#FAF9F6] h-10 w-full pt-1.5 px-6 flex justify-between items-center text-[10px] text-[#1A1A1A]/70 font-mono font-bold z-50">
              <span>09:41</span>
              <div className="flex items-center gap-1.5">
                <span className="bg-emerald-600 text-white text-[8px] font-sans px-1 rounded-sm scale-90">5G</span>
                <span className="w-4 h-2 rounded-sm border border-[#1A1A1A]/40 flex items-center p-px">
                  <span className="bg-[#1A1A1A] h-full w-full rounded-2xs"></span>
                </span>
              </div>
            </div>

            {/* Inner responsive WeChat Client content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#FDFCFB]">
              {AppContent}
            </div>
          </div>
        ) : deviceDisplayMode === "tablet" ? (
          /* High-Fidelity Android Tablet mockup styling frame */
          <div className="relative w-[840px] h-[960px] bg-[#FAF9F6] border-12 border-neutral-800 rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-[fadeIn_0.5s_ease]">
            {/* Camera dot on current center bezel */}
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-neutral-900 rounded-full z-50"></div>
            
            {/* Tablet standard Status details */}
            <div className="bg-[#FAF9F6] h-10 w-full pt-2 px-8 flex justify-between items-center text-[10.5px] text-[#1A1A1A]/70 font-mono font-bold z-50">
              <div className="flex items-center gap-2">
                <span>09:41 AM</span>
                <span className="text-[9px] uppercase tracking-wider bg-black/5 px-2 py-0.5 rounded-md">安卓平板微端模式</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-600 text-white text-[9px] font-sans px-1.5 py-0.5 rounded-sm">WiFi 6</span>
                <span className="w-4.5 h-2.5 rounded-sm border border-[#1A1A1A]/40 flex items-center p-px">
                  <span className="bg-[#1A1A1A] h-full w-full rounded-2xs"></span>
                </span>
                <span className="text-[10px]">100%</span>
              </div>
            </div>

            {/* Tablet dynamic client view area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#FDFCFB]">
              {AppContent}
            </div>
          </div>
        ) : (
          /* Standard fluid web wrapper */
          <div className="w-full min-h-screen bg-[#FDFCFB] flex flex-col">
            {AppContent}
          </div>
        )}
      </div>

      {/* Sync Tablet/Wechat / Phone QR popup modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setShowSyncModal(false)}></div>
          
          <div className="relative bg-[#FDFCFB] border border-[#1A1A1A]/20 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 text-center animate-out duration-200">
            <button 
              onClick={() => setShowSyncModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-neutral-100 text-[#1A1A1A]/50 hover:text-black cursor-pointer transition-all"
            >
              <X size={20} />
            </button>

            <div className="space-y-1.5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 flex items-center justify-center mx-auto mb-2">
                <Smartphone size={24} />
              </div>
              <h3 className="text-lg font-serif font-black">微信、电脑、多端极速互通同步</h3>
              <p className="text-xs text-[#1A1A1A]/60 font-sans tracking-wide leading-relaxed">
                无需微信或平板麻烦下载！直接在移动设备扫码运行：
              </p>
            </div>

            {/* Dynamic QR Code card */}
            <div className="bg-white border border-[#1A1A1A]/10 p-4 rounded-2xl inline-block mx-auto shadow-inner">
              <img 
                src={qrCodeUrl} 
                alt="多端扫码运行同步" 
                className="w-48 h-48 block rounded-md"
                referrerPolicy="no-referrer"
              />
              <p className="text-[9px] uppercase tracking-wider font-bold font-sans text-neutral-400 mt-2">
                点开手机相机 / 微信扫一扫 · 即可实机记词
              </p>
            </div>

            {/* Quick URL entry */}
            <div className="space-y-3">
              <div className="flex bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 rounded-xl p-2 items-center justify-between text-left">
                <span className="text-[10px] font-mono select-all truncate pl-2 max-w-[210px] text-[#1A1A1A]/80">
                  {sharedProductionUrl}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-[#1A1A1A] hover:bg-black text-white text-[10px] font-sans font-bold uppercase rounded-lg flex items-center gap-1 cursor-pointer transition-all shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check size={10} strokeWidth={4} />
                      <span>已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy size={10} />
                      <span>复制链接 copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[10px] text-left text-[#1A1A1A]/60 bg-[#FAF9F6] border border-[#1A1A1A]/10 p-3 rounded-lg leading-relaxed space-y-1">
                <p className="font-bold text-[#1A1A1A]">💡 小贴士 Tips：</p>
                <p>1. 如果您在微信内置浏览器打开此链接，背诵进度与掌握账本均会自动固化（使用极速 localStorage）。</p>
                <p>2. 支持发送电脑微信 File Helper（文件传输助手），微信中一键置顶浮窗，相当于完美运行小程序！</p>
              </div>
            </div>

            <button
              onClick={() => setShowSyncModal(false)}
              className="w-full py-2.5 bg-[#1A1A1A] hover:bg-black text-white font-sans font-bold uppercase tracking-widest text-xs rounded-xl cursor-pointer transition-all"
            >
              我知道了 Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

