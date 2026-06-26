
import { GoogleGenAI } from "@google/genai";
import { AIConfig } from "../types";
import { getAndroidBridge } from "./androidBridge";

export interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface Message {
  role: 'user' | 'model' | 'system';
  parts: ContentPart[];
}

export const generateAIResponse = async (
  config: AIConfig,
  messages: Message[],
  systemInstruction?: string
): Promise<string> => {
  
  // 1. Android Native Offline Execution
  if (config.provider === 'android-native') {
    const bridge = getAndroidBridge();
    if (!bridge) {
      throw new Error("Android native bridge is not available. Ensure you are running inside the Android app.");
    }
    
    // Construct prompt string since most local models take raw text prompts or simple formats
    let promptString = systemInstruction ? `System: ${systemInstruction}\n` : '';
    
    // Since some local models are text-only, we should check if any messages contain inlineData
    // and attempt to extract text natively using ML Kit OCR or PDF Parsing as requested.
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (part.inlineData) {
          // If we have base64 or a URI, we can pass the data URI to native OCR
          const uri = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          // Extract text synchronously from Android
          try {
             const extractedText = bridge.extractTextNatively(uri);
             promptString += `\n[Extracted Text from File]:\n${extractedText}\n`;
          } catch (e) {
             promptString += `\n[File could not be parsed offline]\n`;
          }
        }
        if (part.text) {
          promptString += `${msg.role === 'model' ? 'Assistant' : 'User'}: ${part.text}\n`;
        }
      }
    }
    
    promptString += "Assistant: ";
    
    // Pass to native inference
    try {
      const response = bridge.processOfflineInference(promptString, config.model);
      return response || "";
    } catch (e: any) {
      throw new Error(`Android Offline Inference Error: ${e?.message || 'Unknown'}`);
    }
  }

  // 2. Google Gemini Provider
  if (config.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    
    // Map 'model' role to 'model' (Gemini SDK expects 'user' or 'model')
    // Ensure system instruction is handled via config if present
    const contents = messages.map(m => ({
      role: m.role === 'system' ? 'user' : m.role, // Gemini doesn't use 'system' role in contents usually, strictly user/model
      parts: m.parts
    }));
    
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      }
    });
    
    return response.text || "";
  } 
  
  // 2. OpenAI / Custom / Local / Open Source Provider
  else {
    const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1';
    const endpoint = `${baseUrl}/chat/completions`;
    
    // Some local providers (like Ollama) might not require a key, but fetch might complain with empty header
    // or the server might expect *some* string. We default to 'dummy' if empty for custom types.
    const safeKey = config.apiKey || 'dummy-key'; 

    const openAIMessages = [];

    // Add System Instruction
    if (systemInstruction) {
      openAIMessages.push({ role: 'system', content: systemInstruction });
    }

    // Convert Messages
    for (const msg of messages) {
      const role = msg.role === 'model' ? 'assistant' : (msg.role === 'system' ? 'system' : 'user');
      
      const content = msg.parts.map(part => {
        if (part.text) {
          return { type: 'text', text: part.text };
        }
        if (part.inlineData) {
          // Convert base64 to data URI
          return {
            type: 'image_url',
            image_url: {
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
            }
          };
        }
        return null;
      }).filter(Boolean);

      // If content is just text, send as string (better compatibility for some local models)
      if (content.length === 1 && content[0]?.type === 'text') {
        openAIMessages.push({ role, content: content[0].text });
      } else {
        openAIMessages.push({ role, content });
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${safeKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: openAIMessages,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API Error (${response.status}): ${err.slice(0, 200)}...`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
};

export const validateConnection = async (config: AIConfig): Promise<boolean> => {
  try {
    if (config.provider === 'android-native') {
      const bridge = getAndroidBridge();
      if (!bridge) throw new Error("Bridge not found");
      // Just check if we can query models
      bridge.getAvailableModels();
      return true;
    }
    
    const testMsg: Message[] = [{ role: 'user', parts: [{ text: 'Hello, are you online? Reply with yes.' }] }];
    await generateAIResponse(config, testMsg);
    return true;
  } catch (e) {
    console.error("Validation failed:", e);
    return false;
  }
};
