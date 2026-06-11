import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
// @ts-ignore
import pdfParse from "pdf-parse";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API endpoint to generate story using Gemini 3.5-flash
app.post("/api/stories/generate", async (req, res) => {
  const { words, topic } = req.body;

  if (!words || !Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: "请输入需要编成故事的单词列表！" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return res.status(400).json({
      error: "未在后台配置环境变量中的 GEMINI_API_KEY 密钥。请点击 AI Studio 的 Secrets 面板添加变量以便能够进行 AI 创意故事写作！"
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const topicQuery = topic ? `【${topic}】` : "【趣味恶搞 / 霸道总裁 / 魔法奇幻 / 校园写实 / 末日科幻】之中的一种趣味风格";
    const prompt = `你是一个极为幽默、擅长写作“谐音梗”或“无厘头联想”故事以帮助中高考、CET-6学生快速记住词汇的明星英语名师。
你的任务是将以下提供的词汇，完美融入到一个生动、搞笑、甚至脑洞大开的中文故事中：

词汇列表：[${words.join(", ")}]

生成规范：
1. 风格必须是：${topicQuery}。情节必须具有强烈的画面感、趣味和记忆点，让读者读一遍就能浮现画面。
2. 必须且只能融入这批提供的所有英文单词！
3. 单词在故事叙述中的展现格式，必须全网严格采用 \`{english_word}(中文释义)\` 的格式。
   例如：“听到这个消息，大家都觉得很 {absurd}(荒谬的)，她更是感到一片 {anxiety}(焦虑)。”
   大括号和小括号前后无杂乱空格，释义要适合该句。
4. 故事的第一行格式：《故事名称》
5. 字数控制在 250 到 500 字，节奏明快，废话少。
6. 只要返回写好的 Markdown 故事正文，不要输出任何其他的回复、说明或客套话。`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const storyText = response.text || "";
    res.json({ storyText });
  } catch (err: any) {
    console.error("Gemini Generation Error:", err);
    res.status(500).json({ error: err.message || "生成失败，可能是服务繁忙或网络原因，请稍后再试。" });
  }
});

// API endpoint to analyze custom sentences or lists to extract vocabulary
app.post("/api/words/extract", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "请输入要提取的文本" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    // Return simple local regex extract if AI key is missing
    const found = text.match(/[a-zA-Z]+/g) || [];
    const unique = Array.from(new Set(found.map((w) => w.toLowerCase()))).filter((w) => w.length > 2);
    return res.json({ words: unique.slice(0, 30) });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `请分析以下提供的文本内容，并从中挑选出最符合大学英语六级(CET-6)难度水平（忽略最基础的 simple words 比如 are,/is/the/and/you 等）或者用户重点强调的英文单词。
选出 10 到 15 个核心词汇，并输出翻译，仅需返回 JSON 数组格式。

待分析文本：
"""
${text}
"""

必须以 JSON 数组格式返回，格式如下：
[
  {"word": "ambition", "translation": "野心"},
  {"word": "aggressive", "translation": "好干涉的，侵略性的"}
]
不要有任何 Markdown 包裹标签（或使用 json 格式回复），保证可以用 JSON.parse 直接解析。`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const contentText = response.text || "[]";
    const parsed = JSON.parse(contentText.trim());
    res.json({ words: parsed });
  } catch (err: any) {
    console.error("Extraction Error:", err);
    // Fallback regex extract
    const found = text.match(/[a-zA-Z]+/g) || [];
    const unique = Array.from(new Set(found.map((w) => w.toLowerCase()))).filter((w) => w.length > 3);
    const mockOutput = unique.slice(0, 15).map(w => ({ word: w, translation: "提取自内容" }));
    res.json({ words: mockOutput });
  }
});

// API endpoint to parse PDF server-side using pdf-parse to bypass browser CSP/iframe blocks
app.post("/api/parse-pdf", async (req, res) => {
  const { fileBase64, fileName } = req.body;

  if (!fileBase64) {
    return res.status(400).json({ error: "没有接收到有效的文件数据流！" });
  }

  try {
    const dataBuffer = Buffer.from(fileBase64, "base64");
    
    // Custom page rendering function to inject Page Boundaries
    const renderPage = (pageData: any) => {
      const pageNumber = pageData.pageIndex + 1;
      return pageData.getTextContent().then((textContent: any) => {
        let lastY: any = null;
        let lastX = 0;
        let text = `==Start of Page ${pageNumber}==\n`;
        
        for (let item of textContent.items) {
          if (lastY === item.transform[5] || lastY === null) {
            const gap = item.transform[4] - lastX;
            if (gap > 12) {
              text += "    " + item.str;
            } else {
              text += " " + item.str;
            }
          } else {
            text += "\n" + item.str;
          }
          lastY = item.transform[5];
          lastX = item.transform[4] + (item.str.length * 6);
        }
        text += `\n==End of Page ${pageNumber}==\n\n`;
        return text;
      });
    };

    const options = {
      pagerender: renderPage
    };

    const parsedData = await pdfParse(dataBuffer, options);
    res.json({ text: parsedData.text });
  } catch (err: any) {
    console.error("PDF Parsing Server Error:", err);
    res.status(500).json({ error: `服务器端 PDF 引擎解析失败: ${err.message || err}` });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server start error:", err);
});
