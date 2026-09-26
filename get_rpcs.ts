import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function check() {
  const { data, error } = await supabase.rpc('mark_announcement_viewed', { p_task_id: '123e4567-e89b-12d3-a456-426614174000' });
  console.log('mark_viewed with p_task_id:', error);
  const { data: d2, error: e2 } = await supabase.rpc('mark_announcement_viewed', { task_id: '123e4567-e89b-12d3-a456-426614174000' });
  console.log('mark_viewed with task_id:', e2);
}
check();
