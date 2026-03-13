'use client';

import { useRef, useState } from 'react';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responseText, setResponseText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsLoading(true);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setTranscript(data.transcript);
        setResponseText(data.textResponse);

        // Play the returned audio
        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        audio.play();
      } else {
        console.error('API error:', data.error);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8">Voice Agent</h1>

        <div className="flex justify-center mb-8">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isLoading}
            className={`
              w-32 h-32 rounded-full flex items-center justify-center text-white text-lg font-semibold
              transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-300
              ${isRecording ? 'bg-red-500 scale-110' : 'bg-blue-600 hover:bg-blue-700'}
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
            ) : isRecording ? (
              'Recording...'
            ) : (
              '🎤 Hold to speak'
            )}
          </button>
        </div>

        {transcript && (
          <div className="mb-4 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">You said:</p>
            <p className="text-lg">{transcript}</p>
          </div>
        )}

        {responseText && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600 mb-1">Assistant:</p>
            <p className="text-lg">{responseText}</p>
          </div>
        )}
      </div>
    </main>
  );
}