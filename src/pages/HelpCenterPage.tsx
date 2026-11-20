import React, {useState} from 'react';
import {ChevronDown, MessageSquare, Mic, PhoneCall, Send} from 'lucide-react';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {useVoiceAssistant} from '../hooks/useVoiceAssistant';

const FAQS = [
  {
    q: 'How does the bus conductor know I need the wheelchair ramp?',
    a: 'As soon as you confirm your ticket, your boarding stop, ramp side, and assistance needs appear on the conductor’s tablet 3 stops ahead. When the conductor taps Acknowledge, your ticket updates to "Conductor has been notified ✓".',
  },
  {
    q: 'What if I have no internet connection at the bus stop?',
    a: 'SahayYatra caches your latest QR ticket, conductor name, and stop details offline. You can also book or request status via SMS by texting BOOK <ROUTE> <STOP> to 56767.',
  },
  {
    q: 'How do I activate Voice-First mode without looking at the screen?',
    a: 'Press and hold Spacebar, shake your phone gently, enable "Hey Bus" continuous listening, or double-tap anywhere on the screen when Blind / Voice-First Mode is enabled.',
  },
  {
    q: 'What is the refund policy if a bus is delayed or I cancel?',
    a: 'Cancellations up to 5 minutes before departure receive a 100% instant refund with a 30-second Undo window. If a bus is cancelled by depot operations, smart earlier and later alternatives are shown immediately.',
  },
];

const VOICE_CHEAT_SHEET = [
  'I want to go to the railway station tomorrow morning',
  'Book the 9:15 one',
  'Where is my bus?',
  'Change to the earlier bus',
  'Cancel my booking',
  'Help emergency SOS',
];

export const HelpCenterPage: React.FC = () => {
  const {executeIntent} = useVoiceAssistant();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<Array<{from: 'user' | 'agent'; text: string}>>([
    {from: 'agent', text: 'Welcome to SahayYatra 24×7 Accessibility Desk. How can we assist your trip today?'},
  ]);

  const sendSupportMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    setChatLog((prev) => [
      ...prev,
      {from: 'user', text},
      {
        from: 'agent',
        text: 'Thank you. A live accessibility coordinator has logged your request (Ref #SY-HELP-204) and notified the route depot.',
      },
    ]);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-28 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Accessible Help Center</h1>
        <p className="text-sm text-[var(--sy-text-muted)] mt-1">
          Clear large-text answers, voice command cheat-sheet, and direct human support—zero auto-playing videos.
        </p>
      </div>

      {/* Voice Cheat Sheet */}
      <Card>
        <div className="flex items-center gap-2.5 mb-3">
          <Mic className="w-6 h-6 text-[var(--sy-primary)]" aria-hidden="true" />
          <h2 className="text-xl font-bold">How to Use “Hey Bus” Voice Commands</h2>
        </div>
        <p className="text-sm text-[var(--sy-text-muted)] mb-4">
          Tap any phrase below to test how the voice assistant responds right now:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VOICE_CHEAT_SHEET.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => void executeIntent(cmd)}
              className="min-h-[52px] px-4 py-3 rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface-muted)] text-left text-sm font-bold hover:border-[var(--sy-primary)] cursor-pointer"
            >
              “{cmd}”
            </button>
          ))}
        </div>
      </Card>

      {/* Large-Text FAQ */}
      <Card>
        <h2 className="text-xl font-bold mb-4">Frequently Asked Questions</h2>
        <div className="divide-y divide-[var(--sy-border)]">
          {FAQS.map((item, idx) => {
            const expanded = openIndex === idx;
            return (
              <div key={item.q} className="py-3">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenIndex(expanded ? null : idx)}
                  className="w-full min-h-[52px] flex items-center justify-between gap-4 text-left font-bold text-base sm:text-lg cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {expanded && (
                  <p className="mt-2 text-sm sm:text-base text-[var(--sy-text-muted)] leading-relaxed">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Contact Options */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="md:col-span-5 space-y-4">
          <h2 className="text-xl font-bold">Direct Contact</h2>
          <a
            href="tel:18004257242"
            className="min-h-[56px] w-full rounded-2xl bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] font-bold flex items-center justify-center gap-2 no-underline"
          >
            <PhoneCall className="w-5 h-5" aria-hidden="true" />
            Toll-Free Helpline: 1800-425-7242
          </a>
          <div className="p-4 rounded-2xl bg-[var(--sy-surface-muted)] text-sm">
            <p className="font-bold">SMS Offline Booking</p>
            <p className="text-[var(--sy-text-muted)] mt-1">
              Text <span className="font-tabular font-bold">BOOK 305R MGR</span> to{' '}
              <span className="font-tabular font-bold">56767</span> anytime without data.
            </p>
          </div>
        </Card>

        <Card className="md:col-span-7 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[var(--sy-primary)]" aria-hidden="true" />
            <h2 className="text-xl font-bold">In-App Support Chat</h2>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto p-3 rounded-2xl bg-[var(--sy-surface-muted)]">
            {chatLog.map((m, i) => (
              <div
                key={i}
                className={`text-sm p-3 rounded-2xl ${
                  m.from === 'user'
                    ? 'bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] ml-8'
                    : 'bg-[var(--sy-surface)] border border-[var(--sy-border)] mr-8'
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={sendSupportMessage} className="flex gap-2">
            <label htmlFor="help-chat-input" className="sr-only">
              Type support message
            </label>
            <input
              id="help-chat-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask support a question…"
              className="flex-1 min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4"
            />
            <Button type="submit" variant="primary" icon={<Send className="w-4 h-4" />}>
              Send
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
