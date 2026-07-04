// Native Core 3.0+ ESP32 Hardware Pin Architecture
const int fanRelayPins[2]   = {16, 17};
const int lightRelayPins[3] = {18, 19, 21};
const int fanPWMPins[2]     = {13, 14}; 
const int currentSensorPin  = 34;

// Manual Control Interface Pins (INPUT_PULLUP Configuration)
const int buttonPins[5]     = {25, 26, 27, 32, 33}; // Order: Fan1, Fan2, Light1, Light2, Light3

// Core State Registers
bool deviceStates[5]        = {false, false, false, false, false}; // Track state: ON (true) / OFF (false)
bool lastButtonStates[5]    = {HIGH, HIGH, HIGH, HIGH, HIGH};     // For state-change detection filtering

// Robust Lockout Debounce Registers (Prevents Double-Triggering / Release Chatter)
unsigned long lastDebounceTime[5] = {0, 0, 0, 0, 0};
const unsigned long DEBOUNCE_DELAY = 250; // 250ms lockout window guard bands

// Log Output Clock Parameters
unsigned long lastLogTime = 0;
const unsigned long LOG_INTERVAL = 10000; // Log status every 10 seconds if idle (10000 ms)

void setup() {
  Serial.begin(115200);
  delay(1000); // Initialize UART line buffer

  // Configure digital load switches
  for (int i = 0; i < 2; i++) {
    pinMode(fanRelayPins[i], OUTPUT);
    digitalWrite(fanRelayPins[i], LOW);
  }
  for (int i = 0; i < 3; i++) {
    pinMode(lightRelayPins[i], OUTPUT);
    digitalWrite(lightRelayPins[i], LOW);
  }

  // Configure manual control input switches
  for (int i = 0; i < 5; i++) {
    pinMode(buttonPins[i], INPUT_PULLUP);
  }

  // Bind internal hardware clock profiles straight to pins
  ledcAttach(fanPWMPins[0], 50, 10);
  ledcAttach(fanPWMPins[1], 50, 10);
}

void loop() {
  bool stateChangedInstantaneously = false;

  // 1. Scan Interface Switch Inputs Natively with Lockout Debounce
  for (int i = 0; i < 5; i++) {
    bool currentBtnState = digitalRead(buttonPins[i]);
    
    // Detect falling-edge transition (Button pressed down to GND)
    if (currentBtnState == LOW && lastButtonStates[i] == HIGH) {
      // Ensure enough time has elapsed since the last registered toggle to ignore release chatter
      if (millis() - lastDebounceTime[i] > DEBOUNCE_DELAY) {
        deviceStates[i] = !deviceStates[i]; // Flip target element condition state
        stateChangedInstantaneously = true; // Flag that a button event occurred right now!
        lastDebounceTime[i] = millis();     // Update the lockout timestamp tracker
      }
    }
    lastButtonStates[i] = currentBtnState;
  }

  // 2. Direct State Updates to Output Rails
  digitalWrite(fanRelayPins[0], deviceStates[0] ? HIGH : LOW);
  digitalWrite(fanRelayPins[1], deviceStates[1] ? HIGH : LOW);
  digitalWrite(lightRelayPins[0], deviceStates[2] ? HIGH : LOW);
  digitalWrite(lightRelayPins[1], deviceStates[3] ? HIGH : LOW);
  digitalWrite(lightRelayPins[2], deviceStates[4] ? HIGH : LOW);

  // Drive Servo Fan Simulators via Native Core Timers
  ledcWrite(fanPWMPins[0], deviceStates[0] ? 77 : 0);
  ledcWrite(fanPWMPins[1], deviceStates[1] ? 77 : 0);

  // 3. True Real-Time Power Calculation Engine
  float calculatedBaseWatts = 0;
  if (deviceStates[0]) calculatedBaseWatts += 60.0; // Fan 1 Rating 
  if (deviceStates[1]) calculatedBaseWatts += 60.0; // Fan 2 Rating 
  if (deviceStates[2]) calculatedBaseWatts += 15.0; // Light 1 Rating 
  if (deviceStates[3]) calculatedBaseWatts += 15.0; // Light 2 Rating 
  if (deviceStates[4]) calculatedBaseWatts += 15.0; // Light 3 Rating 

  // 4. Incorporate Potentiometer as a Micro-Fluctuation/Noise Factor
  int adcRaw = analogRead(currentSensorPin);
  // Maps 0-4095 scale to a minor line variance scaling factor (0.9x to 1.1x)
  float varianceFactor = 0.9 + (adcRaw / 4095.0) * 0.2; 
  
  // Apply variance only if devices are drawing power
  float dynamicPowerWatts = calculatedBaseWatts * (calculatedBaseWatts > 0 ? varianceFactor : 0.0);

  // 5. Intelligent Core Reporting Cadence Loop (Every 10 seconds OR instantly on user click)
  unsigned long currentTime = millis();
  if (currentTime - lastLogTime >= LOG_INTERVAL || stateChangedInstantaneously) {
    lastLogTime = currentTime;

    // Compile and transmit structured JSON straight to your Serial Terminal
    Serial.print("{\"room\":\"Work Room 1\",");
    Serial.print("\"fan1\":\""); Serial.print(deviceStates[0] ? "ON" : "OFF"); Serial.print("\",");
    Serial.print("\"fan2\":\""); Serial.print(deviceStates[1] ? "ON" : "OFF"); Serial.print("\",");
    Serial.print("\"light1\":\""); Serial.print(deviceStates[2] ? "ON" : "OFF"); Serial.print("\",");
    Serial.print("\"light2\":\""); Serial.print(deviceStates[3] ? "ON" : "OFF"); Serial.print("\",");
    Serial.print("\"light3\":\""); Serial.print(deviceStates[4] ? "ON" : "OFF"); Serial.print("\",");
    Serial.print("\"measuredPowerWatts\":"); Serial.print(dynamicPowerWatts, 1);
    Serial.println("}");
  }
}