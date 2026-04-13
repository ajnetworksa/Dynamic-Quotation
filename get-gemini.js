async function run() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  const data = await res.json();
  const models = data.data.filter(m => m.id.includes('gemini'));
  models.forEach(m => console.log(m.id + " (Prompt: " + m.pricing.prompt + ")"));
}
run();
