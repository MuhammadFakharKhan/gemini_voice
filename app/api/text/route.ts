import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WaveFile } from 'wavefile';
import { SYSTEM_PROMPT } from '@/app/api/voice/prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const llmModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

const ttsModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-preview-tts"
});

export async function POST(req: NextRequest) {
  try {

    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // LLM response
    const llmResult = await llmModel.generateContent({
      contents: [{ role: "user", parts: [{ text }] }],
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }]
      }
    });

    const textResponse = llmResult.response.text();

    // TTS
    const ttsResult = await ttsModel.generateContent({
  contents: [
    {
      role: "user",
      parts: [{ text: textResponse }]
    }
  ],
  generationConfig: {
    responseModalities: ["AUDIO"],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: "Kore" }
      }
    }
  } as any
});

    const response = ttsResult.response;

    let audioData: Buffer | null = null;

    for (const candidate of response.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.mimeType?.startsWith("audio")) {
          audioData = Buffer.from(part.inlineData.data, "base64");
          break;
        }
      }
    }

    if (!audioData) {
      throw new Error("No audio returned from Gemini");
    }

    // PCM → WAV
    const wav = new WaveFile();

    const pcm = new Int16Array(
      audioData.buffer,
      audioData.byteOffset,
      audioData.length / 2
    );

    wav.fromScratch(1, 24000, "16", pcm);

    const wavBuffer = wav.toBuffer();
    const base64Audio = Buffer.from(wavBuffer).toString("base64");

    return NextResponse.json({
      textResponse,
      audio: base64Audio
    });

  } catch (error: any) {

    console.error(error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );

  }
}