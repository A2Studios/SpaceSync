import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Setup() {
  const [name, setName] = useState('Our place');
  const [code, setCode] = useState('');
  const [numRoommates, setNumRoommates] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleCodeChange = (e) => {
    let val = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setCode(val);
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase not connected. Please add environment variables.");
      return;
    }
    if (!code.trim()) {
      setError("Please enter a room code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create house
      const { data: house, error: houseError } = await supabase
        .from('houses')
        .insert([{ code, name, num_roommates: parseInt(numRoommates) }])
        .select()
        .single();

      if (houseError) {
        if (houseError.code === '23505') {
          throw new Error('This room code is already taken. Please choose another.');
        }
        throw houseError;
      }

      // 2. Create slots (roommates)
      const slots = Array.from({ length: numRoommates }).map((_, i) => ({
        house_id: house.id,
        slot_index: i,
        name: null,
        note: ''
      }));

      // Retrieve inserted rows to get roommate IDs for chore assignment
      const { data: insertedSlots, error: slotsError } = await supabase
        .from('roommates')
        .insert(slots)
        .select();

      if (slotsError) throw slotsError;

      // Sort slots by index to map assignments properly
      const sortedSlots = [...insertedSlots].sort((a, b) => a.slot_index - b.slot_index);

      // 3. Create initial supplies
      const initialSupplies = [
        { 
          house_id: house.id, 
          name: 'Toilet paper', 
          quantity: 3, 
          assigned_to: sortedSlots[0]?.id || null 
        },
        { 
          house_id: house.id, 
          name: 'Dish soap', 
          quantity: 1, 
          assigned_to: sortedSlots[1 % sortedSlots.length]?.id || null 
        },
        { 
          house_id: house.id, 
          name: 'Paper towels', 
          quantity: 0, 
          assigned_to: sortedSlots[2 % sortedSlots.length]?.id || null 
        }
      ];

      const { error: suppliesError } = await supabase
        .from('supplies')
        .insert(initialSupplies);

      if (suppliesError) throw suppliesError;

      // 4. Seed initial chores (todos)
      const initialTodos = [
        { 
          house_id: house.id, 
          title: 'Clean the kitchen', 
          assigned_to: sortedSlots[0]?.id || null,
          completed: false,
          is_recurring: true
        },
        { 
          house_id: house.id, 
          title: 'Take out the trash', 
          assigned_to: sortedSlots[1 % sortedSlots.length]?.id || null,
          completed: false,
          is_recurring: true
        },
        { 
          house_id: house.id, 
          title: 'Vacuum the living room', 
          assigned_to: sortedSlots[2 % sortedSlots.length]?.id || null,
          completed: false,
          is_recurring: true
        }
      ];

      const { error: todosError } = await supabase
        .from('todos')
        .insert(initialTodos);

      if (todosError) throw todosError;

      navigate(`/${code}`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't save. Try again?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 relative overflow-hidden"
         style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-35 animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200/50 shadow-xl shadow-slate-200/80 relative z-10 hover:shadow-2xl transition-all duration-500">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <h1 className="text-2.5xl font-extrabold bg-gradient-to-r from-slate-800 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
            Create a board
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            Let's launch a shared dashboard for your house!
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              House Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 placeholder-slate-400 font-medium transition-all duration-300 bg-white/50"
            />
          </div>

          <div>
            <label htmlFor="code" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Room Code
            </label>
            <input
              id="code"
              type="text"
              required
              value={code}
              onChange={handleCodeChange}
              placeholder="e.g. maple-space-23"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 placeholder-slate-400 font-mono text-sm transition-all duration-300 bg-white/50"
            />
          </div>

          <div>
            <label htmlFor="numRoommates" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Number of roommates
            </label>
            <select
              id="numRoommates"
              value={numRoommates}
              onChange={(e) => setNumRoommates(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 font-medium transition-all duration-300 bg-white/50"
            >
              {[2, 3, 4, 5, 6].map(num => (
                <option key={num} value={num}>{num} Roommates</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white font-semibold py-3 px-4 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 shadow-md disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full animate-spin border-2 border-white/50 border-t-white"></div>
                <span>Creating Board...</span>
              </>
            ) : (
              <>
                <span>Launch Board</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 15l3-3m0 0l-3-3m3 3h-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs">
          <Link to="/" className="text-slate-400 hover:text-slate-600 transition-colors font-medium">
            ← Back to Join Room
          </Link>
        </div>
      </div>
    </div>
  );
}
