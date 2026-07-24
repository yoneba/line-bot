import { Hono } from 'hono';

interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  AI: Ai; // Workers AI
}

const app = new Hono<{ Bindings: Env }>();

// LINE AI 回答関数
async function askAi(question: string, env: Env) {
  const messages = [
    { role: "system", content: "You are a friendly assistant" },
    { role: "user", content: question },
  ];
  const answer = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", { messages });
  if (!answer.response) {
    throw new Error("No response from AI");
  }
  return answer.response;
}

// LINE 返信関数
async function replyMessage(
  replyToken: string,
  message: string,
  env: Env
) {
  const replyMessage = {
    replyToken: replyToken,
    messages: [
      {
        type: "text",
        text: message
      }
    ]
  };

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(replyMessage),
  });
}

// Webhook 処理（LINE メッセージ受信）
app.post("/callback", async (c) => {
  const body = await c.req.json();

  const events = body.events;

  for (const event of events) {
    if (
      event.type === "message" &&
      event.message.type === "text"
    ) {
      const replyToken = event.replyToken;
      const messageText = event.message.text;

      // メンション判定（@bot や @AI）
      if (messageText.includes("@bot") || messageText.includes("@AI")) {
        try {
          // AI に質問
          const aiReply = await askAi(messageText, c.env);
          // LINE に返信
          await replyMessage(replyToken, aiReply, c.env);
        } catch (error) {
          console.error("Error occurred while fetching AI response:", error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
          await replyMessage(replyToken, `Error: ${errorMessage}`, c.env);
        }
      }
    }
  }

  return c.text("ok");
});

// ルートパスのテスト用エンドポイント
app.get("/", async (c) => {
  try {
    const messageText = "What is Cloudflare Worker AI?";
    const aiReply = await askAi(messageText, c.env);
    return c.text(aiReply);
  } catch (error) {
    console.error("Error occurred while fetching AI response:", error);
    return c.text(error instanceof Error ? error.message : "An unknown error occurred");
  }
});

// ホスト設定
export default app;

