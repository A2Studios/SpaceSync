import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import NoteCard from '../components/NoteCard';
import SupplyItem from '../components/SupplyItem';
import { THEMES } from '../lib/themes';
import { Check, Copy, LogOut, Edit2, CheckSquare, ListTodo, Trash2, RefreshCw, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Board({ house, mySlotId }) {
  const navigate = useNavigate();
  const [roommates, setRoommates] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [todos, setTodos] = useState([]);
  
  // States for Chores
  const [newChoreTitle, setNewChoreTitle] = useState('');
  const [newChoreAssignee, setNewChoreAssignee] = useState('');
  const [isChoreRecurring, setIsChoreRecurring] = useState(true);
  
  // States for Supplies
  const [newSupplyName, setNewSupplyName] = useState('');
  const [newSupplyAssignee, setNewSupplyAssignee] = useState('');

  // States for House Renaming
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(house?.name || '');

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [animatingTodos, setAnimatingTodos] = useState([]);

  const theme = THEMES[house?.theme] || THEMES.default;

  // Sync edited house name when house updates from realtime
  useEffect(() => {
    if (house?.name) {
      setEditedName(house.name);
    }
  }, [house?.name]);

  useEffect(() => {
    const fetchBoardData = async () => {
      const [roommatesRes, suppliesRes, todosRes] = await Promise.all([
        supabase.from('roommates').select('*').eq('house_id', house.id).order('slot_index'),
        supabase.from('supplies').select('*').eq('house_id', house.id).order('created_at'),
        supabase.from('todos').select('*').eq('house_id', house.id).order('created_at')
      ]);
      
      if (roommatesRes.data) setRoommates(roommatesRes.data);
      if (suppliesRes.data) setSupplies(suppliesRes.data);
      if (todosRes.data) setTodos(todosRes.data);
      
      setLoading(false);
    };

    fetchBoardData();

    const channel = supabase.channel('board_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roommates', filter: `house_id=eq.${house.id}` }, payload => {
        setRoommates(current => {
          const newRoommates = [...current];
          const index = newRoommates.findIndex(r => r.id === payload.new.id);
          if (index !== -1) newRoommates[index] = payload.new;
          return newRoommates;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplies', filter: `house_id=eq.${house.id}` }, payload => {
        setSupplies(current => {
          if (payload.eventType === 'INSERT') return [...current, payload.new];
          if (payload.eventType === 'DELETE') return current.filter(s => s.id !== payload.old.id);
          
          const newSupplies = [...current];
          const index = newSupplies.findIndex(s => s.id === payload.new.id);
          if (index !== -1) newSupplies[index] = payload.new;
          return newSupplies;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos', filter: `house_id=eq.${house.id}` }, payload => {
        setTodos(current => {
          if (payload.eventType === 'INSERT') return [...current, payload.new];
          if (payload.eventType === 'DELETE') return current.filter(t => t.id !== payload.old.id);
          
          const newTodos = [...current];
          const index = newTodos.findIndex(t => t.id === payload.new.id);
          if (index !== -1) newTodos[index] = payload.new;
          return newTodos;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [house.id]);

  // Rename House
  const saveHouseName = async () => {
    if (!editedName.trim() || editedName.trim() === house.name) {
      setIsEditingName(false);
      setEditedName(house.name);
      return;
    }
    setIsEditingName(false);
    await supabase.from('houses').update({ name: editedName.trim() }).eq('id', house.id);
  };

  // Add Supply
  const addSupply = async (e) => {
    e.preventDefault();
    if (!newSupplyName.trim()) return;

    const name = newSupplyName.trim();
    const assignee = newSupplyAssignee || null;

    setNewSupplyName('');
    setNewSupplyAssignee('');

    await supabase
      .from('supplies')
      .insert([{ 
        house_id: house.id, 
        name, 
        quantity: 3,
        assigned_to: assignee
      }]);
  };

  // Add Chore / Todo
  const addTodo = async (e) => {
    e.preventDefault();
    if (!newChoreTitle.trim()) return;

    const title = newChoreTitle.trim();
    const assignee = newChoreAssignee || null;
    const isRecurring = isChoreRecurring;

    setNewChoreTitle('');
    setNewChoreAssignee('');
    setIsChoreRecurring(true);

    const { error } = await supabase
      .from('todos')
      .insert([{
        house_id: house.id,
        title,
        assigned_to: assignee,
        completed: false,
        is_recurring: isRecurring
      }]);

    if (error) {
      console.error('addTodo insert failed:', error);
      // Fallback: insert without is_recurring if column doesn't exist
      if (error.code === '42703' || error.message?.includes('column')) {
        console.warn('is_recurring column missing — inserting without it');
        await supabase
          .from('todos')
          .insert([{
            house_id: house.id,
            title,
            assigned_to: assignee,
            completed: false
          }]);
      }
    }
  };

  // Delete Chore
  const deleteTodo = async (id) => {
    await supabase.from('todos').delete().eq('id', id);
  };

  // Manually reassign a chore
  const reassignTodo = async (todoId, roommateId) => {
    await supabase.from('todos').update({ assigned_to: roommateId || null }).eq('id', todoId);
  };

  // Checkbox complete - handles auto-rotation for recurring, and completion for one-time chores
  const toggleTodo = async (todo) => {
    // Treat is_recurring as true when undefined/null (matches DB default of TRUE)
    const isRecurring = todo.is_recurring !== false;
    
    const activeRms = roommates.filter(r => r.name !== null);
    const mySlot = roommates.find(r => r.id === mySlotId);
    const completerName = mySlot?.name || 'Someone';
    const now = new Date().toISOString();

    // Start completion animation
    setAnimatingTodos(prev => [...prev, todo.id]);
    await new Promise(resolve => setTimeout(resolve, 800));
    setAnimatingTodos(prev => prev.filter(id => id !== todo.id));

    if (isRecurring) {
      // --- RECURRING CHORE: rotate assignee, log completion, keep active ---
      let nextAssigneeId = todo.assigned_to;
      let rotationText = `Completed by ${completerName}`;

      // Update completion counts
      const completerId = mySlotId || 'guest';
      const currentCounts = todo.completion_counts || {};
      const newCounts = {
        ...currentCounts,
        [completerId]: (currentCounts[completerId] || 0) + 1
      };

      if (activeRms.length > 0) {
        const eligible = activeRms.filter(r => r.id !== completerId);
        
        if (eligible.length === 0) {
          nextAssigneeId = completerId;
          rotationText = `Assigned to ${completerName}`;
        } else if (eligible.length === 1) {
          nextAssigneeId = eligible[0].id;
          rotationText = `Completed by ${completerName} — assigned to ${eligible[0].name} next`;
        } else {
          // Weighted random assignment
          const counts = eligible.map(r => newCounts[r.id] || 0);
          const maxCount = Math.max(...counts);
          
          const weights = eligible.map(r => {
            const count = newCounts[r.id] || 0;
            return (maxCount - count) + 1; // +1 ensures everyone has at least a baseline chance
          });
          
          const totalWeight = weights.reduce((a, b) => a + b, 0);
          let random = Math.random() * totalWeight;
          nextAssigneeId = eligible[eligible.length - 1].id;
          
          for (let i = 0; i < eligible.length; i++) {
            random -= weights[i];
            if (random <= 0) {
              nextAssigneeId = eligible[i].id;
              break;
            }
          }
          const nextAssigneeName = activeRms.find(r => r.id === nextAssigneeId)?.name || 'Someone';
          rotationText = `Completed by ${completerName} — assigned to ${nextAssigneeName} next`;
        }
      }

      // Optimistic local update so UI responds instantly
      setTodos(current => current.map(t => t.id === todo.id ? {
        ...t,
        assigned_to: nextAssigneeId,
        completed: false,
        last_completed_by: completerName,
        last_completed_at: now,
        completion_counts: newCounts
      } : t));

      // Persist to Supabase
      const { error } = await supabase
        .from('todos')
        .update({ 
          assigned_to: nextAssigneeId,
          completed: false,
          last_completed_by: completerName,
          last_completed_at: now,
          completion_counts: newCounts
        })
        .eq('id', todo.id);
      
      if (error) {
        console.error('toggleTodo recurring update failed:', error);
        // Retry without the new columns in case they don't exist yet
        if (error.code === '42703' || error.message?.includes('column')) {
          console.warn('Columns missing — updating without completion_counts fields');
          await supabase
            .from('todos')
            .update({ 
              assigned_to: nextAssigneeId, 
              completed: false,
              last_completed_by: completerName,
              last_completed_at: now
            })
            .eq('id', todo.id);
        }
      }
    } else {

      // Optimistic local update — remove from active list immediately
      setTodos(current => current.map(t => t.id === todo.id ? {
        ...t,
        completed: true,
        last_completed_by: completerName,
        last_completed_at: now
      } : t));

      const { error } = await supabase
        .from('todos')
        .update({ 
          completed: true,
          last_completed_by: completerName,
          last_completed_at: now
        })
        .eq('id', todo.id);

      if (error) {
        console.error('toggleTodo one-time update failed:', error);
        // Retry without the new columns in case they don't exist yet
        if (error.code === '42703' || error.message?.includes('column')) {
          console.warn('Columns missing — updating without last_completed fields');
          await supabase
            .from('todos')
            .update({ completed: true })
            .eq('id', todo.id);
        }
      }
    }
  };

  // Seed standard chores if todo list is empty
  const seedSuggestedChores = async () => {
    const activeRoommates = roommates.filter(r => r.name !== null);
    const slotsList = activeRoommates.length > 0 ? activeRoommates : roommates;

    const suggested = [
      { house_id: house.id, title: 'Clean the kitchen', assigned_to: slotsList[0]?.id || null, completed: false, is_recurring: true },
      { house_id: house.id, title: 'Take out the trash', assigned_to: slotsList[1 % slotsList.length]?.id || null, completed: false, is_recurring: true },
      { house_id: house.id, title: 'Vacuum the living room', assigned_to: slotsList[2 % slotsList.length]?.id || null, completed: false, is_recurring: true }
    ];

    const { error } = await supabase.from('todos').insert(suggested);
    if (error) {
      console.error('seedSuggestedChores failed:', error);
      // Fallback: insert without is_recurring if column doesn't exist
      if (error.code === '42703' || error.message?.includes('column')) {
        const fallback = suggested.map(({ is_recurring, ...rest }) => rest);
        await supabase.from('todos').insert(fallback);
      }
    }
  };

  const updateTheme = async (themeId) => {
    await supabase.from('houses').update({ theme: themeId }).eq('id', house.id);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveRoom = async () => {
    await supabase.from('roommates').update({ name: null, note: '' }).eq('id', mySlotId);
    
    const { data: currentRoommates } = await supabase.from('roommates').select('*').eq('house_id', house.id);
    const hasOthers = currentRoommates && currentRoommates.some(r => r.name !== null && r.id !== mySlotId);
    
    if (!hasOthers) {
      await supabase.from('houses').delete().eq('id', house.id);
    }
    
    localStorage.removeItem(`spacesync_${house.code}`);
    localStorage.removeItem('spacesync_last_room');
    
    navigate('/');
    window.location.reload();
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-all duration-500 ${theme.appBg}`} style={theme.appStyle}>
        <div className={`w-8 h-8 rounded-full animate-spin border-4 border-dashed opacity-50 ${theme.textMain} border-t-transparent`}></div>
      </div>
    );
  }

  // Active roommates lookup map
  const activeRoommates = roommates.filter(r => r.name !== null);
  const activeTodos = todos.filter(t => !t.completed);

  return (
    <div className={`min-h-screen flex flex-col p-4 sm:p-6 transition-all duration-500 ${theme.appBg}`} style={theme.appStyle}>
      
      {/* Header */}
      <header className="py-4 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 max-w-5xl w-full mx-auto border-b border-black/5 pb-6">
        <div className="flex items-center flex-1">
          {/* Editable House Title */}
          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={saveHouseName}
              onKeyDown={(e) => e.key === 'Enter' && saveHouseName()}
              className={`text-2xl font-bold tracking-tight bg-transparent border-b-2 border-indigo-400 outline-none max-w-[280px] sm:max-w-md ${theme.textMain}`}
            />
          ) : (
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingName(true)}>
              <h1 className={`text-2xl font-extrabold tracking-tight ${theme.textMain}`}>
                {house.name}
              </h1>
              <Edit2 size={14} className={`opacity-0 group-hover:opacity-60 transition-opacity ${theme.textMuted}`} />
            </div>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 p-1.5 bg-black/5 rounded-full backdrop-blur-sm shadow-inner">
            {Object.keys(THEMES).map(t => (
              <button
                key={t}
                onClick={() => updateTheme(t)}
                className={`w-5 h-5 rounded-full ${THEMES[t].swatch} ${house?.theme === t ? 'ring-2 ring-offset-2 ring-offset-transparent ring-slate-400 scale-110 shadow-sm' : 'opacity-70 hover:opacity-100 hover:scale-110'} transition-all`}
                title={THEMES[t].name}
              />
            ))}
          </div>
          <button 
            onClick={copyLink}
            className={`border px-3.5 py-1.5 rounded-full text-xs font-mono shadow-sm font-semibold transition-all duration-300 flex items-center gap-2 ${copied ? 'bg-emerald-100 border-emerald-200 text-emerald-800' : `${theme.headerStyle} hover:scale-105`}`}
            title="Copy Invite Link"
          >
            {house.code}
            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="opacity-50" />}
          </button>
          <button 
            onClick={leaveRoom}
            className={`p-2 border rounded-full shadow-sm font-medium transition-all duration-300 ${theme.headerStyle} hover:bg-rose-500 hover:text-white hover:border-rose-600`}
            title="Leave Room"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>


      {/* Main Dashboard */}
      <main className="flex-1 max-w-5xl w-full mx-auto space-y-12 pb-12">
        
        {/* Roommates Profiles */}
        <section>
          <div className="flex flex-wrap justify-center items-stretch gap-4 max-w-5xl mx-auto">
            {roommates.map((slot) => {
              let widthClass = 'w-full md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.7rem)] max-w-sm';
              if (roommates.length === 1) widthClass = 'w-full max-w-sm';
              if (roommates.length === 2) widthClass = 'w-full md:w-[calc(50%-0.5rem)] max-w-md';
              if (roommates.length === 4) widthClass = 'w-full md:w-[calc(50%-0.5rem)] max-w-md';
              
              return (
                <div key={slot.id} className={`flex ${widthClass}`}>
                  <div className="w-full h-full">
                    <NoteCard slot={slot} isMe={slot.id === mySlotId} theme={theme} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Split columns: Chores (Left), Supplies (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* COLUMN 1: CHORE WHEEL */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ListTodo size={18} className={theme.textMain} />
                <h2 className={`text-lg font-bold tracking-tight transition-colors duration-500 ${theme.textMain}`}>
                  Chore Wheel
                </h2>
              </div>
              {activeTodos.length === 0 && (
                <button
                  onClick={seedSuggestedChores}
                  className={`text-xs font-semibold px-3 py-1 border rounded-lg transition-colors flex items-center gap-1.5 shadow-sm ${theme.headerStyle} hover:bg-black/5`}
                >
                  <RefreshCw size={11} />
                  <span>Seed Chores</span>
                </button>
              )}
            </div>

            <div className={`border rounded-2xl overflow-hidden shadow-sm transition-all duration-500 ${theme.cardBg}`}>
              <div className="divide-y divide-black/5">
                {activeTodos.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                    <CheckSquare size={36} className={`opacity-20 ${theme.textMuted}`} />
                    <p className={`text-sm font-medium ${theme.textMuted}`}>No active chores.</p>
                    {todos.length === 0 && (
                      <button
                        onClick={seedSuggestedChores}
                        className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${theme.buttonStyle}`}
                      >
                        Use Recommended Prompts
                      </button>
                    )}
                  </div>
                ) : (
                  activeTodos.map(todo => {
                    const assignedRoommate = roommates.find(r => r.id === todo.assigned_to);
                    return (
                      <div key={todo.id} className={`group flex items-center justify-between p-3.5 transition-all duration-500 ${animatingTodos.includes(todo.id) ? 'bg-emerald-50 scale-[1.02] shadow-sm rounded-xl' : theme.supplyRow}`}>
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Complete Checkbox */}
                          <button
                            onClick={() => toggleTodo(todo)}
                            disabled={animatingTodos.includes(todo.id)}
                            className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                              (todo.completed || animatingTodos.includes(todo.id))
                                ? 'bg-emerald-100 border-emerald-200 text-emerald-600 shadow-sm scale-110' 
                                : 'border-slate-300 hover:border-slate-400 bg-white'
                            }`}
                            title={todo.is_recurring !== false ? "Complete and rotate assignment!" : "Complete chore!"}
                          >
                            {(todo.completed || animatingTodos.includes(todo.id)) && <Check size={14} strokeWidth={3} />}
                          </button>
                          
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[14px] font-medium transition-all break-words ${todo.completed ? 'line-through opacity-40' : (animatingTodos.includes(todo.id) ? 'text-slate-900' : theme.textMain)}`}>
                                {todo.title}
                              </span>
                              {todo.is_recurring !== false && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase bg-indigo-50 border border-indigo-150 text-indigo-600 shadow-sm" title="Recurring Chore">
                                  <RefreshCw size={8} className="animate-spin-slow" />
                                  <span>Recurring</span>
                                </span>
                              )}
                            </div>
                            {todo.is_recurring !== false && todo.last_completed_by && todo.last_completed_at && (
                              <p className={`text-[11px] font-semibold mt-1 transition-colors ${animatingTodos.includes(todo.id) ? 'text-slate-700' : theme.textMuted}`}>
                                  Last completed by <span className={`font-bold ${animatingTodos.includes(todo.id) ? 'text-slate-900' : theme.textMain}`}>{todo.last_completed_by}</span> on {new Date(todo.last_completed_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} at {new Date(todo.last_completed_at).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Assignee pill / selector */}
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <select
                              value={todo.assigned_to || ''}
                              onChange={(e) => reassignTodo(todo.id, e.target.value)}
                              className={`w-[105px] text-left truncate text-[11px] font-extrabold py-1.5 pl-3 pr-6 rounded-xl appearance-none cursor-pointer focus:outline-none shadow-sm transition-all text-slate-700 bg-slate-100 hover:bg-slate-200 hover:shadow border-none ring-1 ring-inset ring-slate-200/50`}
                            >
                              <option value="">Unassigned</option>
                              {activeRoommates.map(rm => (
                                <option key={rm.id} value={rm.id}>{rm.name}</option>
                              ))}
                            </select>
                            <div className="absolute top-1/2 right-2 -translate-y-1/2 pointer-events-none opacity-40">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-700">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>

                          {/* Delete chore button */}
                          <button
                            onClick={() => deleteTodo(todo.id)}
                            className={`transition-all p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 ${theme.deleteBtn}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Chore form */}
              <div className={`p-3.5 border-t border-black/5 transition-colors duration-500 bg-black/[0.02]`}>
                <form onSubmit={addTodo} className="flex flex-col gap-2.5">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Add a chore"
                      value={newChoreTitle}
                      onChange={(e) => setNewChoreTitle(e.target.value)}
                      className={`flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 shadow-sm transition-all duration-500 ${theme.inputStyle}`}
                    />
                    <div className="flex gap-2">
                      <select
                        value={newChoreAssignee}
                        onChange={(e) => setNewChoreAssignee(e.target.value)}
                        className={`text-xs font-semibold px-3 py-2 border rounded-lg focus:outline-none transition-all duration-500 ${theme.inputStyle}`}
                      >
                        <option value="">Assign Later</option>
                        {activeRoommates.map(rm => (
                          <option key={rm.id} value={rm.id}>{rm.name}</option>
                        ))}
                      </select>
                      <button 
                        type="submit" 
                        className={`rounded-lg px-5 py-2 flex items-center justify-center font-semibold text-sm transition-colors shadow-sm ${theme.buttonStyle}`}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-1 select-none">
                    <input
                      id="isRecurring"
                      type="checkbox"
                      checked={isChoreRecurring}
                      onChange={(e) => setIsChoreRecurring(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-350 focus:ring-indigo-500/30 transition-all cursor-pointer"
                    />
                    <label htmlFor="isRecurring" className={`text-xs font-bold cursor-pointer transition-colors opacity-80 hover:opacity-100 ${theme.textMain}`}>
                      <span className="opacity-100">Recurring chore?</span>
                    </label>
                  </div>
                </form>
              </div>
            </div>
          </section>

          {/* COLUMN 2: SUPPLIES LIST */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className={theme.textMain} />
              <h2 className={`text-lg font-bold tracking-tight transition-colors duration-500 ${theme.textMain}`}>
                Supplies
              </h2>
            </div>
            <div className={`border rounded-2xl overflow-hidden shadow-sm transition-all duration-500 ${theme.cardBg}`}>
              <div className="divide-y divide-black/5">
                {supplies.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                    <p className={`text-sm font-medium ${theme.textMuted}`}>Your supplies list is empty.</p>
                  </div>
                ) : (
                  supplies.map(supply => (
                    <SupplyItem 
                      key={supply.id} 
                      supply={supply} 
                      roommates={roommates}
                      mySlotId={mySlotId}
                      onDelete={(id) => setSupplies(current => current.filter(s => s.id !== id))}
                      theme={theme}
                    />
                  ))
                )}
              </div>

              {/* Add Supply form */}
              <div className={`p-3.5 border-t border-black/5 transition-colors duration-500 bg-black/[0.02]`}>
                <form onSubmit={addSupply} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Add a supply"
                    value={newSupplyName}
                    onChange={(e) => setNewSupplyName(e.target.value)}
                    className={`flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 shadow-sm transition-all duration-500 ${theme.inputStyle}`}
                  />
                  <div className="flex gap-2">
                    <select
                      value={newSupplyAssignee}
                      onChange={(e) => setNewSupplyAssignee(e.target.value)}
                      className={`text-xs font-semibold px-3 py-2 border rounded-lg focus:outline-none transition-all duration-500 ${theme.inputStyle}`}
                    >
                      <option value="">Assign Later</option>
                      {activeRoommates.map(rm => (
                        <option key={rm.id} value={rm.id}>{rm.name}</option>
                      ))}
                    </select>
                    <button 
                      type="submit" 
                      className={`rounded-lg px-5 py-2 flex items-center justify-center font-semibold text-sm transition-colors shadow-sm ${theme.buttonStyle}`}
                    >
                      Add
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
