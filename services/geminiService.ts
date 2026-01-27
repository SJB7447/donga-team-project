
import { GoogleGenAI, Type } from "@google/genai";
import { AIProgressResult } from "../types";

// Note: In this environment, process.env.API_KEY is injected automatically.
const API_KEY = process.env.API_KEY || "AIzaSyD6exqgxRty6EUX0qgfJoMhNHxzDZ7kAM0";

export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: API_KEY });
};

export async function calculateTaskProgress(
  taskTitle: string,
  deadline: string,
  description: string,
  context: string
): Promise<AIProgressResult> {
  const ai = getGeminiClient();
  const prompt = `프로젝트 관리 전문가로서 다음 작업의 진행 상태를 평가하고 구체적인 수치(0~100)를 제공하세요.

[프로젝트 배경]
${context}

[평가 대상 작업]
작업명: ${taskTitle}
마감일: ${deadline}
작업 진행 내용: ${description}

요구사항:
1. 현실적인 진행률(%)을 소수점 없이 정수로 도출하세요.
2. 진행률 도출 근거와 앞으로의 권장 사항을 한 문장으로 답변하세요.
3. 반드시 JSON 형식으로만 답변하세요.

응답 형식 예시: {"percentage": 75, "reasoning": "핵심 모듈 구현이 완료되었으나 단위 테스트가 남아있어 75%로 평가하며, 조속한 QA 진행을 권장합니다."}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            percentage: { type: Type.NUMBER },
            reasoning: { type: Type.STRING }
          },
          required: ["percentage", "reasoning"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 응답 없음");
    return JSON.parse(text) as AIProgressResult;
  } catch (error) {
    console.error("AI Evaluation Error:", error);
    throw error;
  }
}

export async function generateProjectSummary(data: string): Promise<string> {
  const ai = getGeminiClient();
  const prompt = `다음은 프로젝트의 현재 작업 및 통계 데이터입니다.
이를 바탕으로 경영진에게 보고할 수준의 전문적인 요약 보고서를 작성하세요.

[데이터]
${data}

작성 지침:
- 한국어로 작성하세요.
- 마크다운 형식을 사용하여 가독성을 높이세요.
- 현재의 건강 상태(정상, 주의, 위기)를 진단하세요.
- 각 팀원의 성과와 향후 리스크 관리를 포함하세요.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "요약 리포트를 생성할 수 없습니다.";
  } catch (error) {
    console.error("AI Summary Error:", error);
    return "AI 서비스 연결 중 오류가 발생했습니다.";
  }
}
