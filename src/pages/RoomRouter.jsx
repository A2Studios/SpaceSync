import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Join from './Join';
import Board from './Board';

export default function RoomRouter() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [house, setHouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mySlotId, setMySlotId] = useState(null);

  useEffect(() => {
    const fetchHouse = async () => {
      if (!supabase) {
        setError("Supabase not configured");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('houses')
        .select('*')
        .eq('code', code)
        .single();
      
      if (error || !data) {
        localStorage.removeItem('spacesync_last_room');
        navigate('/');
      } else {
        setHouse(data);
        const savedSlotId = localStorage.getItem(`spacesync_${code}`);
        if (savedSlotId) {
          setMySlotId(savedSlotId);
          localStorage.setItem('spacesync_last_room', code);
        }
      }
      setLoading(false);
    };
    fetchHouse();

    const channel = supabase.channel('house_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'houses', filter: `code=eq.${code}` }, payload => {
        setHouse(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  const handleJoin = (slotId) => {
    localStorage.setItem(`spacesync_${code}`, slotId);
    localStorage.setItem('spacesync_last_room', code);
    setMySlotId(slotId);
  };

  if (!mySlotId) {
    return <Join house={house} onJoin={handleJoin} />;
  }

  return <Board house={house} mySlotId={mySlotId} />;
}
