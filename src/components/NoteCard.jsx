import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const timeAgo = (dateString) => {
  if (!dateString) return '';
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function NoteCard({ slot, isMe, theme }) {
  const [note, setNote] = useState(slot.note || '');
  const isTaken = !!slot.name;
  const color = theme.avatarColors[slot.slot_index % theme.avatarColors.length];
  
  // Keep local state in sync when external updates come in (unless we're currently typing)
  useEffect(() => {
    if (!isMe) {
      setNote(slot.note || '');
    }
  }, [slot.note, isMe]);

  const saveTimeoutRef = useRef(null);

  const handleNoteChange = (e) => {
    const val = e.target.value;
    setNote(val);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('roommates')
        .update({ note: val, updated_at: new Date().toISOString() })
        .eq('id', slot.id);
    }, 500);
  };

  if (!isTaken) {
    return (
      <div className={`h-full w-full border-2 rounded-2xl p-5 flex flex-col justify-center items-center min-h-[185px] border-dashed transition-all duration-500 ${theme.supplyRow} border-black/10`}>
        <span className={`font-medium ${theme.textMuted}`}>Empty slot</span>
      </div>
    );
  }

  return (
    <div className={`h-full w-full flex flex-col rounded-2xl p-5 min-h-[185px] transition-all duration-500 ${theme.cardBg} ${isMe ? `ring-2 shadow-md transform hover:-translate-y-0.5 ${theme.cardRing}` : `shadow-sm ${theme.cardHover}`}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-transform hover:scale-105 duration-300 ${color} ${theme.avatarText}`}>
          {slot.name.charAt(0).toUpperCase()}
        </div>
        <div className={`font-semibold flex-1 text-[15px] ${theme.textMain}`}>
          <div className="max-w-[120px] sm:max-w-[150px] truncate" title={slot.name}>
            {slot.name}
          </div>
        </div>
        {isMe && (
          <span className={`${theme.buttonStyle} text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm ml-auto shrink-0`}>
            You
          </span>
        )}
      </div>
      <textarea
        value={note}
        onChange={isMe ? handleNoteChange : undefined}
        readOnly={!isMe}
        placeholder={isMe ? "What's going on?..." : ""}
        className={`w-full flex-1 resize-none min-h-[90px] text-[15px] leading-relaxed outline-none bg-transparent transition-colors duration-500
          ${!isMe ? `${theme.textMuted} cursor-default` : theme.textMain}
        `}
        style={{ height: 'auto' }}
        onInput={(e) => {
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
        }}
      />
      {slot.note && slot.updated_at && (
        <div className={`mt-2 flex justify-end text-[10px] opacity-70 ${theme.textMuted}`}>
          Updated {timeAgo(slot.updated_at)}
        </div>
      )}
    </div>
  );
}
