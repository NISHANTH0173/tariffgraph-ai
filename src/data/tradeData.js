/*
  TariffGraph AI
  ----------------
  Prototype Trade Data Layer

  IMPORTANT:
  These records are DEMO / PROTOTYPE DATA.
  They are structured to demonstrate how the application's
  trade-data layer works.

  Do not present these records as official real-world statistics.
  Replace or enrich them with permitted official trade datasets
  before production use.
*/

export const tradeDataset = {
  countries: [
    {
      id: "india",
      name: "India",
      type: "Country",
    },
    {
      id: "taiwan",
      name: "Taiwan",
      type: "Country",
    },
    {
      id: "china",
      name: "China",
      type: "Country",
    },
    {
      id: "japan",
      name: "Japan",
      type: "Country",
    },
    {
      id: "united-states",
      name: "United States",
      type: "Country",
    },
    {
      id: "germany",
      name: "Germany",
      type: "Country",
    },
  ],

  products: [
    {
      id: "semiconductors",
      name: "Semiconductor Components",
      industry: "Electronics",
      type: "Product",
    },
    {
      id: "steel",
      name: "Steel",
      industry: "Construction & Manufacturing",
      type: "Product",
    },
    {
      id: "automotive",
      name: "Automotive Products",
      industry: "Automotive",
      type: "Product",
    },
    {
      id: "solar",
      name: "Solar Components",
      industry: "Renewable Energy",
      type: "Product",
    },
    {
      id: "batteries",
      name: "Batteries",
      industry: "Energy Storage",
      type: "Product",
    },
  ],

  industries: [
    {
      id: "electronics",
      name: "Electronics",
      type: "Industry",
    },
    {
      id: "construction-manufacturing",
      name: "Construction & Manufacturing",
      type: "Industry",
    },
    {
      id: "automotive",
      name: "Automotive",
      type: "Industry",
    },
    {
      id: "renewable-energy",
      name: "Renewable Energy",
      type: "Industry",
    },
    {
      id: "energy-storage",
      name: "Energy Storage",
      type: "Industry",
    },
  ],

  tradeRelationships: [
    {
      id: "trade-001",
      sourceCountry: "Taiwan",
      destinationCountry: "India",
      product: "Semiconductor Components",
      relationship: "EXPORTS_TO",
      dataStatus: "DEMO",
    },

    {
      id: "trade-002",
      sourceCountry: "China",
      destinationCountry: "India",
      product: "Steel",
      relationship: "EXPORTS_TO",
      dataStatus: "DEMO",
    },

    {
      id: "trade-003",
      sourceCountry: "Japan",
      destinationCountry: "India",
      product: "Automotive Products",
      relationship: "EXPORTS_TO",
      dataStatus: "DEMO",
    },

    {
      id: "trade-004",
      sourceCountry: "China",
      destinationCountry: "India",
      product: "Solar Components",
      relationship: "EXPORTS_TO",
      dataStatus: "DEMO",
    },

    {
      id: "trade-005",
      sourceCountry: "Japan",
      destinationCountry: "India",
      product: "Batteries",
      relationship: "EXPORTS_TO",
      dataStatus: "DEMO",
    },

    {
      id: "trade-006",
      sourceCountry: "United States",
      destinationCountry: "India",
      product: "Semiconductor Components",
      relationship: "EXPORTS_TO",
      dataStatus: "DEMO",
    },

    {
      id: "trade-007",
      sourceCountry: "Germany",
      destinationCountry: "India",
      product: "Automotive Products",
      relationship: "EXPORTS_TO",
      dataStatus: "DEMO",
    },
  ],

  tariffScenarios: [
    {
      id: "tariff-001",
      country: "India",
      product: "Semiconductor Components",
      currentRate: 10,
      unit: "%",
      dataStatus: "DEMO",
    },

    {
      id: "tariff-002",
      country: "India",
      product: "Steel",
      currentRate: 10,
      unit: "%",
      dataStatus: "DEMO",
    },

    {
      id: "tariff-003",
      country: "India",
      product: "Automotive Products",
      currentRate: 12,
      unit: "%",
      dataStatus: "DEMO",
    },

    {
      id: "tariff-004",
      country: "India",
      product: "Solar Components",
      currentRate: 8,
      unit: "%",
      dataStatus: "DEMO",
    },

    {
      id: "tariff-005",
      country: "India",
      product: "Batteries",
      currentRate: 9,
      unit: "%",
      dataStatus: "DEMO",
    },
  ],

  downstreamRelationships: [
    {
      product: "Semiconductor Components",
      industry: "Electronics",
      relationship: "USED_BY",
    },

    {
      product: "Steel",
      industry: "Construction & Manufacturing",
      relationship: "USED_BY",
    },

    {
      product: "Automotive Products",
      industry: "Automotive",
      relationship: "USED_BY",
    },

    {
      product: "Solar Components",
      industry: "Renewable Energy",
      relationship: "USED_BY",
    },

    {
      product: "Batteries",
      industry: "Energy Storage",
      relationship: "USED_BY",
    },
  ],
};

/*
  Find a product in the dataset.
*/
export function findProduct(productName) {
  if (!productName) {
    return null;
  }

  return (
    tradeDataset.products.find(
      (product) =>
        product.name.toLowerCase() ===
        productName.toLowerCase()
    ) || null
  );
}

/*
  Find the tariff scenario for a country + product.
*/
export function findTariffScenario(
  countryName,
  productName
) {
  if (!countryName || !productName) {
    return null;
  }

  return (
    tradeDataset.tariffScenarios.find(
      (scenario) =>
        scenario.country.toLowerCase() ===
          countryName.toLowerCase() &&
        scenario.product.toLowerCase() ===
          productName.toLowerCase()
    ) || null
  );
}

/*
  Find trade relationships involving a product.
*/
export function findTradeRelationships(productName) {
  if (!productName) {
    return [];
  }

  return tradeDataset.tradeRelationships.filter(
    (relationship) =>
      relationship.product.toLowerCase() ===
      productName.toLowerCase()
  );
}

/*
  Find downstream industries for a product.
*/
export function findDownstreamIndustries(productName) {
  if (!productName) {
    return [];
  }

  return tradeDataset.downstreamRelationships.filter(
    (relationship) =>
      relationship.product.toLowerCase() ===
      productName.toLowerCase()
  );
}