import React, { useState, useEffect, useRef } from 'react';

// Custom high-quality SVG Icons for clean bundle-free delivery
const Icons = {
  Cpu: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2"/><rect x="9" y="9" width="6" height="6" strokeWidth="2"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" strokeWidth="2" strokeLinecap="round"/></svg>
  ),
  Alarm: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" strokeWidth="2"/><path d="M12 9v4l2 2" strokeWidth="2" strokeLinecap="round"/><path d="M5 3L2 6M19 3l3 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  Calendar: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/></svg>
  ),
  Wifi: ({ rssi }) => {
    let color = "text-green-400";
    if (rssi < -80) color = "text-red-400";
    else if (rssi < -65) color = "text-yellow-400";
    return (
      <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a5.5 5.5 0 0 1 6.95 0M12 19a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    );
  },
  Vibrate: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M2 8l2 2-2 2 2 2-2 2M22 8l-2 2 2 2-2 2 2 2M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" strokeWidth="2" strokeLinejoin="round"/></svg>
  ),
  Code: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 18l6-6-6-6M8 6L2 12l6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  Terminal: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 17l6-6-6-6M12 19h8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  BookOpen: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zm20 0h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  Refresh: () => (
    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  Check: () => (
    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  Alert: () => (
    <svg className="w-5 h-5 text-red-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  Power: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  Clock: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round"/></svg>
  )
};

const DRV2605_EFFECTS = [
  { id: 1, name: "Strong Click (100%)", type: "Click" },
  { id: 10, name: "Double Click (100%)", type: "Click" },
  { id: 14, name: "Triple Click (100%)", type: "Click" },
  { id: 17, name: "Pulsing Strong (100%)", type: "Pulse" },
  { id: 24, name: "Sharp Click (60%)", type: "Click" },
  { id: 27, name: "Alert Buzz (100%)", type: "Buzz" },
  { id: 47, name: "Buzz Alert (Strong)", type: "Buzz" },
  { id: 52, name: "Pulsing Medium (60%)", type: "Pulse" },
  { id: 58, name: "Soft Bump (Pre-alarm style)", type: "Bump" },
  { id: 64, name: "Medium Buzz", type: "Buzz" },
  { id: 71, name: "Transition Hum Down", type: "Transition" },
  { id: 82, name: "Long Buzz (100%)", type: "Buzz" },
  { id: 118, name: "Smooth Hum Rise", type: "Transition" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mode, setMode] = useState('live'); 
  
  // Endpoint Settings - User's custom domain
  const [liveServerUrl, setLiveServerUrl] = useState('https://demo.terry878.org');
  const [deviceId, setDeviceId] = useState('alarm_c3_001');
  const [apiToken, setApiToken] = useState('');
  
  const [config, setConfig] = useState({
    deviceId: "alarm_c3_001",
    enabled: true,
    hour: 7,
    minute: 30,
    repeatMask: 62, 
    prealertSec: 60,
    snoozeMin: 5,
    maxRingSec: 300,
    hapticEffect: 17,
    version: 1,
    commandId: 0,
    command: "none"
  });

  const [status, setStatus] = useState({
    deviceId: "alarm_c3_001",
    online: true,
    state: "IDLE", 
    wifiOk: true,
    wifiRssi: -58,
    ip: "demo.terry878.org",
    timeOk: true,
    time: "2026-06-03 15:03:00",
    drvOk: true,
    alarmEnabled: true,
    alarmTime: "07:30",
    repeatMask: 62,
    lastAction: "BOOT",
    configVersion: 1,
    lastCommandId: 0,
    heap: 198244
  });

  const [logs, setLogs] = useState([]);
  const [isCopied, setIsCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // -------------------------------------------------------------
  // SIMULATOR Internals
  // -------------------------------------------------------------
  const [simTime, setSimTime] = useState(new Date('2026-06-03T07:28:45')); 
  const [simState, setSimState] = useState('IDLE');
  const [simLastAction, setSimLastAction] = useState('BOOT');
  const [simLastCommandId, setSimLastCommandId] = useState(0);
  const [simSnoozeUntil, setSimSnoozeUntil] = useState(null);
  const [simLastAlarmYday, setSimLastAlarmYday] = useState(-1);
  const [simHapticTick, setSimHapticTick] = useState(false); 
  const [simIsPressed, setSimIsPressed] = useState(false); 

  const [leds, setLeds] = useState({ a: false, b: false, flash: false });

  const addLog = (type, message, data = null) => {
    setLogs(prev => [
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        type, 
        message,
        data: data ? JSON.stringify(data, null, 2) : null
      },
      ...prev.slice(0, 49)
    ]);
  };

  // URL Trailing Slash Defensive Sanitizer (防呆過濾)
  const getSanitizedUrl = () => {
    return liveServerUrl.replace(/\/+$/, '');
  };

  // Synchronize Live Data - Updated to clean web endpoints
  const fetchLiveStatus = async () => {
    if (mode !== 'live') return;
    setIsRefreshing(true);
    const cleanUrl = getSanitizedUrl();
    try {
      // 網域版極簡路徑，對接 /web/status
      const res = await fetch(`${cleanUrl}/web/status?device_id=${deviceId}`, {
        headers: apiToken ? { 'X-Device-Token': apiToken } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setConfig(data.config);
        addLog('GET', '成功自 demo.terry878.org 雲端同步最新裝置狀態。', data);
      } else {
        addLog('SYSTEM', `同步狀態失敗。HTTP 錯誤代碼: ${res.status}。提示: 如果是 404，請檢查 Nginx 的 /web/ 反向代理設定。`);
      }
    } catch (e) {
      addLog('SYSTEM', `連線異常：無法觸及位於 ${cleanUrl} 的伺服器。請確認 Node.js 與 Nginx 代理是否正常。錯誤：${e.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const sendLiveConfigUpdate = async (updatedConfig) => {
    if (mode !== 'live') return;
    const cleanUrl = getSanitizedUrl();
    try {
      // 對接雲端 /web/config
      const res = await fetch(`${cleanUrl}/web/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken ? { 'X-Device-Token': apiToken } : {})
        },
        body: JSON.stringify({ ...updatedConfig, deviceId })
      });
      if (res.ok) {
        addLog('POST', '成功發送排程與時間配置至雲端網域 (/web/config)', updatedConfig);
      } else {
        addLog('SYSTEM', `網域拒絕了設定更新要求。狀態碼: ${res.status}`);
      }
    } catch (e) {
      addLog('SYSTEM', `無法推送設定至雲端。連線中斷: ${e.message}`);
    }
  };

  const sendLiveCommand = async (cmdString, customEffect = 0) => {
    if (mode !== 'live') return;
    const cleanUrl = getSanitizedUrl();
    try {
      const nextCmdId = config.commandId + 1;
      const payload = {
        deviceId,
        commandId: nextCmdId,
        command: cmdString,
        hapticEffect: customEffect || config.hapticEffect
      };

      // 對接雲端 /web/command
      const res = await fetch(`${cleanUrl}/web/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken ? { 'X-Device-Token': apiToken } : {})
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setConfig(prev => ({ ...prev, commandId: nextCmdId, command: cmdString }));
        addLog('CMD', `指令已掛載至雲端佇列："${cmdString}" (指令 ID: ${nextCmdId})`);
      } else {
        addLog('SYSTEM', `發送指令失敗。伺服器傳回錯誤: ${res.status}`);
      }
    } catch (e) {
      addLog('SYSTEM', `指令連線發送異常：${e.message}`);
    }
  };

  // -------------------------------------------------------------
  // SIMULATION CLOCK & HARDWARE SYSTEM STATE MACHINE
  // -------------------------------------------------------------
  useEffect(() => {
    if (mode !== 'simulator') return;

    const interval = setInterval(() => {
      setSimTime(prev => {
        const next = new Date(prev.getTime() + 1000); 
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'simulator') return;

    const currentHour = simTime.getHours();
    const currentMin = simTime.getMinutes();
    const currentSec = simTime.getSeconds();
    const currentYday = Math.floor((simTime - new Date(simTime.getFullYear(), 0, 0)) / 86400000);
    const currentWday = simTime.getDay(); 

    const isRepeatAllowed = (config.repeatMask & (1 << currentWday)) !== 0;

    const alarmTimeSec = config.hour * 3600 + config.minute * 60;
    const simTimeSec = currentHour * 3600 + currentMin * 60 + currentSec;

    let nextState = simState;

    if (simState === 'IDLE') {
      if (config.enabled && isRepeatAllowed && simLastAlarmYday !== currentYday) {
        const diff = alarmTimeSec - simTimeSec;
        if (diff <= config.prealertSec && diff > 0) {
          nextState = 'PREALARM';
          setSimLastAction('PREALARM');
          addLog('GET', 'ESP32 模擬器：已符合 Pre-alarm 預警條件，觸發溫和微震。');
        } else if (diff === 0) {
          nextState = 'RINGING';
          setSimLastAlarmYday(currentYday);
          setSimLastAction('ALARM_RINGING');
          addLog('GET', 'ESP32 模擬器：警報時間已到！觸發主體震動響鈴。');
        }
      }
    } else if (simState === 'PREALARM') {
      const diff = alarmTimeSec - simTimeSec;
      if (diff === 0) {
        nextState = 'RINGING';
        setSimLastAlarmYday(currentYday);
        setSimLastAction('ALARM_RINGING');
        addLog('GET', '預警階段結束，切換為響鈴狀態。');
      }
    } else if (simState === 'SNOOZE') {
      if (simSnoozeUntil && simTime >= simSnoozeUntil) {
        nextState = 'RINGING';
        setSimSnoozeUntil(null);
        setSimLastAction('SNOOZE_RINGING');
        addLog('GET', '貪睡時間結束，重新響鈴！');
      }
    }

    if (nextState !== simState) {
      setSimState(nextState);
    }

    const formattedDate = simTime.toISOString().replace('T', ' ').substring(0, 19);
    setStatus({
      deviceId: config.deviceId,
      online: true,
      state: simState,
      wifiOk: true,
      wifiRssi: -45,
      ip: "demo.terry878.org",
      timeOk: true,
      time: formattedDate,
      drvOk: true,
      alarmEnabled: config.enabled,
      alarmTime: `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`,
      repeatMask: config.repeatMask,
      lastAction: simLastAction,
      configVersion: config.version,
      lastCommandId: simLastCommandId,
      heap: 198000
    });

  }, [simTime, simState, config, mode]);

  // Simulate LED PWM & Flashing Frequencies
  useEffect(() => {
    let animationId;
    const tick = () => {
      const now = Date.now();
      let ledA = false;
      let ledB = false;
      let ledFlash = false;

      switch (status.state) {
        case 'BOOT':
          ledA = Math.floor(now / 200) % 2 === 0;
          break;
        case 'TIME_INVALID':
          ledB = Math.floor(now / 1000) % 2 === 0;
          break;
        case 'IDLE':
          ledA = (now % 10000) < 120;
          break;
        case 'PREALARM':
          ledA = Math.floor(now / 500) % 2 === 0;
          ledFlash = (now % 5000) < 150;
          break;
        case 'RINGING':
          ledA = true;
          ledB = Math.floor(now / 250) % 2 === 0;
          ledFlash = Math.floor(now / 125) % 2 === 0;
          break;
        case 'SNOOZE':
          const p = now % 10000;
          ledA = (p < 100) || (p > 250 && p < 350);
          break;
        case 'STOPPED':
          ledA = true;
          ledB = true;
          break;
        case 'DRV_FAIL':
          ledB = true;
          ledFlash = Math.floor(now / 200) % 2 === 0;
          break;
      }

      setLeds({ a: ledA, b: ledB, flash: ledFlash });
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [status.state]);

  // Periodic simulated GET Config & POST Status logs
  useEffect(() => {
    if (mode !== 'simulator') return;
    const interval = setInterval(() => {
      addLog('GET', `ESP32 模擬請求 ➔ GET /clock?device_id=${config.deviceId}`);
      addLog('POST', `ESP32 模擬回傳 ➔ POST /state`, status);
    }, 8000);

    return () => clearInterval(interval);
  }, [mode, status, config]);

  // Simulate Triggering Command on virtual device
  const simulateCommandExecution = (cmdName, customEffect = 0) => {
    const nextCmdId = simLastCommandId + 1;
    setSimLastCommandId(nextCmdId);
    
    addLog('CMD', `模擬器指令處理：ID ${nextCmdId} ➔ "${cmdName}"`);

    if (cmdName === 'test_led') {
      setSimLastAction('TEST_LED');
      addLog('SYSTEM', '虛擬 ESP32：啟動指示燈 LED Flashing 測試模式。');
    } else if (cmdName === 'test_haptic') {
      setSimLastAction('TEST_HAPTIC');
      setSimHapticTick(true);
      setTimeout(() => setSimHapticTick(false), 800);
      addLog('SYSTEM', `虛擬 ESP32：啟動觸覺震動，播放波形 ID #${customEffect || config.hapticEffect}`);
    } else if (cmdName === 'start_alarm') {
      setSimLastAction('MANUAL_START');
      setSimState('RINGING');
      addLog('SYSTEM', '虛擬 ESP32：指令要求強制發動警報強震。');
    } else if (cmdName === 'stop_alarm') {
      setSimLastAction('STOPPED');
      setSimState('IDLE');
      addLog('SYSTEM', '虛擬 ESP32：指令要求強制關閉警報。');
    } else if (cmdName === 'snooze') {
      if (simState === 'RINGING' || simState === 'PREALARM') {
        const snoozeDate = new Date(simTime.getTime() + config.snoozeMin * 60 * 1000);
        setSimSnoozeUntil(snoozeDate);
        setSimState('SNOOZE');
        setSimLastAction('SNOOZE');
        addLog('SYSTEM', `虛擬 ESP32：警報暫停，進入貪睡模式，預計在 ${snoozeDate.toLocaleTimeString()} 再次震動。`);
      }
    }
  };

  const handleTriggerCommand = (cmdName, customEffect = 0) => {
    if (mode === 'simulator') {
      simulateCommandExecution(cmdName, customEffect);
    } else {
      sendLiveCommand(cmdName, customEffect);
    }
  };

  const updateConfigField = (field, value) => {
    const updated = {
      ...config,
      [field]: value,
      version: config.version + 1
    };
    setConfig(updated);
    addLog('SYSTEM', `變更排程設定 [${field}] ➔ ${value}。 版本號遞增為 #${updated.version}`);
    
    if (mode === 'live') {
      sendLiveConfigUpdate(updated);
    }
  };

  const handleToggleDay = (dayBit) => {
    const currentMask = config.repeatMask;
    const newMask = currentMask ^ (1 << dayBit);
    updateConfigField('repeatMask', newMask);
  };

  const getNextAlarmString = () => {
    if (!config.enabled) {
      return "⚠️ 警報器排程已全域關閉 (Master Enabled=false)";
    }
    if (config.repeatMask === 0) {
      return "⚠️ 未選擇任何重複的排程星期天數 (Repeat Mask = 0)";
    }
    
    const daysOfWeek = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const now = mode === 'simulator' ? simTime : new Date();
    const currentWday = now.getDay();
    
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const alarmMinutes = config.hour * 60 + config.minute;
    
    let daysToWait = -1;
    
    if ((config.repeatMask & (1 << currentWday)) !== 0 && alarmMinutes > nowMinutes) {
      daysToWait = 0;
    } else {
      for (let i = 1; i <= 7; i++) {
        let testWday = (currentWday + i) % 7;
        if ((config.repeatMask & (1 << testWday)) !== 0) {
          daysToWait = i;
          break;
        }
      }
    }
    
    if (daysToWait === -1) {
      return "無符合的重複排程天數";
    }
    
    const targetWday = (currentWday + daysToWait) % 7;
    const targetDayName = daysOfWeek[targetWday];
    
    let totalMinutesDiff = 0;
    if (daysToWait === 0) {
      totalMinutesDiff = alarmMinutes - nowMinutes;
    } else {
      totalMinutesDiff = (1440 - nowMinutes) + ((daysToWait - 1) * 1440) + alarmMinutes;
    }
    
    const hoursLeft = Math.floor(totalMinutesDiff / 60);
    const minutesLeft = totalMinutesDiff % 60;
    
    return `⏰ 下次預定響鈴：${targetDayName} ${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')} (約在 ${hoursLeft} 小時 ${minutesLeft} 分鐘後)`;
  };

  const handleVirtualTouchPress = () => {
    setSimIsPressed(true);
    addLog('SYSTEM', 'Touch sensor pressed (GPIO3 -> HIGH)');
    
    if (simState === 'RINGING') {
      simulateCommandExecution('snooze');
    } else if (simState === 'PREALARM') {
      setSimState('IDLE');
      setSimLastAction('PREALARM_CANCEL');
      addLog('SYSTEM', 'Virtual ESP32: Pre-alarm canceled by touch.');
    } else {
      setSimLastAction('TEST_LED');
      simulateCommandExecution('test_haptic', 1);
    }
  };

  useEffect(() => {
    if (mode === 'live') {
      fetchLiveStatus();
      const interval = setInterval(fetchLiveStatus, 15000);
      return () => clearInterval(interval);
    }
  }, [mode, liveServerUrl]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(SERVER_CODE);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* 頂部導航列 */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/30 text-indigo-400 p-2 rounded-lg border border-indigo-500/20">
              <Icons.Cpu />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                ESP32-C3 Super Mini 警報器控制中心
                <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono">網域極簡版 v1.4</span>
              </h1>
              <p className="text-xs text-slate-400">主機網域：demo.terry878.org</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex w-full md:w-auto">
              <button
                onClick={() => setMode('simulator')}
                className={`flex-1 md:flex-initial px-4 py-1.5 rounded-md text-xs font-medium transition ${mode === 'simulator' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                🖥️ 虛擬模擬器
              </button>
              <button
                onClick={() => setMode('live')}
                className={`flex-1 md:flex-initial px-4 py-1.5 rounded-md text-xs font-medium transition flex items-center justify-center gap-1.5 ${mode === 'live' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                🔌 實體連接模式 (Terry878 雲端)
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </button>
            </div>

            {mode === 'live' && (
              <button
                onClick={fetchLiveStatus}
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition border border-slate-700 text-slate-300"
                title="重新整理連線狀態"
              >
                {isRefreshing ? <Icons.Refresh /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1 1 21.306 7M21 3v5h-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            )}
          </div>

        </div>
      </header>

      {/* 狀態列 */}
      <div className="bg-slate-900 border-b border-slate-800 py-2.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-slate-400 font-mono">連線模式:</span>
            {mode === 'simulator' ? (
              <span className="bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full font-semibold border border-blue-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> 本地獨立模擬運作
              </span>
            ) : (
              <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 雲端對接中 (https://demo.terry878.org)
              </span>
            )}

            <div className="h-4 w-px bg-slate-800" />

            <div className="flex items-center gap-1.5 text-slate-300 font-mono">
              <span>裝置編號:</span>
              <input 
                type="text" 
                value={deviceId} 
                onChange={(e) => setDeviceId(e.target.value)} 
                disabled={mode === 'simulator'}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-indigo-300 w-28 text-center disabled:opacity-50 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-400 font-mono">設定同步網址:</span>
            <span className="font-mono text-emerald-400 font-bold">{getSanitizedUrl()}/clock</span>
          </div>

        </div>
      </div>

      {/* 主體區塊 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        {/* TAB 選擇器 */}
        <div className="border-b border-slate-800 flex gap-1 md:gap-4 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-3 text-sm font-semibold border-b-2 transition whitespace-nowrap px-2 md:px-0 flex items-center gap-2 ${activeTab === 'dashboard' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            📊 儀表板 & 網域監控
          </button>
          <button
            onClick={() => setActiveTab('scheduler')}
            className={`pb-3 text-sm font-semibold border-b-2 transition whitespace-nowrap px-2 md:px-0 flex items-center gap-2 ${activeTab === 'scheduler' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            ⏰ 警報時間與排程 (網域版)
            <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              排程
            </span>
          </button>
          <button
            onClick={() => setActiveTab('server')}
            className={`pb-3 text-sm font-semibold border-b-2 transition whitespace-nowrap px-2 md:px-0 flex items-center gap-2 ${activeTab === 'server' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Icons.Code /> 雲端伺服器與 Nginx 佈署
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 text-sm font-semibold border-b-2 transition whitespace-nowrap px-2 md:px-0 flex items-center gap-2 ${activeTab === 'logs' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Icons.Terminal /> API 連線日誌
            {logs.length > 0 && (
              <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {/* 內容分頁: 1. 儀表板分頁 */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 左邊：硬體模擬面板 */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      晶片硬體模擬面版
                    </h2>
                    <p className="text-xs text-slate-400">ESP32-C3 Super Mini 狀態同步</p>
                  </div>
                  <span className="text-[10px] uppercase px-2 py-0.5 bg-slate-800 rounded font-mono text-emerald-400 border border-emerald-500/25">
                    demo.terry878.org
                  </span>
                </div>

                {/* Simulated ESP32 Board */}
                <div className="flex justify-center py-6 bg-slate-950/60 rounded-xl border border-slate-800/80 mb-5 relative">
                  {(status.state === 'RINGING' || simHapticTick) && (
                    <div className="absolute inset-0 border border-red-500/25 rounded-xl animate-ping opacity-60" style={{ animationDuration: '1.2s' }} />
                  )}
                  {status.state === 'PREALARM' && (
                    <div className="absolute inset-0 border border-amber-500/15 rounded-xl animate-pulse" />
                  )}

                  <div className="w-48 bg-[#092c1a] border-2 border-emerald-950 rounded-xl px-4 py-6 shadow-2xl relative flex flex-col items-center">
                    
                    <div className="absolute -top-3 w-16 h-4 bg-slate-700 rounded-b border-x border-b border-slate-600 flex items-center justify-center">
                      <span className="text-[7px] text-slate-400 uppercase font-mono">USB-C CDC</span>
                    </div>

                    <div className="w-28 h-24 bg-slate-900 border border-slate-800 rounded-md my-4 p-2 relative flex flex-col justify-center items-center shadow-inner">
                      <div className="absolute top-1 left-2 text-[7px] text-slate-500 font-mono">ESPRESSIF</div>
                      <div className="text-xs font-bold text-slate-300 font-mono tracking-widest text-center">
                        ESP32-C3<br/>
                        <span className="text-[9px] text-indigo-400">MINI</span>
                      </div>
                      <div className="absolute bottom-1 right-2 text-[7px] text-slate-600 font-mono">2.4G WiFi/BT</div>
                    </div>

                    <div className="absolute left-1 top-6 flex flex-col justify-between h-44 text-[8px] text-emerald-400 font-mono">
                      <span>3V3</span><span>GND</span><span>GPIO5</span><span>GPIO6</span><span>GPIO7</span><span>GPIO8</span>
                    </div>
                    <div className="absolute right-1 top-6 flex flex-col justify-between h-44 text-[8px] text-emerald-400 font-mono text-right">
                      <span>5V</span><span>GND</span><span>GPIO3</span><span>GPIO4</span><span>GPIO9</span><span>GPIO10</span>
                    </div>

                    {/* LED A - GPIO 5 */}
                    <div className="absolute left-10 top-20 flex flex-col items-center">
                      <span className="text-[8px] text-slate-400 mb-0.5">LED A (5)</span>
                      <div className={`w-3.5 h-3.5 rounded-full transition-all duration-100 shadow-md ${leds.a ? 'bg-cyan-400 shadow-cyan-400/80 scale-110 border border-cyan-200' : 'bg-cyan-950 border border-cyan-900/60'}`} />
                    </div>

                    {/* LED B - GPIO 6 */}
                    <div className="absolute left-10 top-32 flex flex-col items-center">
                      <span className="text-[8px] text-slate-400 mb-0.5">LED B (6)</span>
                      <div className={`w-3.5 h-3.5 rounded-full transition-all duration-100 shadow-md ${leds.b ? 'bg-amber-400 shadow-amber-400/80 scale-110 border border-amber-200' : 'bg-amber-950 border border-amber-900/60'}`} />
                    </div>

                    {/* Flashing LED - GPIO 7 */}
                    <div className="absolute right-10 top-20 flex flex-col items-center">
                      <span className="text-[8px] text-slate-400 mb-0.5">FLASH (7)</span>
                      <div className={`w-3.5 h-3.5 rounded-full transition-all duration-100 shadow-md ${leds.flash ? 'bg-red-500 shadow-red-500/80 scale-110 border border-red-200' : 'bg-red-950 border border-red-900/60'}`} />
                    </div>

                    {/* Touch Button - GPIO 3 */}
                    <div className="absolute right-10 top-32 flex flex-col items-center">
                      <span className="text-[8px] text-slate-400 mb-0.5">TOUCH (3)</span>
                      <button 
                        onMouseDown={handleVirtualTouchPress}
                        onMouseUp={() => setSimIsPressed(false)}
                        onTouchStart={handleVirtualTouchPress}
                        onTouchEnd={() => setSimIsPressed(false)}
                        className={`w-5 h-5 rounded transition active:scale-95 border cursor-pointer flex items-center justify-center text-[7px] font-bold ${simIsPressed ? 'bg-pink-600 border-pink-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                      >
                        按
                      </button>
                    </div>

                    {/* DRV2605L Haptic */}
                    <div className="mt-2 w-32 bg-slate-900 border border-slate-800 rounded p-1 text-center text-[8px] text-slate-400 font-mono relative">
                      I2C ADDR: 0x5A (DRV2605)
                      <div className="flex justify-center mt-1 gap-0.5">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>

            {/* 右邊：狀態監控與即時控制 */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* STATUS MONITOR CARD */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    📊 裝置運作與網域狀態
                  </h3>
                  <div className="flex gap-2">
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-500/20 font-mono font-bold">
                      網域: {status.ip}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">目前運作狀態</div>
                    <div className="text-sm font-bold mt-1 text-white flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        status.state === 'RINGING' ? 'bg-red-500 animate-ping' :
                        status.state === 'PREALARM' ? 'bg-amber-400 animate-pulse' :
                        status.state === 'SNOOZE' ? 'bg-sky-400' : 'bg-emerald-400'
                      }`} />
                      {status.state}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">設定 API 路徑 (GET)</div>
                    <div className="text-sm font-bold mt-1 text-cyan-400 font-mono truncate">
                      /clock
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">狀態 API 路徑 (POST)</div>
                    <div className="text-sm font-bold mt-1 text-emerald-400 font-mono truncate">
                      /state
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">硬體驅動 (I2C)</div>
                    <div className="text-sm font-bold mt-1 text-slate-300">
                      {status.drvOk ? "🟢 DRV2605L 在線" : "🔴 驅動器離線"}
                    </div>
                  </div>

                </div>

                {/* Next Alarm countdown visualization */}
                <div className="mt-4 p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg text-xs flex justify-between items-center text-indigo-300 font-mono">
                  <span>排程提醒：</span>
                  <span className="font-semibold text-center sm:text-right">{getNextAlarmString()}</span>
                </div>

              </div>

              {/* COMMAND CENTER CARD */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
                  ⚡ 警報控制與快速測試中心 (遠端網域同步)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  即時將指令排程掛載到雲端。裝置會在下次與 `https://demo.terry878.org` 握手時調用。
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  
                  <button
                    onClick={() => handleTriggerCommand('test_led')}
                    className="flex flex-col items-center justify-center p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-center transition group cursor-pointer"
                  >
                    <span className="text-lg mb-1 group-hover:scale-110 transition">🚨</span>
                    <span className="text-xs font-bold text-slate-200">閃爍測試 (LED)</span>
                    <span className="text-[9px] text-slate-500 font-mono">test_led</span>
                  </button>

                  <button
                    onClick={() => handleTriggerCommand('test_haptic')}
                    className="flex flex-col items-center justify-center p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-center transition group cursor-pointer"
                  >
                    <span className="text-lg mb-1 group-hover:scale-110 transition">📳</span>
                    <span className="text-xs font-bold text-slate-200">測試震動 (Haptic)</span>
                    <span className="text-[9px] text-slate-500 font-mono">test_haptic</span>
                  </button>

                  <button
                    onClick={() => handleTriggerCommand('start_alarm')}
                    className="flex flex-col items-center justify-center p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-center transition group cursor-pointer"
                  >
                    <span className="text-lg mb-1 group-hover:scale-110 transition">🔔</span>
                    <span className="text-xs font-bold text-slate-200">強制啟動警報</span>
                    <span className="text-[9px] text-slate-500 font-mono">start_alarm</span>
                  </button>

                  <button
                    onClick={() => handleTriggerCommand('stop_alarm')}
                    className="flex flex-col items-center justify-center p-3 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-lg text-center transition group cursor-pointer"
                  >
                    <span className="text-lg mb-1 group-hover:scale-110 transition">⏹️</span>
                    <span className="text-xs font-bold text-red-400">強制關閉警報</span>
                    <span className="text-[9px] text-red-500/70 font-mono">stop_alarm</span>
                  </button>

                  <button
                    onClick={() => handleTriggerCommand('snooze')}
                    className="flex flex-col items-center justify-center p-3 bg-amber-950/20 hover:bg-amber-950/40 border border-amber-900/30 rounded-lg text-center transition group cursor-pointer"
                  >
                    <span className="text-lg mb-1 group-hover:scale-110 transition">💤</span>
                    <span className="text-xs font-bold text-amber-400">觸發貪睡</span>
                    <span className="text-[9px] text-amber-500/70 font-mono">snooze</span>
                  </button>

                  <button
                    onClick={() => handleTriggerCommand('none')}
                    className="flex flex-col items-center justify-center p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-center transition group cursor-pointer"
                  >
                    <span className="text-lg mb-1 group-hover:scale-110 transition">⚪</span>
                    <span className="text-xs font-bold text-slate-300">重設無命令</span>
                    <span className="text-[9px] text-slate-500 font-mono">none</span>
                  </button>

                </div>
              </div>

            </div>

          </div>
        )}

        {/* 內容分頁: 2. 警報時間排程 */}
        {activeTab === 'scheduler' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
            
            {/* 左側：核心排程器設定 */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl flex flex-col gap-6">
                
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-600/20 text-indigo-400 p-2.5 rounded-lg border border-indigo-500/20">
                      <Icons.Alarm />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">排程計畫器 (雲端網域同步中)</h2>
                      <p className="text-xs text-slate-400">設定警報時間。更動將即時推送至：https://demo.terry878.org/clock</p>
                    </div>
                  </div>

                  {/* Alarm Switcher */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={config.enabled} 
                      onChange={(e) => updateConfigField('enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-3 text-sm font-bold text-slate-200">{config.enabled ? '排程啟用' : '排程關閉'}</span>
                  </label>
                </div>

                {/* Alarm clock visualization / Big display */}
                <div className="bg-slate-950 rounded-xl p-6 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-mono">極簡 `/clock` 同步</span>
                  </div>
                  
                  <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-2">雲端同步警報時間</div>
                  <div className="text-6xl font-black font-mono text-white tracking-widest drop-shadow-[0_4px_12px_rgba(16,185,129,0.3)] select-none">
                    {String(config.hour).padStart(2, '0')}
                    <span className="animate-pulse text-emerald-500">:</span>
                    {String(config.minute).padStart(2, '0')}
                  </div>

                  {/* Countdown helper representation */}
                  <div className="mt-4 px-4 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/30 text-indigo-300 font-mono text-xs text-center font-bold">
                    {getNextAlarmString()}
                  </div>
                </div>

                {/* Sliders for Hour and Minute */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs text-slate-400 uppercase font-semibold">時 (Hour)</label>
                      <span className="font-mono text-sm font-bold text-indigo-400 bg-slate-900 px-2 py-0.5 rounded">{String(config.hour).padStart(2, '0')} 時</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="23" 
                      value={config.hour}
                      onChange={(e) => updateConfigField('hour', parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs text-slate-400 uppercase font-semibold">分 (Minute)</label>
                      <span className="font-mono text-sm font-bold text-indigo-400 bg-slate-900 px-2 py-0.5 rounded">{String(config.minute).padStart(2, '0')} 分</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="59" 
                      value={config.minute}
                      onChange={(e) => updateConfigField('minute', parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>

                {/* WEEKLY PLANNER GRID */}
                <div className="bg-slate-950 p-5 rounded-lg border border-slate-800">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Icons.Calendar />
                        重複週期星期計畫盤
                      </h4>
                      <p className="text-[11px] text-slate-500">決定哪些天需要發送警報訊號 (Repeat Days Mask)</p>
                    </div>
                    <span className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded font-mono font-bold align-middle self-start">
                      遮罩數值: {config.repeatMask}
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {['日', '一', '二', '三', '四', '五', '六'].map((day, idx) => {
                      const isSelected = (config.repeatMask & (1 << idx)) !== 0;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleDay(idx)}
                          className={`py-3 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 border cursor-pointer ${
                            isSelected 
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_2px_10px_rgba(99,102,241,0.25)]' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          <span>{day}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-transparent'}`} />
                        </button>
                      );
                    })}
                  </div>

                  {/* Preset Shortcuts */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-900/60 text-xs">
                    <span className="text-slate-400 self-center">快速套用遮罩:</span>
                    <button 
                      onClick={() => updateConfigField('repeatMask', 127)}
                      className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1 rounded-md hover:bg-slate-800 transition cursor-pointer"
                    >
                      每天 (127)
                    </button>
                    <button 
                      onClick={() => updateConfigField('repeatMask', 62)}
                      className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1 rounded-md hover:bg-slate-800 transition cursor-pointer"
                    >
                      工作日 (62)
                    </button>
                    <button 
                      onClick={() => updateConfigField('repeatMask', 65)}
                      className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1 rounded-md hover:bg-slate-800 transition cursor-pointer"
                    >
                      週末 (65)
                    </button>
                    <button 
                      onClick={() => updateConfigField('repeatMask', 0)}
                      className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1 rounded-md hover:bg-slate-800 transition cursor-pointer"
                    >
                      不重複 (0)
                    </button>
                  </div>

                </div>

              </div>

            </div>

            {/* 右側：警報參數細部設定 + 觸控波形設定 */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* TIMING CONFIGURATIONS */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Icons.Clock />
                  細部定時參數調校
                </h3>
                <p className="text-xs text-slate-400">
                  設定前置提示、警報超時上限及貪睡緩衝時間。
                </p>

                <div className="flex flex-col gap-4">
                  
                  {/* Pre-alarm Sec */}
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        前置預警機制 (Pre-alarm)
                      </label>
                      <span className="font-mono text-xs text-indigo-400">{config.prealertSec} 秒</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-3">在正式大振響前，給予溫和微振提示緩緩喚醒</p>
                    <select 
                      value={config.prealertSec} 
                      onChange={(e) => updateConfigField('prealertSec', parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="0">無前置預警</option>
                      <option value="30">30 秒前</option>
                      <option value="60">60 秒前 (溫和提示)</option>
                      <option value="120">2 分鐘前</option>
                      <option value="300">5 分鐘前</option>
                    </select>
                  </div>

                  {/* Snooze Minutes */}
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        貪睡睡眠緩衝 (Snooze)
                      </label>
                      <span className="font-mono text-xs text-indigo-400">{config.snoozeMin} 分鐘</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-3">在響鈴中點擊 Touch 後，相隔多久再次響起</p>
                    <select 
                      value={config.snoozeMin} 
                      onChange={(e) => updateConfigField('snoozeMin', parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="1">1 分鐘</option>
                      <option value="3">3 分鐘</option>
                      <option value="5">5 分鐘 (推薦)</option>
                      <option value="10">10 分鐘</option>
                    </select>
                  </div>

                  {/* Max Ring Time */}
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        響鈴上限保護 (Max Ring)
                      </label>
                      <span className="font-mono text-xs text-indigo-400">{config.maxRingSec} 秒</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-3">若無按下停止鍵，警報強振的最長超時限制</p>
                    <select 
                      value={config.maxRingSec} 
                      onChange={(e) => updateConfigField('maxRingSec', parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="60">1 分鐘 (自動停止)</option>
                      <option value="180">3 分鐘</option>
                      <option value="300">5 分鐘保護</option>
                      <option value="600">10 分鐘保護</option>
                    </select>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

        {/* 內容分頁: 3. 伺服器程式碼 */}
        {activeTab === 'server' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl flex flex-col gap-5">
            
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                  🖥️ Node.js 網域版極簡 API 部署 (demo.terry878.org)
                </h3>
                <p className="text-xs text-slate-400">
                  配合您的修改，本服務已全面將端點轉換為極簡的 `/clock` 與 `/state` 路由結構。
                </p>
              </div>
              <button
                onClick={handleCopyCode}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition border flex items-center gap-1.5 cursor-pointer ${isCopied ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'}`}
              >
                {isCopied ? '已複製！' : '一鍵複製'}
              </button>
            </div>

            <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-4 font-mono text-xs overflow-x-auto text-indigo-200 max-h-[300px]">
              <pre>{SERVER_CODE}</pre>
            </div>

            {/* Deployment Quick Guide */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Icons.BookOpen />
                Nginx `/clock` 與 `/state` 轉發配置詳解
              </h4>
              
              <div className="text-xs text-slate-300 space-y-2">
                <p className="text-emerald-400 font-semibold">
                  💡 Nginx 精準轉發配置：請在您的 Nginx 伺服器區塊中寫入以下正則表達式或獨立 Location 塊，即可保證 `/clock` 的 404 問題徹底解決：
                </p>
                
                <pre className="block bg-slate-950 border border-slate-800/80 p-4 my-2 rounded text-indigo-300 font-mono text-[11px] overflow-x-auto leading-relaxed">
{`server {
    listen 443 ssl;
    server_name demo.terry878.org;

    ssl_certificate /etc/letsencrypt/live/demo.terry878.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/demo.terry878.org/privkey.pem;

    # 1. 轉發 ESP32 配置請求 /clock
    location = /clock {
        proxy_pass http://127.0.0.1:8000/clock;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. 轉發 ESP32 狀態回傳 /state
    location = /state {
        proxy_pass http://127.0.0.1:8000/state;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. 轉發前端 Web 控制面板請求 /web/* (例如：/web/status, /web/config)
    location /web/ {
        proxy_pass http://127.0.0.1:8000/web/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Upgrade $http_upgrade;
        proxy_cache_bypass $http_upgrade;
    }

    # 4. 靜態網頁檔案 (控制中心的前端 index.html)
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}`}
                </pre>
              </div>
            </div>

          </div>
        )}

        {/* 內容分頁: 4. API 連線日誌 */}
        {activeTab === 'logs' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl flex flex-col gap-4">
            
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  📟 實體與模擬 API 即時連線日誌
                </h3>
                <p className="text-xs text-slate-400">
                  觀察來自 `demo.terry878.org/clock` 與 `/state` 雲端網域的即時封包互動狀態。
                </p>
              </div>
              <button
                onClick={() => setLogs([])}
                className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded-lg border border-slate-700 hover:text-white transition cursor-pointer"
              >
                清除日誌
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                目前無網域通訊紀錄。
                <br />
                請確認連線模式已切換為「實體連接模式」且雲端 Node.js 已啟動。
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div 
                    key={log.id} 
                    className="bg-slate-950 border border-slate-800/80 p-3 rounded-lg font-mono text-xs flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          log.type === 'GET' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          log.type === 'POST' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          log.type === 'CMD' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {log.type}
                        </span>
                        <span className="text-slate-200 font-semibold">{log.message}</span>
                      </div>
                      <span className="text-slate-500 text-[10px]">{log.time}</span>
                    </div>
                    
                    {log.data && (
                      <pre className="bg-slate-900/60 p-2 rounded border border-slate-800/50 text-[10px] text-slate-400 overflow-x-auto">
                        {log.data}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </main>

      {/* 頁尾 */}
      <footer className="border-t border-slate-900 bg-slate-950/80 text-center py-4 text-xs text-slate-500">
        <p>© 2026 ESP32-C3 Super Mini 警報器控制系統套件. 適用於 DRV2605L 驅動硬體.</p>
      </footer>

    </div>
  );
}

// -------------------------------------------------------------
// COMPLETE EXPORTABLE NODE.JS / EXPRESS BACKEND CODE
// -------------------------------------------------------------
const SERVER_CODE = `/**
 * ESP32-C3 Super Mini Alarm Device - 極簡網域配置 API (Node.js)
 * 對接 ESP32 路徑: GET /clock 與 POST /state
 * * * 🛠️ 運行前準備：
 * 1. 安裝套件： npm install express cors body-parser
 * 2. 執行指令： node server.js
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 8000;

app.use(cors());
app.use(bodyParser.json());

// 內存數據庫 (儲存警報器設定與最新指令)
let deviceConfigs = {
  "alarm_c3_001": {
    deviceId: "alarm_c3_001",
    enabled: true,
    hour: 7,
    minute: 30,
    repeatMask: 62,      // 週一到週五
    prealertSec: 60,     // 60秒前預警
    snoozeMin: 5,        // 貪睡5分鐘
    maxRingSec: 300,     // 最大響鈴300秒
    hapticEffect: 17,    // DRV2605 內建 17 號效果
    version: 1,          // 配置版本
    
    commandId: 0,        // 用來區分新命令
    command: "none"      // 目前執行的指令
  }
};

let deviceStatuses = {
  "alarm_c3_001": {
    deviceId: "alarm_c3_001",
    online: false,
    state: "BOOT",
    wifiOk: false,
    wifiRssi: 0,
    ip: "demo.terry878.org",
    timeOk: false,
    time: "",
    drvOk: false,
    alarmEnabled: false,
    alarmTime: "00:00",
    repeatMask: 0,
    lastAction: "NONE",
    configVersion: 0,
    lastCommandId: 0,
    heap: 0
  }
};

// ============================================================
// ESP32 硬體呼叫的極簡 API 端點
// ============================================================

// 1. ESP32 獲取配置: GET /clock?device_id=xxxx
app.get('/clock', (req, res) => {
  const deviceId = req.query.device_id || 'alarm_c3_001';
  
  if (!deviceConfigs[deviceId]) {
    deviceConfigs[deviceId] = {
      deviceId: deviceId,
      enabled: true,
      hour: 7,
      minute: 30,
      repeatMask: 127,
      prealertSec: 60,
      snoozeMin: 5,
      maxRingSec: 300,
      hapticEffect: 17,
      version: 1,
      commandId: 0,
      command: "none"
    };
  }
  
  console.log(\`[ESP32 -> GET /clock] \${deviceId} 正在獲取警報配置。\\n\`);
  res.json(deviceConfigs[deviceId]);
});

// 2. ESP32 回傳狀態: POST /state
app.post('/state', (req, res) => {
  const status = req.body;
  const deviceId = status.deviceId || 'alarm_c3_001';
  
  if (!deviceId) {
    return res.status(400).json({ error: "Missing deviceId" });
  }
  
  deviceStatuses[deviceId] = {
    ...status,
    online: true,
    lastSeen: Date.now()
  };
  
  console.log(\`[ESP32 -> POST /state] 狀態更新成功: ID=\${deviceId}, 狀態=\${status.state}\\n\`);
  res.json({ success: true });
});

// ============================================================
// Web 控制面板專用 API 端點 (映射於 /web/*)
// ============================================================

// Web UI 獲取指定裝置的狀態
app.get('/web/status', (req, res) => {
  const deviceId = req.query.device_id || 'alarm_c3_001';
  res.json({
    config: deviceConfigs[deviceId] || {},
    status: deviceStatuses[deviceId] || { online: false }
  });
});

// Web UI 更新裝置警報時間與配置
app.post('/web/config', (req, res) => {
  const newConfig = req.body;
  const deviceId = newConfig.deviceId || 'alarm_c3_001';
  
  if (!deviceConfigs[deviceId]) {
    deviceConfigs[deviceId] = {};
  }
  
  deviceConfigs[deviceId] = {
    ...deviceConfigs[deviceId],
    ...newConfig,
    version: (deviceConfigs[deviceId].version || 0) + 1
  };
  
  console.log(\`[Web UI -> POST /web/config] 網域設定更新成功！ (Version: #\${deviceConfigs[deviceId].version})\\n\`);
  res.json({ success: true, config: deviceConfigs[deviceId] });
});

// Web UI 發送指令
app.post('/web/command', (req, res) => {
  const { deviceId, command, hapticEffect } = req.body;
  const targetId = deviceId || 'alarm_c3_001';
  
  if (!deviceConfigs[targetId]) {
    return res.status(404).json({ error: "Device not found" });
  }
  
  deviceConfigs[targetId].commandId += 1;
  deviceConfigs[targetId].command = command;
  
  if (hapticEffect) {
    deviceConfigs[targetId].hapticEffect = hapticEffect;
  }
  
  console.log(\`[Web UI -> POST /web/command] 指令已掛載: ID=\${deviceConfigs[targetId].commandId}, Cmd=\${command}\\n\`);
  res.json({ success: true, commandId: deviceConfigs[targetId].commandId });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('============================================================');
  console.log(\`🚀 極簡網域配置後台已成功啟動！監聽本機端口: \${PORT}\`);
  console.log(\`   對外服務： https://demo.terry878.org/clock\`);
  console.log(\`            https://demo.terry878.org/state\`);
  console.log('============================================================');
});`;