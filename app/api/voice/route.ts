import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai';
import { WaveFile } from 'wavefile';
import { SYSTEM_PROMPT } from './prompt';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const ttsModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    responseModalities: ['audio'],
  } as GenerationConfig & { responseModalities?: string[] },
});

const llmModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file' }, { status: 400 });
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    const { result } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      { model: 'nova-3', smart_format: true }
    );

    const transcript = result?.results?.channels[0]?.alternatives[0]?.transcript;
    if (!transcript) {
      return NextResponse.json({ error: 'No speech detected' }, { status: 400 });
    }

    const llmResult = await llmModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: transcript }] }],
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
    });
    const textResponse = llmResult.response.text();

    const ttsResult = await ttsModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: textResponse }] }],
    });

    const response = ttsResult.response;
    let audioData: Buffer | null = null;

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData && part.inlineData.mimeType === 'audio/pcm') {
        audioData = Buffer.from(part.inlineData.data, 'base64');
        break;
      }
    }

    if (!audioData) {
      throw new Error('No audio returned from TTS');
    }

    // Convert PCM to WAV (24000 Hz, 16-bit mono)
   // Convert PCM to WAV (24000 Hz, 16-bit mono)
const wav = new WaveFile();
// @ts-ignore - TypeScript overload mismatch for Int16Array constructor
const pcmData = new Int16Array(audioData.buffer, 0, audioData.length / 2);
wav.fromScratch(1, 24000, '16', pcmData);
const wavBuffer = wav.toBuffer();
const base64Audio = Buffer.from(wavBuffer).toString('base64');

return new NextResponse(
  JSON.stringify({
    transcript,
    textResponse,
    audio: base64Audio,
  }),
  { headers: { 'Content-Type': 'application/json' } }
);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}