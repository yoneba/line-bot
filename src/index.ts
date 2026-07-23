import { Hono } from 'hono';

interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  AI: any; // Workers AI
}

const app = new Hono<{ Bindings: Env }>();

// LINE AI 回答関数
async function answerAi(question: string, env: Env) {
  return question;
  // const answer = await env.AI.run(
  //   '@cf/meta/llama-3-8b-instruct',
  //   {
  //     messages: [
  //       {
  //         role: 'user',
  //         content: question
  //       }
  //     ]
  //   }
  // );
  // return answer.response;
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
        // AI に質問
        const aiReply = await answerAi(messageText, c.env);
        // LINE に返信
        await replyMessage(replyToken, aiReply, c.env);
      }
    }
  }

  return c.text("ok");
});

// ホスト設定
export default app;

