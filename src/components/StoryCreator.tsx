import React, { useState } from "react";
import { Sparkles, FileText, ChevronRight, HelpCircle, Loader, RefreshCw, AlertCircle, Trash2 } from "lucide-react";
import { Story, WordItem } from "../predefinedStories";

interface StoryCreatorProps {
  onStoryGenerated: (story: Story) => void;
}

export default function StoryCreator({ onStoryGenerated }: StoryCreatorProps) {
  // Mode tabs: 1. Manual entrance, 2. Text analyzer (paste from PDF)
  const [activeTab, setActiveTab] = useState<"words" | "analyzer">("words");
  
  // Tab 1: custom word lists
  const [wordInput, setWordInput] = useState<string>("temporary, permanent, substitute, artificial, synthetic");
  const [topic, setTopic] = useState<string>("霸道总裁");

  // Tab 2: paste box for PDF or text
  const [rawText, setRawText] = useState<string>(
    `The research group at the chemistry institute was trying to synthesize a synthetic hormone. However, due to temporary power failure, all automatic systems collapsed, and they had to substitute manual cooling devices. This led to a permanent impact on their results...`
  );
  
  // Loading & States
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedWords, setExtractedWords] = useState<WordItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const presetWords = [
    { label: "考查高频重点", words: "abound, benefit, coordinate, diminish, evaluate, manipulate" },
    { label: "情绪心理行为", words: "anxiety, depress, compromise, tolerate, guarantee, hesitate" },
    { label: "社会经济结构", words: "prosperity, inflation, transaction, consume, wholesale, retail" },
  ];

  // Action 1: Extract words from pasted PDF text using server API
  const handleExtractWords = async () => {
    if (!rawText.trim()) {
      setErrorMsg("请先粘贴 PDF 中的单词或段落文章！");
      return;
    }

    setIsExtracting(true);
    setErrorMsg("");
    try {
      const response = await fetch("/api/words/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });

      const data = await response.json();
      if (response.ok && data.words && Array.isArray(data.words)) {
        setExtractedWords(data.words);
        // Sync into manual input too
        const wordsStr = data.words.map((w: any) => w.word).join(", ");
        setWordInput(wordsStr);
      } else {
        setErrorMsg(data.error || "分析提取词汇失败，请直接手动输入单词列表。");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("连接服务器失败，为您自动进行本地分词识别，请手动微调。");
      // Fallback regex match locally
      const found = rawText.match(/[a-zA-Z]+/g) || [];
      const uniq = Array.from(new Set(found.map((w: string) => w.toLowerCase()))).filter((w: string) => w.length > 3 && w.length < 15);
      const items = uniq.slice(0, 10).map((w: string) => ({ word: w, translation: "学考高频" }));
      setExtractedWords(items);
      setWordInput(items.map(i => i.word).join(", "));
    } finally {
      setIsExtracting(false);
    }
  };

  // Action 2: Trigger Gemini API to generate the humorous story
  const handleGenerateStory = async () => {
    const list = wordInput
      .split(/[,，\n]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    if (list.length === 0) {
      setErrorMsg("请至少输入一个核心英文单词进行故事创作！");
      return;
    }

    setIsGenerating(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/stories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          words: list,
          topic: topic,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "生成失败，请点击 Secrets 配置 GEMINI_API_KEY 后重试。");
      }

      if (data.storyText) {
        // Parse the generated story output
        const titleMatch = data.storyText.match(/《([^》]+)》/) || data.storyText.match(/📖\s*([^\n]+)/);
        const title = titleMatch ? titleMatch[1].replace("📖", "").trim() : "AI 专属记词故事";
        
        // Formulate a dynamic library word item
        const parsedWords: WordItem[] = list.map((w) => {
          // Attempt to scan translated term from bracket if it returns, or fall back
          let translation = "核心概念";
          const lowerW = w.toLowerCase();
          const matchRegex = new RegExp(`\\{${lowerW}\\}\\(([^)]+)\\)`, "i");
          const m = data.storyText.match(matchRegex);
          if (m && m[1]) {
            translation = m[1];
          } else {
            // Check extracted words if any
            const found = extractedWords.find(ew => ew.word.toLowerCase() === lowerW);
            if (found) translation = found.translation;
          }

          return {
            word: w,
            translation,
            phonetic: "[英美发音]",
            example: "结合 AI 生成的故事主线加深核心记忆。"
          };
        });

        const newStory: Story = {
          id: `custom_${Date.now()}`,
          title: title,
          emoji: topic.includes("总裁") ? "👑" : topic.includes("魔法") ? "🧙‍♂️" : topic.includes("末日") ? "🧟" : "📚",
          tags: ["AI 智能生成", topic],
          text: data.storyText,
          words: parsedWords
        };

        onStoryGenerated(newStory);
      } else {
        throw new Error("服务器没有返回故事文本！");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "故事生成服务出现异常，请检查配置或输入单词！");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-6 md:p-8 shadow-sm max-w-4xl mx-auto text-[#1A1A1A]">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex p-3 bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 text-[#1A1A1A] rounded-2xl mb-3">
          <Sparkles size={24} className="animate-pulse" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-[#1A1A1A]">AI 智能联想故事写作机</h2>
        <p className="text-[#1A1A1A]/60 text-sm mt-1.5 leading-relaxed font-sans">
          把枯燥的高难 CET-6 单词卡片，一键化为狗血、好玩、自然流利的短篇故事，脑洞关联，记忆速度翻倍！
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1A1A1A]/10 mb-6 font-medium text-sm">
        <button
          onClick={() => { setActiveTab("words"); setErrorMsg(""); }}
          className={`pb-3 px-4 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "words"
              ? "border-b-2 border-[#1A1A1A] text-[#1A1A1A] font-bold"
              : "text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
          }`}
        >
          <Sparkles size={16} /> 手动输入单词组
        </button>
        <button
          onClick={() => { setActiveTab("analyzer"); setErrorMsg(""); }}
          className={`pb-3 px-4 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "analyzer"
              ? "border-b-2 border-[#1A1A1A] text-[#1A1A1A] font-bold"
              : "text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
          }`}
        >
          <FileText size={16} /> PDF/段落文本解析器
        </button>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <span className="font-bold font-sans uppercase tracking-wider">操作错误或网络异常:</span>
            <p className="opacity-90">{errorMsg}</p>
          </div>
        </div>
      )}

      {activeTab === "words" ? (
        <div className="space-y-6">
          {/* Word Inputs */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-[#1A1A1A]/60 tracking-wider font-sans uppercase">
                请输入需要记词的英文单词（逗号或回车分割）
              </label>
              <button
                onClick={() => setWordInput("")}
                className="text-xs text-rose-750 hover:text-rose-600 font-bold cursor-pointer font-sans uppercase tracking-wider"
                title="清空"
              >
                清空 Clear
              </button>
            </div>
            <textarea
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value)}
              placeholder="例如: luxury, expand, strategy, potential, bankrupt"
              rows={3}
              className="w-full bg-white border border-[#1A1A1A]/10 focus:border-[#1A1A1A] rounded-xl p-4 text-[#1A1A1A] text-sm font-mono placeholder:text-[#1A1A1A]/30 outline-none transition-all"
            />
            
            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[#1A1A1A]/40 font-bold font-sans uppercase tracking-wider">点选推荐 Preset Decks：</span>
              {presetWords.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => setWordInput(preset.words)}
                  className="text-xs px-2.5 py-1 bg-white hover:bg-[#1A1A1A] border border-[#1A1A1A]/10 hover:text-white text-[#1A1A1A]/80 rounded-lg transition-all cursor-pointer font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Paste board */}
          <div>
            <label className="text-xs font-bold text-[#1A1A1A]/60 block mb-2 tracking-wider font-sans uppercase">
              在这里粘贴 PDF 某页单词表内容、或者包含生词的外刊阅读材料
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste English textbook paragraphs or raw PDF sheets here..."
              rows={4}
              className="w-full bg-white border border-[#1A1A1A]/10 focus:border-[#1A1A1A] rounded-xl p-4 text-[#1A1A1A] text-sm placeholder:text-[#1A1A1A]/30 outline-none transition-all"
            />
          </div>

          <button
            onClick={handleExtractWords}
            disabled={isExtracting}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#1A1A1A] hover:bg-black text-white font-sans font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {isExtracting ? (
              <>
                <Loader size={15} className="animate-spin text-white" />
                正在AI提取核心六级词...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                自动智能一键提取考词
              </>
            )}
          </button>

          {extractedWords.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-[#1A1A1A]/15">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#1A1A1A]/40 mb-2.5 font-sans">识别提取到的生词：</p>
              <div className="flex flex-wrap gap-2">
                {extractedWords.map((item) => (
                  <span
                    key={item.word}
                    className="text-xs px-2.5 py-1.5 bg-[#FAF9F6] text-[#1A1A1A] border border-[#1A1A1A]/10 rounded-lg flex items-center gap-1.5"
                  >
                    <span><strong>{item.word}</strong>: {item.translation}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Styled story configuration & trigger */}
      <div className="mt-8 pt-6 border-t border-[#1A1A1A]/10 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/50 mb-2 block font-sans">
            选择故事戏路风格 Theme
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "霸道总裁", label: "霸道总裁 👑" },
              { id: "仙侠奇幻", label: "仙侠奇幻 🧙‍♂️" },
              { id: "赛博科幻", label: "末日生化 🧟" },
              { id: "校园生活", label: "搞笑自律 🏫" },
              { id: "密室悬疑", label: "剧本杀探案 🕵️" },
              { id: "无厘头恶搞", label: "神级无厘头 😂" }
            ].map((theme) => (
              <button
                key={theme.id}
                onClick={() => setTopic(theme.id)}
                className={`py-2 px-1 text-xs rounded-lg border text-center transition-all cursor-pointer font-medium ${
                  topic === theme.id
                    ? "bg-[#1A1A1A] border-[#1A1A1A] text-white font-bold"
                    : "bg-white border-[#1A1A1A]/10 text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white"
                }`}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4 md:pt-0">
          <button
            onClick={handleGenerateStory}
            disabled={isGenerating || !wordInput.trim()}
            className="w-full md:w-auto px-8 py-3.5 bg-[#1A1A1A] hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-bold uppercase tracking-widest text-xs rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader size={16} className="animate-spin text-white" />
                <span>AI 正在联想中，预计需要 30 秒左右...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>立即编撰联想故事 WRITE STORY</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
