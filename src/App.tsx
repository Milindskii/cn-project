import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, ArrowDown, ArrowRight, Ban, BookOpen, Cable, CheckCircle2, ChevronDown, CircleHelp, Eye, Globe2, LockKeyhole, Menu, Pause, Play, Radio, RotateCcw, Send, Shield, ShieldAlert, SlidersHorizontal, Sparkles, Terminal, Trash2, Wifi, Zap } from 'lucide-react'
import { initialState, MACS, resolvePayload, sendPayload, tick, type ArpEntry, type Capture, type Defense, type SimState } from './engine'

const payloads = {
  'Login credentials': 'POST /login  HTTP/1.1\\nuser=alice&password=summer2026',
  'Banking wire transfer': 'POST /transfer  HTTP/1.1\\nfrom=ACC-1048&to=ACC-2217&amount=$4,800',
  'Plain HTTP GET': 'GET /account/summary HTTP/1.1\\nHost: bank.example.com',
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'red' | 'purple' | 'amber' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Toggle({ checked, onChange, label, danger = false }: { checked: boolean; onChange: () => void; label: string; danger?: boolean }) {
  return <button aria-pressed={checked} className={`toggle-wrap ${checked ? 'on' : ''} ${danger ? 'toggle-danger' : ''}`} onClick={onChange}><span className="toggle"><span /></span><span>{label}</span></button>
}

function ArpTable({ title, entries, node }: { title: string; entries: ArpEntry[]; node: 'victim' | 'gateway' }) {
  return <div className="panel arp-panel">
    <div className="panel-title"><span><span className="eyebrow">LOCAL CACHE</span><strong>{title}</strong></span><span title="ARP maps an IP address to a MAC address so Ethernet frames know where to go."><CircleHelp size={15} /></span></div>
    <div className="table-head"><span>IP ADDRESS</span><span>MAC ADDRESS</span><span>TTL</span></div>
    {entries.map((entry) => <div className={`arp-row ${entry.status === 'Poisoned' ? 'poisoned' : ''}`} key={entry.ip}>
      <div><span className="ip-dot" />{entry.ip}</div><code>{entry.mac}</code><div className="ttl">{entry.ttl ? `${entry.ttl}s` : '—'}</div>
      {entry.status !== 'Normal' && <Badge tone={entry.status === 'Poisoned' ? 'red' : 'green'}>{entry.status === 'Poisoned' ? '⚠ POISONED' : 'STATIC'}</Badge>}
    </div>)}
    <div className="cache-note"><span className="status-dot green" /> {node === 'victim' ? 'Learns gateway identity through ARP' : 'Learns client identity through ARP'}</div>
  </div>
}

function NodeCard({ type, title, ip, mac, icon: Icon, accent, active }: { type: string; title: string; ip: string; mac: string; icon: typeof Wifi; accent: string; active?: boolean }) {
  return <div className={`node-card node-${accent} ${active ? 'node-active' : ''}`}><div className="node-top"><div className="node-icon"><Icon size={18} /></div><Badge tone={accent === 'attacker' ? 'red' : 'green'}>{type}</Badge></div><strong>{title}</strong><div className="node-ip">{ip}</div><code>{mac}</code></div>
}

function NetworkCanvas({ state }: { state: SimState }) {
  return <div className="network-stage">
    <div className="stage-toolbar"><span><span className="live-dot" /> LIVE VIRTUAL FABRIC</span><span className="stage-hint"><Cable size={13} /> Layer 2 broadcast domain</span></div>
    <div className="topology">
      <div className="link link-left"><span className="link-label">eth0 · 1 Gbps</span>{state.packets.filter(p => p.from === 'victim' || p.to === 'victim').map((p) => <span className={`packet packet-${p.tone}`} key={p.id} />)}</div>
      <NodeCard type="ENDPOINT" title="Victim Client" ip="192.168.1.10" mac={MACS.victim} icon={Wifi} accent="victim" active={state.status === 'POISONED'} />
      <div className="switch" title="The virtual switch forwards Layer 2 frames using destination MAC addresses."><div className="switch-core"><Zap size={20} /></div><span>VIRTUAL SWITCH</span><small>SW-01 · 3 ports</small></div>
      <NodeCard type="ROUTER" title="Gateway Router" ip="192.168.1.1" mac={MACS.gateway} icon={Globe2} accent="gateway" active={state.status === 'POISONED'} />
      <div className="link link-right"><span className="link-label">uplink · internet</span></div>
      <div className="attacker-line"><div className="attack-line-glow" />{state.packets.filter(p => p.from === 'attacker' || p.to === 'attacker').map((p) => <span className={`packet packet-${p.tone}`} key={p.id} />)}</div>
      <NodeCard type="THREAT ACTOR" title="Attacker Node" ip="192.168.1.50" mac={MACS.attacker} icon={ShieldAlert} accent="attacker" active={state.poisoning} />
    </div>
    <div className="route-readout"><span className="route-line" /><strong>{state.status === 'POISONED' ? 'TRAFFIC ROUTE ALTERED' : 'TRAFFIC ROUTE'}</strong><span>Victim</span><ArrowRight size={14} /><span className={state.status === 'POISONED' ? 'text-red' : ''}>{state.status === 'POISONED' ? 'Attacker' : 'Gateway'}</span><ArrowRight size={14} /><span>Internet</span></div>
  </div>
}

function CaptureList({ state, onSelect }: { state: SimState; onSelect: (id: number) => void }) {
  return <div className="capture-list">{state.captures.length === 0 ? <div className="empty-capture"><Radio size={19} /><span>Listening for frames…</span></div> : state.captures.map((item: Capture) => <button key={item.id} className={`capture-row ${state.selectedCapture === item.id ? 'selected' : ''}`} onClick={() => onSelect(item.id)}><div className="capture-time">{item.time}</div><div className="capture-main"><span className={`protocol protocol-${item.tone}`}>{item.protocol}</span><span className="capture-info">{item.info}</span></div><div className="capture-ips">{item.src.slice(0, 8)}… → {item.dst.slice(0, 8)}…</div></button>)}</div>
}

function App() {
  const [state, setState] = useState<SimState>(initialState)
  const [tab, setTab] = useState<'victim' | 'gateway'>('victim')
  const [payloadType, setPayloadType] = useState<keyof typeof payloads>('Banking wire transfer')
  const [tamperText, setTamperText] = useState('')

  useEffect(() => { if (!state.running || state.speed === 'step') return; const delay = state.speed === '0.5x' ? 2400 : state.speed === '2x' ? 650 : 1250; const timer = window.setInterval(() => setState((s) => tick(s)), delay); return () => window.clearInterval(timer) }, [state.running, state.speed])
  const selected = useMemo(() => state.captures.find((item) => item.id === state.selectedCapture), [state.captures, state.selectedCapture])
  const defenseCount = Number(state.defenses.static) + Number(state.defenses.dai)
  const setDefense = (defense: Defense) => setState((s) => ({ ...s, defenses: { ...s.defenses, [defense]: !s.defenses[defense] }, status: !s.defenses[defense] ? 'MITIGATED' : s.status }))
  const scenario = (name: string) => { if (name === 'Normal Flow') setState({ ...initialState(), running: true }); if (name === 'Active Poisoning') setState({ ...initialState(), poisoning: true, running: true, status: 'POISONED' }); if (name === 'Mitigation Enabled') setState({ ...initialState(), poisoning: true, defenses: { static: true, dai: true }, running: true, status: 'MITIGATED' }) }
  const handleSpeed = (speed: SimState['speed']) => setState((s) => ({ ...s, speed, running: speed === 'step' ? false : s.running }))

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Activity size={20} /></div><div><strong>NETPOISON</strong><span>NETWORK SECURITY LAB</span></div></div><div className="top-status"><span className="status-dot green" /> SIMULATION ONLINE <span className="top-divider" /> <span className="muted">LAB-01 · PRIVATE VLAN</span></div><button className="icon-button"><Menu size={18} /></button></header>
    <section className="controlbar"><div className="control-group"><button className="control-button primary" onClick={() => setState((s) => ({ ...s, running: !s.running }))}>{state.running ? <Pause size={15} /> : <Play size={15} />}{state.running ? 'Pause' : 'Play'}</button><button className="control-button" onClick={() => setState((s) => tick({ ...s, running: false }))}><ArrowRight size={15} /> Step next</button><div className="speed-select"><SlidersHorizontal size={14} />{(['0.5x', '1x', '2x', 'step'] as const).map((speed) => <button key={speed} className={state.speed === speed ? 'selected-speed' : ''} onClick={() => handleSpeed(speed)}>{speed === 'step' ? 'STEP' : speed}</button>)}</div></div><div className="scenario-group"><span className="muted">SCENARIO</span>{['Normal Flow', 'Active Poisoning', 'Mitigation Enabled'].map((item) => <button key={item} className="scenario-button" onClick={() => scenario(item)}>{item}</button>)}</div><button className="reset-button" onClick={() => setState(initialState())}><RotateCcw size={14} /> Reset lab</button></section>
    <section className="lab-grid">
      <aside className="left-rail"><div className="rail-heading"><span><span className="eyebrow">ENDPOINTS</span><strong>Node inspectors</strong></span><Badge tone="green">3 online</Badge></div><div className="inspector-tabs"><button className={tab === 'victim' ? 'active' : ''} onClick={() => setTab('victim')}><span className="mini-node victim-mini" />Victim</button><button className={tab === 'gateway' ? 'active' : ''} onClick={() => setTab('gateway')}><span className="mini-node gateway-mini" />Gateway</button></div>{tab === 'victim' ? <ArpTable title="Victim ARP cache" entries={state.victimArp} node="victim" /> : <ArpTable title="Gateway ARP cache" entries={state.gatewayArp} node="gateway" />}<div className="info-card"><BookOpen size={16} /><div><strong>Why does ARP matter?</strong><p>ARP binds a Layer 3 IP to a Layer 2 MAC. Trusting a forged binding lets an attacker sit in the middle.</p></div></div><div className="layer-legend"><span className="eyebrow">TRAFFIC LEGEND</span><div><i className="legend-dot green-dot" /> Legitimate frame</div><div><i className="legend-dot red-dot" /> Spoofed / intercepted</div><div><i className="legend-dot purple-dot" /> Tampered payload</div></div></aside>
      <section className="center-column"><NetworkCanvas state={state} /><div className="traffic-panel panel"><div className="panel-title"><span><span className="eyebrow">TRAFFIC GENERATOR</span><strong>Send a plaintext payload</strong></span><Badge tone={state.intercepted ? 'red' : 'neutral'}>{state.intercepted ? 'BUFFERED AT ATTACKER' : 'READY'}</Badge></div><div className="payload-controls"><div className="custom-select"><ChevronDown size={15} />{(Object.keys(payloads) as (keyof typeof payloads)[]).map((item) => <button key={item} className={payloadType === item ? 'payload-active' : ''} onClick={() => setPayloadType(item)}>{item}</button>)}</div><button className="send-button" onClick={() => setState((s) => sendPayload(s, payloads[payloadType]))}><Send size={15} /> Send from victim</button></div><div className="payload-preview"><span className="payload-label">PLAINTEXT PREVIEW</span><pre>{payloads[payloadType]}</pre></div></div></section>
      <aside className="right-rail"><div className="rail-heading"><span><span className="eyebrow">THREAT CONTROL</span><strong>Attacker C2</strong></span><ShieldAlert size={18} className="text-red" /></div><div className={`attack-card ${state.poisoning ? 'attack-active' : ''}`}><div className="attack-row"><div><span className="attack-icon"><Zap size={16} /></span><div><strong>ARP cache poisoning</strong><small>Unsolicited gratuitous ARP</small></div></div><span title="A poisoned ARP cache makes both endpoints associate the other IP with the attacker MAC."><Toggle checked={state.poisoning} onChange={() => setState((s) => ({ ...s, poisoning: !s.poisoning, status: !s.poisoning ? 'POISONED' : 'STABLE' }))} label="" danger /></span></div>{state.poisoning && <div className="attack-sub"><AlertTriangle size={14} /> Every 4 ticks · claims gateway identity</div>}</div><div className="defense-card panel"><div className="panel-title"><span><span className="eyebrow">NETWORK DEFENSES</span><strong>Mitigation controls</strong></span><Shield size={15} /></div><Toggle checked={state.defenses.static} onChange={() => setDefense('static')} label="Static ARP entries" /><p>Locks trusted IP ↔ MAC mappings.</p><Toggle checked={state.defenses.dai} onChange={() => setDefense('dai')} label="Dynamic ARP Inspection" /><p>Validates ARP against DHCP snooping.</p>{defenseCount > 0 && <div className="defense-active"><CheckCircle2 size={14} /> {defenseCount} mitigation {defenseCount === 1 ? 'control' : 'controls'} active</div>}</div><div className="panel capture-panel"><div className="panel-title"><span><span className="eyebrow">PACKET CAPTURE</span><strong>Live frames</strong></span><span className="capture-count">{state.captures.length}</span></div><CaptureList state={state} onSelect={(id) => setState((s) => ({ ...s, selectedCapture: id }))} /></div></aside>
    </section>
    <section className="bottom-grid"><div className="terminal panel"><div className="terminal-head"><span><Terminal size={14} /> EVENT STREAM</span><span className="terminal-live"><span className="live-dot" /> LIVE</span></div><div className="terminal-body">{state.logs.slice(0, 7).reverse().map((entry) => <div className={`log-line log-${entry.tone}`} key={entry.id}><span className="log-time">{entry.time}</span><span className="log-message">{entry.message}</span></div>)}</div></div><div className="packet-detail panel"><div className="panel-title"><span><span className="eyebrow">SELECTED FRAME</span><strong>Packet inspector</strong></span><Eye size={15} /></div>{selected ? <><div className="detail-summary"><Badge tone={selected.tone === 'bad' ? 'red' : selected.tone === 'purple' ? 'purple' : 'green'}>{selected.protocol}</Badge><span>{selected.info}</span></div><div className="detail-grid"><div><span>ETHERNET II</span><code>src {selected.src}</code><code>dst {selected.dst}</code></div><div><span>LAYER 7 PAYLOAD</span><pre>{selected.payload || 'No application payload in this frame.'}</pre></div></div></> : <div className="no-frame"><Radio size={18} />Select a frame above to inspect decoded fields.</div>}</div></section>
    {state.intercepted && <div className="intercept-modal"><div className="intercept-dialog"><div className="dialog-head"><div className="danger-icon"><ShieldAlert size={19} /></div><div><span className="eyebrow">MITM BUFFER · PLAINTEXT</span><h2>Payload intercepted</h2></div><button onClick={() => setState((s) => ({ ...s, intercepted: false }))}><Trash2 size={16} /></button></div><p className="dialog-copy">The attacker has paused this packet before it reaches the gateway. Choose how the frame continues.</p><pre className="intercept-payload">{state.interceptedPayload}</pre><div className="mitm-actions"><button onClick={() => setState((s) => resolvePayload(s, 'forward'))}><ArrowRight size={15} /> Forward unchanged</button><button className="tamper-action" onClick={() => setState((s) => resolvePayload(s, 'tamper', tamperText))}><Sparkles size={15} /> Tamper & forward</button><button className="drop-action" onClick={() => setState((s) => resolvePayload(s, 'drop'))}><Ban size={15} /> Drop packet</button></div><label className="tamper-input"><span>OPTIONAL TAMPER TEXT</span><input placeholder="e.g. replace account number" value={tamperText} onChange={(e) => setTamperText(e.target.value)} /></label></div></div>}
  </main>
}

export default App
