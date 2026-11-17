'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  Sprout,
  Thermometer,
  Droplets,
  FlaskConical,
  Zap,
  Waves,
  Sun,
  Power,
  BrainCircuit,
  Sliders,
  History,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Fan,
  Sparkles,
  Activity,
  Clock,
  Save,
  Radio,
  Cpu,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';

// ==============================================================================
// Types & Interfaces (ตรงกับ Schema ทั้ง 7 ตารางใน database.sql)
// ==============================================================================

interface Plant {
  plant_id: string;
  plant_name: string;
  planted_date: string;
  age_days: number;
}

interface PlantRecipe {
  recipe_id?: number;
  plant_id: string;
  temp_min: number;
  temp_max: number;
  humidity_min: number;
  humidity_max: number;
  ph_min: number;
  ph_max: number;
  ec_min: number;
  ec_max: number;
  mist_duration: number;
  mist_interval: number;
  light_hours_per_day: number;
}

interface SensorReading {
  reading_id?: number;
  plant_id: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  ph: number;
  ec: number;
  chamber_water_level: number;
  light_intensity: number;
}

interface DeviceLog {
  log_id?: number;
  timestamp: string;
  device_name: string;
  status: string;
  duration_seconds: number;
  chamber_id: string;
}

interface AIPrediction {
  prediction_id?: number;
  plant_id: string;
  timestamp: string;
  target_type: string;
  actual_value: number | null;
  predicted_value: number;
  error_value: number | null;
  model_version: string;
}

interface AlertItem {
  alert_id?: number;
  timestamp: string;
  alert_type: string;
  detected_value: number;
  threshold_value: number;
  status: string;
}

type ChamberKey = 'P001' | 'P002';
type TabKey = 'overview' | 'recipes' | 'ai' | 'logs';

// ==============================================================================
// ข้อมูลเริ่มต้น (Fallback / Initial Seed State)
// ==============================================================================

const CHAMBER_CONFIG: Record<
  ChamberKey,
  {
    plant_id: ChamberKey;
    chamber_id: 'CH01' | 'CH02';
    title: string;
    thaiName: string;
    scientificName: string;
    badgeColor: string;
    description: string;
    age_days: number;
  }
> = {
  P001: {
    plant_id: 'P001',
    chamber_id: 'CH01',
    title: 'Chamber 1: กะเพราแดง (Red Holy Basil)',
    thaiName: 'กะเพราแดง',
    scientificName: 'Ocimum tenuiflorum L. (Red)',
    badgeColor: 'from-emerald-500 to-teal-500',
    description: 'เน้นการสังเคราะห์สารสำคัญกลุ่ม Eugenol และมวลชีวภาพใบสดด้วยระบบฉีดพ่นหมอกละอองละเอียด',
    age_days: 25,
  },
  P002: {
    plant_id: 'P002',
    chamber_id: 'CH02',
    title: 'Chamber 2: ขมิ้นชัน (Turmeric)',
    thaiName: 'ขมิ้นชัน',
    scientificName: 'Curcuma longa L.',
    badgeColor: 'from-amber-500 to-emerald-500',
    description: 'เน้นการสะสมสาร Curcuminoids และการขยายขนาดเหง้า (Rhizome) ในสภาวะไร้วัสดุปลูก (Aeroponics)',
    age_days: 60,
  },
};

const INITIAL_RECIPES: Record<ChamberKey, PlantRecipe> = {
  P001: {
    recipe_id: 1,
    plant_id: 'P001',
    temp_min: 24.0,
    temp_max: 30.0,
    humidity_min: 65.0,
    humidity_max: 80.0,
    ph_min: 5.5,
    ph_max: 6.5,
    ec_min: 1.4,
    ec_max: 2.0,
    mist_duration: 15,
    mist_interval: 5,
    light_hours_per_day: 14.0,
  },
  P002: {
    recipe_id: 2,
    plant_id: 'P002',
    temp_min: 25.0,
    temp_max: 32.0,
    humidity_min: 75.0,
    humidity_max: 90.0,
    ph_min: 5.5,
    ph_max: 6.5,
    ec_min: 1.8,
    ec_max: 2.4,
    mist_duration: 20,
    mist_interval: 4,
    light_hours_per_day: 12.0,
  },
};

const INITIAL_READINGS: Record<ChamberKey, SensorReading> = {
  P001: {
    reading_id: 101,
    plant_id: 'P001',
    timestamp: new Date().toISOString(),
    temperature: 27.4,
    humidity: 72.5,
    ph: 6.02,
    ec: 1.72,
    chamber_water_level: 85.0,
    light_intensity: 16500,
  },
  P002: {
    reading_id: 102,
    plant_id: 'P002',
    timestamp: new Date().toISOString(),
    temperature: 28.3,
    humidity: 82.0,
    ph: 5.95,
    ec: 2.15,
    chamber_water_level: 80.5,
    light_intensity: 14200,
  },
};

const INITIAL_PREDICTIONS: AIPrediction[] = [
  {
    prediction_id: 1,
    plant_id: 'P001',
    timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    target_type: 'น้ำหนักสดใบกะเพราแดง (Fresh Weight g)',
    actual_value: 95.5,
    predicted_value: 97.2,
    error_value: 1.7,
    model_version: 'Random Forest v1.4',
  },
  {
    prediction_id: 2,
    plant_id: 'P001',
    timestamp: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    target_type: 'ความสูงลำต้น (Height cm)',
    actual_value: 29.4,
    predicted_value: 28.9,
    error_value: 0.5,
    model_version: 'Gradient Boosting v2.1',
  },
  {
    prediction_id: 3,
    plant_id: 'P001',
    timestamp: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
    target_type: 'จำนวนใบต่อต้น (Leaf Count)',
    actual_value: 68.0,
    predicted_value: 66.0,
    error_value: 2.0,
    model_version: 'Random Forest v1.4',
  },
  {
    prediction_id: 4,
    plant_id: 'P002',
    timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    target_type: 'น้ำหนักสดเหง้าขมิ้นชัน (Rhizome Weight g)',
    actual_value: 138.0,
    predicted_value: 141.5,
    error_value: 3.5,
    model_version: 'Gradient Boosting v2.1',
  },
  {
    prediction_id: 5,
    plant_id: 'P002',
    timestamp: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    target_type: 'ขนาดเส้นผ่านศูนย์กลางเหง้า (Rhizome Diameter mm)',
    actual_value: 28.6,
    predicted_value: 28.1,
    error_value: 0.5,
    model_version: 'Random Forest v1.4',
  },
  {
    prediction_id: 6,
    plant_id: 'P002',
    timestamp: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
    target_type: 'ความสูงลำต้นเหนือดิน (Height cm)',
    actual_value: 56.8,
    predicted_value: 55.4,
    error_value: 1.4,
    model_version: 'Gradient Boosting v2.1',
  },
];

