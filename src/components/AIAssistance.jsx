import React, { useState, useRef, useEffect } from 'react';
import { Brain, X, Send, Mic, FileText, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import './AIAssistance.css';

const BASE_URL = 'https://welmed.vercel.app';

const AIAssistance = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content:
        "Hello! I'm your Wellmed AI assistant. I can help you with medical coding, DRG analysis, CPT/ICD/HCPCS, and more. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pdfContent, setPdfContent] = useState('');
  const [pdfMeta, setPdfMeta] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Helpers ---
  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const toBackendMessages = (msgs) =>
    msgs.map((m) => ({
      role: m.type === 'assistant' ? 'assistant' : 'user',
      content: m.type === 'assistant' ? stripHtml(m.content) : m.content,
    }));

  const safeExtractGeminiText = (data) => {
    try {
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join('\n') ??
        null;
      return text;
    } catch {
      return null;
    }
  };

  const notifyError = (msg) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: 'assistant',
        content: `**Error:** ${msg}`,
        timestamp: new Date(),
      },
    ]);
  };

  // --- Speech Recognition ---
  const initializeSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return null;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      if (event.results.length > 0 && event.results[0].length > 0) {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
      }
      setIsListening(false);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert('Please allow microphone access to use speech recognition.');
      } else if (event.error === 'no-speech') {
        alert('No speech detected. Please try again.');
      } else {
        alert(`Speech recognition error: ${event.error}`);
      }
    };
    recognition.onend = () => setIsListening(false);
    return recognition;
  };

  const handleSpeakToAsk = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current = initializeSpeechRecognition();
      recognitionRef.current?.start();
    }
  };

  // --- PDF Upload (to backend) ---
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file only.');
      return;
    }

    setUploadedFile(file);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await fetch(`${BASE_URL}/api/analyze-pdf`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'PDF Analysis failed');
      }

      setPdfContent(data.text || '');
      setPdfMeta({ pages: data.pages, info: data.info });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'assistant',
          content: `I've processed your PDF (${file.name}) with **${data.pages ?? 'unknown'}** pages. You can now ask questions based on its content.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error('PDF analysis error:', err);
      notifyError('PDF analysis failed. Please try again with a valid PDF.');
      setUploadedFile(null);
      setPdfContent('');
      setPdfMeta(null);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Send Message (to backend chat/chat1) ---
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const history = toBackendMessages([...messages, userMessage].slice(-12));
      const endpoint = pdfContent ? '/api/chat1' : '/api/chat';
      const payload = pdfContent ? { messages: history, pdfContent } : { messages: history };

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.details || data?.error || 'Sorry, I encountered an error while generating a response.';
        throw new Error(msg);
      }

      const rawText = safeExtractGeminiText(data);
      const finalText = rawText || 'I could not parse a response from the model. Please try rephrasing your question.';

      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: finalText, // keep raw markdown; render cleanly below
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      notifyError(err.message || 'Sorry, something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen((o) => !o);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const toggleFullscreen = () => setIsFullscreen((f) => !f);

  // --- Lightweight Markdown renderer (no extra symbols injected) ---
  const escapeHtml = (s) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const markdownToHtml = (md) => {
    if (!md) return '';

    // Normalize line endings
    md = md.replace(/\r\n?/g, '\n');

    // Protect code blocks first
    const codeBlocks = [];
    md = md.replace(/```([\s\S]*?)```/g, (_, code) => {
      const i = codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`) - 1;
      return `[[[CODEBLOCK_${i}]]]`;
    });

    // Inline code
    md = md.replace(/`([^`]+?)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);

    // Headings
    md = md
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Bold / Italic (basic)
    md = md
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links [text](url)
    md = md.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Lists (group into <ul>/<ol>)
    const lines = md.split('\n');
    let out = '';
    let inUL = false;
    let inOL = false;

    const closeLists = () => {
      if (inUL) {
        out += '</ul>';
        inUL = false;
      }
      if (inOL) {
        out += '</ol>';
        inOL = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Unordered list item: - or * followed by space
      if (/^\s*[-*]\s+/.test(line)) {
        if (!inUL) {
          closeLists();
          inUL = true;
          out += '<ul class="ai-message-list">';
        }
        const item = line.replace(/^\s*[-*]\s+/, '');
        out += `<li class="ai-message-list-item">${item}</li>`;
        continue;
      }

      // Ordered list item: 1. 2. etc
      if (/^\s*\d+\.\s+/.test(line)) {
        if (!inOL) {
          closeLists();
          inOL = true;
          out += '<ol class="ai-message-list">';
        }
        const item = line.replace(/^\s*\d+\.\s+/, '');
        out += `<li class="ai-message-list-item">${item}</li>`;
        continue;
      }

      // Blank line -> paragraph break
      if (/^\s*$/.test(line)) {
        closeLists();
        out += '<br>';
        continue;
      }

      // Regular paragraph line
      closeLists();
      out += `<p>${line}</p>`;
    }
    closeLists();

    // Restore code blocks
    out = out.replace(/\[\[\[CODEBLOCK_(\d+)]]]/g, (_, idx) => codeBlocks[Number(idx)]);

    return out;
  };

  return (
    <>
      {/* Floating AI Assistant Button */}
      <div className="ai-assistant-button" onClick={toggleChat}>
        <Brain size={24} />
        <span className="ai-assistant-label">AI Assistant</span>
      </div>

      {/* Chat Modal */}
      {isOpen && (
        <div className={`ai-assistant-modal ${isFullscreen ? 'fullscreen' : ''}`}>
          <div className="ai-assistant-header">
            <div className="ai-assistant-title">
              <Brain size={20} />
              <span>Wellmed AI Assistant</span>
            </div>
            <div className="ai-assistant-controls">
              <button
                className="ai-assistant-fullscreen"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
              <button className="ai-assistant-close" onClick={toggleChat}>
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="ai-assistant-messages">
            {messages.map((message) => (
              <div key={message.id} className={`ai-message ${message.type}`}>
                <div className="ai-message-content">
                  {message.type === 'assistant' ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(message.content),
                      }}
                    />
                  ) : (
                    message.content
                  )}
                </div>
                <div className="ai-message-time">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="ai-message assistant">
                <div className="ai-message-content">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-assistant-input-container">
            <div className="ai-assistant-tools">
              <button
                className="ai-tool-button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload PDF"
              >
                <FileText size={16} />
              </button>
              <button
                className={`ai-tool-button ${isListening ? 'listening' : ''}`}
                onClick={handleSpeakToAsk}
                title="Voice Input"
              >
                <Mic size={16} />
              </button>
            </div>

            <div className="ai-input-wrapper">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about DRG, CPT, ICD, documentation, coverage rules..."
                className="ai-input"
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="ai-send-button"
              >
                <Send size={16} />
              </button>
            </div>

            {uploadedFile && (
              <div className="ai-uploaded-file">
                <FileText size={16} />
                <span>{uploadedFile.name}</span>
                <button
                  onClick={() => {
                    setUploadedFile(null);
                    setPdfContent('');
                    setPdfMeta(null);
                  }}
                  className="ai-remove-file"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {pdfMeta && (
              <div className="ai-uploaded-file" style={{ opacity: 0.8 }}>
                <span>Parsed PDF • Pages: {pdfMeta.pages ?? '—'}</span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </>
  );
};

export default AIAssistance;