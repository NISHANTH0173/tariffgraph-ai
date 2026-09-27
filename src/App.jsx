import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  ExternalLink,
  Factory,
  FileText,
  Filter,
  Globe2,
  Info,
  Package,
  RotateCcw,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
  CalendarDays,
  History,
  TrendingUp,
  BrainCircuit,
} from "lucide-react";

import { motion } from "framer-motion";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import {
  tradeDataset,
  findProduct,
  findTariffScenario,
  findTradeRelationships,
  findDownstreamIndustries,
} from "./data/tradeData";

/* =========================================================
   SAMPLE QUESTIONS
========================================================= */

const sampleQuestions = [
  "What if the tariff on steel increases from 10% to 25% in 2026?",
  "What happens if India increases the tariff on semiconductor components from Taiwan?",
  "What happens if Japan increases the tariff on automotive products?",
];

/* =========================================================
   CONSTANTS
========================================================= */

const FALLBACK_TARIFF = 10;

/* =========================================================
   TEXT HELPERS
========================================================= */

function containsWholeWord(
  text,
  word
) {
  if (!text || !word) {
    return false;
  }

  const escaped =
    word.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  return new RegExp(
    `\\b${escaped}\\b`,
    "i"
  ).test(text);
}

/* =========================================================
   NATURAL LANGUAGE EXTRACTION
========================================================= */

function extractPercentage(
  text
) {
  if (!text) {
    return null;
  }

  const matches = [
    ...text.matchAll(
      /(\d+(?:\.\d+)?)\s*%/g
    ),
  ];

  if (!matches.length) {
    return null;
  }

  return Number(
    matches[
      matches.length - 1
    ][1]
  );
}

function extractYear(
  text
) {
  if (!text) {
    return new Date().getFullYear();
  }

  const match =
    text.match(
      /\b(20\d{2})\b/
    );

  return match
    ? Number(match[1])
    : new Date().getFullYear();
}

/* =========================================================
   PRODUCT
========================================================= */

function extractProduct(
  text
) {
  if (!text) {
    return null;
  }

  const lower =
    text.toLowerCase();

  const aliases = [
    {
      keywords: [
        "semiconductor",
        "semiconductors",
        "chip",
        "chips",
      ],
      product:
        "Semiconductor Components",
    },

    {
      keywords: [
        "steel",
      ],
      product:
        "Steel",
    },

    {
      keywords: [
        "automotive",
        "automobile",
        "automobiles",
        "car",
        "cars",
      ],
      product:
        "Automotive Products",
    },

    {
      keywords: [
        "solar",
      ],
      product:
        "Solar Components",
    },

    {
      keywords: [
        "battery",
        "batteries",
      ],
      product:
        "Batteries",
    },
  ];

  const aliasMatch =
    aliases.find(
      (item) =>
        item.keywords.some(
          (keyword) =>
            lower.includes(
              keyword
            )
        )
    );

  if (aliasMatch) {
    return findProduct(
      aliasMatch.product
    );
  }

  const exactMatch =
    tradeDataset.products.find(
      (product) =>
        lower.includes(
          product.name.toLowerCase()
        )
    );

  return exactMatch
    ? findProduct(
        exactMatch.name
      )
    : null;
}

/* =========================================================
   COUNTRY
========================================================= */

function extractExplicitDestinationCountry(
  text
) {
  if (!text) {
    return null;
  }

  const patterns = [
    /\b(india|taiwan|china|japan|germany|united states|usa|u\.s\.)\s+(?:increases|increase|raises|raise|imposes|impose|raising)\b/i,
    /\b(?:in|into)\s+(india|taiwan|china|japan|germany|united states|usa|u\.s\.)\b/i,
    /\b(india|taiwan|china|japan|germany|united states|usa|u\.s\.)\s+(?:tariff|duty)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return normalizeCountry(match[1]);
    }
  }

  return null;
}

function extractCountry(
  text
) {
  return (
    extractExplicitDestinationCountry(text) ||
    "India"
  );
}

function normalizeCountry(
  country
) {
  const value =
    String(
      country || ""
    )
      .trim()
      .toLowerCase();

  const mappings = {
    india:
      "India",

    taiwan:
      "Taiwan",

    china:
      "China",

    japan:
      "Japan",

    germany:
      "Germany",

    "united states":
      "United States",

    usa:
      "United States",

    "u.s.":
      "United States",
  };

  return (
    mappings[value] ||
    country ||
    "India"
  );
}

/* =========================================================
   SOURCE COUNTRY
========================================================= */

function extractSourceCountry(
  text,
  productName,
  destinationCountry
) {
  if (!text || !productName) {
    return null;
  }

  const relationships = findTradeRelationships(productName);

  const destinationMatches = relationships.filter(
    (relationship) =>
      relationship.destinationCountry.toLowerCase() ===
      destinationCountry.toLowerCase()
  );

  const fromMatch = text.match(
    /\bfrom\s+(india|taiwan|china|japan|germany|united states|usa|u\.s\.)\b/i
  );

  if (!fromMatch) {
    // Never infer a source country only because it exists in the dataset.
    return null;
  }

  const normalized = normalizeCountry(fromMatch[1]);

  return (
    destinationMatches.find(
      (relationship) =>
        relationship.sourceCountry === normalized
    )?.sourceCountry || null
  );
}

/* =========================================================
   LOCAL RESOLUTION
========================================================= */

function getLocalResolution(
  question
) {
  const product =
    extractProduct(
      question
    );

  const destination =
    extractCountry(
      question
    );

  const source =
    extractSourceCountry(
      question,
      product?.name,
      destination
    );

  const tariffRecord =
    findTariffScenario(
      destination,
      product?.name
    );

  const baseline =
    tariffRecord?.currentRate ??
    FALLBACK_TARIFF;

  const requested =
    extractPercentage(
      question
    );

  const explicitDestination =
    extractExplicitDestinationCountry(question);

  const yearMatch = question?.match(/\b(20\d{2})\b/);

  return {
    product,
    destination,
    destinationExplicit: Boolean(explicitDestination),
    source,
    sourceExplicit: Boolean(source),
    baseline,
    requested,
    tariffExplicit: requested !== null,
    year:
      extractYear(
        question
      ),
    yearExplicit: Boolean(yearMatch),
  };
}

/* =========================================================
   VALIDATE IBM RESULT
========================================================= */

function resolveAIResult(
  aiResult,
  question
) {
  const local = getLocalResolution(question);

  // User-entered values are authoritative. IBM AI only fills values
  // that the local parser could not resolve and that can be validated
  // against the structured prototype dataset.
  const aiProduct = aiResult?.product
    ? findProduct(aiResult.product)
    : null;

  const product = local.product || aiProduct;

  const aiCountry = aiResult?.country
    ? normalizeCountry(aiResult.country)
    : null;

  const validAICountry = tradeDataset.countries.some(
    (country) => country.name === aiCountry
  )
    ? aiCountry
    : null;

  const destination = local.destinationExplicit
    ? local.destination
    : validAICountry || local.destination;

  const relationships = findTradeRelationships(product?.name);

  const localSource = local.sourceExplicit
    ? local.source
    : null;

  const aiSource = aiResult?.sourceCountry
    ? normalizeCountry(aiResult.sourceCountry)
    : null;

  const hasFromPhrase = /\bfrom\s+(india|taiwan|china|japan|germany|united states|usa|u\.s\.)\b/i.test(
    question || ""
  );

  const matchingSource = hasFromPhrase
    ? relationships.find(
        (relationship) =>
          relationship.sourceCountry === aiSource &&
          relationship.destinationCountry === destination
      )?.sourceCountry || null
    : null;

  const source = localSource || matchingSource;

  const tariffRecord = findTariffScenario(
    destination,
    product?.name
  );

  const baseline = tariffRecord?.currentRate ?? local.baseline;

  // Preserve an explicitly typed tariff. With no explicit percentage,
  // start at the modeled baseline and let the What-If slider control the scenario.
  const scenario = local.tariffExplicit
    ? local.requested
    : baseline;

  const aiYear = Number(aiResult?.year);
  const year = local.yearExplicit
    ? local.year
    : Number.isFinite(aiYear) && aiYear >= 2000 && aiYear <= 2100
    ? aiYear
    : local.year;

  return {
    product,
    destination,
    source,
    baseline,
    scenario,
    year,

    aiSummary: aiResult?.summary || "",
    aiFact: aiResult?.fact || "",
    aiInference: aiResult?.inference || "",
    aiPossibility: aiResult?.possibility || "",
    intent: aiResult?.intent || "tariff_impact",
  };
}

/* =========================================================
   IMPACT
========================================================= */

function calculateImpactScore(
  tariffChange,
  relationshipCount,
  downstreamCount
) {
  const tariffFactor =
    Math.min(
      Math.abs(
        tariffChange
      ) * 3,
      50
    );

  const tradeFactor =
    Math.min(
      relationshipCount *
        8,
      25
    );

  const downstreamFactor =
    Math.min(
      downstreamCount *
        10,
      25
    );

  return Math.round(
    Math.min(
      tariffFactor +
        tradeFactor +
        downstreamFactor,
      100
    )
  );
}

function getImpactLevel(
  score
) {
  if (score >= 70) {
    return "HIGH";
  }

  if (score >= 40) {
    return "MEDIUM";
  }

  return "LOW";
}

/* =========================================================
   NODE TYPES
========================================================= */

function getNodeType(
  nodeId
) {
  const types = {
    "source-country":
      "Country",

    product:
      "Product",

    tariff:
      "Tariff",

    "import-cost":
      "Impact",

    manufacturer:
      "Manufacturer",

    "price-pressure":
      "Impact",

    downstream:
      "Industry",
  };

  return (
    types[nodeId] ||
    "Trade Graph Node"
  );
}

function getFilterType(
  nodeId
) {
  const types = {
    "source-country":
      "Country",

    product:
      "Product",

    tariff:
      "Tariff",

    "import-cost":
      "Impact",

    manufacturer:
      "Manufacturer",

    "price-pressure":
      "Impact",

    downstream:
      "Industry",
  };

  return (
    types[nodeId] ||
    "Other"
  );
}

/* =========================================================
   REASONING
========================================================= */

const reasoningOrder = [
  "source-country",
  "product",
  "tariff",
  "import-cost",
  "manufacturer",
  "downstream",
];

