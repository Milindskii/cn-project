export type NodeId = 'victim' | 'gateway' | 'attacker'
export type Defense = 'static' | 'dai'
export type PacketType = 'ARP' | 'HTTP' | 'TCP'

export type ArpEntry = { ip: string; mac: string; ttl: number; status: 'Normal' | 'Poisoned' | 'Static' }
export type LogEntry = { id: number; time: string; tone: 'info' | 'success' | 'danger' | 'warn'; message: string }
export type Capture = { id: number; time: string; src: string; dst: string; protocol: PacketType; info: string; tone: 'good' | 'bad' | 'purple'; payload?: string }
export type Packet = { id: number; from: NodeId; to: NodeId; kind: 'arp' | 'http' | 'response'; tone: 'good' | 'bad' | 'purple' }

export type SimState = {
  running: boolean
  step: number
  speed: '0.5x' | '1x' | '2x' | 'step'
  poisoning: boolean
  defenses: Record<Defense, boolean>
  victimArp: ArpEntry[]
  gatewayArp: ArpEntry[]
  logs: LogEntry[]
  captures: Capture[]
  packets: Packet[]
  selectedCapture: number | null
  intercepted: boolean
  interceptedPayload: string
  pendingPayload: string | null
  status: 'STABLE' | 'POISONED' | 'MITIGATED'
}

const VICTIM_MAC = '00:1A:2B:3C:4D:5E'
const GATEWAY_MAC = 'AA:BB:CC:DD:EE:01'
const ATTACKER_MAC = '66:DE:AD:BE:EF:99'
const now = () => new Date().toLocaleTimeString([], { hour12: false })
const log = (message: string, tone: LogEntry['tone'] = 'info'): LogEntry => ({ id: Date.now() + Math.random(), time: now(), tone, message })
const capture = (args: Omit<Capture, 'id' | 'time'>): Capture => ({ ...args, id: Date.now() + Math.random(), time: now() })

export const initialState = (): SimState => ({
  running: false, step: 0, speed: '1x', poisoning: false, defenses: { static: false, dai: false },
  victimArp: [{ ip: '192.168.1.1', mac: '—', ttl: 0, status: 'Normal' }, { ip: '192.168.1.50', mac: '—', ttl: 0, status: 'Normal' }],
  gatewayArp: [{ ip: '192.168.1.10', mac: '—', ttl: 0, status: 'Normal' }, { ip: '192.168.1.50', mac: '—', ttl: 0, status: 'Normal' }],
  logs: [log('Virtual switch fabric online. Awaiting traffic.', 'success')], captures: [], packets: [], selectedCapture: null,
  intercepted: false, interceptedPayload: '', pendingPayload: null, status: 'STABLE',
})

const push = <T,>(items: T[], item: T, limit = 28) => [item, ...items].slice(0, limit)

