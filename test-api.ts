import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
});

async function run() {
  try {
    const res = await openai.chat.completions.create({
      model: "meta-llama/llama-3-8b-instruct:free",
      messages: [{ role: 'user', content: 'hello' }]
    });
    console.log("LLAMA SUCCESS:", res.choices[0].message.content);
  } catch (e: any) {
    console.error("LLAMA ERROR:", e.message);
  }
}
run();