function getReasoningNodeIds(
  selectedNodeId
) {
  if (!selectedNodeId) {
    return [];
  }

  const index =
    reasoningOrder.indexOf(
      selectedNodeId
    );

  if (index === -1) {
    return reasoningOrder;
  }

  return reasoningOrder.slice(
    0,
    index + 1
  );
}

function getReasoningPath(
  selectedNodeId,
  analysis
) {
  const labels = {
    "source-country":
      analysis.sourceCountry ||
      "Source Country",

    product:
      analysis.product
        ?.name ||
      "Product",

    tariff:
      `${analysis.tariffForAnalysis}% Tariff`,

    "import-cost":
      "Import Cost Pressure",

    manufacturer:
      "Manufacturer",

    downstream:
      analysis.downstreamRelationships
        .map(
          (item) =>
            item.industry
        )
        .join(", ") ||
      analysis.product
        ?.industry ||
      "Downstream Industry",
  };

  const index =
    reasoningOrder.indexOf(
      selectedNodeId
    );

  if (index === -1) {
    return reasoningOrder.map(
      (id) =>
        labels[id]
    );
  }

  return reasoningOrder
    .slice(
      0,
      index + 1
    )
    .map(
      (id) =>
        labels[id]
    );
}

/* =========================================================
   NODE EXPLANATION
========================================================= */

function getNodeExplanation(
  nodeId,
  analysis
) {
  switch (nodeId) {
    case "source-country":
      return analysis.sourceCountry
        ? `${analysis.sourceCountry} is represented as the export source in the prototype trade relationship for ${analysis.product?.name || "the selected product"}.`
        : "A specific export source could not be resolved from the available prototype trade relationships.";

    case "product":
      return `${analysis.product?.name || "The selected product"} is the central traded input identified from the user's question.`;

    case "tariff":
      return `The modeled tariff is ${analysis.tariffForAnalysis}%, compared with the ${analysis.currentTariff}% prototype baseline.`;

    case "import-cost":
      return "A tariff change can influence landed import costs. This relationship is an analytical inference rather than a guaranteed economic outcome.";

    case "manufacturer":
      return "Manufacturers using the affected input may experience cost pressure when imported inputs become more expensive.";

    case "price-pressure":
      return "Possible price pressure is a potential downstream effect. Actual pricing can depend on competition, substitution, inventories, demand and other market conditions.";

    case "downstream":
      return `The prototype data layer connects the selected product to ${analysis.downstreamRelationships[0]?.industry || analysis.product?.industry || "a downstream industry"}.`;

    default:
      return "This node is part of the modeled trade-impact reasoning path.";
  }
}

/* =========================================================
   GRAPH DATA
========================================================= */

function createGraphData({
  product,
  sourceCountry,
  destinationCountry,
  currentTariff,
  scenarioTariff,
}) {
  const downstreamRelationships =
    findDownstreamIndustries(
      product?.name
    );

  const downstreamIndustry =
    downstreamRelationships[0]
      ?.industry ||
    product?.industry ||
    "Downstream Industry";

  const tariffChange =
    scenarioTariff -
    currentTariff;

  const source =
    sourceCountry ||
    "Source unavailable";

  const destination =
    destinationCountry ||
    "India";

  const nodes = [
    {
      id:
        "source-country",

      type:
        "trade",

      position: {
        x: 0,
        y: 235,
      },

      data: {
        label:
          source,

        subtitle:
          sourceCountry
            ? "Export source"
            : "Source unavailable",

        icon:
          "globe",

        nodeType:
          "Country",

        filterType:
          "Country",

        showTarget:
          false,

        showSource:
          true,
      },
    },

    {
      id:
        "product",

      type:
        "trade",

      position: {
        x: 255,
        y: 235,
      },

      data: {
        label:
          product?.name ||
          "Trade Product",

        subtitle:
          product?.industry ||
          "Product",

        icon:
          "package",

        nodeType:
          "Product",

        filterType:
          "Product",

        showTarget:
          true,

        showSource:
          true,
      },
    },

    {
      id:
        "tariff",

      type:
        "trade",

      position: {
        x: 535,
        y: 235,
      },

      data: {
        label:
          `${scenarioTariff}% tariff`,

        subtitle:
          tariffChange ===
          0
            ? "Current scenario"
            : `${
                tariffChange >
                0
                  ? "+"
                  : ""
              }${tariffChange} pp`,

        icon:
          "activity",

        nodeType:
          "Tariff",

        filterType:
          "Tariff",

        showTarget:
          true,

        showSource:
          true,
      },
    },

    {
      id:
        "import-cost",

      type:
        "trade",

      position: {
        x: 815,
        y: 235,
      },

      data: {
        label:
          "Import Cost Pressure",

        subtitle:
          tariffChange >
          0
            ? "Potential increase"
            : "Modeled impact",

        icon:
          "arrow",

        nodeType:
          "Impact",

        filterType:
          "Impact",

        showTarget:
          true,

        showSource:
          true,
      },
    },

    {
      id:
        "manufacturer",

      type:
        "trade",

      position: {
        x: 1080,
        y: 235,
      },

      data: {
        label:
          "Manufacturer",

        subtitle:
          "Input cost pressure",

        icon:
          "factory",

        nodeType:
          "Manufacturer",

        filterType:
          "Manufacturer",

        showTarget:
          true,

        showSource:
          true,
      },
    },

    {
      id:
        "price-pressure",

      type:
        "trade",

      position: {
        x: 1350,
        y: 100,
      },

      data: {
        label:
          "Possible Price Pressure",

        subtitle:
          "Potential outcome",

        icon:
          "activity",

        nodeType:
          "Potential Outcome",

        filterType:
          "Impact",

        showTarget:
          true,

        showSource:
          false,
      },
    },

    {
      id:
        "downstream",

      type:
        "trade",

      position: {
        x: 1350,
        y: 370,
      },

      data: {
        label:
          downstreamIndustry,

        subtitle:
          "Downstream industry",

        icon:
          "factory",

        nodeType:
          "Industry",

        filterType:
          "Industry",

        showTarget:
          true,

        showSource:
          false,
      },
    },
  ];

  const commonEdgeStyle = {
    strokeWidth: 2,
  };

  const arrowMarker = {
    type:
      MarkerType.ArrowClosed,
  };

  const edges = [
    {
      id:
        "edge-source-product",

      source:
        "source-country",

      target:
        "product",

      label:
        sourceCountry
          ? "EXPORTS_TO"
          : "TRADE SOURCE",

      animated:
        true,

      style:
        commonEdgeStyle,

      markerEnd:
        arrowMarker,
    },

    {
      id:
        "edge-product-tariff",

      source:
        "product",

      target:
        "tariff",

      label:
        `${destination} TARIFF`,

      animated:
        true,

      style:
        commonEdgeStyle,

      markerEnd:
        arrowMarker,
    },

    {
      id:
        "edge-tariff-import",

      source:
        "tariff",

      target:
        "import-cost",

      label:
        "INFLUENCES",

      animated:
        true,

      style:
        commonEdgeStyle,

      markerEnd:
        arrowMarker,
    },

    {
      id:
        "edge-import-manufacturer",

      source:
        "import-cost",

      target:
        "manufacturer",

      label:
        "INPUT_COST",

      animated:
        true,

      style:
        commonEdgeStyle,

      markerEnd:
        arrowMarker,
    },

    {
      id:
        "edge-manufacturer-price",

      source:
        "manufacturer",

      target:
        "price-pressure",

      label:
        "POSSIBLE",

      animated:
        true,

      style:
        commonEdgeStyle,

      markerEnd:
        arrowMarker,
    },

    {
      id:
        "edge-manufacturer-downstream",

      source:
        "manufacturer",

      target:
        "downstream",

      label:
        "USED_BY",

      animated:
        true,

      style:
        commonEdgeStyle,

      markerEnd:
        arrowMarker,
    },
  ];

  return {
    nodes,
    edges,
  };
}

/* =========================================================
   GRAPH ICON
========================================================= */

function renderNodeIcon(
  icon
) {
  const className =
    "h-5 w-5";

  switch (icon) {
    case "globe":
      return (
        <Globe2
          className={
            className
          }
        />
      );

    case "package":
      return (
        <Package
          className={
            className
          }
        />
      );

    case "factory":
      return (
        <Factory
          className={
            className
          }
        />
      );

    case "activity":
      return (
        <Activity
          className={
            className
          }
        />
      );

    default:
      return (
        <ArrowRight
          className={
            className
          }
        />
      );
  }
}

/* =========================================================
   CUSTOM NODE
========================================================= */

