-- ==============================================================================
-- Database Schema: Smart Aeroponic Cultivation Tank for Herbs and Spices
-- A Case Study of Red Holy Basil (กะเพราแดง) and Turmeric (ขมิ้นชัน)
-- Target DBMS: Supabase / PostgreSQL
-- ==============================================================================

-- 1. ตารางข้อมูลพืช (plants)
CREATE TABLE IF NOT EXISTS plants (
    plant_id VARCHAR(10) PRIMARY KEY,
    plant_name VARCHAR(100) NOT NULL,
    planted_date DATE NOT NULL DEFAULT CURRENT_DATE,
    age_days INTEGER NOT NULL DEFAULT 0
);

-- 2. ตารางสูตรการปลูก / เกณฑ์มาตรฐานสภาพแวดล้อม (plant_recipes)
CREATE TABLE IF NOT EXISTS plant_recipes (
    recipe_id SERIAL PRIMARY KEY,
    plant_id VARCHAR(10) NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    temp_min NUMERIC(5,2) NOT NULL,
    temp_max NUMERIC(5,2) NOT NULL,
    humidity_min NUMERIC(5,2) NOT NULL,
    humidity_max NUMERIC(5,2) NOT NULL,
    ph_min NUMERIC(4,2) NOT NULL,
    ph_max NUMERIC(4,2) NOT NULL,
    ec_min NUMERIC(5,2) NOT NULL,
    ec_max NUMERIC(5,2) NOT NULL,
    mist_duration INTEGER NOT NULL,       -- วินาที (Seconds)
    mist_interval INTEGER NOT NULL,       -- นาที (Minutes)
    light_hours_per_day NUMERIC(4,1) NOT NULL
);

-- 3. ตารางบันทึกค่าเซนเซอร์ (sensor_readings)
CREATE TABLE IF NOT EXISTS sensor_readings (
    reading_id SERIAL PRIMARY KEY,
    plant_id VARCHAR(10) NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    temperature NUMERIC(5,2) NOT NULL,
    humidity NUMERIC(5,2) NOT NULL,
    ph NUMERIC(4,2) NOT NULL,
    ec NUMERIC(5,2) NOT NULL,
    chamber_water_level NUMERIC(5,2) NOT NULL,
    light_intensity NUMERIC(8,2) NOT NULL
);

-- 4. ตารางบันทึกการเจริญเติบโตของพืช (plant_growth)
CREATE TABLE IF NOT EXISTS plant_growth (
    growth_id SERIAL PRIMARY KEY,
    plant_id VARCHAR(10) NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    plant_age_days INTEGER NOT NULL,
    height_cm NUMERIC(6,2),
    leaf_count INTEGER,
    fresh_weight_g NUMERIC(8,2),
    rhizome_weight_g NUMERIC(8,2),
    rhizome_diameter_mm NUMERIC(6,2)
);

-- 5. ตารางบันทึกการทำงานของอุปกรณ์ (device_logs)
CREATE TABLE IF NOT EXISTS device_logs (
    log_id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,          -- 'ON', 'OFF', 'AUTO'
    duration_seconds INTEGER DEFAULT 0,
    chamber_id VARCHAR(10) NOT NULL       -- 'CH01', 'CH02'
);

-- 6. ตารางผลลัพธ์การพยากรณ์ด้วย AI (ai_predictions)
CREATE TABLE IF NOT EXISTS ai_predictions (
    prediction_id SERIAL PRIMARY KEY,
    plant_id VARCHAR(10) NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    target_type VARCHAR(100) NOT NULL,    -- เช่น 'Fresh Weight (g)', 'Rhizome Weight (g)', 'Height (cm)'
    actual_value NUMERIC(8,2),
    predicted_value NUMERIC(8,2) NOT NULL,
    error_value NUMERIC(8,2),
    model_version VARCHAR(50) NOT NULL    -- เช่น 'Random Forest v1.2', 'Gradient Boosting v2.0'
);

-- 7. ตารางการแจ้งเตือนเมื่อค่าผิดปกติ (alerts)
CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alert_type VARCHAR(100) NOT NULL,
    detected_value NUMERIC(8,2) NOT NULL,
    threshold_value NUMERIC(8,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' -- 'ACTIVE', 'RESOLVED'
);

-- ==============================================================================
-- ข้อมูลเริ่มต้น (Seed Data)
-- ==============================================================================

-- 1. ข้อมูลพืชเริ่มต้น: P001 = กะเพราแดง และ P002 = ขมิ้นชัน
INSERT INTO plants (plant_id, plant_name, planted_date, age_days)
VALUES
    ('P001', 'กะเพราแดง (Red Holy Basil)', CURRENT_DATE - INTERVAL '25 days', 25),
    ('P002', 'ขมิ้นชัน (Turmeric)', CURRENT_DATE - INTERVAL '60 days', 60)
