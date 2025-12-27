// app/api/agent-brain/route.ts
import { NextResponse } from 'next/server';
import { getWorkerForTask, getBaseUrl, TaskType } from '@/app/lib/llm-config';

export async function POST(request: Request) {
  try {
    const { agent, context, taskType } = await request.json();
    const worker = getWorkerForTask(taskType as TaskType);
    const apiKey = process.env[worker.keyName];

    if (!apiKey) {
      return NextResponse.json({ error: `Missing API Key: ${worker.keyName}` }, { status: 500 });
    }

    // 构建 Prompt
    let systemPrompt = `You are playing a role in a virtual town simulation.
    Your name is ${agent.name}, your job is ${agent.job}.
    Your personality is: ${agent.mood}.
    Current energy: ${Math.floor(agent.energy)}/100.
    
    Format your response as a JSON object strictly.`;

    let userPrompt = "";

    if (taskType === 'CHAT') {
        userPrompt = `Context: ${context}. 
        Generate a short, one-sentence thought or speech bubble (max 15 words) for yourself based on your surroundings or job.
        Response format: {"content": "Your text here"}`;
    } else if (taskType === 'REACTION') {
        userPrompt = `Context: ${context}.
        Decide your next action state (IDLE, WALKING, WORKING, TALKING).
        Response format: {"state": "NEW_STATE", "reason": "Short reason"}`;
    }

    // 调用 LLM
    const response = await fetch(`${getBaseUrl(worker.provider)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: worker.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 60,
        response_format: { type: "json_object" } 
      })
    });

    const data = await response.json();
    
    // 解析结果
    let result = { content: "..." };
    if (data.choices && data.choices[0].message.content) {
        try {
            result = JSON.parse(data.choices[0].message.content);
        } catch (e) {
            console.error("JSON Parse Error", e);
            result = { content: data.choices[0].message.content }; // Fallback
        }
    }

    return NextResponse.json({ success: true, result, workerId: worker.id });

  } catch (error) {
    console.error("Brain Error:", error);
    return NextResponse.json({ error: "Brain malfunction" }, { status: 500 });
  }
}