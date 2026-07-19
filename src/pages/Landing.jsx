import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Landing() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const lastRoom = localStorage.getItem('spacesync_last_room');
    if (lastRoom) {
      navigate(`/${lastRoom}`);
    }
  }, [navigate]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (code.trim()) {
      navigate(`/${code.trim().toLowerCase()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 relative overflow-hidden" 
         style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      
      {/* Decorative Glowing Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-35 animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200/50 shadow-xl shadow-slate-200/80 relative z-10 hover:shadow-2xl transition-all duration-500">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="text-3.5xl font-extrabold tracking-tight bg-gradient-to-r from-slate-800 via-indigo-900 to-slate-900 bg-clip-text text-transparent mt-2">
            SpaceSync
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium max-w-xs mx-auto">
            Syncing chores, supplies, and roommate life seamlessly.
          </p>
        </div>

        {/* Join Form */}
        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label htmlFor="code" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Room Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. maple-river-42"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 placeholder-slate-400 font-medium transition-all duration-300 bg-white/50"
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-slate-900 text-white font-semibold py-3 px-4 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 shadow-md shadow-slate-900/10 flex items-center justify-center gap-2 hover:shadow-lg"
          >
            <span>Join Room</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </form>

        {/* Create Board Callout */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
          <p className="font-medium">
            New to SpaceSync?{' '}
            <Link 
              to="/setup" 
              className="text-indigo-600 font-bold hover:text-indigo-500 transition-colors hover:underline"
            >
              Create a board
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