const INITIAL_DEVICE_LOGS: DeviceLog[] = [
  {
    log_id: 1,
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    device_name: 'Mist Pump',
    status: 'ON',
    duration_seconds: 15,
    chamber_id: 'CH01',
  },
  {
    log_id: 2,
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    device_name: 'LED Grow Light',
    status: 'ON',
    duration_seconds: 3600,
    chamber_id: 'CH01',
  },
  {
    log_id: 3,
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    device_name: 'Exhaust Fan',
    status: 'OFF',
    duration_seconds: 0,
    chamber_id: 'CH01',
  },
  {
    log_id: 4,
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    device_name: 'Mist Pump',
    status: 'ON',
    duration_seconds: 20,
    chamber_id: 'CH02',
  },
  {
    log_id: 5,
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    device_name: 'Exhaust Fan',
    status: 'ON',
    duration_seconds: 300,
    chamber_id: 'CH02',
  },
];

const INITIAL_ALERTS: AlertItem[] = [
  {
    alert_id: 1,
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    alert_type: 'P002 (CH02): ความชื้นสัมพัทธ์ต่ำกว่าเกณฑ์ (Low Humidity)',
    detected_value: 71.5,
    threshold_value: 75.0,
    status: 'ACTIVE',
  },
  {
    alert_id: 2,
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    alert_type: 'P001 (CH01): อุณหภูมิสูงเกินเกณฑ์ (High Temperature)',
    detected_value: 31.2,
    threshold_value: 30.0,
    status: 'RESOLVED',
  },
];

