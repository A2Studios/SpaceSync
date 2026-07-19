import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const COLORS = [
  'bg-blue-100 border-blue-200 text-blue-900',
  'bg-emerald-100 border-emerald-200 text-emerald-900',
  'bg-amber-100 border-amber-200 text-amber-900',
  'bg-pink-100 border-pink-200 text-pink-900',
  'bg-purple-100 border-purple-200 text-purple-900',
  'bg-rose-100 border-rose-200 text-rose-900'
];

export default function Join({ house, onJoin }) {
  const [roommates, setRoommates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState(null);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    const fetchRoommates = async () => {
      const { data } = await supabase
        .from('roommates')
        .select('*')
        .eq('house_id', house.id)
        .order('slot_index');
      
      if (data) setRoommates(data);
      setLoading(false);
    };

    fetchRoommates();

    const channel = supabase.channel('roommates_join')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roommates', filter: `house_id=eq.${house.id}` }, payload => {
        setRoommates(current => {
          const newRoommates = [...current];
          const index = newRoommates.findIndex(r => r.id === payload.new.id);
          if (index !== -1) newRoommates[index] = payload.new;
          return newRoommates;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [house.id]);

  const claimSlot = async (e) => {
    e.preventDefault();
    if (!nameInput.trim() || !activeSlot) return;

    const { error } = await supabase
      .from('roommates')
      .update({ name: nameInput.trim() })
      .eq('id', activeSlot.id);

    if (!error) {
      onJoin(activeSlot.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-full animate-spin border-4 border-dashed border-slate-900 opacity-20 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4 sm:p-6 bg-slate-50"
         style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      
      <header className="max-w-3xl w-full mx-auto py-5 mb-8 flex justify-between items-center border-b border-slate-200/60 bg-white/50 backdrop-blur-sm px-4 rounded-2xl shadow-sm">
        <div className="flex items-center">
          <h1 className="text-xl font-extrabold bg-gradient-to-r from-slate-800 to-indigo-950 bg-clip-text text-transparent">
            {house.name}
          </h1>
        </div>
        <div className="bg-slate-900 text-white font-mono text-xs px-3.5 py-1.5 rounded-full font-semibold shadow-sm">
          {house.code}
        </div>
      </header>
      
      <main className="flex-1 max-w-3xl w-full mx-auto flex flex-col justify-center pb-24">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Who are you?</h2>
          <p className="text-slate-500 font-medium text-sm mt-2">Select an empty slot or claim your profile to join the board.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {roommates.map((slot) => {
            const isTaken = !!slot.name;
            const colorClass = COLORS[slot.slot_index % COLORS.length];

            if (activeSlot?.id === slot.id) {
              return (
                <div key={slot.id} className="border-2 border-indigo-600 rounded-2xl p-5 bg-white shadow-lg transform scale-105 transition-all duration-300 flex flex-col justify-center min-h-[160px]">
                  <form onSubmit={claimSlot} className="flex flex-col h-full justify-between gap-3">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Your name..."
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full text-center text-lg font-bold outline-none border-b-2 border-indigo-100 focus:border-indigo-600 pb-1 text-slate-800 placeholder-slate-300"
                    />
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setActiveSlot(null)}
                        className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl py-2 px-3 flex-1 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={!nameInput.trim()}
                        className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 px-4 flex-1 disabled:opacity-40 shadow-md shadow-indigo-600/10 transition-all"
                      >
                        Claim Slot
                      </button>
                    </div>
                  </form>
                </div>
              );
            }

            return (
              <button
                key={slot.id}
                disabled={isTaken}
                onClick={() => {
                  setActiveSlot(slot);
                  setNameInput('');
                }}
                className={`border rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 min-h-[160px]
                  ${isTaken 
                    ? 'bg-slate-100/60 border-slate-200/50 opacity-60 cursor-not-allowed shadow-inner' 
                    : 'bg-white border-slate-200 hover:border-slate-350 hover:shadow-md active:scale-95 cursor-pointer shadow-sm'
                  }
                `}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 shadow-inner ${isTaken ? colorClass : 'bg-slate-100 text-slate-400 border border-slate-200 border-dashed'}`}>
                  {isTaken ? (
                    <span className="font-extrabold text-lg uppercase">{slot.name.charAt(0)}</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                </div>
                <div className={`font-bold text-sm tracking-wide ${isTaken ? 'text-slate-700' : 'text-slate-400'}`}>
                  {isTaken ? slot.name : 'Empty Slot'}
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
