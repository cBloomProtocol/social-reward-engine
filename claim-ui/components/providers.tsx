"use client";

import {
  CrossmintProvider,
  CrossmintAuthProvider,
  CrossmintWalletProvider,
} from "@crossmint/client-sdk-react-ui";

const CROSSMINT_API_KEY = process.env.NEXT_PUBLIC_CROSSMINT_API_KEY || "";
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "base";

// Map network to Crossmint chain
const getChain = (network: string) => {
  switch (network) {
    case "base":
      return "base-sepolia"; // Use testnet for staging
    case "solana":
      return "solana";
    default:
      return "base-sepolia";
  }
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CrossmintProvider apiKey={CROSSMINT_API_KEY}>
      <CrossmintAuthProvider
        loginMethods={["twitter", "email"]}
        authModalTitle="Sign in to Claim Reward"
        appearance={{
          borderRadius: "12px",
          colors: {
            background: "#1a1a1a",
            textPrimary: "#ffffff",
            textSecondary: "#a1a1aa",
            accent: "#000000",
            buttonBackground: "#000000",
            buttonText: "#ffffff",
            inputBackground: "#ffffff",
            inputText: "#000000",
          },
        }}
      >
        <CrossmintWalletProvider
          createOnLogin={{
            chain: getChain(NETWORK),
            signer: { type: "eoa" },
          }}
        >
          {children}
        </CrossmintWalletProvider>
      </CrossmintAuthProvider>
    </CrossmintProvider>
  );
}
