# NetPoison Simulator

An interactive, production-grade web application for simulating and visualizing Layer 2 Network ARP Cache Poisoning (Man-in-the-Middle) attacks and defenses.

## 🚀 Features

- **Interactive Network Fabric**: Visualize communication between Victim, Gateway, and Attacker nodes.
- **Dynamic ARP Tables**: Inspect live ARP caches, TTL expiration, and cache poisoning state transitions.
- **Packet Inspection & Sniffing**: View captured frames, payload inspection (credentials, wire transfers, plain HTTP requests), and packet flow.
- **Defense Mechanisms**: Experiment with Dynamic ARP Inspection (DAI), static ARP bindings, and HTTPS encryption defenses.

## 🛠 Tech Stack

- **Framework**: React + TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS / Custom CSS
- **Icons**: Lucide React

## 📦 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Run the development server
```bash
npm run dev
```

### 3. Build for production
```bash
npm run build
```
