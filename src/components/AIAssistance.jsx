import React, { useState, useRef, useEffect } from 'react';
import { Brain, X, Send, Mic, FileText, Loader2, MessageSquare, Maximize2, Minimize2 } from 'lucide-react';
import './AIAssistance.css';

const AIAssistance = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: 'Hello! I\'m your Gemini-powered medical coding AI assistant. I can help you with medical coding, DRG analysis, CPT codes, and more. How can I assist you today?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pdfContent, setPdfContent] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize speech recognition
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

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      if (event.results.length > 0 && event.results[0].length > 0) {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
      }
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert('Please allow microphone access to use speech recognition.');
      } else if (event.error === 'no-speech') {
        alert('No speech detected. Please try speaking again.');
      } else {
        alert(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return recognition;
  };

  const handleSpeakToAsk = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      recognitionRef.current = initializeSpeechRecognition();
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file only.');
      return;
    }

    setUploadedFile(file);
    
    // Read PDF content
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      // For now, we'll extract text from PDF and use it as context
      // In a real implementation, you'd want to use a PDF parsing library
      const reader = new FileReader();
      reader.onload = async (e) => {
        // Simple text extraction - for better results, use pdf-parse or similar
        const text = e.target.result;
        setPdfContent(text);
        
        // Add system message about PDF context
        const pdfContextMessage = {
          id: Date.now(),
          type: 'assistant',
          content: `I've uploaded your PDF document. I can now help you with questions related to this content.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, pdfContextMessage]);
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('PDF analysis error:', error);
      alert('Error analyzing PDF. Please try again.');
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Use Gemini API directly
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyAShoQ4yMxCJq32MzvwUcpVheyzdwyR-wY', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                                    text: `You are a medical coding AI assistant. Help students with medical coding, DRG analysis, CPT codes, and related questions. 

Student's question: ${inputMessage}

${pdfContent ? `Context from uploaded PDF: ${pdfContent}` : ''}

Provide a helpful, accurate response focused on medical coding education.`
                }
              ]
            }
          ]
        })
      });

      if (response.ok) {
                          const data = await response.json();
                  const rawContent = data.candidates[0].content.parts[0].text;
                  
                  // Format the response to look like ChatGPT with bullet points and emojis
                  const formattedContent = formatResponse(rawContent);
                  
                  const assistantMessage = {
                    id: Date.now() + 1,
                    type: 'assistant',
                    content: formattedContent,
                    timestamp: new Date()
                  };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
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
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Format AI response to look like ChatGPT with bullet points and emojis
  const formatResponse = (text) => {
    if (!text) return text;
    
    let formatted = text;
    
    // Add emojis to common medical coding terms
    const emojiMap = {
      'DRG': '🏥',
      'CPT': '📋',
      'ICD': '📊',
      'HCPCS': '🏷️',
      'medical coding': '⚕️',
      'coding': '💻',
      'hospital': '🏥',
      'patient': '👤',
      'diagnosis': '🔍',
      'procedure': '🩺',
      'billing': '💰',
      'insurance': '🛡️',
      'claim': '📄',
      'revenue': '💵',
      'compliance': '✅',
      'audit': '🔍',
      'documentation': '📝',
      'clinical': '🏥',
      'surgical': '🔪',
      'emergency': '🚨',
      'outpatient': '🏥',
      'inpatient': '🏥',
      'ambulatory': '🚶',
      'pharmacy': '💊',
      'laboratory': '🧪',
      'radiology': '📷',
      'cardiology': '❤️',
      'orthopedics': '🦴',
      'pediatrics': '👶',
      'geriatrics': '👴',
      'oncology': '🦠',
      'neurology': '🧠',
      'psychiatry': '🧠',
      'dermatology': '🦠',
      'ophthalmology': '👁️',
      'dental': '🦷',
      'obstetrics': '🤱',
      'gynecology': '👩‍⚕️'
    };
    
    // Replace terms with emojis
    Object.entries(emojiMap).forEach(([term, emoji]) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      formatted = formatted.replace(regex, `${emoji} ${term}`);
    });
    
    // Format bullet points and lists
    formatted = formatted.replace(/^[-*]\s+/gm, '• ');
    formatted = formatted.replace(/^(\d+)\.\s+/gm, '$1️⃣ ');
    
    // Format headers
    formatted = formatted.replace(/^(#+)\s+(.+)$/gm, (match, hashes, text) => {
      const level = hashes.length;
      const emojis = ['📌', '🔹', '🔸', '▪️', '▫️'];
      const emoji = emojis[Math.min(level - 1, emojis.length - 1)];
      return `${emoji} **${text}**`;
    });
    
    // Format important terms
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '**$1**');
    formatted = formatted.replace(/\*(.+?)\*/g, '*$1*');
    
    // Add spacing for better readability
    formatted = formatted.replace(/\n\n/g, '\n\n');
    
    return formatted;
  };

  // Convert formatted text to HTML for rendering
  const formatMessageContent = (text) => {
    if (!text) return '';
    
    let html = text;
    
    // Convert markdown-style formatting to HTML
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Convert bullet points to proper HTML lists
    html = html.replace(/^(•\s+.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Convert numbered lists
    html = html.replace(/^(\d+️⃣\s+.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>\d+️⃣.*<\/li>)/s, '<ol>$1</ol>');
    
    // Convert line breaks to HTML
    html = html.replace(/\n/g, '<br>');
    
    // Add CSS classes for styling
    html = html.replace(/<ul>/g, '<ul class="ai-message-list">');
    html = html.replace(/<ol>/g, '<ol class="ai-message-list">');
    html = html.replace(/<li>/g, '<li class="ai-message-list-item">');
    
    return html;
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
              <span>Gemini AI Assistant</span>
            </div>
            <div className="ai-assistant-controls">
              <button 
                className="ai-assistant-fullscreen" 
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
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
                     <div dangerouslySetInnerHTML={{ 
                       __html: formatMessageContent(message.content) 
                     }} />
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
                placeholder="Ask me anything about medical coding, DRG codes, CPT codes..."
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
                  }}
                  className="ai-remove-file"
                >
                  <X size={14} />
                </button>
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
