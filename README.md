# TariffGraph AI

## AI-Powered Trade Impact Intelligence

TariffGraph AI is an AI-powered trade intelligence and visualization platform that turns natural-language tariff questions into an explainable interactive Trade Impact Graph.

## 🚀 Live Demo

**Demo URL:**  
https://beta-pos-causes-stripes.trycloudflare.com

> Note: This is a temporary Cloudflare Quick Tunnel used for the hackathon demo.

## 🎯 Problem

Tariff changes can create connected effects across imports, manufacturers, products, industries, and downstream businesses.

Traditional tools often show isolated tariff numbers or trade information, making it difficult to understand:

**What changed → what is connected → what could be affected → why**

## 💡 Solution

TariffGraph AI allows users to ask questions such as:

> What if the tariff on steel increases from 10% to 25% in 2026?

The system analyzes the question and creates an interactive graph connecting:

**Country → Product → Tariff Change → Import Cost → Manufacturer → Downstream Industry**

The platform uses cautious scenario language such as **could**, **may**, and **potential impact** instead of presenting uncertain outcomes as guaranteed predictions.

## ✨ Key Features

- Natural-language tariff questions
- AI entity and intent extraction
- Interactive Trade Impact Graph
- Country, product, tariff, and industry relationships
- Clickable and draggable graph nodes
- Node details and relationship information
- Reasoning path
- FACT / INFERENCE / POSSIBILITY distinction
- Evidence and source area
- Trade Data view
- Timeline
- Scenario history
- What-If Simulator
- Scenario comparison
- Professional trade-intelligence dashboard

## 🧠 IBM Technology

### IBM Granite

IBM Granite 4.2 is used for AI analysis and structured interpretation.

For this prototype, IBM Granite runs locally through **Ollama**.

### IBM Bob 2.0

IBM Bob 2.0 was used as a core development tool throughout the project for:

- Understanding the repository
- Planning and implementing features
- Code modification and maintenance
- Testing
- Debugging
- Production build verification

Bob task-session evidence is preserved in:

`bob_sessions/`

## 🛠️ Technology Stack

- React
- Vite
- JavaScript
- Tailwind CSS
- React Flow
- Node.js
- Ollama
- IBM Granite 4.2
- GitHub

## 🏗️ Architecture

```text
User
  ↓
Natural Language Query
  ↓
AI Query Parser
  ↓
Entity + Intent Extraction
  ↓
Trade Data Layer
  ↓
Knowledge Graph
  ↓
Impact Analysis
  ↓
Interactive Graph + AI Explanation
