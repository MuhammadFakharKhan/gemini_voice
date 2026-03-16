import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai';
import { WaveFile } from 'wavefile';
import { SYSTEM_PROMPT } from '@/app/api/voice/prompt';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const ttsModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-preview-tts',
});

const llmModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
});

export async function POST(req: NextRequest) {

  const errors: string[] = [];

  try {

    // 1️⃣ Parse audio
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided', errors },
        { status: 400 }
      );
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // 2️⃣ Speech → Text (Deepgram)
    let transcript = '';

    try {

      const { result } = await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-3',
          smart_format: true
        }
      );

      transcript =
        result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

      if (!transcript) {
        errors.push('STT: No speech detected');
      }

    } catch (err: any) {

      errors.push(`STT error: ${err.message}`);
      throw new Error('Speech-to-text failed');

    }

    // 3️⃣ LLM Response
    let textResponse = '';

    try {

      const llmResult = await llmModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: transcript }] }],
        systemInstruction: {
          role: 'system',
          parts: [{ text: SYSTEM_PROMPT }]
        },
      });

      textResponse = llmResult.response.text();

    } catch (err: any) {

      errors.push(`LLM error: ${err.message}`);
      throw new Error('LLM generation failed');

    }

    // 4️⃣ Text → Speech (Gemini TTS)

    let audioData: Buffer | null = null;

    try {

      const ttsResult = await ttsModel.generateContent({

        contents: [
          {
            role: 'user',
            parts: [{ text: textResponse }]
          }
        ],

        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Kore"
              }
            }
          }
        } as GenerationConfig & { speechConfig?: any }

      });

      const response = ttsResult.response;

      for (const candidate of response.candidates ?? []) {

        for (const part of candidate.content?.parts ?? []) {

          if (part.inlineData?.mimeType?.startsWith('audio')) {

            audioData = Buffer.from(part.inlineData.data, 'base64');
            break;

          }

        }

        if (audioData) break;

      }

      if (!audioData) {
        throw new Error('No audio returned from Gemini TTS');
      }

    } catch (err: any) {

      errors.push(`TTS error: ${err.message}`);
      throw new Error('Text-to-speech failed');

    }

    // 5️⃣ Convert PCM → WAV

    const wav = new WaveFile();

    const pcmData = new Int16Array(
      audioData.buffer,
      audioData.byteOffset,
      audioData.length / 2
    );

    wav.fromScratch(1, 24000, '16', pcmData);

    const wavBuffer = wav.toBuffer();
    const base64Audio = Buffer.from(wavBuffer).toString('base64');

    return NextResponse.json({
      transcript,
      textResponse,
      audio: base64Audio,
      errors
    });

  } catch (error: any) {

    console.error(error);

    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        errors
      },
      { status: 500 }
    );

  }

}