function TradeNode({
  data,
  selected,
}) {
  return (
    <div
      className={`relative min-w-[205px] max-w-[235px] rounded-2xl border bg-slate-950 px-4 py-4 shadow-xl transition-all duration-200 ${
        selected
          ? "border-blue-400 shadow-blue-500/20 ring-2 ring-blue-500/20"
          : data.searchDimmed || data.pathDimmed
          ? "border-slate-800 opacity-25"
          : "border-slate-700 hover:border-slate-500"
      }`}
    >

      {data.showTarget && (
        <Handle
          type="target"
          position={
            Position.Left
          }
          style={{
            width: 9,
            height: 9,
            background:
              "#3b82f6",
            border:
              "2px solid #020617",
          }}
        />
      )}

      <div className="flex items-center gap-3">

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            selected
              ? "bg-blue-500/20 text-blue-300"
              : data.searchDimmed
              ? "bg-slate-900 text-slate-700"
              : "bg-slate-800 text-slate-300"
          }`}
        >

          {renderNodeIcon(
            data.icon
          )}

        </div>

        <div className="min-w-0">

          <p className="break-words text-sm font-semibold leading-5 text-slate-100">
            {
              data.label
            }
          </p>

          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            {
              data.subtitle
            }
          </p>

        </div>

      </div>

      <div className="mt-3 border-t border-slate-800 pt-2">

        <p
          className={`text-[9px] font-bold uppercase tracking-[0.18em] ${
            selected
              ? "text-blue-400"
              : "text-slate-600"
          }`}
        >
          {selected
            ? "Selected"
            : data.nodeType}
        </p>

      </div>

      {data.showSource && (
        <Handle
          type="source"
          position={
            Position.Right
          }
          style={{
            width: 9,
            height: 9,
            background:
              "#3b82f6",
            border:
              "2px solid #020617",
          }}
        />
      )}

    </div>
  );
}

const nodeTypes = {
  trade:
    TradeNode,
};

/* =========================================================
   APP
========================================================= */

function App() {
  const [
    question,
    setQuestion,
  ] = useState("");

  const [
    analyzedQuestion,
    setAnalyzedQuestion,
  ] = useState("");

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] = useState(false);

  const [
    scenarioTariff,
    setScenarioTariff,
  ] = useState(
    FALLBACK_TARIFF
  );

  const [
    appliedScenario,
    setAppliedScenario,
  ] = useState(
    FALLBACK_TARIFF
  );

  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState(null);

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    "Sources"
  );

  const [
    graphSearch,
    setGraphSearch,
  ] = useState("");

  const [
    graphFilter,
    setGraphFilter,
  ] = useState("All");

  const [
    highlightPath,
    setHighlightPath,
  ] = useState(false);

  const [
    scenarioHistory,
    setScenarioHistory,
  ] = useState([]);

  const [
    aiResult,
    setAiResult,
  ] = useState(null);

  const [
    aiStatus,
    setAiStatus,
  ] = useState(
    "CHECKING"
  );

  const [
    aiError,
    setAiError,
  ] = useState("");

  const [
    nodes,
    setNodes,
    onNodesChange,
  ] = useNodesState([]);

  const [
    edges,
    setEdges,
    onEdgesChange,
  ] = useEdgesState([]);

  /* =====================================================
     CHECK IBM BACKEND
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    fetch(
      "/api/health"
    )
      .then(
        async (response) => {
          const data =
            await response.json();

          if (
            cancelled
          ) {
            return;
          }

          if (
            data.configured
          ) {
            setAiStatus(
              "READY"
            );
          } else {
            setAiStatus(
              "FALLBACK"
            );
          }
        }
      )
      .catch(() => {
        if (
          !cancelled
        ) {
          setAiStatus(
            "FALLBACK"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* =====================================================
     ANALYSIS
  ===================================================== */

  const analysis = useMemo(() => {
    const sourceText =
      analyzedQuestion ||
      question;

    const local =
      getLocalResolution(
        sourceText
      );

    const resolved =
      aiResult
        ? resolveAIResult(
            aiResult,
            sourceText
          )
        : {
            product:
              local.product,

            destination:
              local.destination,

            source:
              local.source,

            baseline:
              local.baseline,

            scenario:
              appliedScenario,

            year:
              local.year,

            aiSummary:
              "",

            aiFact:
              "",

            aiInference:
              "",

            aiPossibility:
              "",

            intent:
              "tariff_impact",
          };

    const product =
      resolved.product;

    const destination =
      resolved.destination;

    const source =
      resolved.source;

    const currentTariff =
      resolved.baseline;

    const tariffForAnalysis =
      appliedScenario;

    const requestedTariff =
      extractPercentage(
        sourceText
      );

    const tradeRelationships =
      findTradeRelationships(
        product?.name
      );

    const downstreamRelationships =
      findDownstreamIndustries(
        product?.name
      );

    const tariffChange =
      tariffForAnalysis -
      currentTariff;

    const impactScore =
      calculateImpactScore(
        tariffChange,
        tradeRelationships.length,
        downstreamRelationships.length
      );

    return {
      product,

      destinationCountry:
        destination,

      sourceCountry:
        source,

      tariffRecord:
        findTariffScenario(
          destination,
          product?.name
        ),

      currentTariff,

      tariffForAnalysis,

      requestedTariff,

      tradeRelationships,

      downstreamRelationships,

      tariffChange,

      impactScore,

      impactLevel:
        getImpactLevel(
          impactScore
        ),

      dataSourceStatus:
        findTariffScenario(
          destination,
          product?.name
        )
          ? "DEMO"
          : "FALLBACK DEMO",

      year:
        resolved.year,

      aiSummary:
        resolved.aiSummary,

      aiFact:
        resolved.aiFact,

      aiInference:
        resolved.aiInference,

      aiPossibility:
        resolved.aiPossibility,

      aiIntent:
        resolved.intent,
    };
  }, [
    analyzedQuestion,
    question,
    appliedScenario,
    aiResult,
  ]);

  /* =====================================================
     GRAPH
  ===================================================== */

  const graphKey = [
    analysis.product?.name ||
      "",

    analysis.sourceCountry ||
      "",

    analysis.destinationCountry ||
      "",

    analysis.currentTariff,

    appliedScenario,

    analysis.downstreamRelationships
      .map(
        (item) =>
          item.industry
      )
      .join(","),
  ].join("|");

  useEffect(() => {
    const graph =
      createGraphData({
        product:
          analysis.product,

        sourceCountry:
          analysis.sourceCountry,

        destinationCountry:
          analysis.destinationCountry,

        currentTariff:
          analysis.currentTariff,

        scenarioTariff:
          appliedScenario,
      });

    setNodes(
      graph.nodes
    );

    setEdges(
      graph.edges
    );

    setSelectedNodeId(
      null
    );

    setHighlightPath(
      false
    );
  }, [
    graphKey,
    setNodes,
    setEdges,
  ]);

  /* =====================================================
     SELECTED NODE
  ===================================================== */

  const selectedNode =
    nodes.find(
      (node) =>
        node.id ===
        selectedNodeId
    ) || null;

  /* =====================================================
     PATH
  ===================================================== */

  const pathNodeIds =
    useMemo(
      () =>
        getReasoningNodeIds(
          selectedNodeId
        ),
      [selectedNodeId]
    );

  /* =====================================================
     GRAPH FILTER
  ===================================================== */

  const filteredNodes =
    useMemo(() => {
      const search =
        graphSearch
          .trim()
          .toLowerCase();

      return nodes.map(
        (node) => {
          const nodeFilter =
            getFilterType(
              node.id
            );

          const matchesFilter =
            graphFilter ===
              "All" ||
            nodeFilter ===
              graphFilter;

          const searchableText = [
            node.data?.label,
            node.data?.subtitle,
            node.data?.nodeType,
            nodeFilter,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !search ||
            searchableText.includes(
              search
            );

          const pathMatch =
            !highlightPath ||
            !selectedNodeId ||
            pathNodeIds.includes(
              node.id
            );

          return {
            ...node,

            hidden:
              !matchesFilter,

            data: {
              ...node.data,

              searchDimmed:
                Boolean(
                  search &&
                    !matchesSearch
                ),

              pathDimmed:
                Boolean(
                  highlightPath &&
                    selectedNodeId &&
                    !pathMatch
                ),
            },
          };
        }
      );
    }, [
      nodes,
      graphSearch,
      graphFilter,
      highlightPath,
      selectedNodeId,
      pathNodeIds,
    ]);

  const filteredEdges =
    useMemo(() => {
      const hiddenNodeIds =
        new Set(
          filteredNodes
            .filter(
              (node) =>
                node.hidden
            )
            .map(
              (node) =>
                node.id
            )
        );

      return edges.map(
        (edge) => {
          const sourceHidden =
            hiddenNodeIds.has(
              edge.source
            );

          const targetHidden =
            hiddenNodeIds.has(
              edge.target
            );

          const pathRelevant =
            !highlightPath ||
            !selectedNodeId ||
            (
              pathNodeIds.includes(
                edge.source
              ) &&
              pathNodeIds.includes(
                edge.target
              )
            );

          const search =
            graphSearch
              .trim()
              .toLowerCase();

          const sourceNode =
            nodes.find(
              (node) =>
                node.id ===
                edge.source
            );

          const targetNode =
            nodes.find(
              (node) =>
                node.id ===
                edge.target
            );

          const searchable =
            `${sourceNode?.data?.label || ""} ${targetNode?.data?.label || ""}`.toLowerCase();

          const searchRelevant =
            !search ||
            searchable.includes(
              search
            );

          return {
            ...edge,

            hidden:
              sourceHidden ||
              targetHidden,

            style: {
              ...(edge.style ||
                {}),

              opacity:
                highlightPath &&
                selectedNodeId &&
                !pathRelevant
                  ? 0.15
                  : search &&
                    !searchRelevant
                  ? 0.12
                  : 1,
            },
          };
        }
      );
    }, [
      edges,
      filteredNodes,
      highlightPath,
      selectedNodeId,
      pathNodeIds,
      graphSearch,
      nodes,
    ]);

  /* =====================================================
     LOCAL SCENARIO SETUP
  ===================================================== */

  function applyResolvedAnalysis(
    questionText,
    result
  ) {
    const resolved =
      resolveAIResult(
        result,
        questionText
      );

    setScenarioTariff(
      resolved.scenario
    );

    setAppliedScenario(
      resolved.scenario
    );

    setAnalyzedQuestion(
      questionText
    );

    setGraphSearch("");

    setGraphFilter(
      "All"
    );

    setScenarioHistory([
      {
        id:
          `${Date.now()}-question`,

        type:
          "QUESTION",

        label:
          "Trade question analyzed",

        detail:
          resolved.product
            ?.name ||
          "Product analysis",

        value:
          `${resolved.scenario}%`,

        year:
          resolved.year,
      },

      {
        id:
          `${Date.now()}-baseline`,

        type:
          "BASELINE",

        label:
          "Modeled tariff baseline",

        detail:
          `${resolved.destination} · ${
            resolved.product
              ?.name ||
            "Product"
          }`,

        value:
          `${resolved.baseline}%`,

        year:
          resolved.year,
      },
    ]);
  }

  /* =====================================================
     RUN ANALYSIS
  ===================================================== */

  const runAnalysis =
    async () => {
      if (
        !question.trim()
      ) {
        return;
      }

      setIsAnalyzing(
        true
      );

      setSelectedNodeId(
        null
      );

      setHighlightPath(
        false
      );

      setAiError("");

      const local =
        getLocalResolution(
          question
        );

      try {
        setAiStatus(
          "ANALYZING"
        );

        const response =
          await fetch(
            "/api/ai/analyze",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  question:
                    question,

                  dataContext: {
                    countries:
                      tradeDataset.countries.map(
                        (item) =>
                          item.name
                      ),

                    products:
                      tradeDataset.products.map(
                        (item) =>
                          item.name
                      ),

                    industries:
                      tradeDataset.industries.map(
                        (item) =>
                          item.name
                      ),

                    tradeRelationships:
                      tradeDataset.tradeRelationships,

                    tariffScenarios:
                      tradeDataset.tariffScenarios,

                    downstreamRelationships:
                      tradeDataset.downstreamRelationships,
                  },
                }),
            }
          );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload.ok ||
          !payload.result
        ) {
          throw new Error(
            payload.error ||
              "Local IBM Granite analysis failed."
          );
        }

        const result =
          payload.result;

        setAiResult(
          result
        );

        setAiStatus(
          "CONNECTED"
        );

        applyResolvedAnalysis(
          question,
          result
        );
      } catch (
        error
      ) {
        console.error(
          "Local Granite analysis fallback:",
          error
        );

        /*
          The local parser keeps the prototype usable
          even when IBM credentials/backend are unavailable.
        */

        setAiResult(
          null
        );

        setAiStatus(
          "FALLBACK"
        );

        setAiError(
          error?.message ||
            "Local IBM Granite unavailable. Local parser analysis is being used."
        );

        setScenarioTariff(
          local.requested ??
            local.baseline
        );

        setAppliedScenario(
          local.requested ??
            local.baseline
        );

        setAnalyzedQuestion(
          question
        );

        setScenarioHistory([
          {
            id:
              `${Date.now()}-question`,

            type:
              "QUESTION",

            label:
              "Trade question analyzed",

            detail:
              local.product
                ?.name ||
              "Product analysis",

            value:
              `${
                local.requested ??
                local.baseline
              }%`,

            year:
              local.year,
          },

          {
            id:
              `${Date.now()}-baseline`,

            type:
              "BASELINE",

            label:
              "Modeled tariff baseline",

            detail:
              `${local.destination} · ${
                local.product
                  ?.name ||
                "Product"
              }`,

            value:
              `${local.baseline}%`,

            year:
              local.year,
          },
        ]);
      }

      setIsAnalyzing(
        false
      );
    };

  /* =====================================================
     SAMPLE
  ===================================================== */

  const selectSampleQuestion =
    (sample) => {
      setQuestion(
        sample
      );
    };

  /* =====================================================
     SCENARIO
  ===================================================== */

  const applyScenario =
    () => {
      const newValue =
        Number(
          scenarioTariff
        );

      setAppliedScenario(
        newValue
      );

      setScenarioHistory(
        (history) => [
          ...history,

          {
            id:
              `${Date.now()}-scenario`,

            type:
              "SCENARIO",

            label:
              "Scenario applied",

            detail:
              `${
                analysis.product
                  ?.name ||
                "Selected product"
              } · ${
                analysis.destinationCountry
              }`,

            value:
              `${newValue}%`,

            year:
              analysis.year,
          },
        ]
      );
    };

  const resetScenario =
    () => {
      const baseline =
        analysis.currentTariff;

      setScenarioTariff(
        baseline
      );

      setAppliedScenario(
        baseline
      );

      setScenarioHistory(
        (history) => [
          ...history,

          {
            id:
              `${Date.now()}-reset`,

            type:
              "RESET",

            label:
              "Scenario reset",

            detail:
              "Returned to modeled baseline",

            value:
              `${baseline}%`,

            year:
              analysis.year,
          },
        ]
      );
    };

  /* =====================================================
     GRAPH RESET
  ===================================================== */

  const resetGraphLayout =
    () => {
      const graph =
        createGraphData({
          product:
            analysis.product,

          sourceCountry:
            analysis.sourceCountry,

          destinationCountry:
            analysis.destinationCountry,

          currentTariff:
            analysis.currentTariff,

          scenarioTariff:
            appliedScenario,
        });

      setNodes(
        graph.nodes
      );

      setSelectedNodeId(
        null
      );

      setHighlightPath(
        false
      );
    };

  const resetGraphExplorer =
    () => {
      setGraphSearch("");
      setGraphFilter(
        "All"
      );
      setHighlightPath(
        false
      );
    };

  /* =====================================================
     AI SUMMARY
  ===================================================== */

  const impactExplanation =
    useMemo(() => {
      if (
        analysis.aiSummary
      ) {
        return analysis.aiSummary;
      }

      const productName =
        analysis.product
          ?.name ||
        "the selected product";

      const source =
        analysis.sourceCountry ||
        "the available trade source";

      const destination =
        analysis.destinationCountry ||
        "the destination country";

      const downstream =
        analysis.downstreamRelationships
          .map(
            (item) =>
              item.industry
          )
          .join(", ") ||
        analysis.product
          ?.industry ||
        "a downstream industry";

      const change =
        analysis.tariffChange;

      if (
        change > 0
      ) {
        return `A ${change}-percentage-point increase in the modeled tariff on ${productName} could increase import-cost pressure for businesses in ${destination}. The prototype trade layer ${
          analysis.sourceCountry
            ? `connects ${source} with ${destination}`
            : "does not currently resolve a specific export source"
        } for this product. Manufacturers using the input may therefore experience additional cost pressure, which could create possible downstream price pressure in ${downstream}.`;
      }

      if (
        change === 0
      ) {
        return `The modeled tariff remains at ${analysis.currentTariff}%. The graph shows the available trade pathway from ${source} to ${destination}, through ${productName}, into manufacturing and downstream relationships.`;
      }

      return `The modeled tariff is ${Math.abs(change)} percentage points below the prototype baseline. This scenario could reduce some import-cost pressure, although actual outcomes would depend on supplier alternatives, inventory, demand, substitution and other market conditions.`;
    }, [
      analysis,
    ]);

  /* =====================================================
     ENTITY DATA
  ===================================================== */

  const entityRows = [
    {
      label:
        "Country",
      value:
        analysis.destinationCountry ||
        "Not detected",
    },

    {
      label:
        "Source Country",
      value:
        analysis.sourceCountry ||
        "Not detected",
    },

    {
      label:
        "Trade Direction",
      value:
        analysis.sourceCountry
          ? `${analysis.sourceCountry} → ${analysis.destinationCountry}`
          : `To ${analysis.destinationCountry} · source unavailable`,
    },

    {
      label:
        "Product",
      value:
        analysis.product
          ?.name ||
        "Not detected",
    },

    {
      label:
        "Industry",
      value:
        analysis.product
          ?.industry ||
        "Not detected",
    },

    {
      label:
        "Tariff",
      value:
        `${analysis.tariffForAnalysis}%`,
    },

    {
      label:
        "Year",
      value:
        analysis.year ||
        "Not detected",
    },
  ];

  /* =====================================================
     EVIDENCE
  ===================================================== */

  const evidence = [
    {
      title:
        "Trade relationship",

      source:
        "TariffGraph Prototype Dataset",

      date:
        "Prototype dataset",

      reference:
        "src/data/tradeData.js",

      detail:
        analysis.sourceCountry
          ? `${analysis.sourceCountry} → ${analysis.destinationCountry} → ${analysis.product?.name || "Product"}`
          : `No specific export source resolved for ${analysis.destinationCountry}`,

      supports:
        "Supports the modeled source-to-destination product relationship shown in the graph.",
    },

    {
      title:
        "Tariff scenario",

      source:
        "TariffGraph Prototype Dataset",

      date:
        "Prototype dataset",

      reference:
        "src/data/tradeData.js",

      detail:
        `${analysis.destinationCountry} / ${analysis.product?.name || "Product"} / ${analysis.currentTariff}%`,

      supports:
        "Supports the modeled baseline tariff used for scenario analysis.",
    },

    {
      title:
        "Downstream relationship",

      source:
        "TariffGraph Prototype Dataset",

      date:
        "Prototype dataset",

      reference:
        "src/data/tradeData.js",

      detail:
        analysis.downstreamRelationships
          .map(
            (item) =>
              item.industry
          )
          .join(", ") ||
        analysis.product
          ?.industry ||
        "No downstream relationship resolved",

      supports:
        "Supports the modeled relationship between the selected product and downstream industry.",
    },
  ];

  /* =====================================================
     FOUR LARGE CARDS
  ===================================================== */

  const bottomCards = [
    {
      title:
        "Impact Score",

      value:
        `${analysis.impactScore}/100`,

      label:
        "Analytical indicator",

      icon:
        <Target className="h-5 w-5" />,

      description:
        "Derived from modeled tariff change, trade relationships and downstream relationships.",
    },

    {
      title:
        "Evidence",

      value:
        `${evidence.length}`,

      label:
        "Linked records",

      icon:
        <FileText className="h-5 w-5" />,

      description:
        "Prototype evidence records supporting the current graph and explanation.",
    },

    {
      title:
        "Trade Links",

      value:
        `${analysis.tradeRelationships.length}`,

      label:
        "Relationships",

      icon:
        <Globe2 className="h-5 w-5" />,

      description:
        "Trade relationships found for the detected product in the prototype dataset.",
    },

    {
      title:
        "Scenario Delta",

      value:
        `${
          analysis.tariffChange >= 0
            ? "+"
            : ""
        }${analysis.tariffChange} pp`,

      label:
        "From baseline",

      icon:
        <SlidersHorizontal className="h-5 w-5" />,

      description:
        "Difference between the applied scenario and modeled baseline tariff.",
    },
  ];

  /* =====================================================
     TIMELINE
  ===================================================== */

  const timelineStages = [
    {
      title:
        "Question",

      subtitle:
        "Natural-language request",

      value:
        `${analysis.year}`,

      icon:
        <Sparkles className="h-4 w-4" />,

      active:
        Boolean(
          analyzedQuestion
        ),
    },

    {
      title:
        "Baseline",

      subtitle:
        "Modeled tariff",

      value:
        `${analysis.currentTariff}%`,

      icon:
        <Database className="h-4 w-4" />,

      active:
        Boolean(
          analysis.product
        ),
    },

    {
      title:
        "Scenario",

      subtitle:
        "Applied tariff",

      value:
        `${appliedScenario}%`,

      icon:
        <TrendingUp className="h-4 w-4" />,

      active:
        Boolean(
          analysis.product
        ),
    },

    {
      title:
        "Impact",

      subtitle:
        "Modeled exposure",

      value:
        analysis.impactLevel,

      icon:
        <Activity className="h-4 w-4" />,

      active:
        Boolean(
          analysis.product
        ),
    },
  ];

  /* =====================================================
     TABS
  ===================================================== */

  const tabs = [
    "Sources",
    "Trade Data",
    "Timeline",
    "Methodology",
  ];

  /* =====================================================
     AI STATUS UI
  ===================================================== */

  const aiStatusText =
    aiStatus ===
    "CONNECTED"
      ? "LOCAL IBM GRANITE CONNECTED"
      : aiStatus ===
        "ANALYZING"
      ? "LOCAL IBM GRANITE ANALYZING"
      : aiStatus ===
        "READY"
      ? "LOCAL IBM GRANITE READY"
      : aiStatus ===
        "CHECKING"
      ? "CHECKING LOCAL AI"
      : "LOCAL PARSER FALLBACK";

  /* =====================================================
     RETURN
  ===================================================== */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* HEADER */}

      <header className="border-b border-slate-800 bg-slate-950/95">

        <div className="mx-auto max-w-[1650px] px-6 py-5">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">

                <Globe2 className="h-6 w-6" />

              </div>

              <div>

                <h1 className="text-2xl font-bold tracking-tight">
                  TariffGraph AI
                </h1>

                <p className="text-sm text-slate-400">
                  AI-powered trade intelligence & impact visualization
                </p>

              </div>

            </div>

            <div className="flex flex-wrap items-center gap-3">

              <StatusBadge
                icon={
                  <BrainCircuit className="h-3.5 w-3.5" />
                }
                text={
                  aiStatusText
                }
                connected={
                  aiStatus ===
                  "CONNECTED"
                }
              />

              <StatusBadge
                icon={
                  <Database className="h-3.5 w-3.5" />
                }
                text="TRADE DATA LAYER"
              />

              <StatusBadge
                text="DEMO DATA"
                amber
              />

              <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">

                {tradeDataset.tradeRelationships.length +
                  tradeDataset.tariffScenarios.length +
                  tradeDataset.downstreamRelationships.length}{" "}
                records

              </div>

            </div>

          </div>

        </div>

      </header>

      {/* MAIN */}

      <main className="mx-auto max-w-[1650px] px-6 py-6">

        {/* SEARCH */}

        <section className="mb-6">

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-black/20">

            <div className="mb-4 flex items-center gap-2">

              <Sparkles className="h-5 w-5 text-blue-400" />

              <h2 className="font-semibold">
                Ask a trade-impact question
              </h2>

            </div>

            <div className="flex flex-col gap-3 lg:flex-row">

              <div className="relative flex-1">

                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

                <input
                  value={
                    question
                  }
                  onChange={(
                    event
                  ) =>
                    setQuestion(
                      event.target
                        .value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      runAnalysis();
                    }
                  }}
                  placeholder="Example: What if India increases the tariff on steel from 10% to 25%?"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm outline-none transition focus:border-blue-500"
                />

              </div>

              <button
                onClick={
                  runAnalysis
                }
                disabled={
                  isAnalyzing ||
                  !question.trim()
                }
                className="rounded-xl bg-blue-600 px-7 py-4 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAnalyzing
                  ? "Analyzing..."
                  : "Analyze Impact"}
              </button>

            </div>

            {aiError && (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-slate-400">

                <div className="flex items-center gap-2 text-amber-300">

                  <Info className="h-4 w-4" />

                  LOCAL AI FALLBACK

                </div>

                <p className="mt-1 leading-5">
                  IBM Granite could not be reached for this request, so the local trade parser is being used.
                </p>

              </div>
            )}

            {analyzedQuestion && (
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-500">
                Analyzed: <span className="text-slate-300">{analyzedQuestion}</span>
              </div>
            )}

            <div className="mt-4">

              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Try a sample
              </p>

              <div className="flex flex-wrap gap-2">

                {sampleQuestions.map(
                  (
                    sample
                  ) => (
                    <button
                      key={
                        sample
                      }
                      onClick={() =>
                        selectSampleQuestion(
                          sample
                        )
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-blue-500 hover:text-white"
                    >
                      {
                        sample
                      }
                    </button>
                  )
                )}

              </div>

            </div>

          </div>

        </section>

        {/* TOP METRICS */}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <MetricCard
            icon={
              <Package className="h-5 w-5" />
            }
            label="Detected Product"
            value={
              analysis.product
                ?.name ||
              "Waiting for question"
            }
          />

          <MetricCard
            icon={
              <Globe2 className="h-5 w-5" />
            }
            label="Trade Route"
            value={
              analysis.sourceCountry
                ? `${analysis.sourceCountry} → ${analysis.destinationCountry}`
                : `${analysis.destinationCountry} → source unavailable`
            }
          />

          <MetricCard
            icon={
              <Activity className="h-5 w-5" />
            }
            label="Modeled Tariff"
            value={`${appliedScenario}%`}
          />

          <MetricCard
            icon={
              <ShieldCheck className="h-5 w-5" />
            }
            label="Impact Level"
            value={
              analysis.impactLevel
            }
          />

        </section>

        {/* MAIN CONTENT */}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">

          {/* LEFT */}

          <div className="min-w-0">

            {/* GRAPH */}

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

              <div className="border-b border-slate-800 p-5">

                <div className="flex flex-col gap-4">

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                    <div>

                      <div className="flex items-center gap-2">

                        <Activity className="h-5 w-5 text-blue-400" />

                        <h2 className="font-semibold">
                          Trade Impact Graph
                        </h2>

                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Drag nodes · Click nodes · Zoom · Pan · Explore relationships
                      </p>

                    </div>

                    <div className="flex flex-wrap gap-2">

                      {selectedNode && (
                        <button
                          onClick={() =>
                            setHighlightPath(
                              !highlightPath
                            )
                          }
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                            highlightPath
                              ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                              : "border-slate-700 bg-slate-950 text-slate-400 hover:border-blue-500 hover:text-white"
                          }`}
                        >

                          <Route className="h-3.5 w-3.5" />

                          Reasoning path

                        </button>
                      )}

                      <button
                        onClick={
                          resetGraphLayout
                        }
                        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-400 transition hover:border-blue-500 hover:text-white"
                      >

                        <RotateCcw className="h-3.5 w-3.5" />

                        Reset layout

                      </button>

                    </div>

                  </div>

                  {/* GRAPH EXPLORER */}

                  <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">

                    <div className="relative">

                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />

                      <input
                        value={
                          graphSearch
                        }
                        onChange={(
                          event
                        ) =>
                          setGraphSearch(
                            event.target
                              .value
                          )
                        }
                        placeholder="Search graph nodes..."
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-slate-300 outline-none transition focus:border-blue-500"
                      />

                    </div>

                    <div className="relative">

                      <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />

                      <select
                        value={
                          graphFilter
                        }
                        onChange={(
                          event
                        ) =>
                          setGraphFilter(
                            event.target
                              .value
                          )
                        }
                        className="w-full appearance-none rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-slate-300 outline-none focus:border-blue-500"
                      >

                        <option value="All">
                          All node types
                        </option>

                        <option value="Country">
                          Country
                        </option>

                        <option value="Product">
                          Product
                        </option>

                        <option value="Tariff">
                          Tariff
                        </option>

                        <option value="Impact">
                          Impact
                        </option>

                        <option value="Manufacturer">
                          Manufacturer
                        </option>

                        <option value="Industry">
                          Industry
                        </option>

                      </select>

                    </div>

                    <button
                      onClick={
                        resetGraphExplorer
                      }
                      className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-slate-500 transition hover:border-slate-600 hover:text-white"
                    >
                      Clear filters
                    </button>

                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">

                    <span className="text-slate-600">
                      Filter:
                    </span>

                    <span className="rounded-full border border-slate-800 bg-slate-950 px-2 py-1 text-slate-500">
                      {
                        graphFilter
                      }
                    </span>

                    {graphSearch && (
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-blue-300">
                        Search: {
                          graphSearch
                        }
                      </span>
                    )}

                    {highlightPath && (
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-blue-300">
                        Reasoning path active
                      </span>
                    )}

                  </div>

                </div>

              </div>

              <div className="h-[680px]">

                <ReactFlow
                  nodes={
                    filteredNodes
                  }
                  edges={
                    filteredEdges
                  }
                  nodeTypes={
                    nodeTypes
                  }
                  onNodesChange={
                    onNodesChange
                  }
                  onEdgesChange={
                    onEdgesChange
                  }
                  onNodeClick={(
                    _event,
                    node
                  ) => {
                    setSelectedNodeId(
                      node.id
                    );
                  }}
                  nodesDraggable={
                    true
                  }
                  nodesConnectable={
                    false
                  }
                  elementsSelectable={
                    true
                  }
                  panOnDrag={
                    true
                  }
                  panOnScroll={
                    true
                  }
                  zoomOnScroll={
                    true
                  }
                  zoomOnPinch={
                    true
                  }
                  minZoom={
                    0.2
                  }
                  maxZoom={
                    1.7
                  }
                  fitView
                  fitViewOptions={{
                    padding:
                      0.15,
                  }}
                >

                  <Background
                    gap={24}
                    size={1}
                  />

                  <Controls />

                  <MiniMap
                    nodeColor="#3b82f6"
                    maskColor="rgba(2,6,23,0.72)"
                  />

                </ReactFlow>

              </div>

            </div>

            {/* FOUR CARDS */}

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

              {bottomCards.map(
                (
                  card
                ) => (
                  <LargeInfoCard
                    key={
                      card.title
                    }
                    icon={
                      card.icon
                    }
                    title={
                      card.title
                    }
                    value={
                      card.value
                    }
                    label={
                      card.label
                    }
                    description={
                      card.description
                    }
                  />
                )
              )}

            </section>

            {/* TABS */}

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

              <div className="flex flex-wrap border-b border-slate-800">

                {tabs.map(
                  (tab) => (
                    <button
                      key={
                        tab
                      }
                      onClick={() =>
                        setActiveTab(
                          tab
                        )
                      }
                      className={`border-b-2 px-5 py-4 text-sm font-medium transition ${
                        activeTab ===
                        tab
                          ? "border-blue-500 text-white"
                          : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {
                        tab
                      }
                    </button>
                  )
                )}

              </div>

              <div className="p-5">

                {/* SOURCES */}

                {activeTab ===
                  "Sources" && (
                  <div className="space-y-4">

                    <div>

                      <div className="flex items-center gap-2">

                        <FileText className="h-5 w-5 text-blue-400" />

                        <h3 className="font-semibold">
                          Evidence & Sources
                        </h3>

                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Prototype records supporting the current analysis.
                      </p>

                    </div>

                    {evidence.map(
                      (
                        item
                      ) => (
                        <div
                          key={
                            item.title
                          }
                          className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                        >

                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">

                            <div>

                              <div className="flex items-center gap-2">

                                <CheckCircle2 className="h-4 w-4 text-blue-400" />

                                <h4 className="font-medium">
                                  {
                                    item.title
                                  }
                                </h4>

                              </div>

                              <p className="mt-2 text-sm text-slate-300">
                                {
                                  item.detail
                                }
                              </p>

                            </div>

                            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                              DEMO
                            </div>

                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">

                            <EvidenceMini
                              label="SOURCE"
                              value={
                                item.source
                              }
                            />

                            <EvidenceMini
                              label="DATA DATE"
                              value={
                                item.date
                              }
                            />

                            <EvidenceMini
                              label="REFERENCE"
                              value={
                                item.reference
                              }
                            />

                          </div>

                          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs leading-5 text-slate-500">

                            <strong className="text-slate-300">
                              Supports:
                            </strong>{" "}

                            {
                              item.supports
                            }

                          </div>

                        </div>
                      )
                    )}

                  </div>
                )}

                {/* TRADE DATA */}

                {activeTab ===
                  "Trade Data" && (
                  <div className="space-y-5">

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <DataRow
                        label="Countries"
                        value={tradeDataset.countries.length}
                      />

                      <DataRow
                        label="Products"
                        value={tradeDataset.products.length}
                      />

                      <DataRow
                        label="Industries"
                        value={tradeDataset.industries.length}
                      />

                      <DataRow
                        label="Trade relationships"
                        value={tradeDataset.tradeRelationships.length}
                      />

                      <DataRow
                        label="Tariff scenarios"
                        value={tradeDataset.tariffScenarios.length}
                      />

                      <DataRow
                        label="Downstream relationships"
                        value={tradeDataset.downstreamRelationships.length}
                      />
                    </div>

                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <Route className="h-4 w-4 text-blue-400" />
                        <h3 className="text-sm font-semibold">Matched Trade Relationships</h3>
                      </div>

                      {analysis.tradeRelationships.length > 0 ? (
                        <div className="space-y-2">
                          {analysis.tradeRelationships.map((relationship) => (
                            <div
                              key={`${relationship.sourceCountry}-${relationship.destinationCountry}-${relationship.product}`}
                              className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-sm font-medium text-slate-200">
                                  {relationship.sourceCountry} → {relationship.destinationCountry}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {relationship.product}
                                </p>
                              </div>

                              <span className="w-fit rounded-md border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                                {relationship.relationship || "TRADE LINK"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-5 text-sm text-slate-500">
                          No trade relationship is resolved for the selected product and destination in the prototype dataset.
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <Database className="h-4 w-4 text-blue-400" />
                        <h3 className="text-sm font-semibold">Matched Tariff Scenario</h3>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <EvidenceMini
                            label="DESTINATION"
                            value={analysis.destinationCountry}
                          />
                          <EvidenceMini
                            label="PRODUCT"
                            value={analysis.product?.name || "Not detected"}
                          />
                          <EvidenceMini
                            label="BASELINE"
                            value={`${analysis.currentTariff}%`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-6 text-slate-400">
                      These records are prototype/demo data and should not be presented as official real-world statistics.
                    </div>

                  </div>
                )}

                {/* TIMELINE */}

                {activeTab ===
                  "Timeline" && (
                  <div className="space-y-6">

                    <div>

                      <div className="flex items-center gap-2">

                        <CalendarDays className="h-5 w-5 text-blue-400" />

                        <h3 className="font-semibold">
                          Trade Impact Timeline
                        </h3>

                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Follow the analytical flow from the user's question to the modeled scenario and potential impact.
                      </p>

                    </div>

                    <div className="overflow-x-auto pb-2">

                      <div className="min-w-[760px]">

                        <div className="relative">

                          <div className="absolute left-[7%] right-[7%] top-7 h-px bg-slate-700" />

                          <div className="relative grid grid-cols-4 gap-4">

                            {timelineStages.map(
                              (
                                stage
                              ) => (
                                <div
                                  key={
                                    stage.title
                                  }
                                  className="relative"
                                >

                                  <div className="flex flex-col items-center text-center">

                                    <div
                                      className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full border ${
                                        stage.active
                                          ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                                          : "border-slate-700 bg-slate-950 text-slate-600"
                                      }`}
                                    >
                                      {
                                        stage.icon
                                      }
                                    </div>

                                    <p className="mt-4 text-sm font-semibold text-slate-200">
                                      {
                                        stage.title
                                      }
                                    </p>

                                    <p className="mt-1 text-[11px] text-slate-500">
                                      {
                                        stage.subtitle
                                      }
                                    </p>

                                    <p
                                      className={`mt-3 text-lg font-bold ${
                                        stage.active
                                          ? "text-blue-400"
                                          : "text-slate-600"
                                      }`}
                                    >
                                      {
                                        stage.value
                                      }
                                    </p>

                                  </div>

                                </div>
                              )
                            )}

                          </div>

                        </div>

                      </div>

                    </div>

                    <div className="grid gap-4 md:grid-cols-3">

                      <TimelineMetric
                        icon={
                          <Database className="h-4 w-4" />
                        }
                        title="Baseline"
                        value={`${analysis.currentTariff}%`}
                        detail="Modeled current tariff"
                      />

                      <TimelineMetric
                        icon={
                          <TrendingUp className="h-4 w-4" />
                        }
                        title="Scenario"
                        value={`${appliedScenario}%`}
                        detail={
                          analysis.tariffChange ===
                          0
                            ? "No change"
                            : `${
                                analysis.tariffChange >
                                0
                                  ? "+"
                                  : ""
                              }${analysis.tariffChange} percentage points`
                        }
                        active
                      />

                      <TimelineMetric
                        icon={
                          <Activity className="h-4 w-4" />
                        }
                        title="Impact"
                        value={
                          analysis.impactLevel
                        }
                        detail={`${analysis.impactScore}/100 analytical indicator`}
                      />

                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">

                      <div className="mb-4 flex items-center gap-2">

                        <History className="h-4 w-4 text-blue-400" />

                        <h3 className="text-sm font-semibold">
                          Scenario History
                        </h3>

                      </div>

                      {scenarioHistory.length ===
                        0 && (
                        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900 p-5 text-center">

                          <p className="text-sm text-slate-400">
                            No scenario activity yet.
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            Analyze a question or apply a what-if scenario to populate the timeline.
                          </p>

                        </div>
                      )}

                      {scenarioHistory.length >
                        0 && (
                        <div className="space-y-3">

                          {scenarioHistory
                            .slice()
                            .reverse()
                            .map(
                              (
                                item
                              ) => (
                                <div
                                  key={
                                    item.id
                                  }
                                  className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3"
                                >

                                  <div
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                      item.type ===
                                      "SCENARIO"
                                        ? "bg-blue-500/10 text-blue-400"
                                        : item.type ===
                                          "RESET"
                                        ? "bg-violet-500/10 text-violet-400"
                                        : "bg-slate-800 text-slate-400"
                                    }`}
                                  >

                                    {item.type ===
                                    "SCENARIO" ? (
                                      <TrendingUp className="h-4 w-4" />
                                    ) : item.type ===
                                      "RESET" ? (
                                      <RotateCcw className="h-4 w-4" />
                                    ) : (
                                      <Sparkles className="h-4 w-4" />
                                    )}

                                  </div>

                                  <div className="min-w-0 flex-1">

                                    <p className="text-sm font-medium text-slate-300">
                                      {
                                        item.label
                                      }
                                    </p>

                                    <p className="mt-1 truncate text-xs text-slate-500">
                                      {
                                        item.detail
                                      }
                                    </p>

                                  </div>

                                  <div className="text-right">

                                    <p className="text-sm font-bold text-slate-200">
                                      {
                                        item.value
                                      }
                                    </p>

                                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
                                      {
                                        item.type
                                      }
                                    </p>

                                  </div>

                                </div>
                              )
                            )}

                        </div>
                      )}

                    </div>

                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">

                      <div className="flex items-start gap-3">

                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />

                        <p className="text-xs leading-6 text-slate-500">
                          Timeline values describe the application's modeled scenario. They should not be interpreted as a guaranteed prediction of actual market outcomes.
                        </p>

                      </div>

                    </div>

                  </div>
                )}

                {/* METHODOLOGY */}

                {activeTab ===
                  "Methodology" && (
                  <div className="space-y-5">

                    <MethodStep
                      number="01"
                      title="Natural-language parsing"
                      text="The user question is sent to the locally running IBM Granite model. A local parser remains available only if the local AI service is unavailable."
                    />

                    <MethodStep
                      number="02"
                      title="Entity validation"
                      text="AI-extracted country and product values are matched against the structured prototype trade-data layer before being used in the graph."
                    />

                    <MethodStep
                      number="03"
                      title="Trade-data resolution"
                      text="Validated entities are matched against trade relationships, tariff records and downstream relationships."
                    />

                    <MethodStep
                      number="04"
                      title="Knowledge-graph construction"
                      text="Resolved relationships become connected graph nodes and edges."
                    />

                    <MethodStep
                      number="05"
                      title="Impact reasoning"
                      text="The system models a pathway from tariff change to import-cost pressure, manufacturers and downstream relationships."
                    />

                    <MethodStep
                      number="06"
                      title="Explainability"
                      text="Facts, inferences and possibilities are separated so users can distinguish data-backed relationships from analytical reasoning."
                    />

                    <MethodStep
                      number="07"
                      title="Scenario analysis"
                      text="The what-if slider changes the modeled scenario. User-entered tariff percentages are preserved; otherwise the scenario begins at the modeled baseline."
                    />

                    <MethodStep
                      number="08"
                      title="Graph exploration"
                      text="Users can search graph nodes, filter node types, inspect nodes and highlight reasoning paths."
                    />

                    <MethodStep
                      number="09"
                      title="Timeline tracking"
                      text="Question, baseline, scenario and impact stages are shown in the analytical timeline."
                    />

                  </div>
                )}

              </div>

            </div>

          </div>

          {/* RIGHT SIDEBAR */}

          <aside className="space-y-6">

            {/* ENTITY EXTRACTION */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

              <div className="mb-4 flex items-center gap-2">

                <Sparkles className="h-5 w-5 text-blue-400" />

                <div>

                  <h2 className="font-semibold">
                    Detected Entities
                  </h2>

                  <p className="text-xs text-slate-500">
                    IBM Granite + trade-data validation
                  </p>

                </div>

              </div>

              <div className="space-y-3">

                {entityRows.map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item.label
                      }
                      className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950 px-3 py-3"
                    >

                      <span className="text-xs uppercase tracking-wider text-slate-500">
                        {
                          item.label
                        }
                      </span>

                      <span className="max-w-[220px] truncate text-right text-sm font-medium text-slate-200">
                        {
                          item.value
                        }
                      </span>

                    </div>
                  )
                )}

              </div>

              {analysis.aiIntent && (
                <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                    Detected Intent
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {
                      analysis.aiIntent
                    }
                  </p>

                </div>
              )}

            </div>

            {/* AI ANALYSIS */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

              <div className="mb-4 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <BrainCircuit className="h-5 w-5 text-blue-400" />

                  <h2 className="font-semibold">
                    AI Analysis
                  </h2>

                </div>

                <span
                  className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
                    aiStatus ===
                    "CONNECTED"
                      ? "border border-blue-500/20 bg-blue-500/5 text-blue-300"
                      : "border border-slate-700 bg-slate-950 text-slate-500"
                  }`}
                >
                  {
                    aiStatusText
                  }
                </span>

              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">

                <p className="text-sm leading-7 text-slate-300">
                  {
                    impactExplanation
                  }
                </p>

              </div>

              <div className="mt-4 space-y-3">

                <Classification
                  type="FACT"
                  text={
                    analysis.aiFact ||
                    (
                      analysis.sourceCountry
                        ? `${analysis.sourceCountry} → ${analysis.destinationCountry} is represented in the prototype trade dataset.`
                        : "A specific source-country relationship is not currently resolved."
                    )
                  }
                />

                <Classification
                  type="INFERENCE"
                  text={
                    analysis.aiInference ||
                    `The modeled tariff change is ${analysis.tariffChange >= 0 ? "+" : ""}${analysis.tariffChange} percentage points from the baseline.`
                  }
                />

                <Classification
                  type="POSSIBILITY"
                  text={
                    analysis.aiPossibility ||
                    "Higher input costs could create downstream price pressure, depending on supplier alternatives, inventory, demand and other market conditions."
                  }
                />

              </div>

            </div>

            {/* NODE DETAILS */}

            <motion.div
              layout
              className={`rounded-2xl border p-5 ${
                selectedNode
                  ? "border-blue-500/30 bg-slate-900"
                  : "border-slate-800 bg-slate-900"
              }`}
            >

              <div className="mb-4 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <Info className="h-5 w-5 text-blue-400" />

                  <div>

                    <h2 className="font-semibold">
                      Node Details
                    </h2>

                    <p className="text-xs text-slate-500">
                      Interactive graph inspector
                    </p>

                  </div>

                </div>

                {selectedNode && (
                  <button
                    onClick={() =>
                      setSelectedNodeId(
                        null
                      )
                    }
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                    title="Close details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

              </div>

              {!selectedNode && (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center">

                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">

                    <Info className="h-6 w-6" />

                  </div>

                  <p className="mt-4 font-medium text-slate-300">
                    Select a graph node
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Click any country, product, tariff, impact or industry node to inspect its data, relationships and reasoning.
                  </p>

                </div>
              )}

              {selectedNode && (
                <NodeDetailsContent
                  node={
                    selectedNode
                  }
                  analysis={
                    analysis
                  }
                />
              )}

            </motion.div>

            {/* WHAT IF */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

              <div className="mb-5 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <SlidersHorizontal className="h-5 w-5 text-blue-400" />

                  <div>

                    <h2 className="font-semibold">
                      What-If Simulator
                    </h2>

                    <p className="text-xs text-slate-500">
                      Scenario analysis
                    </p>

                  </div>

                </div>

                <button
                  onClick={
                    resetScenario
                  }
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                  title="Reset scenario"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">

                <div className="mb-5 grid grid-cols-2 gap-3">

                  <ScenarioValue
                    label="Current"
                    value={`${analysis.currentTariff}%`}
                  />

                  <ScenarioValue
                    label="Scenario"
                    value={`${scenarioTariff}%`}
                    blue
                  />

                </div>

                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={
                    scenarioTariff
                  }
                  onChange={(
                    event
                  ) =>
                    setScenarioTariff(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  className="w-full accent-blue-500"
                />

                <div className="mt-2 flex justify-between text-xs text-slate-600">

                  <span>
                    0%
                  </span>

                  <span>
                    25%
                  </span>

                  <span>
                    50%
                  </span>

                </div>

                <button
                  onClick={
                    applyScenario
                  }
                  className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold transition hover:bg-blue-500"
                >
                  Apply Scenario
                </button>

                <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-slate-500">

                  <div className="mb-1 flex items-center gap-2 text-amber-300">

                    <Info className="h-3.5 w-3.5" />

                    Scenario only

                  </div>

                  This analysis describes potential effects. It does not guarantee an actual market outcome.

                </div>

              </div>

            </div>

            {/* QUICK TIMELINE */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

              <div className="mb-4 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <Clock3 className="h-5 w-5 text-blue-400" />

                  <div>

                    <h2 className="font-semibold">
                      Analysis Timeline
                    </h2>

                    <p className="text-xs text-slate-500">
                      Current scenario state
                    </p>

                  </div>

                </div>

                <button
                  onClick={() =>
                    setActiveTab(
                      "Timeline"
                    )
                  }
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Open
                </button>

              </div>

              <div className="space-y-3">

                <QuickTimelineItem
                  title="Question"
                  value={
                    analysis.year
                  }
                  active={
                    Boolean(
                      analyzedQuestion
                    )
                  }
                />

                <QuickTimelineItem
                  title="Baseline"
                  value={`${analysis.currentTariff}%`}
                  active={
                    Boolean(
                      analysis.product
                    )
                  }
                />

                <QuickTimelineItem
                  title="Scenario"
                  value={`${appliedScenario}%`}
                  active={
                    Boolean(
                      analysis.product
                    )
                  }
                />

                <QuickTimelineItem
                  title="Impact"
                  value={
                    analysis.impactLevel
                  }
                  active={
                    Boolean(
                      analysis.product
                    )
                  }
                />

              </div>

            </div>

            {/* RESOLUTION */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

              <div className="mb-4 flex items-center gap-2">

                <Clock3 className="h-5 w-5 text-blue-400" />

                <h2 className="font-semibold">
                  Current Resolution
                </h2>

              </div>

              <div className="space-y-3">

                <ResolutionRow
                  label="Product"
                  value={
                    analysis.product
                      ?.name ||
                    "Not detected"
                  }
                />

                <ResolutionRow
                  label="Destination"
                  value={
                    analysis.destinationCountry
                  }
                />

                <ResolutionRow
                  label="Source"
                  value={
                    analysis.sourceCountry ||
                    "Not detected"
                  }
                />

                <ResolutionRow
                  label="Industry"
                  value={
                    analysis.product
                      ?.industry ||
                    "Not detected"
                  }
                />

                <ResolutionRow
                  label="Data status"
                  value={
                    analysis.dataSourceStatus
                  }
                />

              </div>

            </div>

          </aside>

        </section>

        {/* FOOTER */}

        <footer className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">

          <div className="flex flex-col gap-3 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <span className="font-medium text-slate-200">
                TariffGraph AI
              </span>

              {" "}· Prototype Trade Intelligence Platform

            </div>

            <div className="flex items-center gap-2 text-xs">

              <BrainCircuit className="h-4 w-4" />

              IBM AI + Trade Data + Knowledge Graph

            </div>

          </div>

        </footer>

      </main>

    </div>
  );
}

/* =========================================================
   NODE DETAILS
========================================================= */

function NodeDetailsContent({
  node,
  analysis,
}) {
  const details =
    getDetailedNodeData(
      node.id,
      analysis
    );

  const reasoningPath =
    getReasoningPath(
      node.id,
      analysis
    );

  return (
    <div className="space-y-4">

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">

            {renderNodeIcon(
              node.data?.icon
            )}

          </div>

          <div className="min-w-0">

            <p className="break-words text-base font-semibold text-slate-100">
              {
                node.data?.label
              }
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {
                node.data?.subtitle
              }
            </p>

          </div>

        </div>

      </div>

      <div className="grid grid-cols-2 gap-3">

        <DetailBox
          label="NODE TYPE"
          value={
            node.data?.nodeType ||
            getNodeType(
              node.id
            )
          }
        />

        <DetailBox
          label="DATA STATUS"
          value="DEMO"
        />

      </div>

      <DetailSection
        title="Data"
        icon={
          <Database className="h-4 w-4" />
        }
      >

        <div className="space-y-2">

          {details.data.map(
            (item) => (
              <NodeDetailRow
                key={
                  item.label
                }
                label={
                  item.label
                }
                value={
                  item.value
                }
              />
            )
          )}

        </div>

      </DetailSection>

      <DetailSection
        title="Relationships"
        icon={
          <Activity className="h-4 w-4" />
        }
      >

        <div className="space-y-2">

          {details.relationships.map(
            (item, index) => (
              <div
                key={`${item}-${index}`}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3"
              >

                <p className="text-xs leading-5 text-slate-400">
                  {item}
                </p>

              </div>
            )
          )}

        </div>

      </DetailSection>

      <DetailSection
        title="Reasoning Path"
        icon={
          <Route className="h-4 w-4" />
        }
      >

        <div className="space-y-2">

          {reasoningPath.map(
            (
              item,
              index
            ) => (
              <div
                key={`${item}-${index}`}
                className="flex items-center gap-2"
              >

                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-bold text-blue-400">
                  {index +
                    1}
                </div>

                <p className="flex-1 break-words text-xs text-slate-400">
                  {item}
                </p>

                {index <
                  reasoningPath.length -
                    1 && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-700" />
                )}

              </div>
            )
          )}

        </div>

      </DetailSection>

      <DetailSection
        title="Explanation"
        icon={
          <Sparkles className="h-4 w-4" />
        }
      >

        <p className="text-sm leading-6 text-slate-400">
          {
            getNodeExplanation(
              node.id,
              analysis
            )
          }
        </p>

      </DetailSection>

      {analysis.aiSummary && (
        <DetailSection
          title="IBM AI Insight"
          icon={
            <BrainCircuit className="h-4 w-4" />
          }
        >

          <p className="text-sm leading-6 text-slate-400">
            {
              analysis.aiSummary
            }
          </p>

        </DetailSection>
      )}

      <DetailSection
        title="Supporting Source"
        icon={
          <FileText className="h-4 w-4" />
        }
      >

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">

          <p className="text-sm font-medium text-slate-300">
            TariffGraph Prototype Dataset
          </p>

          <p className="mt-1 text-xs text-slate-500">
            src/data/tradeData.js
          </p>

          <div className="mt-3 rounded-lg bg-slate-900 p-3 text-xs leading-5 text-slate-500">

            The structured dataset supports the prototype relationship or baseline value displayed for this node.

          </div>

        </div>

      </DetailSection>

      <div className="flex items-center justify-between border-t border-slate-800 pt-3">

        <span className="text-[10px] uppercase tracking-wider text-slate-600">
          Node ID
        </span>

        <span className="font-mono text-[11px] text-slate-500">
          {node.id}
        </span>

      </div>

    </div>
  );
}

/* =========================================================
   NODE DATA
========================================================= */

function getDetailedNodeData(
  nodeId,
  analysis
) {
  const productName =
    analysis.product
      ?.name ||
    "Selected product";

  const source =
    analysis.sourceCountry ||
    "Source unavailable";

  const destination =
    analysis.destinationCountry ||
    "India";

  const downstreamIndustries =
    analysis.downstreamRelationships.map(
      (item) =>
        item.industry
    );

  switch (nodeId) {
    case "source-country":
      return {
        data: [
          {
            label:
              "Country",
            value:
              source,
          },

          {
            label:
              "Trade direction",
            value:
              `${source} → ${destination}`,
          },

          {
            label:
              "Product",
            value:
              productName,
          },
        ],

        relationships:
          analysis.sourceCountry
            ? [
                `${source} EXPORTS_TO ${destination}`,
                `${source} → ${productName}`,
              ]
            : [
                "No specific export source resolved",
              ],
      };

    case "product":
      return {
        data: [
          {
            label:
              "Product",
            value:
              productName,
          },

          {
            label:
              "Industry",
            value:
              analysis.product
                ?.industry ||
              "Not available",
          },

          {
            label:
              "Trade links",
            value:
              `${analysis.tradeRelationships.length}`,
          },
        ],

        relationships:
          analysis.tradeRelationships
            .length
            ? analysis.tradeRelationships.map(
                (
                  relationship
                ) =>
                  `${relationship.sourceCountry} → ${relationship.destinationCountry}`
              )
            : [
                "No trade relationships found",
              ],
      };

    case "tariff":
      return {
        data: [
          {
            label:
              "Destination",
            value:
              destination,
          },

          {
            label:
              "Baseline tariff",
            value:
              `${analysis.currentTariff}%`,
          },

          {
            label:
              "Scenario tariff",
            value:
              `${analysis.tariffForAnalysis}%`,
          },

          {
            label:
              "Scenario delta",
            value:
              `${
                analysis.tariffChange >=
                0
                  ? "+"
                  : ""
              }${analysis.tariffChange} pp`,
          },
        ],

        relationships: [
          `SUBJECT_TO → ${productName}`,
          `INFLUENCES → Import Cost Pressure`,
          `Scenario year → ${analysis.year}`,
        ],
      };

    case "import-cost":
      return {
        data: [
          {
            label:
              "Tariff scenario",
            value:
              `${analysis.tariffForAnalysis}%`,
          },

          {
            label:
              "Change",
            value:
              `${
                analysis.tariffChange >=
                0
                  ? "+"
                  : ""
              }${analysis.tariffChange} pp`,
          },

          {
            label:
              "Classification",
            value:
              "Inference",
          },
        ],

        relationships: [
          "Tariff → Import Cost Pressure",
          "Import Cost Pressure → Manufacturer",
        ],
      };

    case "manufacturer":
      return {
        data: [
          {
            label:
              "Input product",
            value:
              productName,
          },

          {
            label:
              "Potential pressure",
            value:
              "Input cost",
          },

          {
            label:
              "Downstream links",
            value:
              `${downstreamIndustries.length}`,
          },
        ],

        relationships: [
          "Receives input-cost pressure",
          "→ Possible Price Pressure",
          `→ ${
            downstreamIndustries.join(
              ", "
            ) ||
            "Downstream Industry"
          }`,
        ],
      };

    case "price-pressure":
      return {
        data: [
          {
            label:
              "Classification",
            value:
              "Possibility",
          },

          {
            label:
              "Driver",
            value:
              "Input cost pressure",
          },

          {
            label:
              "Guarantee",
            value:
              "None",
          },
        ],

        relationships: [
          "Manufacturer → POSSIBLE → Price Pressure",
          "Outcome depends on market conditions",
        ],
      };

    case "downstream":
      return {
        data: [
          {
            label:
              "Industry",
            value:
              analysis
                .downstreamRelationships[0]
                ?.industry ||
              analysis.product
                ?.industry ||
              "Industry",
          },

          {
            label:
              "Product input",
            value:
              productName,
          },

          {
            label:
              "Relationship",
            value:
              "USED_BY",
          },
        ],

        relationships: [
          `${productName} USED_BY downstream industry`,
          "Manufacturer → Downstream Industry",
        ],
      };

    default:
      return {
        data: [
          {
            label:
              "Status",
            value:
              "DEMO",
          },
        ],

        relationships: [
          "Part of the trade-impact graph",
        ],
      };
  }
}

/* =========================================================
   COMPONENTS
========================================================= */

function StatusBadge({
  icon,
  text,
  amber = false,
  connected = false,
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
        amber
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : connected
          ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
          : "border-slate-700 bg-slate-900 text-slate-400"
      }`}
    >
      {icon}

      {text}

    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">

      <div className="mb-3 flex items-center gap-2 text-slate-500">

        {icon}

        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>

      </div>

      <p className="truncate text-lg font-semibold text-slate-100">
        {value}
      </p>

    </div>
  );
}

function LargeInfoCard({
  icon,
  title,
  value,
  label,
  description,
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700">

      <div className="mb-4 flex items-center justify-between">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
          {icon}
        </div>

        <ChevronRight className="h-4 w-4 text-slate-700" />

      </div>

      <p className="text-2xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <h3 className="mt-4 font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>

    </div>
  );
}

function EvidenceMini({
  label,
  value,
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">

      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </p>

      <p className="mt-1 break-words text-xs text-slate-400">
        {value}
      </p>

    </div>
  );
}

function DataRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">

      <span className="text-sm text-slate-400">
        {label}
      </span>

      <span className="font-semibold text-slate-200">
        {value}
      </span>

    </div>
  );
}

function TimelineMetric({
  icon,
  title,
  value,
  detail,
  active = false,
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active
          ? "border-blue-500/20 bg-blue-500/5"
          : "border-slate-800 bg-slate-950"
      }`}
    >

      <div className="flex items-center gap-2">

        <span className="text-blue-400">
          {icon}
        </span>

        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>

      </div>

      <p className="mt-3 text-2xl font-bold text-slate-100">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {detail}
      </p>

    </div>
  );
}

function QuickTimelineItem({
  title,
  value,
  active,
}) {
  return (
    <div className="flex items-center gap-3">

      <div
        className={`h-2 w-2 rounded-full ${
          active
            ? "bg-blue-500"
            : "bg-slate-700"
        }`}
      />

      <div className="flex-1">

        <p className="text-xs font-medium text-slate-400">
          {title}
        </p>

      </div>

      <p
        className={`text-xs font-semibold ${
          active
            ? "text-slate-200"
            : "text-slate-600"
        }`}
      >
        {value}
      </p>

    </div>
  );
}

function ScenarioValue({
  label,
  value,
  blue = false,
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">

      <p className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 text-xl font-bold ${
          blue
            ? "text-blue-400"
            : "text-slate-100"
        }`}
      >
        {value}
      </p>

    </div>
  );
}

function TimelineRow({
  label,
  title,
  detail,
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4">

      <div className="w-20 text-xs font-semibold uppercase tracking-wider text-blue-400">
        {label}
      </div>

      <div className="h-2 w-2 rounded-full bg-blue-500" />

      <div className="flex-1">

        <p className="font-medium">
          {title}
        </p>

      </div>

      <div className="text-sm font-semibold text-slate-300">
        {detail}
      </div>

    </div>
  );
}

function MethodStep({
  number,
  title,
  text,
}) {
  return (
    <div className="flex gap-4">

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-xs font-bold text-blue-400">
        {number}
      </div>

      <div>

        <h3 className="font-semibold text-slate-200">
          {title}
        </h3>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          {text}
        </p>

      </div>

    </div>
  );
}

function Classification({
  type,
  text,
}) {
  const styles = {
    FACT:
      "border-blue-500/20 bg-blue-500/5 text-blue-300",

    INFERENCE:
      "border-violet-500/20 bg-violet-500/5 text-violet-300",

    POSSIBILITY:
      "border-amber-500/20 bg-amber-500/5 text-amber-300",
  };

  return (
    <div
      className={`rounded-xl border p-3 ${styles[type]}`}
    >

      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest">
        {type}
      </div>

      <p className="text-xs leading-5">
        {text}
      </p>

    </div>
  );
}

function NodeDetailRow({
  label,
  value,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-2 last:border-0 last:pb-0">

      <span className="text-xs text-slate-600">
        {label}
      </span>

      <span className="max-w-[210px] break-words text-right text-xs font-medium text-slate-400">
        {value}
      </span>

    </div>
  );
}

function DetailBox({
  label,
  value,
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">

      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
        {label}
      </p>

      <p className="mt-2 break-words text-xs font-medium text-slate-300">
        {value}
      </p>

    </div>
  );
}

function DetailSection({
  title,
  icon,
  children,
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">

      <div className="mb-3 flex items-center gap-2 text-slate-300">

        <span className="text-blue-400">
          {icon}
        </span>

        <h3 className="text-xs font-semibold uppercase tracking-wider">
          {title}
        </h3>

      </div>

      {children}

    </div>
  );
}

function ResolutionRow({
  label,
  value,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3 last:border-0 last:pb-0">

      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="max-w-[220px] break-words text-right text-sm font-medium text-slate-300">
        {value}
      </span>

    </div>
  );
}

export default App;