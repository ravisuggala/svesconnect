import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function Chatbot() {

  const [messages, setMessages] = useState(() => {
    const savedMessages = localStorage.getItem("sves_chat_messages");
    return savedMessages
      ? JSON.parse(savedMessages)
      : [
          {
            sender: "bot",
            text: "Hello 👋 I’m SVES AI Chatbot. I help you find details about equipment, laboratories, facilities and infrastructure resources. Ask me anything!"
          }
        ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(
      "sves_chat_messages",
      JSON.stringify(messages)
    );
  }, [messages]);

  const clearChat = () => {
    localStorage.removeItem("sves_chat_messages");
    setMessages([
      {
        sender: "bot",
        text: "Hello 👋 I’m SVES AI Chatbot. I help you find details about equipment, laboratories, facilities and infrastructure resources. Ask me anything!"
      }
    ]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(
        "/api/chatbot/chat",
        { question: input }
      );

      const botMsg = { sender: "bot", text: res.data.answer };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Server error. Try again later." }
      ]);
    }

    setLoading(false);
  };

  return (
    <div className="bg-light d-flex align-items-center justify-content-center p-2" style={{ minHeight: "calc(100vh - 48px)" }}>
      <div className="col-12 col-sm-10 col-md-8 col-lg-6">
        <div className="card shadow border-0 rounded-4">

          <div
            className="card-header text-center text-white rounded-top-4"
            style={{ background: "#0f766e" }}
          >
            <h5 className="mb-0 fw-bold">SVES AI Chatbot</h5>
            <small>Infrastructure Assistant</small>
          </div>

          <div
            className="card-body overflow-auto"
            style={{ height: "420px", background: "#f8fafc" }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`d-flex mb-3 ${
                  msg.sender === "user"
                    ? "justify-content-end"
                    : "justify-content-start"
                }`}
              >
                <div
                  className="px-3 py-2 rounded-3"
                  style={{
                    maxWidth: "75%",
                    background:
                      msg.sender === "user" ? "#134e4a" : "#ffffff",
                    color:
                      msg.sender === "user" ? "#ffffff" : "#111827",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.1)"
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <p className="text-muted fst-italic small">
                Processing request...
              </p>
            )}

            <div ref={bottomRef}></div>
          </div>

          <div className="card-footer bg-white">
            <div className="d-flex gap-2 align-items-center">

              <input
                type="text"
                className="form-control rounded-pill"
                placeholder="Type your question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />

              <button
                className="btn text-white rounded-pill px-4"
                style={{ background: "#0f766e" }}
                onClick={sendMessage}
              >
                Send
              </button>

              <button
                className="btn btn-outline-secondary rounded-pill px-3"
                onClick={clearChat}
              >
                Refresh
              </button>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
