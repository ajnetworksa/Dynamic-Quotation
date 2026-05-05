import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

async function list() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '', "v1");
  const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-pro"];
  
  for (const m of models) {
    try {
      await genAI.getGenerativeModel({ model: m }).generateContent("test");
      console.log(`Success with ${m}`);
    } catch (e: any) {
      console.error(`Error with ${m}:`, e.message);
    }
  }
}

list();
