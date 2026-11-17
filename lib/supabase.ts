import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

/**
 *ตรวจสอบว่ามีการตั้งค่า Supabase จริงหรือยัง (ไม่ได้ใช้ค่าเริ่มต้นจากไฟล์ตัวอย่าง)
 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder-project') &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'your-supabase-anon-key'
);

/**
 * Supabase Client สำหรับฝั่ง Frontend (Browser) และ Realtime Subscription
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Supabase Admin Client สำหรับฝั่ง Backend API Routes (ใช้ Service Role Key เพื่อข้าม RLS เมื่อรับข้อมูลจาก ESP32)
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
