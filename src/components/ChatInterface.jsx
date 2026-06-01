import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './ChatInterface.css';

// Initialize Gemini API
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const ChatInterface = ({ onAddFoodLog }) => {
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', text: "Hi! I'm your Thyroid Diet Assistant. What did you eat today, or do you have any questions about the Reset Phase?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const processWithGemini = async (text) => {
    if (!genAI) {
      return fallbackProcess(text);
    }
    
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `
        You are a helpful, expert assistant for the "Thyroid Reset Diet" by Dr. Alan Christianson.
        The user is currently tracking their food intake.
        Analyze the following user input: "${text}"
        
        If they mentioned eating food, estimate the iodine content of that food based on standard nutritional data.
        Categorize the food as "Green" (<10mcg), "Yellow" (10-50mcg), or "Red" (>50mcg).
        
        Return your response strictly as a JSON object with this structure:
        {
          "reply": "Your conversational, encouraging response to the user. Mention the iodine content of their meal.",
          "foods": [
             { "name": "Food Item", "category": "Green/Yellow/Red", "iodine": number }
          ]
        }
        
        If they are just asking a general question and not logging food, keep "foods" as an empty array [].
      `;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Clean up markdown formatting if present
      let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedData = JSON.parse(cleanJson);
      
      // Add foods to dashboard
      if (parsedData.foods && parsedData.foods.length > 0) {
        parsedData.foods.forEach(food => {
          onAddFoodLog({
            name: food.name,
            category: food.category,
            iodine: food.iodine,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          });
        });
      }
      
      return parsedData.reply;
      
    } catch (error) {
      console.error("Gemini API Error:", error);
      return `Error: ${error.message}. Please check your API key or console for details.`;
    }
  };

  // Mock LLM parsing as fallback
  const fallbackProcess = (text) => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('egg') || lowerText.includes('spinach')) {
      onAddFoodLog({ name: 'Egg & Spinach', category: 'Green', iodine: 8, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
      return "(Mock Mode) I've logged 1 serving of Egg & Spinach. That's a Green Light meal! Please add a VITE_GEMINI_API_KEY to your .env file to use the real AI.";
    }
    
    return "(Mock Mode) Got it. Please add a VITE_GEMINI_API_KEY to your .env file to enable the real Gemini integration.";
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const replyText = await processWithGemini(userMessage.text);
    
    setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', text: replyText }]);
    setIsTyping(false);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <Sparkles className="chat-icon" />
        <h2>Diet Assistant</h2>
      </div>
      
      <div className="messages-area">
        {messages.map(msg => (
          <div key={msg.id} className={`message-wrapper ${msg.role}`}>
            <div className="message-bubble">
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message-wrapper assistant">
            <div className="message-bubble typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-area" onSubmit={handleSend}>
        <div className="input-wrapper">
          <input 
            type="text" 
            placeholder={apiKey ? "Log a meal or ask a question..." : "Waiting for API Key..."} 
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" disabled={!input.trim()}>
            <Send className="send-icon" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
