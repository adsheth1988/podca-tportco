// Top 10 holdings per ETF — update quarterly from fund fact sheets.
// Sources: SPDR (SPY), Invesco (QQQM), iShares (SOXX, IWM), Roundhill (MEME)

export interface ETFHolding {
  ticker: string;
  name: string;
  weight: number;
}

export interface ETFInfo {
  fullName: string;
  holdings: ETFHolding[];
}

export const ETF_HOLDINGS: Record<string, ETFInfo> = {
  SPY: {
    fullName: "SPDR S&P 500 ETF Trust",
    holdings: [
      { ticker: "AAPL",  name: "Apple Inc.",            weight: 7.18 },
      { ticker: "MSFT",  name: "Microsoft Corp.",       weight: 6.55 },
      { ticker: "NVDA",  name: "NVIDIA Corp.",          weight: 6.08 },
      { ticker: "AMZN",  name: "Amazon.com Inc.",       weight: 3.78 },
      { ticker: "META",  name: "Meta Platforms",        weight: 2.82 },
      { ticker: "GOOGL", name: "Alphabet (Google)",      weight: 4.27 },
      { ticker: "TSLA",  name: "Tesla Inc.",            weight: 1.82 },
      { ticker: "AVGO",  name: "Broadcom Inc.",         weight: 1.74 },
      { ticker: "BRK.B", name: "Berkshire Hathaway B",  weight: 1.65 },
    ],
  },
  QQQM: {
    fullName: "Invesco Nasdaq-100 ETF",
    holdings: [
      { ticker: "AAPL",  name: "Apple Inc.",            weight: 8.97 },
      { ticker: "MSFT",  name: "Microsoft Corp.",       weight: 8.42 },
      { ticker: "NVDA",  name: "NVIDIA Corp.",          weight: 8.15 },
      { ticker: "AMZN",  name: "Amazon.com Inc.",       weight: 5.52 },
      { ticker: "AVGO",  name: "Broadcom Inc.",         weight: 4.61 },
      { ticker: "META",  name: "Meta Platforms",        weight: 4.48 },
      { ticker: "GOOGL", name: "Alphabet (Google)",      weight: 8.01 },
      { ticker: "TSLA",  name: "Tesla Inc.",            weight: 3.54 },
      { ticker: "COST",  name: "Costco Wholesale",      weight: 2.81 },
    ],
  },
  SOXX: {
    fullName: "iShares Semiconductor ETF",
    holdings: [
      { ticker: "NVDA",  name: "NVIDIA Corp.",          weight: 9.42 },
      { ticker: "AVGO",  name: "Broadcom Inc.",         weight: 9.18 },
      { ticker: "AMD",   name: "Advanced Micro Devices",weight: 5.82 },
      { ticker: "QCOM",  name: "Qualcomm Inc.",         weight: 5.12 },
      { ticker: "AMAT",  name: "Applied Materials",     weight: 4.85 },
      { ticker: "MU",    name: "Micron Technology",     weight: 4.52 },
      { ticker: "LRCX",  name: "Lam Research Corp.",   weight: 4.31 },
      { ticker: "KLAC",  name: "KLA Corp.",             weight: 4.18 },
      { ticker: "MRVL",  name: "Marvell Technology",   weight: 3.95 },
      { ticker: "TXN",   name: "Texas Instruments",     weight: 3.42 },
    ],
  },
  IWM: {
    fullName: "iShares Russell 2000 ETF",
    holdings: [
      { ticker: "SMCI",  name: "Super Micro Computer",  weight: 0.56 },
      { ticker: "DUOL",  name: "Duolingo Inc.",         weight: 0.48 },
      { ticker: "BOOT",  name: "Boot Barn Holdings",    weight: 0.43 },
      { ticker: "MEDP",  name: "Medpace Holdings",      weight: 0.41 },
      { ticker: "HLNE",  name: "Hamilton Lane Inc.",    weight: 0.39 },
      { ticker: "HQY",   name: "HealthEquity Inc.",     weight: 0.37 },
      { ticker: "ENSG",  name: "Ensign Group Inc.",     weight: 0.35 },
      { ticker: "MOD",   name: "Modine Manufacturing",  weight: 0.34 },
      { ticker: "STEP",  name: "StepStone Group",       weight: 0.33 },
      { ticker: "MGEE",  name: "MGE Energy Inc.",       weight: 0.31 },
    ],
  },
  MEME: {
    fullName: "Roundhill Meme ETF",
    holdings: [
      { ticker: "GME",   name: "GameStop Corp.",        weight: 5.82 },
      { ticker: "TSLA",  name: "Tesla Inc.",            weight: 5.21 },
      { ticker: "AMC",   name: "AMC Entertainment",     weight: 4.95 },
      { ticker: "PLTR",  name: "Palantir Technologies", weight: 4.74 },
      { ticker: "RIVN",  name: "Rivian Automotive",     weight: 4.51 },
      { ticker: "SOFI",  name: "SoFi Technologies",     weight: 4.22 },
      { ticker: "HOOD",  name: "Robinhood Markets",     weight: 4.05 },
      { ticker: "RBLX",  name: "Roblox Corp.",          weight: 3.82 },
      { ticker: "LCID",  name: "Lucid Group Inc.",      weight: 3.54 },
      { ticker: "BBAI",  name: "BigBear.ai Holdings",   weight: 3.31 },
    ],
  },
};
