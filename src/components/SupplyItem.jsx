import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Minus, Plus, X, ShoppingBag } from 'lucide-react';

const guessUnitInfo = (name, quantity) => {
  const lowerName = name.toLowerCase();
  let baseUnit = '';
  let maxQty = 20; // Default sensible limit
  
  if (lowerName.match(/paper|roll|tp|t\.p\./)) { baseUnit = 'roll'; maxQty = 36; }
  else if (lowerName.match(/soap|spray|cleaner|bottle|detergent|shampoo|wash/)) { baseUnit = 'bottle'; maxQty = 12; }
  else if (lowerName.match(/bag|trash/)) { baseUnit = 'bag'; maxQty = 120; }
  else if (lowerName.match(/box|tissue/)) { baseUnit = 'box'; maxQty = 10; }
  else if (lowerName.match(/sponge/)) { baseUnit = 'sponge'; maxQty = 24; }
  else if (lowerName.match(/pod|tablet|tab/)) { baseUnit = 'pod'; maxQty = 120; }
  else if (lowerName.match(/pack/)) { baseUnit = 'pack'; maxQty = 50; }
  else if (lowerName.match(/can/)) { baseUnit = 'can'; maxQty = 48; }
  else if (lowerName.match(/tube|paste/)) { baseUnit = 'tube'; maxQty = 10; }
  
  let displayUnit = baseUnit;
  if (quantity !== 1 && baseUnit) {
    if (baseUnit === 'box') displayUnit = 'boxes';
    else displayUnit = baseUnit + 's';
  }
  
  return { displayUnit, maxQty };
};