export default function AeroponicDashboardPage() {
  // สถานะตู้ปลูกที่เลือก (P001 = กะเพราแดง / CH01, P002 = ขมิ้นชัน / CH02)
  const [selectedPlantId, setSelectedPlantId] = useState<ChamberKey>('P001');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // ข้อมูลจากฐานข้อมูล / State
  const [plants, setPlants] = useState<Record<ChamberKey, Plant>>({
    P001: {
      plant_id: 'P001',
      plant_name: 'กะเพราแดง (Red Holy Basil)',
      planted_date: '2026-10-23',
      age_days: 25,
    },
    P002: {
      plant_id: 'P002',
      plant_name: 'ขมิ้นชัน (Turmeric)',
      planted_date: '2026-09-18',
      age_days: 60,
    },
  });

  const [recipes, setRecipes] = useState<Record<ChamberKey, PlantRecipe>>(INITIAL_RECIPES);
  const [recipeForm, setRecipeForm] = useState<PlantRecipe>(INITIAL_RECIPES.P001);
  const [sensorReadings, setSensorReadings] =
    useState<Record<ChamberKey, SensorReading>>(INITIAL_READINGS);
  const [deviceLogs, setDeviceLogs] = useState<DeviceLog[]>(INITIAL_DEVICE_LOGS);
  const [aiPredictions, setAiPredictions] = useState<AIPrediction[]>(INITIAL_PREDICTIONS);
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);

  // สถานะแผงควบคุมอุปกรณ์ (Manual / Auto) แยกตามตู้ CH01 และ CH02
  const [controlMode, setControlMode] = useState<Record<'CH01' | 'CH02', 'AUTO' | 'MANUAL'>>({
    CH01: 'AUTO',
    CH02: 'AUTO',
  });

  const [deviceStates, setDeviceStates] = useState<
    Record<'CH01' | 'CH02', { 'Mist Pump': boolean; 'Exhaust Fan': boolean; 'LED Grow Light': boolean }>
  >({
    CH01: {
      'Mist Pump': true,
      'Exhaust Fan': false,
      'LED Grow Light': true,
    },
    CH02: {
      'Mist Pump': true,
      'Exhaust Fan': true,
      'LED Grow Light': true,
    },
  });

  // สถานะ UI / Loading / Notification
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState<boolean>(false);
  const [isSimulatingEsp32, setIsSimulatingEsp32] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info' | 'warning';
    message: string;
  } | null>(null);

  const currentChamber = CHAMBER_CONFIG[selectedPlantId];
  const currentChamberId = currentChamber.chamber_id;
  const currentReading = sensorReadings[selectedPlantId];
  const currentRecipe = recipes[selectedPlantId];

  // ซิงค์ฟอร์มแก้ไขสูตรการปลูกเมื่อสลับตู้
  useEffect(() => {
    setRecipeForm(recipes[selectedPlantId]);
  }, [selectedPlantId, recipes]);

  // ฟังก์ชันดึงข้อมูลเริ่มต้นจาก Supabase
  const fetchDashboardData = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);

    try {
      // 1. ดึงข้อมูล plants
      const { data: plantsData } = await supabase.from('plants').select('*');
      if (plantsData && plantsData.length > 0) {
        const plantMap = { ...plants };
        plantsData.forEach((p: Plant) => {
          if (p.plant_id === 'P001' || p.plant_id === 'P002') {
            plantMap[p.plant_id] = p;
          }
        });
        setPlants(plantMap);
      }

      // 2. ดึงข้อมูล plant_recipes ล่าสุดของแต่ละพืช
      const { data: recipesData } = await supabase
        .from('plant_recipes')
        .select('*')
        .order('recipe_id', { ascending: false });

      if (recipesData && recipesData.length > 0) {
        const updatedRecipes = { ...INITIAL_RECIPES };
        const p001Recipe = recipesData.find((r: PlantRecipe) => r.plant_id === 'P001');
        const p002Recipe = recipesData.find((r: PlantRecipe) => r.plant_id === 'P002');
        if (p001Recipe) updatedRecipes.P001 = p001Recipe;
        if (p002Recipe) updatedRecipes.P002 = p002Recipe;
        setRecipes(updatedRecipes);
      }

      // 3. ดึงข้อมูล sensor_readings ล่าสุดของ P001 และ P002
      for (const pid of ['P001', 'P002'] as ChamberKey[]) {
        const { data: latestSensor } = await supabase
          .from('sensor_readings')
          .select('*')
          .eq('plant_id', pid)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestSensor) {
          setSensorReadings((prev) => ({
            ...prev,
            [pid]: latestSensor as SensorReading,
          }));
        }
      }

      // 4. ดึงข้อมูล device_logs ล่าสุด
      const { data: logsData } = await supabase
        .from('device_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(30);

      if (logsData && logsData.length > 0) {
        setDeviceLogs(logsData as DeviceLog[]);
      }

      // 5. ดึงข้อมูล ai_predictions ล่าสุด
      const { data: aiData } = await supabase
        .from('ai_predictions')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (aiData && aiData.length > 0) {
        setAiPredictions(aiData as AIPrediction[]);
      }

      // 6. ดึงข้อมูล alerts ล่าสุด
      const { data: alertsData } = await supabase
        .from('alerts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(30);

      if (alertsData && alertsData.length > 0) {
        setAlerts(alertsData as AlertItem[]);
      }
    } catch (error) {
      console.error('Error loading Supabase data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // เชื่อมต่อ Supabase Realtime Subscription
  useEffect(() => {
    fetchDashboardData();

    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('aeroponic-realtime-dashboard')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
        (payload) => {
          const newReading = payload.new as SensorReading;
          if (newReading.plant_id === 'P001' || newReading.plant_id === 'P002') {
            setSensorReadings((prev) => ({
              ...prev,
              [newReading.plant_id as ChamberKey]: newReading,
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'device_logs' },
        (payload) => {
          const newLog = payload.new as DeviceLog;
          setDeviceLogs((prev) => [newLog, ...prev.slice(0, 29)]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          const newAlert = payload.new as AlertItem;
          setAlerts((prev) => [newAlert, ...prev.slice(0, 29)]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plant_recipes' },
        (payload) => {
          const updated = payload.new as PlantRecipe;
          if (updated && (updated.plant_id === 'P001' || updated.plant_id === 'P002')) {
            setRecipes((prev) => ({
              ...prev,
              [updated.plant_id as ChamberKey]: updated,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  // ฟังก์ชันสั่งเปิด-ปิดอุปกรณ์แล้วบันทึกลงตาราง device_logs ทันที
  const handleToggleDevice = async (
    deviceName: 'Mist Pump' | 'Exhaust Fan' | 'LED Grow Light'
  ) => {
    const currentStatus = deviceStates[currentChamberId][deviceName];
    const nextStatusBoolean = !currentStatus;
    const nextStatusText = nextStatusBoolean ? 'ON' : 'OFF';

    // อัปเดต UI ทันที
    setDeviceStates((prev) => ({
      ...prev,
      [currentChamberId]: {
        ...prev[currentChamberId],
        [deviceName]: nextStatusBoolean,
      },
    }));

    const durationSeconds =
      deviceName === 'Mist Pump' && nextStatusBoolean
        ? currentRecipe.mist_duration
        : deviceName === 'LED Grow Light' && nextStatusBoolean
        ? 3600
        : nextStatusBoolean
        ? 300
        : 0;

    const newLogEntry: DeviceLog = {
      log_id: Date.now(),
      timestamp: new Date().toISOString(),
      device_name: deviceName,
      status: nextStatusText,
      duration_seconds: durationSeconds,
      chamber_id: currentChamberId,
    };

    // เพิ่มใน state ทันทีเพื่อให้ผู้ใช้งานเห็นผลแบบ Real-time
    setDeviceLogs((prev) => [newLogEntry, ...prev]);

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('device_logs').insert([
        {
          device_name: deviceName,
          status: nextStatusText,
          duration_seconds: durationSeconds,
          chamber_id: currentChamberId,
        },
      ]);

      if (error) {
        setStatusBanner({
          type: 'warning',
          message: `อัปเดตสถานะ ${deviceName} (${nextStatusText}) ในหน้าจอแล้ว แต่บันทึกฐานข้อมูลไม่สำเร็จ: ${error.message}`,
        });
        return;
      }
    }

    setStatusBanner({
      type: 'success',
      message: `สั่งงานอุปกรณ์ ${deviceName} [${currentChamberId}] สถานะ ${nextStatusText} และบันทึกลงตาราง device_logs เรียบร้อยแล้ว`,
    });
  };

  // ฟังก์ชันสลับโหมด AUTO / MANUAL และบันทึกลง device_logs
  const handleModeSwitch = async (mode: 'AUTO' | 'MANUAL') => {
    setControlMode((prev) => ({
      ...prev,
      [currentChamberId]: mode,
    }));

    const modeLog: DeviceLog = {
      log_id: Date.now(),
      timestamp: new Date().toISOString(),
      device_name: `System Mode (${mode})`,
      status: mode,
      duration_seconds: 0,
      chamber_id: currentChamberId,
    };

    setDeviceLogs((prev) => [modeLog, ...prev]);

    if (isSupabaseConfigured) {
      await supabase.from('device_logs').insert([
        {
          device_name: `System Mode (${mode})`,
          status: mode,
          duration_seconds: 0,
          chamber_id: currentChamberId,
        },
      ]);
    }

    setStatusBanner({
      type: 'info',
      message: `เปลี่ยนโหมดการควบคุมตู้ ${currentChamberId} เป็น ${mode} เรียบร้อยแล้ว`,
    });
  };

  // ฟังก์ชันบันทึกสูตรการปลูกลงตาราง plant_recipes
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRecipe(true);

    const updatedRecipe: PlantRecipe = {
      ...recipeForm,
      plant_id: selectedPlantId,
      temp_min: Number(recipeForm.temp_min),
      temp_max: Number(recipeForm.temp_max),
      humidity_min: Number(recipeForm.humidity_min),
      humidity_max: Number(recipeForm.humidity_max),
      ph_min: Number(recipeForm.ph_min),
      ph_max: Number(recipeForm.ph_max),
      ec_min: Number(recipeForm.ec_min),
      ec_max: Number(recipeForm.ec_max),
      mist_duration: Number(recipeForm.mist_duration),
      mist_interval: Number(recipeForm.mist_interval),
      light_hours_per_day: Number(recipeForm.light_hours_per_day),
    };

    try {
      setRecipes((prev) => ({
        ...prev,
        [selectedPlantId]: updatedRecipe,
      }));

      if (isSupabaseConfigured) {
        if (updatedRecipe.recipe_id) {
          const { error } = await supabase
            .from('plant_recipes')
            .update({
              temp_min: updatedRecipe.temp_min,
              temp_max: updatedRecipe.temp_max,
              humidity_min: updatedRecipe.humidity_min,
              humidity_max: updatedRecipe.humidity_max,
              ph_min: updatedRecipe.ph_min,
              ph_max: updatedRecipe.ph_max,
              ec_min: updatedRecipe.ec_min,
              ec_max: updatedRecipe.ec_max,
              mist_duration: updatedRecipe.mist_duration,
              mist_interval: updatedRecipe.mist_interval,
              light_hours_per_day: updatedRecipe.light_hours_per_day,
            })
            .eq('recipe_id', updatedRecipe.recipe_id);

          if (error) throw error;
        } else {
          const { error } = await supabase.from('plant_recipes').insert([updatedRecipe]);
          if (error) throw error;
        }
      }

      setStatusBanner({
        type: 'success',
        message: `บันทึกสูตรการปลูกของ ${currentChamber.thaiName} (${selectedPlantId}) ลงตาราง plant_recipes สำเร็จ! บอร์ด ESP32 สามารถดึงค่าใหม่ผ่าน GET /api/telemetry?plant_id=${selectedPlantId}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      setStatusBanner({
        type: 'warning',
        message: `อัปเดตสูตรในระบบแล้ว (สถานะฐานข้อมูล: ${msg})`,
      });
    } finally {
      setIsSavingRecipe(false);
    }
  };

  // ฟังก์ชันทดสอบส่งข้อมูลจำลองจากบอร์ด ESP32 ไปยัง POST /api/telemetry
  const handleSimulateEsp32Telemetry = async () => {
    setIsSimulatingEsp32(true);
    try {
      const jitter = (range: number) => Number(((Math.random() - 0.5) * range).toFixed(2));
      const payload = {
        chamber_id: currentChamberId,
        plant_id: selectedPlantId,
        temperature: Number((currentReading.temperature + jitter(1.6)).toFixed(2)),
        humidity: Number((currentReading.humidity + jitter(3.0)).toFixed(2)),
        ph: Number((currentReading.ph + jitter(0.25)).toFixed(2)),
        ec: Number((currentReading.ec + jitter(0.2)).toFixed(2)),
        chamber_water_level: Number(
          Math.max(20, Math.min(100, currentReading.chamber_water_level + jitter(2.0))).toFixed(1)
        ),
        light_intensity: Math.round(currentReading.light_intensity + jitter(600)),
        mist_pump: deviceStates[currentChamberId]['Mist Pump'] ? 'ON' : 'OFF',
        fan: deviceStates[currentChamberId]['Exhaust Fan'] ? 'ON' : 'OFF',
        grow_light: deviceStates[currentChamberId]['LED Grow Light'] ? 'ON' : 'OFF',
      };

      const res = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        setSensorReadings((prev) => ({
          ...prev,
          [selectedPlantId]: result.reading,
        }));
        if (result.alerts && result.alerts.length > 0) {
          const newAlerts: AlertItem[] = result.alerts.map(
            (a: Omit<AlertItem, 'alert_id' | 'timestamp'>, idx: number) => ({
              ...a,
              alert_id: Date.now() + idx,
              timestamp: new Date().toISOString(),
            })
          );
          setAlerts((prev) => [...newAlerts, ...prev]);
        }
        setStatusBanner({
          type: 'success',
          message: `จำลองการส่งค่า Telemetry จากบอร์ด ESP32 (${currentChamberId}) สำเร็จ! (แจ้งเตือนใหม่: ${result.alerts_triggered} รายการ)`,
        });
      }
    } catch (error) {
      console.error('Failed to simulate ESP32 telemetry:', error);
    } finally {
      setIsSimulatingEsp32(false);
    }
  };

  // วิเคราะห์สถานะของค่าเซนเซอร์เทียบกับเกณฑ์ plant_recipes
  const checkSensorStatus = (value: number, min: number, max: number) => {
    if (value < min) return { status: 'LOW', label: 'ต่ำกว่าเกณฑ์', color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' };
    if (value > max) return { status: 'HIGH', label: 'สูงเกินเกณฑ์', color: 'text-rose-400 border-rose-500/40 bg-rose-500/10' };
    return { status: 'OPTIMAL', label: 'ปกติ (เหมาะสม)', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' };
  };

  // สร้างคำแนะนำอัจฉริยะจากโมเดล AI (Random Forest & Gradient Boosting) ตามค่าเซนเซอร์ปัจจุบัน
  const getAIRecommendations = () => {
    const recs: Array<{ model: string; title: string; detail: string; badge: string }> = [];

    if (selectedPlantId === 'P001') {
      // กะเพราแดง
      if (currentReading.temperature > currentRecipe.temp_max) {
        recs.push({
          model: 'Random Forest Classifier v1.4',
          title: 'ลดความเครียดจากความร้อนในรากอากาศกะเพราแดง',
          detail: `อุณหภูมิปัจจุบัน (${currentReading.temperature} °C) สูงกว่าค่าเหมาะสม (${currentRecipe.temp_max} °C) แนะนำให้เปิดพัดลมระบายอากาศ (Exhaust Fan) และลดระยะห่างการพ่นหมอก (Mist Interval) เหลือ ${Math.max(2, currentRecipe.mist_interval - 1)} นาที`,
          badge: 'Action Needed',
        });
      } else {
        recs.push({
          model: 'Random Forest Regressor v1.4',
          title: 'สภาวะการสังเคราะห์น้ำมันหอมระเหย (Eugenol) อยู่ในเกณฑ์ดีเยี่ยม',
          detail: `ค่า EC ${currentReading.ec} mS/cm และ pH ${currentReading.ph} ส่งเสริมการแตกยอดอ่อนของกะเพราแดง คาดการณ์ผลผลิตน้ำหนักสดรอบตัดถัดไปอยู่ที่ 97.2 กรัม/ต้น (ความแม่นยำ 98.2%)`,
          badge: 'Optimal Yield',
        });
      }

      recs.push({
        model: 'Gradient Boosting v2.1',
        title: 'การจัดการแสง LED Grow Light สำหรับกะเพราแดง',
        detail: `ความเข้มแสงปัจจุบัน ${currentReading.light_intensity.toLocaleString()} Lux ร่วมกับชั่วโมงรับแสง ${currentRecipe.light_hours_per_day} ชม./วัน ช่วยกระตุ้นสีม่วงแดงของใบและเพิ่มความหนาแน่นของต่อมน้ำมันหอมระเหย`,
        badge: 'Photoperiod Insight',
      });
    } else {
      // ขมิ้นชัน
      if (currentReading.humidity < currentRecipe.humidity_min) {
        recs.push({
          model: 'Random Forest Classifier v1.4',
          title: 'เพิ่มความชื้นสัมพัทธ์ในโซนเหง้าขมิ้นชัน (Rhizome Zone)',
          detail: `ความชื้นปัจจุบัน (${currentReading.humidity}%) ต่ำกว่าเกณฑ์ขั้นต่ำ (${currentRecipe.humidity_min}%) แนะนำให้เพิ่มเวลาพ่นหมอก (Mist Duration) จาก ${currentRecipe.mist_duration} วินาที เป็น ${currentRecipe.mist_duration + 5} วินาที เพื่อป้องกันรากฝอยแห้ง`,
          badge: 'Humidity Tuning',
        });
      } else {
        recs.push({
          model: 'Gradient Boosting Regressor v2.1',
          title: 'อัตราการขยายขนาดเหง้าขมิ้นชัน (Rhizome Bulking) มีแนวโน้มสูง',
          detail: `ระดับสารอาหาร EC ${currentReading.ec} mS/cm และความชื้น ${currentReading.humidity}% เหมาะสมต่อการสะสมสาร Curcuminoids คาดการณ์น้ำหนักเหง้าสด 141.5 กรัม/กอ และเส้นผ่านศูนย์กลางเหง้า 28.1 มม.`,
          badge: 'High Curcuminoid Potential',
        });
      }

      recs.push({
        model: 'Random Forest v1.4',
        title: 'เสถียรภาพของค่าความเป็นกรด-ด่าง (pH Buffer)',
        detail: `ค่า pH ${currentReading.ph} อยู่ในช่วงดูดซึมฟอสฟอรัสและโพแทสเซียมสูงสุด ช่วยเร่งการสะสมแป้งและสารสำคัญในแง่งขมิ้นชันระยะอายุ ${plants.P002.age_days} วัน`,
        badge: 'Nutrient Uptake',
      });
    }

    return recs;
  };

  const filteredPredictions = aiPredictions.filter((item) => item.plant_id === selectedPlantId);
  const filteredDeviceLogs = deviceLogs.filter((log) => log.chamber_id === currentChamberId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Glow Background */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-gradient-to-b from-emerald-950/30 via-slate-950/10 to-transparent" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20">
                <Sprout className="h-7 w-7 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                    <Radio className="h-3 w-3 animate-pulse" />
                    Smart Aeroponic IoT & AI System
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-xs text-slate-400">
                    <Cpu className="h-3 w-3 text-emerald-400" />
                    ESP32 Telemetry Ready
                  </span>
                </div>
                <h1 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl">
                  Smart Aeroponic Cultivation Tank for Herbs and Spices
                </h1>
                <p className="text-xs text-slate-400 sm:text-sm">
                  กรณีศึกษา: กะเพราแดง (Red Holy Basil - P001) และ ขมิ้นชัน (Turmeric - P002)
                </p>
              </div>
            </div>

            {/* Action Buttons & Chamber Switcher */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSimulateEsp32Telemetry}
                disabled={isSimulatingEsp32}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSimulatingEsp32 ? 'animate-spin' : ''}`} />
                จำลองส่งค่า ESP32 ({currentChamberId})
              </button>

              {/* สลับตู้ปลูกด้านบนระหว่าง Chamber 1 (P001 / CH01) และ Chamber 2 (P002 / CH02) */}
              <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-900/90 p-1">
                {(['P001', 'P002'] as ChamberKey[]).map((pid) => {
                  const cfg = CHAMBER_CONFIG[pid];
                  const isSelected = selectedPlantId === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setSelectedPlantId(pid)}
                      className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition sm:text-sm ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isSelected ? 'bg-slate-950' : 'bg-emerald-400'
                        }`}
                      />
                      <span>
                        {cfg.chamber_id}: {cfg.thaiName} ({pid})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Status Notification Banner */}
        {statusBanner && (
          <div
            className={`mb-6 flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm ${
              statusBanner.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : statusBanner.type === 'warning'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-sky-500/40 bg-sky-500/10 text-sky-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{statusBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-xs underline opacity-75 hover:opacity-100"
            >
              ปิดข้อความ
            </button>
          </div>
        )}

        {/* Active Chamber Info Card */}
        <section className="mb-6 rounded-3xl border border-slate-800/90 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-emerald-950/30 p-5 shadow-xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
                  {currentChamber.chamber_id} • {currentChamber.plant_id}
                </span>
                <h2 className="text-xl font-bold text-white sm:text-2xl">
                  {currentChamber.title}
                </h2>
                <span className="text-xs italic text-slate-400">
                  ({currentChamber.scientificName})
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-300">{currentChamber.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2.5">
                <span className="block text-slate-400 text-xs">อายุพืชปัจจุบัน</span>
                <span className="font-bold text-emerald-400 text-base">
                  {plants[selectedPlantId]?.age_days ?? currentChamber.age_days} วัน
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2.5">
                <span className="block text-slate-400 text-xs">รอบพ่นหมอก (Mist)</span>
                <span className="font-bold text-white text-base">
                  {currentRecipe.mist_duration} วินาที / ทุก {currentRecipe.mist_interval} นาที
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2.5">
                <span className="block text-slate-400 text-xs">อัปเดตล่าสุด</span>
                <span className="font-medium text-slate-200">
                  {new Date(currentReading.timestamp).toLocaleTimeString('th-TH')}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation Tabs (4 แท็บหลัก) */}
        <nav className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-1.5 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-medium transition sm:text-sm ${
              activeTab === 'overview'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>1. ภาพรวมและควบคุม</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recipes')}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-medium transition sm:text-sm ${
              activeTab === 'recipes'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>2. สูตรการปลูก (Recipes)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-medium transition sm:text-sm ${
              activeTab === 'ai'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <BrainCircuit className="h-4 w-4" />
            <span>3. คาดการณ์ผลผลิต AI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-medium transition sm:text-sm ${
              activeTab === 'logs'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <History className="h-4 w-4" />
            <span>4. ประวัติและแจ้งเตือน</span>
            {alerts.filter((a) => a.status === 'ACTIVE').length > 0 && (
              <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {alerts.filter((a) => a.status === 'ACTIVE').length}
              </span>
            )}
          </button>
        </nav>

        {/* ====================================================================
            แท็บ 1: ภาพรวมและควบคุม (Overview & Control)
        ==================================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* การ์ดค่าเซนเซอร์ 6 ค่าแบบ Real-time */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Activity className="h-5 w-5 text-emerald-400" />
                  ค่าเซนเซอร์สภาพแวดล้อมแบบ Real-time ({currentChamber.thaiName})
                </h3>
                <span className="text-xs text-slate-400">
                  เชื่อมโยงตาราง <code className="text-emerald-400">sensor_readings</code> &{' '}
                  <code className="text-emerald-400">plant_recipes</code>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* 1. อุณหภูมิ (Temperature) */}
                {(() => {
                  const st = checkSensorStatus(
                    currentReading.temperature,
                    currentRecipe.temp_min,
                    currentRecipe.temp_max
                  );
                  return (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 shadow-lg transition hover:border-emerald-500/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                            <Thermometer className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">อุณหภูมิภายในถังปลูก</p>
                            <h4 className="text-sm font-semibold text-slate-200">Temperature</h4>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-4 flex items-baseline justify-between">
                        <p className="text-3xl font-bold text-white">
                          {currentReading.temperature.toFixed(1)}{' '}
                          <span className="text-base font-normal text-slate-400">°C</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          เกณฑ์: {currentRecipe.temp_min} - {currentRecipe.temp_max} °C
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. ความชื้นสัมพัทธ์ (Humidity) */}
                {(() => {
                  const st = checkSensorStatus(
                    currentReading.humidity,
                    currentRecipe.humidity_min,
                    currentRecipe.humidity_max
                  );
                  return (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 shadow-lg transition hover:border-emerald-500/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                            <Droplets className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">ความชื้นสัมพัทธ์โซนราก</p>
                            <h4 className="text-sm font-semibold text-slate-200">Relative Humidity</h4>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-4 flex items-baseline justify-between">
                        <p className="text-3xl font-bold text-white">
                          {currentReading.humidity.toFixed(1)}{' '}
                          <span className="text-base font-normal text-slate-400">%RH</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          เกณฑ์: {currentRecipe.humidity_min} - {currentRecipe.humidity_max} %
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. ค่าความเป็นกรด-ด่าง (pH) */}
                {(() => {
                  const st = checkSensorStatus(
                    currentReading.ph,
                    currentRecipe.ph_min,
                    currentRecipe.ph_max
                  );
                  return (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 shadow-lg transition hover:border-emerald-500/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                            <FlaskConical className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">ความเป็นกรด-ด่างสารละลาย</p>
                            <h4 className="text-sm font-semibold text-slate-200">pH Level</h4>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-4 flex items-baseline justify-between">
                        <p className="text-3xl font-bold text-white">
                          {currentReading.ph.toFixed(2)}{' '}
                          <span className="text-base font-normal text-slate-400">pH</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          เกณฑ์: {currentRecipe.ph_min} - {currentRecipe.ph_max}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. ค่าการนำไฟฟ้า / ความเข้มข้นปุ๋ย (EC) */}
                {(() => {
                  const st = checkSensorStatus(
                    currentReading.ec,
                    currentRecipe.ec_min,
                    currentRecipe.ec_max
                  );
                  return (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 shadow-lg transition hover:border-emerald-500/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                            <Zap className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">ความเข้มข้นธาตุอาหาร</p>
                            <h4 className="text-sm font-semibold text-slate-200">EC Conductivity</h4>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-4 flex items-baseline justify-between">
                        <p className="text-3xl font-bold text-white">
                          {currentReading.ec.toFixed(2)}{' '}
                          <span className="text-base font-normal text-slate-400">mS/cm</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          เกณฑ์: {currentRecipe.ec_min} - {currentRecipe.ec_max} mS/cm
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* 5. ระดับน้ำในถังพักสารละลาย (Chamber Water Level) */}
                {(() => {
                  const st = checkSensorStatus(currentReading.chamber_water_level, 25, 100);
                  return (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 shadow-lg transition hover:border-emerald-500/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                            <Waves className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">ระดับน้ำสารละลายในถัง</p>
                            <h4 className="text-sm font-semibold text-slate-200">Water Level</h4>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-4 flex items-baseline justify-between">
                        <p className="text-3xl font-bold text-white">
                          {currentReading.chamber_water_level.toFixed(1)}{' '}
                          <span className="text-base font-normal text-slate-400">%</span>
                        </p>
                        <p className="text-xs text-slate-400">เกณฑ์ปลอดภัย: &ge; 25%</p>
                      </div>
                    </div>
                  );
                })()}

                {/* 6. ความเข้มแสง (Light Intensity) */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 shadow-lg transition hover:border-emerald-500/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-500/15 text-yellow-400">
                        <Sun className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">ความเข้มแสงปลูกพืช</p>
                        <h4 className="text-sm font-semibold text-slate-200">Light Intensity</h4>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                      {currentRecipe.light_hours_per_day} ชม./วัน
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <p className="text-3xl font-bold text-white">
                      {currentReading.light_intensity.toLocaleString()}{' '}
                      <span className="text-base font-normal text-slate-400">Lux</span>
                    </p>
                    <p className="text-xs text-slate-400">PAR Spectrum LED</p>
                  </div>
                </div>
              </div>
            </div>

            {/* แผงควบคุมอุปกรณ์ Manual/Auto และ กล่องคำแนะนำจากโมเดล AI */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* แผงควบคุมอุปกรณ์ (7 คอลัมน์) */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl lg:col-span-7">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                      <Power className="h-5 w-5 text-emerald-400" />
                      แผงควบคุมอุปกรณ์ ({currentChamberId}: {currentChamber.thaiName})
                    </h3>
                    <p className="text-xs text-slate-400">
                      กดสั่งเปิด-ปิดและบันทึกสถานะลงตาราง <code className="text-emerald-400">device_logs</code> ทันที
                    </p>
                  </div>

                  {/* สวิตช์โหมด AUTO / MANUAL */}
                  <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950 p-1">
                    {(['AUTO', 'MANUAL'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleModeSwitch(m)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          controlMode[currentChamberId] === m
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {m === 'AUTO' ? 'อัตโนมัติ (AUTO)' : 'ควบคุมเอง (MANUAL)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* อุปกรณ์ที่ 1: Mist Pump */}
                  {(() => {
                    const isOn = deviceStates[currentChamberId]['Mist Pump'];
                    return (
                      <div
                        className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                          isOn
                            ? 'border-emerald-500/50 bg-emerald-950/25'
                            : 'border-slate-800 bg-slate-950/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                isOn ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              <Droplets className="h-5 w-5" />
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                isOn
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {isOn ? 'ON (กำลังทำงาน)' : 'OFF (ปิด)'}
                            </span>
                          </div>
                          <h4 className="mt-3 font-semibold text-white">Mist Pump</h4>
                          <p className="mt-1 text-xs text-slate-400">
                            ปั๊มพ่นหมอกแรงดันสูง ({currentRecipe.mist_duration}s / ทุก {currentRecipe.mist_interval}m)
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleDevice('Mist Pump')}
                          className={`mt-4 w-full rounded-xl py-2.5 text-xs font-semibold transition ${
                            isOn
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          }`}
                        >
                          {isOn ? 'สั่งหยุดพ่นหมอก (Turn OFF)' : 'สั่งพ่นหมอกทันที (Turn ON)'}
                        </button>
                      </div>
                    );
                  })()}

                  {/* อุปกรณ์ที่ 2: Exhaust Fan */}
                  {(() => {
                    const isOn = deviceStates[currentChamberId]['Exhaust Fan'];
                    return (
                      <div
                        className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                          isOn
                            ? 'border-emerald-500/50 bg-emerald-950/25'
                            : 'border-slate-800 bg-slate-950/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                isOn ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              <Fan className={`h-5 w-5 ${isOn ? 'animate-spin' : ''}`} />
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                isOn
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {isOn ? 'ON (กำลังทำงาน)' : 'OFF (ปิด)'}
                            </span>
                          </div>
                          <h4 className="mt-3 font-semibold text-white">Exhaust Fan</h4>
                          <p className="mt-1 text-xs text-slate-400">
                            พัดลมระบายความร้อนและหมุนเวียนอากาศ
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleDevice('Exhaust Fan')}
                          className={`mt-4 w-full rounded-xl py-2.5 text-xs font-semibold transition ${
                            isOn
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          }`}
                        >
                          {isOn ? 'สั่งปิดพัดลม (Turn OFF)' : 'สั่งเปิดพัดลม (Turn ON)'}
                        </button>
                      </div>
                    );
                  })()}

                  {/* อุปกรณ์ที่ 3: LED Grow Light */}
                  {(() => {
                    const isOn = deviceStates[currentChamberId]['LED Grow Light'];
                    return (
                      <div
                        className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                          isOn
                            ? 'border-emerald-500/50 bg-emerald-950/25'
                            : 'border-slate-800 bg-slate-950/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                isOn ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              <Sun className="h-5 w-5" />
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                isOn
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {isOn ? 'ON (กำลังทำงาน)' : 'OFF (ปิด)'}
                            </span>
                          </div>
                          <h4 className="mt-3 font-semibold text-white">LED Grow Light</h4>
                          <p className="mt-1 text-xs text-slate-400">
                            ไฟปลูกพืช Full Spectrum ({currentRecipe.light_hours_per_day} ชม./วัน)
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleDevice('LED Grow Light')}
                          className={`mt-4 w-full rounded-xl py-2.5 text-xs font-semibold transition ${
                            isOn
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          }`}
                        >
                          {isOn ? 'สั่งปิดไฟปลูกพืช (Turn OFF)' : 'สั่งเปิดไฟปลูกพืช (Turn ON)'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* กล่องแสดงคำแนะนำจากโมเดล AI (Random Forest / Gradient Boosting) (5 คอลัมน์) */}
              <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-6 shadow-xl lg:col-span-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        คำแนะนำอัจฉริยะจากโมเดล AI
                      </h3>
                      <p className="text-xs text-emerald-400">
                        Random Forest & Gradient Boosting Decision Support
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3.5">
                  {getAIRecommendations().map((rec, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-emerald-400">
                          {rec.model}
                        </span>
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
                          {rec.badge}
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-sm font-bold text-white">{rec.title}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">{rec.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            แท็บ 2: สูตรการปลูก (Plant Recipes Configuration)
        ==================================================================== */}
        {activeTab === 'recipes' && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  <Sliders className="h-5 w-5 text-emerald-400" />
                  ตั้งค่าสูตรการปลูกและเกณฑ์มาตรฐาน ({currentChamber.title})
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  บันทึกข้อมูลลงตาราง <code className="text-emerald-400">plant_recipes</code> สำหรับใช้ตรวจสอบแจ้งเตือนและส่งค่าให้บอร์ด ESP32 ผ่าน{' '}
                  <code className="text-emerald-400">GET /api/telemetry?plant_id={selectedPlantId}</code>
                </p>
              </div>
              <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                Plant ID: {selectedPlantId} ({currentChamberId})
              </span>
            </div>

            <form onSubmit={handleSaveRecipe} className="mt-6 space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {/* อุณหภูมิต่ำสุด - สูงสุด */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="block text-xs font-medium text-slate-400">
                    อุณหภูมิต่ำสุด (temp_min °C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={recipeForm.temp_min}
                    onChange={(e) =>
                      setRecipeForm({ ...recipeForm, temp_min: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="block text-xs font-medium text-slate-400">
                    อุณหภูมิสูงสุด (temp_max °C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={recipeForm.temp_max}
                    onChange={(e) =>
                      setRecipeForm({ ...recipeForm, temp_max: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* ความชื้นสัมพัทธ์ต่ำสุด - สูงสุด */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="block text-xs font-medium text-slate-400">
                    ความชื้นต่ำสุด (humidity_min %RH)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={recipeForm.humidity_min}
                    onChange={(e) =>
                      setRecipeForm({
                        ...recipeForm,
                        humidity_min: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="block text-xs font-medium text-slate-400">
                    ความชื้นสูงสุด (humidity_max %RH)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={recipeForm.humidity_max}
                    onChange={(e) =>
                      setRecipeForm({
                        ...recipeForm,
                        humidity_max: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* pH ต่ำสุด - สูงสุด */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="block text-xs font-medium text-slate-400">
                    ค่า pH ต่ำสุด (ph_min)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={recipeForm.ph_min}
                    onChange={(e) =>
                      setRecipeForm({ ...recipeForm, ph_min: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="block text-xs font-medium text-slate-400">
                    ค่า pH สูงสุด (ph_max)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={recipeForm.ph_max}
                    onChange={(e) =>
                      setRecipeForm({ ...recipeForm, ph_max: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* EC ต่ำสุด - สูงสุด */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="block text-xs font-medium text-slate-400">
                    ค่าปุ๋ย EC ต่ำสุด (ec_min mS/cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={recipeForm.ec_min}
                    onChange={(e) =>
                      setRecipeForm({ ...recipeForm, ec_min: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="block text-xs font-medium text-slate-400">
                    ค่าปุ๋ย EC สูงสุด (ec_max mS/cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={recipeForm.ec_max}
                    onChange={(e) =>
                      setRecipeForm({ ...recipeForm, ec_max: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* การพ่นหมอกและแสง */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="block text-xs font-medium text-slate-400">
                    ระยะเวลาพ่นหมอก (mist_duration วินาที)
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={recipeForm.mist_duration}
                    onChange={(e) =>
                      setRecipeForm({
                        ...recipeForm,
                        mist_duration: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="block text-xs font-medium text-slate-400">
                    ความถี่การพ่นหมอก (mist_interval นาที)
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={recipeForm.mist_interval}
                    onChange={(e) =>
                      setRecipeForm({
                        ...recipeForm,
                        mist_interval: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400">
                    ชั่วโมงการให้แสงต่อวัน (light_hours_per_day ชั่วโมง/วัน)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={recipeForm.light_hours_per_day}
                    onChange={(e) =>
                      setRecipeForm({
                        ...recipeForm,
                        light_hours_per_day: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-5">
                <p className="text-xs text-slate-400">
                  เมื่อกดบันทึก ระบบจะอัปเดตค่ามาตรฐานลงตาราง <code className="text-emerald-400">plant_recipes</code> ทันที
                </p>
                <button
                  type="submit"
                  disabled={isSavingRecipe}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSavingRecipe
                    ? 'กำลังบันทึกข้อมูล...'
                    : `บันทึกสูตรการปลูก (${currentChamber.thaiName})`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ====================================================================
            แท็บ 3: คาดการณ์ผลผลิต AI (AI Yield Predictions)
        ==================================================================== */}
        {activeTab === 'ai' && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  <BrainCircuit className="h-5 w-5 text-emerald-400" />
                  ตารางเปรียบเทียบค่าจริงและค่าพยากรณ์ผลผลิตด้วย AI ({currentChamber.thaiName})
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  ข้อมูลจากตาราง <code className="text-emerald-400">ai_predictions</code> ประมวลผลด้วยโมเดล Random Forest และ Gradient Boosting
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-300">
                <TrendingUp className="h-4 w-4" />
                แสดงผลเฉพาะ {selectedPlantId}: {currentChamber.thaiName}
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                    <th className="pb-3 pr-4">เวลาประมวลผล</th>
                    <th className="pb-3 px-4">เป้าหมายการทำนาย (target_type)</th>
                    <th className="pb-3 px-4 text-right">ค่าจริง (actual_value)</th>
                    <th className="pb-3 px-4 text-right">ค่าทำนาย AI (predicted_value)</th>
                    <th className="pb-3 px-4 text-right">ความคลาดเคลื่อน (error_value)</th>
                    <th className="pb-3 pl-4">เวอร์ชันโมเดล (model_version)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredPredictions.map((pred) => {
                    const accuracy =
                      pred.actual_value && pred.error_value !== null
                        ? Math.max(0, 100 - (Math.abs(pred.error_value) / pred.actual_value) * 100)
                        : null;

                    return (
                      <tr key={pred.prediction_id} className="hover:bg-slate-800/40">
                        <td className="py-4 pr-4 text-xs text-slate-400 whitespace-nowrap">
                          {new Date(pred.timestamp).toLocaleString('th-TH')}
                        </td>
                        <td className="py-4 px-4 font-medium text-white">{pred.target_type}</td>
                        <td className="py-4 px-4 text-right font-semibold text-slate-200">
                          {pred.actual_value !== null ? pred.actual_value.toFixed(2) : '-'}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-emerald-400">
                          {pred.predicted_value.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                            ±{pred.error_value !== null ? pred.error_value.toFixed(2) : '0.00'}
                            {accuracy !== null && (
                              <span className="text-emerald-400">({accuracy.toFixed(1)}%)</span>
                            )}
                          </span>
                        </td>
                        <td className="py-4 pl-4">
                          <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300">
                            {pred.model_version}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====================================================================
            แท็บ 4: ประวัติและแจ้งเตือน (Device Logs & Alerts)
        ==================================================================== */}
        {activeTab === 'logs' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ตารางแจ้งเตือน (alerts) */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-white">
                    <ShieldAlert className="h-5 w-5 text-rose-400" />
                    รายการแจ้งเตือนความผิดปกติ (ตาราง alerts)
                  </h3>
                  <p className="text-xs text-slate-400">
                    บันทึกอัตโนมัติเมื่อค่าเซนเซอร์จาก ESP32 เกินเกณฑ์มาตรฐานในสูตรการปลูก
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {alerts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">ไม่มีรายการแจ้งเตือน</p>
                ) : (
                  alerts.map((al, idx) => (
                    <div
                      key={al.alert_id ?? idx}
                      className={`rounded-2xl border p-4 ${
                        al.status === 'ACTIVE'
                          ? 'border-rose-500/40 bg-rose-950/20'
                          : 'border-slate-800 bg-slate-950/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                          <AlertTriangle
                            className={`h-4 w-4 ${
                              al.status === 'ACTIVE' ? 'text-rose-400' : 'text-slate-400'
                            }`}
                          />
                          {al.alert_type}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            al.status === 'ACTIVE'
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {al.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-slate-300">
                        <span>
                          ค่าที่ตรวจพบ:{' '}
                          <strong className="text-rose-300">{al.detected_value}</strong> (เกณฑ์มาตรฐาน:{' '}
                          <strong className="text-emerald-300">{al.threshold_value}</strong>)
                        </span>
                        <span className="text-slate-400">
                          {new Date(al.timestamp).toLocaleString('th-TH')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ตารางประวัติการทำงานของอุปกรณ์ (device_logs) */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-white">
                    <Clock className="h-5 w-5 text-emerald-400" />
                    ประวัติการทำงานของอุปกรณ์ (ตาราง device_logs - {currentChamberId})
                  </h3>
                  <p className="text-xs text-slate-400">
                    แสดงประวัติการสั่งเปิด-ปิดปั๊มพ่นหมอก พัดลม และไฟปลูกพืชของตู้ {currentChamberId}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {filteredDeviceLogs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    ยังไม่มีประวัติการทำงานของอุปกรณ์ในตู้ {currentChamberId}
                  </p>
                ) : (
                  filteredDeviceLogs.map((log, idx) => (
                    <div
                      key={log.log_id ?? idx}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            log.status === 'ON'
                              ? 'bg-emerald-400'
                              : log.status === 'AUTO'
                              ? 'bg-sky-400'
                              : 'bg-slate-500'
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {log.device_name}{' '}
                            <span className="text-xs font-normal text-slate-400">
                              [{log.chamber_id}]
                            </span>
                          </p>
                          <p className="text-xs text-slate-400">
                            ระยะเวลาทำงาน: {log.duration_seconds} วินาที
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-bold ${
                            log.status === 'ON'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {log.status}
                        </span>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString('th-TH')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
