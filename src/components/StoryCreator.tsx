import React, { useState, useEffect } from "react";
import { Sparkles, FileText, ChevronRight, HelpCircle, Loader, RefreshCw, AlertCircle, Trash2, Upload, FileUp, Check, BookOpen, Clock } from "lucide-react";
import { Story, WordItem } from "../predefinedStories";
import * as XLSX from "xlsx";

interface StoryCreatorProps {
  onStoryGenerated: (story: Story) => void;
}

interface CustomBoard {
  id: string;
  name: string;
  uploadedAt: string;
  words: WordItem[];
}

export default function StoryCreator({ onStoryGenerated }: StoryCreatorProps) {
  // Mode tabs: 1. Manual words, 2. Text analyzer, 3. Custom file uploader (New!)
  const [activeTab, setActiveTab] = useState<"words" | "analyzer" | "uploader">("words");
  
  // Tab 1: manual word list
  const [wordInput, setWordInput] = useState<string>("temporary, permanent, substitute, artificial, synthetic");
  const [topic, setTopic] = useState<string>("霸道总裁");

  // Tab 2: paste box for PDF or text
  const [rawText, setRawText] = useState<string>(
    `The research group at the chemistry institute was trying to synthesize a synthetic hormone. However, due to temporary power failure, all automatic systems collapsed, and they had to substitute manual cooling devices. This led to a permanent impact on their results...`
  );
  
  // Tab 3: Custom uploader states
  const [customBoards, setCustomBoards] = useState<CustomBoard[]>(() => {
    const saved = localStorage.getItem("cet6_custom_boards");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(() => {
    const saved = localStorage.getItem("cet6_custom_boards");
    if (saved) {
      const decoded = JSON.parse(saved);
      if (Array.isArray(decoded) && decoded.length > 0) {
        return decoded[0].id;
      }
    }
    return null;
  });
  
  const [dragActive, setDragActive] = useState(false);
  const [parsingResult, setParsingResult] = useState<{ fileName: string; words: WordItem[] } | null>(null);
  const [selectedUploadWords, setSelectedUploadWords] = useState<Record<string, boolean>>({});

  // Loading & States
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedWords, setExtractedWords] = useState<WordItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const presetWords = [
    { label: "考查高频重点", words: "abound, benefit, coordinate, diminish, evaluate, manipulate" },
    { label: "情绪心理行为", words: "anxiety, depress, compromise, tolerate, guarantee, hesitate" },
    { label: "社会经济结构", words: "prosperity, inflation, transaction, consume, wholesale, retail" },
  ];

  // Sync custom upload list back to localStorage
  useEffect(() => {
    localStorage.setItem("cet6_custom_boards", JSON.stringify(customBoards));
  }, [customBoards]);

  // Handle Drag Over
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle Drop and Load Text file
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Custom File Selector
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Load and Parse PDF files client-side using PDF.js CDN
  const loadAndParsePDF = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    // Ensure pdf.js is loaded dynamically if not present
    await new Promise<void>((resolve, reject) => {
      if ((window as any).pdfjsLib || (window as any)['pdfjs-dist/build/pdf']) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("高精度 PDF 解析器驱动包加载失败，请检查网络连接！"));
      document.head.appendChild(script);
    });

    const pdfjsLib = (window as any).pdfjsLib || (window as any)['pdfjs-dist/build/pdf'];
    if (!pdfjsLib) {
      throw new Error("PDF 解析器初始化不完整，请稍后刷新重试！");
    }

    // Configure worker from CDN to optimize multi-page streaming
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let completeText = "";
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];
      
      const linesMap: { [key: number]: any[] } = {};
      const tolerance = 4; // Tolerance distance for row alignment
      
      items.forEach((item) => {
        if (!item.str || !item.str.trim()) return;
        const y = item.transform[5];
        const x = item.transform[4];
        
        let foundYKey: number | null = null;
        for (const existingY of Object.keys(linesMap).map(Number)) {
          if (Math.abs(existingY - y) <= tolerance) {
            foundYKey = existingY;
            break;
          }
        }
        
        if (foundYKey !== null) {
          linesMap[foundYKey].push({ x, str: item.str });
        } else {
          linesMap[y] = [{ x, str: item.str }];
        }
      });
      
      // Sort baselines descending (top-to-bottom on page layout)
      const sortedBaselines = Object.keys(linesMap)
        .map(Number)
        .sort((a, b) => b - a);
        
      let pageText = "";
      sortedBaselines.forEach((y) => {
        const rowItems = linesMap[y].sort((a, b) => a.x - b.x);
        let lineStr = "";
        let prevXEnd = -1;
        
        rowItems.forEach((item, index) => {
          if (index === 0) {
            lineStr += item.str;
          } else {
            const gap = item.x - prevXEnd;
            if (gap > 12) {
              lineStr += "    " + item.str; // Broad spaces perfectly retain dual-side splits
            } else {
              lineStr += " " + item.str;
            }
          }
          prevXEnd = item.x + (item.str.length * 6); // rough characters-width estimation
        });
        
        pageText += lineStr + "\n";
      });
      
      completeText += `==Start of Page ${pageNum}==\n` + pageText + `==End of Page ${pageNum}==\n\n`;
    }
    
    return completeText;
  };

  // Parsing Core Algorithm - matches CSV, TXT, Excel sheets, JSON dictionary lists, multi-column PDF layouts, and dual-side OCR
  const processFile = (file: File) => {
    setErrorMsg("");
    setSuccessMsg("");
    
    // Validate extensions
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const allowedExtensions = [".txt", ".csv", ".md", ".json", ".xlsx", ".xls", ".pdf"];
    if (!allowedExtensions.includes(ext)) {
      setErrorMsg("目前支持上传 .pdf, .txt, .csv, .md, .json, .xlsx, .xls 等生词本格式！请检查您的文件。");
      return;
    }

    const isExcel = ext === ".xlsx" || ext === ".xls";
    const isPDF = ext === ".pdf";
    const isBinary = isExcel || isPDF;
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let wordsList: WordItem[] = [];
        
        if (isPDF) {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          setSuccessMsg("正为您启动高精度 PDF 引擎，智能重构词表排版并提取词组...");
          const text = await loadAndParsePDF(arrayBuffer);
          wordsList = parseGenericList(text);
        } else if (isExcel) {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          wordsList = parseExcelList(arrayBuffer);
        } else {
          const contents = event.target?.result as string;
          if (!contents) {
            setErrorMsg("抱歉，读取生词本文件内容为空或失败。");
            return;
          }
          
          if (ext === ".json") {
            wordsList = parseJsonList(contents);
          } else {
            wordsList = parseGenericList(contents);
          }
        }

        if (wordsList.length === 0) {
          setErrorMsg("未能从此文件里成功识别到 [英文单词] 及其 [中/英文释义]，请检查格式是否匹配建议指南。");
          return;
        }

        setParsingResult({
          fileName: file.name,
          words: wordsList
        });

        // Default all parsed words to selected
        const selectedMap: Record<string, boolean> = {};
        wordsList.forEach(w => {
          selectedMap[w.word.toLowerCase()] = true;
        });
        setSelectedUploadWords(selectedMap);
        setSuccessMsg(`成功解析文件 ${file.name}，共智能识别并配对过滤出 ${wordsList.length} 个单词生词对！`);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(`解析文件时发生错误: ${err.message || err}`);
      }
    };

    reader.onerror = () => {
      setErrorMsg("在读取外置文件流时发生系统错误！");
    };

    if (isBinary) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Extract from binary Excel sheet arrays
  const parseExcelList = (arrayBuffer: ArrayBuffer): WordItem[] => {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Read raw grid columns
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    const parsedItems: WordItem[] = [];
    const seenWords = new Set<string>();

    for (const row of rawData) {
      if (!row || row.length === 0) continue;
      
      let wordCandidate = "";
      let translationCandidate = "";
      
      // Analyze types inside each row dynamically (enables column position flexibility!)
      for (const cell of row) {
        if (cell === null || cell === undefined) continue;
        const valStr = String(cell).trim();
        if (!valStr) continue;
        
        // Pure english candidate checklist vs Chinese/non-english translation candidate checklist
        if (/^[a-zA-Z\s\-']+$/.test(valStr) && valStr.length >= 2 && valStr.length <= 45) {
          if (!wordCandidate) wordCandidate = valStr;
        } else if (/[\u4e00-\u9fa5]/.test(valStr)) {
          if (!translationCandidate) translationCandidate = valStr;
        }
      }
      
      // Fallback matching if cells are mixed but follow simple layout: col-1 as word, col-2 as description
      if (!wordCandidate && row.length >= 2) {
        const first = String(row[0]).trim();
        const second = String(row[1]).trim();
        if (/^[a-zA-Z\s\-']+$/.test(first) && first.length >= 2) {
          wordCandidate = first;
          translationCandidate = second;
        }
      }
      
      if (wordCandidate && translationCandidate) {
        const lowerW = wordCandidate.toLowerCase();
        if (!seenWords.has(lowerW)) {
          seenWords.add(lowerW);
          parsedItems.push({
            word: wordCandidate,
            translation: translationCandidate,
            phonetic: "[英美发音]",
            example: "来自于您的 Excel 形式背词表。"
          });
        }
      }
    }
    
    return parsedItems;
  };

  // Load word deck structures from JSON dict configurations
  const parseJsonList = (contents: string): WordItem[] => {
    try {
      const data = JSON.parse(contents);
      const parsedItems: WordItem[] = [];
      const seenWords = new Set<string>();

      const addWord = (w: string, t: string) => {
        const cleanW = w.trim();
        const cleanT = t.trim();
        // Skip keys that don't match standard English boundaries
        if (!cleanW || !cleanT || !/^[a-zA-Z\s\-']+$/.test(cleanW)) return;
        const lowerW = cleanW.toLowerCase();
        if (!seenWords.has(lowerW)) {
          seenWords.add(lowerW);
          parsedItems.push({
            word: cleanW,
            translation: cleanT,
            phonetic: "[英美发音]",
            example: "来自于您的 JSON 数据辞典。"
          });
        }
      };

      if (Array.isArray(data)) {
        // Option 1: Object dictionary array [{"word": "apple", "translation": "苹果"}, ...]
        for (const item of data) {
          if (item && typeof item === "object") {
            const word = item.word || item.vocab || item.eng || item.english || "";
            const translation = item.translation || item.meaning || item.chinese || item.explain || item.chinese_meaning || "";
            if (word && translation) {
              addWord(String(word), String(translation));
            }
          }
        }
      } else if (data && typeof data === "object") {
        // Option 2: Pure Key-Value dictionary {"apple": "苹果", "banana": "香蕉"}
        for (const [key, val] of Object.entries(data)) {
          if (val && typeof val === "string") {
            addWord(key, val);
          }
        }
      }
      return parsedItems;
    } catch {
      return [];
    }
  };

  // Powerful parser that handles mixed lines, side-by-side columns copied from PDF view grids
  const parseGenericList = (contents: string): WordItem[] => {
    const lines = contents.split(/\r?\n/);
    const parsedItems: WordItem[] = [];
    const seenWords = new Set<string>();

    for (let rawLine of lines) {
      rawLine = rawLine.trim();
      if (!rawLine) continue;

      // Filter out general table headers, footer counters or metadata lines
      if (/^(word\s+meaning|word|meaning)$/i.test(rawLine)) continue;
      if (/^\d+\s*\/\s*\d+\s*$/i.test(rawLine)) continue; 
      if (/共\s*\d+\s*词/i.test(rawLine)) continue;      
      if (rawLine.includes("不背单词") || rawLine.includes("纸上默写")) continue;

      // Splitting candidate row columns
      // Step A: Split on long space intervals (e.g. 3 or more spaces), highly common for side-by-side copies
      const initialParts = rawLine.split(/\s{3,}/).map(x => x.trim()).filter(x => x.length > 0);
      const subColumns: string[] = [];

      for (const part of initialParts) {
        // Step B: Split inside columns if we find a serial index prefix followed by English letters
        // (e.g. "1 you [juː] ... 22 no [nəʊ]" copy merged on a single line)
        const indices: number[] = [0];
        const seqRegex = /\s+(\d+)\s+([a-zA-Z])/g;
        let seqMatch;
        while ((seqMatch = seqRegex.exec(part)) !== null) {
          indices.push(seqMatch.index);
        }
        indices.push(part.length);

        for (let i = 0; i < indices.length - 1; i++) {
          subColumns.push(part.substring(indices[i], indices[i+1]).trim());
        }
      }

      for (const col of subColumns) {
        if (!col) continue;

        // Clean leading indicators like "1. ", "42 ", "211、"
        let clean = col.replace(/^\d+[\s\t\.\、\-]+/i, "").trim();
        if (!clean) continue;

        let word = "";
        let translation = "";
        let phonetic = "[英美发音]";

        // Extract phonetic symbols block if present (e.g. "[juː]" or "/nəʊ/")
        const phoneticMatch = clean.match(/\[([^[\]]{1,25}?[ːaeiouəbdfg/\\tʃdʒθðʃʒ\d\s][^[\]]*?)\]|\/([^/]{1,25}?)\//);
        if (phoneticMatch) {
          phonetic = phoneticMatch[0];
          // Strip phonetics from matching text path
          clean = clean.replace(phoneticMatch[0], " ").replace(/\s{2,}/g, " ").trim();
        }

        // Try Route 1: Split English words that transition to Part-of-speech tags or block brackets or Chinese characters
        const transitionMatch = clean.match(/^([a-zA-Z\s\-']+?)(?:\s+)?(\b(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux)\.|\b\[[a-zA-Z\u4e00-\u9fa5]+\]|[\u4e00-\u9fa5]+|[\(\（]+[\u4e00-\u9fa5]+)(.*)$/);
        
        if (transitionMatch) {
          word = transitionMatch[1].trim();
          translation = (transitionMatch[2] + transitionMatch[3]).trim();
        }

        // Try Route 2: Fallback to Comma CSV separation [word, translation]
        if (!word && clean.includes(",")) {
          const commaIdx = clean.indexOf(",");
          const wTemp = clean.substring(0, commaIdx).trim();
          const mTemp = clean.substring(commaIdx + 1).trim();
          if (/^[a-zA-Z\s\-']+$/.test(wTemp)) {
            word = wTemp;
            translation = mTemp;
          }
        }

        // Try Route 3: Fallback to Tab separations [word \t meanings]
        if (!word && clean.includes("\t")) {
          const parts = clean.split("\t").map(x => x.trim()).filter(x => x.length > 0);
          if (parts.length >= 2 && /^[a-zA-Z\s\-']+$/.test(parts[0])) {
            word = parts[0];
            translation = parts.slice(1).join(" ");
          }
        }

        // Try Route 4: Fallback to simple Space bounds separating English word from rest
        if (!word) {
          const regexMatch = clean.match(/^([a-zA-Z\s\-']+?)[\s\t]+(.*)$/);
          if (regexMatch) {
            const wTemp = regexMatch[1].trim();
            const mTemp = regexMatch[2].trim();
            if (wTemp.length > 1 && mTemp.length > 0) {
              word = wTemp;
              translation = mTemp;
            }
          }
        }

        if (word && translation) {
          const lowerW = word.toLowerCase();
          if (!seenWords.has(lowerW)) {
            seenWords.add(lowerW);
            parsedItems.push({
              word,
              translation,
              phonetic,
              example: "来自于您的自选词表。"
            });
          }
        }
      }
    }

    return parsedItems;
  };

  // Convert uploaded parsed words to the active manual wordInput string
  const handleLoadParsedWords = () => {
    if (!parsingResult) return;
    const selectedList = parsingResult.words.filter(w => selectedUploadWords[w.word.toLowerCase()]);
    if (selectedList.length === 0) {
      setErrorMsg("请至少勾选一个生词进行导入和故事创作！");
      return;
    }

    // Save this parsed result as a permanent record in customBoards
    const boardId = `board_${Date.now()}`;
    const newBoard: CustomBoard = {
      id: boardId,
      name: parsingResult.fileName,
      uploadedAt: new Date().toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
      words: selectedList
    };

    setCustomBoards(prev => [newBoard, ...prev.filter(b => b.name !== newBoard.name)]);
    setSelectedBoardId(boardId);

    // Sync words into wordInput textarea so they can hit "Generate" directly
    const wordsStr = selectedList.map(w => w.word).join(", ");
    setWordInput(wordsStr);
    
    // Switch to generate/words view directly
    setSuccessMsg(`生词本 ${parsingResult.fileName} 已导入！已帮您在下方的生词输入框里载入 ${selectedList.length} 个单词，您可以选择故事主题来启动生成。`);
    setActiveTab("words");
    setParsingResult(null);
  };

  const handleSelectBoard = (boardId: string) => {
    setSelectedBoardId(boardId);
    const board = customBoards.find(b => b.id === boardId);
    if (board) {
      const wordsStr = board.words.map(w => w.word).join(", ");
      setWordInput(wordsStr);
      setSuccessMsg(`已切换并激活单词账本：${board.name}。共计 ${board.words.length} 个考纲单词！随时可在下方选择主题编撰故事。`);
    }
  };

  const handleRemoveBoard = (boardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomBoards(prev => prev.filter(b => b.id !== boardId));
    if (selectedBoardId === boardId) {
      setSelectedBoardId(null);
    }
  };

  // Action 1: Extract words from pasted PDF text using server API
  const handleExtractWords = async () => {
    if (!rawText.trim()) {
      setErrorMsg("请先粘贴 PDF 中的单词或段落文章！");
      return;
    }

    setIsExtracting(true);
    setErrorMsg("");
    setSuccessMsg("");
    
    try {
      const response = await fetch("/api/words/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });

      const data = await response.json();
      if (response.ok && data.words && Array.isArray(data.words)) {
        setExtractedWords(data.words);
        const wordsStr = data.words.map((w: any) => w.word).join(", ");
        setWordInput(wordsStr);
        setSuccessMsg(`分析完毕！AI 帮您从文章段落中提炼出 ${data.words.length} 个大学六级核心词。已在下方框内为您准备就绪。`);
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
      setErrorMsg("请至少输入或上传一个核心英文单词进行故事创作！");
      return;
    }

    setIsGenerating(true);
    setErrorMsg("");
    setSuccessMsg("");

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
          let translation = "核心概念";
          const lowerW = w.toLowerCase();
          const matchRegex = new RegExp(`\\{${lowerW}\\}\\(([^)]+)\\)`, "i");
          const m = data.storyText.match(matchRegex);
          if (m && m[1]) {
            translation = m[1];
          } else {
            // Check extracted words & custom board lists for translations
            let found = extractedWords.find(ew => ew.word.toLowerCase() === lowerW);
            if (!found && selectedBoardId) {
              const activeBoard = customBoards.find(b => b.id === selectedBoardId);
              if (activeBoard) {
                found = activeBoard.words.find(ew => ew.word.toLowerCase() === lowerW);
              }
            }
            if (found) translation = found.translation;
          }

          return {
            word: w,
            translation,
            phonetic: "[英美发音]",
            example: "结合 AI 生成的故事主线加深核心记忆。"
          };
        });

        // Ensure we assign a matching theme icon
        let emoji = "📚";
        if (topic.includes("总裁")) emoji = "👑";
        else if (topic.includes("仙侠")) emoji = "🧙‍♂️";
        else if (topic.includes("科幻") || topic.includes("世纪") || topic.includes("末日")) emoji = "🧟";
        else if (topic.includes("校园")) emoji = "🏫";
        else if (topic.includes("悬疑") || topic.includes("探案")) emoji = "🕵️";
        else if (topic.includes("无厘头") || topic.includes("恶搞")) emoji = "😂";

        const newStory: Story = {
          id: `custom_${Date.now()}`,
          title: title,
          emoji,
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

  const toggleUploadWordCheck = (word: string) => {
    setSelectedUploadWords(prev => ({
      ...prev,
      [word]: !prev[word]
    }));
  };

  const handleSelectAll = (select: boolean) => {
    if (!parsingResult) return;
    const nextMap: Record<string, boolean> = {};
    parsingResult.words.forEach(w => {
      nextMap[w.word.toLowerCase()] = select;
    });
    setSelectedUploadWords(nextMap);
  };

  return (
    <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded-2xl p-6 md:p-8 shadow-sm max-w-4xl mx-auto text-[#1A1A1A]">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex p-3 bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 text-[#1A1A1A] rounded-2xl mb-3">
          <Sparkles size={24} className="animate-pulse" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-[#1A1A1A]">AI 智能联想记词脑洞工坊</h2>
        <p className="text-[#1A1A1A]/60 text-sm mt-1.5 leading-relaxed font-sans">
          导入您自己的英语 PDF 页面或生词表，AI 将自动融合生词编撰离奇有趣、脑洞大开的故事！
        </p>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-[#1A1A1A]/10 mb-6 font-medium text-sm flex-wrap gap-1">
        <button
          onClick={() => { setActiveTab("words"); setErrorMsg(""); }}
          className={`pb-3 px-4 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "words"
              ? "border-b-2 border-[#1A1A1A] text-[#1A1A1A] font-bold"
              : "text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
          }`}
        >
          <Sparkles size={15} /> 手动输入单词
        </button>
        <button
          onClick={() => { setActiveTab("analyzer"); setErrorMsg(""); }}
          className={`pb-3 px-4 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "analyzer"
              ? "border-b-2 border-[#1A1A1A] text-[#1A1A1A] font-bold"
              : "text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
          }`}
        >
          <FileText size={15} /> PDF 段落提取
        </button>
        <button
          onClick={() => { setActiveTab("uploader"); setErrorMsg(""); }}
          className={`pb-3 px-4 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "uploader"
              ? "border-b-2 border-[#1A1A1A] text-[#1A1A1A] font-bold"
              : "text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
          }`}
        >
          <Upload size={15} /> 自定义生词文件上传
        </button>
      </div>

      {/* Success details */}
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2.5">
          <Check size={16} className="mt-0.5 shrink-0 text-emerald-700" />
          <div className="space-y-1">
            <span className="font-bold font-sans uppercase tracking-wider">操作成功 SUCCESS:</span>
            <p className="opacity-95 leading-relaxed">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Error details */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <span className="font-bold font-sans uppercase tracking-wider">操作错误或网络异常:</span>
            <p className="opacity-90">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Tab Panel contents */}
      {activeTab === "words" ? (
        <div className="space-y-6">
          {/* Historical custom uploaded boards selection carousel */}
          {customBoards.length > 0 && (
            <div className="bg-white border border-[#1A1A1A]/10 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-[#1A1A1A]/45 mb-2 flex items-center gap-1.5 font-sans">
                <Clock size={12} /> 已上传历史记词账本：可通过点击直接切换
              </p>
              <div className="flex flex-wrap gap-2">
                {customBoards.map((b) => {
                  const isActive = selectedBoardId === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => handleSelectBoard(b.id)}
                      className={`px-3 py-2 rounded-lg text-xs border text-left flex items-center justify-between gap-3 group cursor-pointer transition-all ${
                        isActive
                          ? "bg-[#1A1A1A] border-[#1A1A1A] text-white"
                          : "bg-white border-[#1A1A1A]/10 text-[#1A1A1A] hover:bg-[#FAF9F6]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen size={12} />
                        <div>
                          <p className="font-bold truncate max-w-[120px]">{b.name}</p>
                          <p className={`text-[9px] ${isActive ? "text-white/60" : "text-[#1A1A1A]/40"}`}>
                            {b.words.length}词 · {b.uploadedAt}
                          </p>
                        </div>
                      </div>
                      <span
                        onClick={(e) => handleRemoveBoard(b.id, e)}
                        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 ${
                          isActive ? "text-white/60 hover:text-white" : "text-[#1A1A1A]/40 hover:text-rose-800"
                        }`}
                        title="删除该账本"
                      >
                        <Trash2 size={11} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Word inputs */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-[#1A1A1A]/60 tracking-wider font-sans uppercase">
                请输入需要记词的生词列表（空格、逗号或回车分割）
              </label>
              <button
                onClick={() => setWordInput("")}
                className="text-xs text-rose-800 hover:text-rose-600 font-bold cursor-pointer font-sans uppercase tracking-wider"
              >
                清空 Clear
              </button>
            </div>
            <textarea
              id="raw-words-input"
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value)}
              placeholder="例如: luxury, expand, strategy, potential, bankrupt"
              rows={3}
              className="w-full bg-white border border-[#1A1A1A]/10 focus:border-[#1A1A1A] rounded-xl p-4 text-[#1A1A1A] text-sm font-mono placeholder:text-[#1A1A1A]/30 outline-none transition-all resize-none leading-relaxed"
            />
            
            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-[#1A1A1A]/40 font-bold font-sans uppercase tracking-wider">经典六级生词本分类 Preset Decks：</span>
              {presetWords.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setWordInput(preset.words);
                    setSelectedBoardId(null);
                  }}
                  className="text-xs px-2.5 py-1 bg-white hover:bg-[#1A1A1A] border border-[#1A1A1A]/10 hover:text-white text-[#1A1A1A]/80 rounded-lg transition-all cursor-pointer font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === "analyzer" ? (
        <div className="space-y-5">
          {/* Paste board */}
          <div>
            <label className="text-xs font-bold text-[#1A1A1A]/60 block mb-2 tracking-wider font-sans uppercase">
              在这里粘贴外刊阅读材料，AI 将智能提炼生词并生成趣味记忆故事
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste English textbook paragraphs or raw PDF articles here..."
              rows={4}
              className="w-full bg-white border border-[#1A1A1A]/10 focus:border-[#1A1A1A] rounded-xl p-4 text-[#1A1A1A] text-sm placeholder:text-[#1A1A1A]/30 outline-none transition-all resize-none"
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
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#1A1A1A]/45 mb-2.5 font-sans">识别提取到的生词：已自动载入生成配置</p>
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
      ) : (
        /* Tab 3: Pristine Custom File Uploader */
        <div className="space-y-6">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all relative ${
              dragActive
                ? "border-[#1A1A1A] bg-[#1A1A1A]/5 scale-101"
                : "border-[#1A1A1A]/20 bg-white hover:border-[#1A1A1A]/55"
            }`}
          >
            <input
              type="file"
              id="words-file-uploader"
              onChange={handleFileChange}
              accept=".txt,.csv,.md,.json,.xlsx,.xls,.pdf"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            
            <div className="max-w-md mx-auto space-y-3 pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 flex items-center justify-center mx-auto text-[#1A1A1A]/70">
                <FileUp size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1A1A1A]">拖拽或点击上传您的英语单词表文档</p>
                <p className="text-xs text-[#1A1A1A]/50 mt-1.5 leading-relaxed font-sans">
                  已全面支持 <strong>高精度 PDF 单词表 (.pdf)</strong>、Excel 电子表格 (.xlsx, .xls)、JSON 配置、Markdown 笔记 (.md) 及 plain 文本与逗号分隔 (.csv, .txt)。
                </p>
              </div>
            </div>
          </div>

          {/* Parsed Result Preview */}
          {parsingResult && (
            <div className="bg-white p-5 rounded-2xl border border-[#1A1A1A]/10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1A1A1A]/10 pb-4">
                <div>
                  <h4 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-1.5 font-serif">
                    文件解析成功: {parsingResult.fileName}
                  </h4>
                  <p className="text-xs text-[#1A1A1A]/50 mt-0.5">请选择或剔除要记的生词，点击下方一键录选本生词表。</p>
                </div>
                
                {/* Select / Deselect actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelectAll(true)}
                    className="text-xs px-2.5 py-1.5 bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded hover:bg-[#1A1A1A] hover:text-white cursor-pointer font-bold"
                  >
                    全选
                  </button>
                  <button
                    onClick={() => handleSelectAll(false)}
                    className="text-xs px-2.5 py-1.5 bg-[#FAF9F6] border border-[#1A1A1A]/10 rounded hover:bg-[#1A1A1A] hover:text-white cursor-pointer font-bold"
                  >
                    全清
                  </button>
                </div>
              </div>

              {/* Grid of Parsed Words Custom Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {parsingResult.words.map((item) => {
                  const isChecked = selectedUploadWords[item.word.toLowerCase()] || false;
                  return (
                    <button
                      key={item.word}
                      onClick={() => toggleUploadWordCheck(item.word)}
                      className={`p-2.5 text-left border rounded-xl flex items-center justify-between transition-all cursor-pointer text-xs ${
                        isChecked
                          ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold"
                          : "bg-white border-[#1A1A1A]/10 text-[#1A1A1A]/60"
                      }`}
                    >
                      <div className="truncate max-w-[170px] pr-2">
                        <span className="font-serif text-[13px]">{item.word}</span>
                        <span className="block text-[10px] font-sans font-medium opacity-70 truncate">{item.translation}</span>
                      </div>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "border-[#1A1A1A]/20"
                      }`}>
                        {isChecked && <Check size={10} strokeWidth={4} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Loader integration buttons */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleLoadParsedWords}
                  className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-black text-white text-xs font-sans font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  导入此本单词词账 IMPORT WORD DECK <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

           {/* Quick Guide & Formatting Guidelines */}
          <div className="bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 p-4 rounded-xl text-xs space-y-2 leading-relaxed">
            <h5 className="font-serif font-black">多端多格式词表支持建议指南 GUIDELINES</h5>
            <p className="text-[#1A1A1A]/60 font-medium">
              系统配备了智能词频与语意分词器，完美适应各种导出形式、PDF原版及多栏排版布局：
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[#1A1A1A]/60 text-[11px] font-sans">
              <div>
                <span className="font-bold text-[#1A1A1A] block mb-1">📊 1. 电子表格、数据配置 & PDF 直接上传:</span>
                <p className="leading-relaxed">
                  Excel (.xlsx, .xls) 自适应提取；JSON 可以是字典对象数组或键值对。<strong>PDF 词表 (.pdf)</strong> 无论单双栏、有无音标，都能智能重构段落流，识别提取！
                </p>
              </div>
              <div>
                <span className="font-bold text-[#1A1A1A] block mb-1">📖 2. 传统文本 & 双面/双栏打印复制:</span>
                <p className="leading-relaxed">
                  支持多达 3 栏并排词表（例如：<code className="bg-black/5 px-1 rounded">you [juː] [代] 你 22 no [副] 不</code>），系统在载入时能智能拆解提取所有排版的词汇词组对。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styled story configuration & trigger */}
      <div className="mt-8 pt-6 border-t border-[#1A1A1A]/10 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/50 mb-2.5 block font-sans">
            选择故事风格脑洞戏路 Theme
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: "霸道总裁", label: "霸道总裁 👑" },
              { id: "仙侠奇幻", label: "修真仙侠 🧙‍♂️" },
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
            className="w-full md:w-auto px-8 py-4 bg-[#1A1A1A] hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-bold uppercase tracking-widest text-xs rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader size={16} className="animate-spin text-white" />
                <span>AI 正在联想中，请稍候 15~30 秒...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>一键为选中词组编撰联想故事</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
