'use client';

import { useRef, useState } from 'react';
import ErrorLog from '@/components/ErrorLog';

type Tab = 'voice' | 'text';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responseText, setResponseText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Voice recording handlers
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
        await processVoice(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setErrors([]); // clear previous errors
    } catch (error) {
      console.error('Microphone error:', error);
      setErrors(prev => [...prev, 'Microphone access denied']);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsLoading(true);
    }
  };

  const processVoice = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setTranscript(data.transcript || '');
        setResponseText(data.textResponse);
        setErrors(data.errors || []);
        if (data.audio) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
          audio.play();
        }
      } else {
        setErrors(prev => [...prev, data.error || 'Unknown error']);
      }
    } catch (error: any) {
      setErrors(prev => [...prev, `Network error: ${error.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  // Text submission handler
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    setIsLoading(true);
    setErrors([]);
    setTranscript(''); // not applicable

    try {
      const res = await fetch('/api/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput }),
      });

      const data = await res.json();
      if (res.ok) {
        setResponseText(data.textResponse);
        setErrors(data.errors || []);
        if (data.audio) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
          audio.play();
        }
      } else {
        setErrors(prev => [...prev, data.error || 'Unknown error']);
      }
    } catch (error: any) {
      setErrors(prev => [...prev, `Network error: ${error.message}`]);
    } finally {
      setIsLoading(false);
      setTextInput('');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-3xl font-bold text-center mb-6">Voice Agent</h1>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            className={`flex-1 py-2 text-center font-medium ${
              activeTab === 'voice'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('voice')}
          >
            🎤 Voice Input
          </button>
          <button
            className={`flex-1 py-2 text-center font-medium ${
              activeTab === 'text'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('text')}
          >
            ⌨️ Text Input
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'voice' ? (
          <div className="flex flex-col items-center">
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
                '🎤 Hold'
              )}
            </button>
            {transcript && (
              <div className="mt-4 w-full p-4 bg-gray-100 rounded-lg">
                <p className="text-sm text-black mb-1">You said:</p>
                <p className="text-lg">{transcript}</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleTextSubmit} className="space-y-4">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your message..."
              className="w-full p-3 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !textInput.trim()}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                'Send'
              )}
            </button>
          </form>
        )}

        {/* Response */}
        {responseText && (
          <div className="mt-6 p-4 bg-white-50 rounded-lg">
            <p className="text-sm text-black mb-1">Assistant:</p>
            <p className="text-lg text-black">{responseText}</p>
          </div>
        )}

        {/* Error Log */}
        <ErrorLog errors={errors} />
      </div>
    </main>
  );
}