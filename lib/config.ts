const configuredGasApiUrl =
  process.env.GAS_API_URL || process.env.NEXT_PUBLIC_GAS_API_URL || "";

export const GAS_API_URL = configuredGasApiUrl.replace(/^hhttps:\/\//, "https://");