export default function SupplyItem({ supply, roommates, mySlotId, onDelete, theme }) {
  const [isEditingQty, setIsEditingQty] = useState(false);
  const [inputValue, setInputValue] = useState(supply.quantity.toString());
  
  // States for logging a purchase
  const [showPurchaseLogger, setShowPurchaseLogger] = useState(false);
  const [buyQty, setBuyQty] = useState('1');
  const [buyPrice, setBuyPrice] = useState('');
  const [splitMoney, setSplitMoney] = useState(true);

  useEffect(() => {
    if (!isEditingQty) {
      setInputValue(supply.quantity.toString());
    }
  }, [supply.quantity, isEditingQty]);

  const { displayUnit, maxQty } = guessUnitInfo(supply.name, supply.quantity);

  const saveQuantity = async (qty) => {
    await supabase.from('supplies').update({ quantity: qty }).eq('id', supply.id);
  };

  const updateQuantity = async (delta) => {
    const newQty = Math.max(0, Math.min(maxQty, supply.quantity + delta));
    if (newQty === supply.quantity) return;
    await saveQuantity(newQty);
  };

  const handleInputSubmit = async () => {
    setIsEditingQty(false);
    let newQty = parseInt(inputValue, 10);
    if (isNaN(newQty)) newQty = supply.quantity;
    newQty = Math.max(0, Math.min(maxQty, newQty));
    setInputValue(newQty.toString());
    if (newQty !== supply.quantity) {
      await saveQuantity(newQty);
    }
  };

  const deleteSupply = async () => {
    if (onDelete) onDelete(supply.id);
    await supabase.from('supplies').delete().eq('id', supply.id);
  };

  // Re-assign supply buyer manually
  const reassignSupply = async (roommateId) => {
    await supabase.from('supplies').update({ assigned_to: roommateId || null }).eq('id', supply.id);
  };

  // Log a purchase! Triggers stock increase, buyer rotation, and logs details
  const handleLogPurchase = async (e) => {
    e.preventDefault();
    const parsedQty = parseInt(buyQty, 10) || 1;
    const parsedPrice = parseFloat(buyPrice) || 0;
    
    // Find current user's roommate name
    const myRoommate = roommates.find(r => r.id === mySlotId);
    const buyerName = myRoommate?.name || 'Someone';

    // Replenish stock
    const replenishedQty = Math.min(maxQty, supply.quantity + parsedQty);

    // Rotate assignee to next active roommate
    const activeRoommates = roommates.filter(r => r.name !== null);
    let nextAssigneeId = supply.assigned_to;
    
    if (activeRoommates.length > 0) {
      if (supply.assigned_to) {
        const currentIndex = activeRoommates.findIndex(r => r.id === supply.assigned_to);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % activeRoommates.length;
          nextAssigneeId = activeRoommates[nextIndex].id;
        } else {
          nextAssigneeId = activeRoommates[0].id;
        }
      } else {
        nextAssigneeId = activeRoommates[0].id;
      }
    }

    // Reset logger states
    setBuyQty('1');
    setBuyPrice('');
    setShowPurchaseLogger(false);

    // Save purchase details to Supabase
    await supabase
      .from('supplies')
      .update({
        quantity: replenishedQty,
        last_bought_by: buyerName,
        last_bought_qty: parsedQty,
        last_bought_price: parsedPrice,
        split_money: splitMoney,
        assigned_to: nextAssigneeId
      })
      .eq('id', supply.id);
  };

  // Calculate split amount
  const activeRoommates = roommates.filter(r => r.name !== null);
  const activeCount = activeRoommates.length || 1;
  const splitAmount = supply.last_bought_price && supply.split_money
    ? (supply.last_bought_price / activeCount).toFixed(2)
    : null;

  // Status pills
  let statusClass = 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-600/10';
  let statusText = 'ok';
  
  if (supply.quantity === 0) {
    statusClass = 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-600/10';
    statusText = 'out';
  } else if (supply.quantity <= 2) {
    statusClass = 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/10';
    statusText = 'low';
  }

  // Unit text guesser helper
  const purchaseUnit = guessUnitInfo(supply.name, supply.last_bought_qty || 1).displayUnit;

  return (
    <div className={`group flex flex-col p-3.5 transition-colors duration-500 ${theme.supplyRow}`}>
      
      {/* Primary Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-col w-full sm:flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className={`text-[14px] font-bold truncate ${theme.textMain}`}>{supply.name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md lowercase shrink-0 ${statusClass}`}>
              {statusText}
            </span>
          </div>

          {/* Last Purchase History Badge */}
          {supply.last_bought_by ? (
            <div className={`text-[11px] font-medium mt-1 transition-colors ${theme.textMuted} flex flex-wrap items-center gap-x-1.5 gap-y-0.5`}>
              <span>
                {supply.last_bought_by} bought {supply.last_bought_qty} {purchaseUnit}
                {supply.last_bought_price > 0 && <span className={`font-semibold opacity-90 ${theme.textMain}`}> — ${parseFloat(supply.last_bought_price).toFixed(2)}</span>}
              </span>
              {splitAmount && (
                <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] border border-current opacity-70 ${theme.textMain}`}>
                  ${splitAmount}/person
                </span>
              )}
            </div>
          ) : (
            <div className={`text-[10.5px] mt-0.5 ${theme.textMuted} opacity-50`}>
              No purchases logged yet
            </div>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3.5 sm:shrink-0 w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0">
          
          {/* Assigned Buyer Selection */}
          <div className="relative">
            <select
              value={supply.assigned_to || ''}
              onChange={(e) => reassignSupply(e.target.value)}
              className="w-[105px] text-left truncate text-[11px] font-extrabold py-1.5 pl-3 pr-6 rounded-xl appearance-none cursor-pointer focus:outline-none shadow-sm transition-all text-slate-700 bg-slate-100 hover:bg-slate-200 hover:shadow border-none ring-1 ring-inset ring-slate-200/50"
              title="Assigned buyer (will rotate on purchase)"
            >
              <option value="">No buyer</option>
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

          {/* Quantity Controls */}
          <div className={`flex items-center rounded-lg border shadow-sm transition-colors duration-500 ${theme.supplyControls}`}>
            <button 
              onClick={() => updateQuantity(-1)}
              disabled={supply.quantity === 0}
              className="p-1.5 rounded-l-lg disabled:opacity-30 transition-colors"
            >
              <Minus size={13} />
            </button>
            
            {isEditingQty ? (
              <div className="w-14 flex items-center justify-center h-[34px]">
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputValue}
                  autoFocus
                  onChange={(e) => setInputValue(e.target.value)}
                  onBlur={handleInputSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInputSubmit();
                    if (e.key === 'Escape') {
                      setIsEditingQty(false);
                      setInputValue(supply.quantity.toString());
                    }
                  }}
                  className={`w-10 text-center text-[13px] font-bold outline-none bg-black/10 rounded py-0.5 ${theme.textMain}`}
                />
              </div>
            ) : (
              <span 
                className="w-14 text-center text-[13px] font-bold tabular-nums flex flex-col justify-center leading-none py-1 cursor-text hover:bg-black/5 rounded transition-colors"
                onClick={() => setIsEditingQty(true)}
                title={`Click to edit. Max: ${maxQty}`}
              >
                <span className={theme.textMain}>{supply.quantity}</span>
                {displayUnit && <span className={`text-[9px] font-semibold mt-0.5 ${theme.textMuted}`}>{displayUnit}</span>}
              </span>
            )}

            <button 
              onClick={() => updateQuantity(1)}
              disabled={supply.quantity >= maxQty}
              className="p-1.5 rounded-r-lg disabled:opacity-30 transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Log Purchase Toggle Icon */}
          <button
            onClick={() => setShowPurchaseLogger(!showPurchaseLogger)}
            className={`p-1.5 rounded-lg shadow-sm transition-colors duration-200 border ${
              showPurchaseLogger 
                ? theme.buttonStyle
                : theme.supplyControls
            }`}
            title="I bought this!"
          >
            <ShoppingBag size={14} />
          </button>

          {/* Delete Icon */}
          <button 
            onClick={deleteSupply}
            className={`transition-all p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 ${theme.deleteBtn}`}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Slide-down Log Purchase Form Panel */}
      {showPurchaseLogger && (
        <form onSubmit={handleLogPurchase} className={`mt-3.5 p-3.5 rounded-xl border animate-fadeIn ${theme.supplyRow} shadow-inner`}>
          <div className={`text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1 ${theme.textMain}`}>
            <ShoppingBag size={12} />
            <span>Log Purchase & Rotate Buyer</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${theme.textMuted}`}>Quantity Bought</label>
              <input
                type="number"
                min="1"
                max={maxQty}
                value={buyQty}
                onChange={(e) => setBuyQty(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs rounded-lg focus:outline-none font-semibold transition-all ${theme.inputStyle}`}
                required
              />
            </div>
            
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${theme.textMuted}`}>Total Cost ($)</label>
              <div className="relative">
                <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold opacity-60 ${theme.textMain}`}>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 5.50"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  className={`w-full pl-6 pr-3 py-1.5 text-xs rounded-lg focus:outline-none font-semibold transition-all ${theme.inputStyle}`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={splitMoney}
                  onChange={(e) => setSplitMoney(e.target.checked)}
                  className="w-3.5 h-3.5 rounded cursor-pointer"
                />
                <span className={`text-[11px] font-bold ${theme.textMain}`}>Split money?</span>
              </label>
              <button 
                type="submit"
                className={`w-full font-bold py-1.5 px-3 rounded-lg text-xs transition-colors shadow-sm ${theme.buttonStyle}`}
              >
                Log & Rotate
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