export function tick(state: SimState): SimState {
  const next = { ...state, packets: state.packets.slice(0), logs: state.logs.slice(0), captures: state.captures.slice(0), step: state.step + 1 }
  const phase = next.step % 4
  if (phase === 1 && next.step === 1) {
    next.packets = [{ id: next.step, from: 'victim', to: 'gateway', kind: 'arp', tone: 'good' }]
    next.logs = push(next.logs, log('[ARP] Broadcast who-has 192.168.1.1 tell 192.168.1.10'))
    next.captures = push(next.captures, capture({ src: VICTIM_MAC, dst: 'FF:FF:FF:FF:FF:FF', protocol: 'ARP', info: 'Who has 192.168.1.1? Tell 192.168.1.10', tone: 'good' }))
  } else if (phase === 2 && next.step <= 2) {
    next.packets = [{ id: next.step, from: 'gateway', to: 'victim', kind: 'arp', tone: 'good' }]
    next.victimArp = next.victimArp.map((row) => row.ip === '192.168.1.1' ? { ...row, mac: GATEWAY_MAC, ttl: 118, status: 'Normal' } : row)
    next.gatewayArp = next.gatewayArp.map((row) => row.ip === '192.168.1.10' ? { ...row, mac: VICTIM_MAC, ttl: 118, status: 'Normal' } : row)
    next.logs = push(next.logs, log('[ARP] Reply 192.168.1.1 is-at AA:BB:CC:DD:EE:01', 'success'))
    next.captures = push(next.captures, capture({ src: GATEWAY_MAC, dst: VICTIM_MAC, protocol: 'ARP', info: '192.168.1.1 is-at AA:BB:CC:DD:EE:01', tone: 'good' }))
  } else if (next.poisoning && phase === 0) {
    const blocked = next.defenses.static || next.defenses.dai
    next.packets = [{ id: next.step, from: 'attacker', to: 'victim', kind: 'arp', tone: blocked ? 'good' : 'bad' }]
    const defense = next.defenses.dai ? 'DAI dropped spoofed ARP: sender not in DHCP binding table' : 'Static ARP rejected unsolicited update for 192.168.1.1'
    next.logs = push(next.logs, log(blocked ? `[DEFENSE] ${defense}` : '[SECURITY ALERT] Inconsistent MAC detected for 192.168.1.1', blocked ? 'success' : 'danger'))
    next.captures = push(next.captures, capture({ src: ATTACKER_MAC, dst: 'FF:FF:FF:FF:FF:FF', protocol: 'ARP', info: blocked ? 'Spoofed gratuitous ARP — DROPPED' : 'Gratuitous ARP: 192.168.1.1 is-at 66:DE:AD:BE:EF:99', tone: blocked ? 'good' : 'bad' }))
    if (!blocked) {
      next.victimArp = next.victimArp.map((row) => row.ip === '192.168.1.1' ? { ...row, mac: ATTACKER_MAC, ttl: 28, status: 'Poisoned' } : row)
      next.gatewayArp = next.gatewayArp.map((row) => row.ip === '192.168.1.10' ? { ...row, mac: ATTACKER_MAC, ttl: 28, status: 'Poisoned' } : row)
      next.status = 'POISONED'
    } else next.status = 'MITIGATED'
  } else if (next.step > 2) {
    next.packets = [{ id: next.step, from: 'victim', to: next.poisoning && !next.defenses.static && !next.defenses.dai ? 'attacker' : 'gateway', kind: 'http', tone: next.poisoning && !next.defenses.static && !next.defenses.dai ? 'bad' : 'good' }]
    next.logs = push(next.logs, log(next.poisoning && !next.defenses.static && !next.defenses.dai ? '[HTTP] Victim traffic rerouted via attacker MAC' : '[HTTP] Direct encrypted-safe path: Victim → Gateway'))
  }
  return next
}

export function sendPayload(state: SimState, payload: string): SimState {
  const mitm = state.poisoning && !state.defenses.static && !state.defenses.dai
  const item = capture({ src: VICTIM_MAC, dst: mitm ? ATTACKER_MAC : GATEWAY_MAC, protocol: 'HTTP', info: mitm ? 'Intercepted plaintext payload' : 'GET /api/transfer HTTP/1.1', tone: mitm ? 'bad' : 'good', payload })
  return { ...state, captures: push(state.captures, item), selectedCapture: item.id, intercepted: mitm, interceptedPayload: mitm ? payload : '', pendingPayload: mitm ? payload : null, packets: [{ id: Date.now(), from: 'victim', to: mitm ? 'attacker' : 'gateway', kind: 'http', tone: mitm ? 'bad' : 'good' }], logs: push(state.logs, log(mitm ? '[MITM] Plaintext HTTP payload paused at attacker buffer' : '[HTTP] Payload delivered directly to gateway', mitm ? 'danger' : 'success')) }
}

export function resolvePayload(state: SimState, action: 'forward' | 'tamper' | 'drop', text?: string): SimState {
  if (!state.pendingPayload) return state
  if (action === 'drop') return { ...state, intercepted: false, pendingPayload: null, interceptedPayload: '', packets: [], logs: push(state.logs, log('[MITM] Packet dropped. Victim will receive no response.', 'danger')) }
  const payload = action === 'tamper' ? (text || state.pendingPayload.replace('ACC-1048', 'ACC-9001')) : state.pendingPayload
  const item = capture({ src: ATTACKER_MAC, dst: GATEWAY_MAC, protocol: 'HTTP', info: action === 'tamper' ? 'Tampered & forwarded payload' : 'Forwarded unchanged', tone: action === 'tamper' ? 'purple' : 'bad', payload })
  return { ...state, intercepted: false, pendingPayload: null, interceptedPayload: '', captures: push(state.captures, item), selectedCapture: item.id, packets: [{ id: Date.now(), from: 'attacker', to: 'gateway', kind: 'http', tone: action === 'tamper' ? 'purple' : 'bad' }], logs: push(state.logs, log(action === 'tamper' ? '[MITM] Payload modified in attacker buffer, forwarding to gateway' : '[MITM] Payload forwarded unchanged to gateway', action === 'tamper' ? 'warn' : 'info')) }
}

export const MACS = { victim: VICTIM_MAC, gateway: GATEWAY_MAC, attacker: ATTACKER_MAC }
