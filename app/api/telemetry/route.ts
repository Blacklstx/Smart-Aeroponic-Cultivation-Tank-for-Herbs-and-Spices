import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

interface TelemetryPayload {
  chamber_id?: string;
  plant_id?: string;
  temperature: number;
  humidity: number;
  ph: number;
  ec: number;
  chamber_water_level: number;
  light_intensity: number;
  mist_pump?: string | boolean;
  fan?: string | boolean;
  grow_light?: string | boolean;
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

const DEFAULT_RECIPES: Record<string, PlantRecipe> = {
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

function normalizeDeviceStatus(val: string | boolean | undefined): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val ? 'ON' : 'OFF';
  const upper = String(val).trim().toUpperCase();
  if (upper === '1' || upper === 'TRUE' || upper === 'ON') return 'ON';
  if (upper === '0' || upper === 'FALSE' || upper === 'OFF') return 'OFF';
  return upper;
}

/**
 * GET /api/telemetry?plant_id=P001
 * ส่งค่าสูตรการปลูก (plant_recipes) ล่าสุดกลับเป็น JSON ให้บอร์ด ESP32
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id') || 'P001';

    if (!isSupabaseConfigured) {
      const fallbackRecipe = DEFAULT_RECIPES[plantId] || DEFAULT_RECIPES.P001;
      return NextResponse.json({
        success: true,
        source: 'fallback_default',
        plant_id: plantId,
        recipe: fallbackRecipe,
      });
    }

    const { data: recipe, error } = await supabaseAdmin
      .from('plant_recipes')
      .select('*')
      .eq('plant_id', plantId)
      .order('recipe_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          recipe: DEFAULT_RECIPES[plantId] || DEFAULT_RECIPES.P001,
        },
        { status: 500 }
      );
    }

    if (!recipe) {
      return NextResponse.json({
        success: true,
        source: 'default_recipe',
        plant_id: plantId,
        recipe: DEFAULT_RECIPES[plantId] || DEFAULT_RECIPES.P001,
      });
    }

    return NextResponse.json({
      success: true,
      plant_id: plantId,
      recipe,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/telemetry
 * รับค่า JSON จากบอร์ด ESP32:
 * 1. บันทึกลงตาราง sensor_readings
 * 2. ตรวจสอบค่ากับ plant_recipes หากเกินเกณฑ์ให้บันทึกลงตาราง alerts
 * 3. บันทึกสถานะอุปกรณ์ (mist_pump, fan, grow_light) ลงตาราง device_logs
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TelemetryPayload;

    const plant_id = body.plant_id || 'P001';
    const chamber_id = body.chamber_id || (plant_id === 'P002' ? 'CH02' : 'CH01');
    const temperature = Number(body.temperature);
    const humidity = Number(body.humidity);
    const ph = Number(body.ph);
    const ec = Number(body.ec);
    const chamber_water_level = Number(body.chamber_water_level ?? 0);
    const light_intensity = Number(body.light_intensity ?? 0);

    if (
      Number.isNaN(temperature) ||
      Number.isNaN(humidity) ||
      Number.isNaN(ph) ||
      Number.isNaN(ec)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid sensor payload: temperature, humidity, ph, and ec must be valid numbers.',
        },
        { status: 400 }
      );
    }

    // ดึงเกณฑ์มาตรฐานจาก plant_recipes
    let recipe: PlantRecipe = DEFAULT_RECIPES[plant_id] || DEFAULT_RECIPES.P001;

    if (isSupabaseConfigured) {
      const { data: dbRecipe } = await supabaseAdmin
        .from('plant_recipes')
        .select('*')
        .eq('plant_id', plant_id)
        .order('recipe_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbRecipe) {
        recipe = dbRecipe as PlantRecipe;
      }
    }

    // 1. บันทึกค่าเซนเซอร์ลงตาราง sensor_readings
    let insertedReading = null;
    if (isSupabaseConfigured) {
      const { data, error: readingError } = await supabaseAdmin
        .from('sensor_readings')
        .insert([
          {
            plant_id,
            temperature,
            humidity,
            ph,
            ec,
            chamber_water_level,
            light_intensity,
          },
        ])
        .select()
        .single();

      if (readingError) {
        return NextResponse.json(
          { success: false, error: `Failed to insert sensor_readings: ${readingError.message}` },
          { status: 500 }
        );
      }
      insertedReading = data;
    }

    // 2. ตรวจสอบค่าเซนเซอร์กับเกณฑ์มาตรฐานใน plant_recipes
    const generatedAlerts: Array<{
      alert_type: string;
      detected_value: number;
      threshold_value: number;
      status: string;
    }> = [];

    if (temperature < Number(recipe.temp_min)) {
      generatedAlerts.push({
        alert_type: `${plant_id} (${chamber_id}): อุณหภูมิต่ำกว่าเกณฑ์ (Low Temperature)`,
        detected_value: temperature,
        threshold_value: Number(recipe.temp_min),
        status: 'ACTIVE',
      });
    } else if (temperature > Number(recipe.temp_max)) {
      generatedAlerts.push({
        alert_type: `${plant_id} (${chamber_id}): อุณหภูมิสูงเกินเกณฑ์ (High Temperature)`,
        detected_value: temperature,
        threshold_value: Number(recipe.temp_max),
        status: 'ACTIVE',
      });
    }

    if (humidity < Number(recipe.humidity_min)) {
      generatedAlerts.push({
        alert_type: `${plant_id} (${chamber_id}): ความชื้นสัมพัทธ์ต่ำกว่าเกณฑ์ (Low Humidity)`,
        detected_value: humidity,
        threshold_value: Number(recipe.humidity_min),
        status: 'ACTIVE',
      });
    } else if (humidity > Number(recipe.humidity_max)) {
      generatedAlerts.push({
        alert_type: `${plant_id} (${chamber_id}): ความชื้นสัมพัทธ์สูงเกินเกณฑ์ (High Humidity)`,
        detected_value: humidity,
        threshold_value: Number(recipe.humidity_max),
        status: 'ACTIVE',
      });
    }

    if (ph < Number(recipe.ph_min)) {
      generatedAlerts.push({
        alert_type: `${plant_id} (${chamber_id}): ค่า pH ต่ำกว่าเกณฑ์ (Low pH - Acidic)`,
        detected_value: ph,
        threshold_value: Number(recipe.ph_min),
        status: 'ACTIVE',
      });
    } else if (ph > Number(recipe.ph_max)) {
      generatedAlerts.push({
        alert_type: `${plant_id} (${chamber_id}): ค่า pH สูงเกินเกณฑ์ (High pH - Alkaline)`,
        detected_value: ph,
        threshold_value: Number(recipe.ph_max),
        status: 'ACTIVE',
      });
    }

    if (ec < Number(recipe.ec_min)) {
      generatedAlerts.push({
        alert_type: `${plant_id} (${chamber_id}): ค่าปุ๋ย EC ต่ำกว่าเกณฑ์ (Low EC Nutrient)`,
        detected_value: ec,
        threshold_value: Number(recipe.ec_min),
        status: 'ACTIVE',
      });
    } else if (ec > Number(recipe.ec_max)) {
      generatedAlerts.push({
        alert_type: `${plant_id} (${chamber_id}): ค่าปุ๋ย EC สูงเกินเกณฑ์ (High EC Nutrient)`,
        detected_value: ec,
        threshold_value: Number(recipe.ec_max),
        status: 'ACTIVE',
      });
    }

    if (chamber_water_level > 0 && chamber_water_level < 25) {
      generatedAlerts.push({
        alert_type: `${plant_id} (${chamber_id}): ระดับน้ำในถังต่ำกว่าเกณฑ์ปลอดภัย (Low Water Level)`,
        detected_value: chamber_water_level,
        threshold_value: 25.0,
        status: 'ACTIVE',
      });
    }

    if (isSupabaseConfigured && generatedAlerts.length > 0) {
      await supabaseAdmin.from('alerts').insert(generatedAlerts);
    }

    // 3. บันทึกสถานะอุปกรณ์ลงตาราง device_logs
    const deviceEntries: Array<{
      device_name: string;
      status: string;
      duration_seconds: number;
      chamber_id: string;
    }> = [];

    const mistStatus = normalizeDeviceStatus(body.mist_pump);
    if (mistStatus) {
      deviceEntries.push({
        device_name: 'Mist Pump',
        status: mistStatus,
        duration_seconds: mistStatus === 'ON' ? Number(recipe.mist_duration || 15) : 0,
        chamber_id,
      });
    }

    const fanStatus = normalizeDeviceStatus(body.fan);
    if (fanStatus) {
      deviceEntries.push({
        device_name: 'Exhaust Fan',
        status: fanStatus,
        duration_seconds: fanStatus === 'ON' ? 60 : 0,
        chamber_id,
      });
    }

    const growLightStatus = normalizeDeviceStatus(body.grow_light);
    if (growLightStatus) {
      deviceEntries.push({
        device_name: 'LED Grow Light',
        status: growLightStatus,
        duration_seconds: growLightStatus === 'ON' ? 3600 : 0,
        chamber_id,
      });
    }

    if (isSupabaseConfigured && deviceEntries.length > 0) {
      await supabaseAdmin.from('device_logs').insert(deviceEntries);
    }

    return NextResponse.json({
      success: true,
      message: 'Telemetry processed successfully',
      chamber_id,
      plant_id,
      reading: insertedReading || {
        plant_id,
        temperature,
        humidity,
        ph,
        ec,
        chamber_water_level,
        light_intensity,
        timestamp: new Date().toISOString(),
      },
      alerts_triggered: generatedAlerts.length,
      alerts: generatedAlerts,
      device_logs_recorded: deviceEntries.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
