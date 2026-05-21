import React, { useState } from 'react';

interface Message {
  id: number;
  from: string;
  subject: string;
  body: string;
  time: string;
}

const initialMessages: Message[] = [
  { id: 1, from: 'Supervisor', subject: 'Cambio de horario', body: 'Por favor, revisa el turno de mañana.', time: 'Hace 20 minutos' },
  { id: 2, from: 'Recepción', subject: 'Reserva urgente', body: 'Gestiona la habitación 207 antes de las 14:00.', time: 'Hace 1 hora' }
];

export const WorkerMessages: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject || !body) return;

    setMessages((prev) => [
      {
        id: prev.length + 1,
        from: 'Yo',
        subject,
        body,
        time: 'Ahora'
      },
      ...prev
    ]);
    setSubject('');
    setBody('');
  };

  return (
    <div className="worker-page">
      <div className="page-header">
        <h2>Mensajes</h2>
        <p>Comunícate con el supervisor y registra tus respuestas.</p>
      </div>

      <div className="admin-grid">
        <div className="admin-card message-card">
          <h3>Enviar mensaje</h3>
          <form onSubmit={handleSend} className="admin-form">
            <label>
              Asunto
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto" />
            </label>
            <label>
              Mensaje
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe tu mensaje" />
            </label>
            <button type="submit" className="admin-action-btn">
              Enviar mensaje
            </button>
          </form>
        </div>

        <div className="admin-card message-list-card">
          <h3>Historial de mensajes</h3>
          <div className="messages-list">
            {messages.map((message) => (
              <div key={message.id} className="message-item">
                <div className="message-meta">
                  <strong>{message.subject}</strong>
                  <span>{message.time}</span>
                </div>
                <p>{message.body}</p>
                <small>De: {message.from}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