ON CONFLICT (plant_id) DO UPDATE SET
    plant_name = EXCLUDED.plant_name,
    planted_date = EXCLUDED.planted_date,
    age_days = EXCLUDED.age_days;

-- 2. ข้อมูลสูตรการปลูกเริ่มต้น (plant_recipes)
INSERT INTO plant_recipes (
    plant_id, temp_min, temp_max, humidity_min, humidity_max,
    ph_min, ph_max, ec_min, ec_max, mist_duration, mist_interval, light_hours_per_day
)
VALUES
    -- กะเพราแดง (P001): ชอบอากาศอุ่นชื้นปานกลาง pH 5.5-6.5 EC 1.4-2.0 mS/cm
    ('P001', 24.0, 30.0, 65.0, 80.0, 5.5, 6.5, 1.4, 2.0, 15, 5, 14.0),
    -- ขมิ้นชัน (P002): ชอบความชื้นสัมพัทธ์สูง pH 5.5-6.5 EC 1.8-2.4 mS/cm
    ('P002', 25.0, 32.0, 75.0, 90.0, 5.5, 6.5, 1.8, 2.4, 20, 4, 12.0);

-- 3. ข้อมูลเซนเซอร์เริ่มต้น (sensor_readings)
INSERT INTO sensor_readings (
    plant_id, temperature, humidity, ph, ec, chamber_water_level, light_intensity
)
VALUES
    ('P001', 27.4, 72.5, 6.0, 1.72, 85.0, 16500),
    ('P002', 28.1, 82.0, 5.9, 2.15, 80.5, 14200);

-- 4. ข้อมูลการเจริญเติบโตเริ่มต้น (plant_growth)
INSERT INTO plant_growth (
    plant_id, record_date, plant_age_days, height_cm, leaf_count, fresh_weight_g, rhizome_weight_g, rhizome_diameter_mm
)
VALUES
    ('P001', CURRENT_DATE - INTERVAL '10 days', 15, 18.5, 32, 42.0, NULL, NULL),
    ('P001', CURRENT_DATE, 25, 29.4, 68, 95.5, NULL, NULL),
    ('P002', CURRENT_DATE - INTERVAL '15 days', 45, 42.0, 12, 145.0, 82.5, 21.4),
    ('P002', CURRENT_DATE, 60, 56.8, 16, 210.0, 138.0, 28.6);

-- 5. ข้อมูลบันทึกการทำงานของอุปกรณ์เริ่มต้น (device_logs)
INSERT INTO device_logs (device_name, status, duration_seconds, chamber_id)
VALUES
    ('Mist Pump', 'ON', 15, 'CH01'),
    ('LED Grow Light', 'ON', 3600, 'CH01'),
    ('Exhaust Fan', 'OFF', 0, 'CH01'),
    ('Mist Pump', 'ON', 20, 'CH02'),
    ('LED Grow Light', 'ON', 3600, 'CH02'),
    ('Exhaust Fan', 'ON', 300, 'CH02');

-- 6. ข้อมูลพยากรณ์ผลผลิต AI เริ่มต้น (ai_predictions)
INSERT INTO ai_predictions (
    plant_id, target_type, actual_value, predicted_value, error_value, model_version
)
VALUES
    ('P001', 'น้ำหนักสดใบกะเพราแดง (Fresh Weight g)', 95.50, 97.20, 1.70, 'Random Forest v1.4'),
    ('P001', 'ความสูงลำต้น (Height cm)', 29.40, 28.90, 0.50, 'Gradient Boosting v2.1'),
    ('P001', 'จำนวนใบต่อต้น (Leaf Count)', 68.00, 66.00, 2.00, 'Random Forest v1.4'),
    ('P002', 'น้ำหนักสดเหง้าขมิ้นชัน (Rhizome Weight g)', 138.00, 141.50, 3.50, 'Gradient Boosting v2.1'),
    ('P002', 'ขนาดเส้นผ่านศูนย์กลางเหง้า (Rhizome Diameter mm)', 28.60, 28.10, 0.50, 'Random Forest v1.4'),
    ('P002', 'ความสูงลำต้นเหนือดิน (Height cm)', 56.80, 55.40, 1.40, 'Gradient Boosting v2.1');

-- 7. ข้อมูลแจ้งเตือนเริ่มต้น (alerts)
INSERT INTO alerts (alert_type, detected_value, threshold_value, status)
VALUES
    ('P001: อุณหภูมิสูงเกินเกณฑ์ (High Temperature)', 31.20, 30.00, 'RESOLVED'),
    ('P002: ความชื้นสัมพัทธ์ต่ำกว่าเกณฑ์ (Low Humidity)', 71.50, 75.00, 'ACTIVE');

-- เปิดใช้งาน Supabase Realtime สำหรับตารางที่ต้องการติดตามแบบสด
-- ALTER PUBLICATION supabase_realtime ADD TABLE sensor_readings, device_logs, alerts, plant_recipes, ai_predictions;
